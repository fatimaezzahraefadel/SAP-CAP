'use strict';

const crypto = require('node:crypto');

// In production, this should be an environment variable.
const SIGNING_SECRET = process.env.URL_SIGNING_SECRET || 'dev-secret-key';
const ALGORITHM = 'sha256';

/**
 * Generate a signed URL for secure, temporary access to a resource.
 * @param {string} baseUrl - The base URL or path (e.g., '/odata/v4/project/download')
 * @param {object} params - Query parameters to include (e.g., fileId)
 * @param {number} expiresInSeconds - Time in seconds until the URL expires
 * @returns {string} The signed URL with ?expires=...&signature=...
 */
function generateSignedUrl(baseUrl, params = {}, expiresInSeconds = 3600) {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  
  const searchParams = new URLSearchParams(params);
  searchParams.set('expires', expires.toString());
  
  // Create the string to sign
  const stringToSign = `${baseUrl}?${searchParams.toString()}`;
  
  const signature = crypto
    .createHmac(ALGORITHM, SIGNING_SECRET)
    .update(stringToSign)
    .digest('hex');
    
  searchParams.set('signature', signature);
  
  return `${baseUrl}?${searchParams.toString()}`;
}

/**
 * Verify a signed URL to ensure it hasn't been tampered with and hasn't expired.
 * @param {string} urlPath - The base path of the request
 * @param {object} query - The parsed query object (req.query)
 * @returns {boolean} True if valid, false otherwise
 */
function verifySignedUrl(urlPath, query) {
  if (!query || !query.signature || !query.expires) {
    return false;
  }

  const { signature: providedSignature, expires, ...restParams } = query;

  // Check expiration
  if (Math.floor(Date.now() / 1000) > parseInt(expires, 10)) {
    return false;
  }

  // Reconstruct string to sign
  const searchParams = new URLSearchParams(restParams);
  searchParams.set('expires', expires);
  
  const stringToSign = `${urlPath}?${searchParams.toString()}`;

  const expectedSignature = crypto
    .createHmac(ALGORITHM, SIGNING_SECRET)
    .update(stringToSign)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const providedBuffer = Buffer.from(providedSignature, 'hex');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

module.exports = {
  generateSignedUrl,
  verifySignedUrl
};
