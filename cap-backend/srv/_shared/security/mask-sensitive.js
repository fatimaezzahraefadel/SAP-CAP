'use strict';

/**
 * Sensitive-data masking.
 *
 * Shared across the backend so every place that serialises arbitrary payloads
 * (audit writer, audit read handler, future logger redaction, error formatters)
 * scrubs the same set of keys using the same rules.
 *
 * Rule: any object key whose name matches /password|token|authorization|secret/i
 * — at any depth, inside arrays too — has its value replaced with REDACTED.
 *
 * The match is intentionally a substring match so variants are caught:
 *   password, oldPassword, passwordHash,
 *   token, accessToken, refreshToken, csrfToken,
 *   authorization, AuthorizationHeader,
 *   secret, clientSecret, apiSecret.
 *
 * The match is case-insensitive.
 */

const SENSITIVE_KEY_PATTERN = /password|token|authorization|secret/i;
const REDACTED = '***REDACTED***';

/**
 * Recursively walk a value and return a new value with sensitive keys masked.
 * - Plain objects: replace value when the KEY matches; otherwise recurse.
 * - Arrays: recurse element-wise.
 * - Primitives: returned untouched.
 *
 * The input is NOT mutated.
 */
function maskSensitive(value) {
  if (Array.isArray(value)) {
    return value.map(maskSensitive);
  }
  if (value && typeof value === 'object') {
    // Skip class instances we shouldn't reshape (Buffer, Date, streams, etc.).
    if (Buffer.isBuffer(value) || value instanceof Date) return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? REDACTED : maskSensitive(v);
    }
    return out;
  }
  return value;
}

/**
 * Mask a STRING that contains JSON. If it parses cleanly, mask the parsed tree
 * and re-stringify. If it doesn't (truncated payload ending with "..."), fall
 * back to a coarse regex-level scrub so partial leaks are still avoided.
 *
 * Pass-through for non-string inputs (null / undefined / numbers).
 */
function maskJsonString(details) {
  if (details == null || typeof details !== 'string') return details;

  try {
    const parsed = JSON.parse(details);
    return JSON.stringify(maskSensitive(parsed));
  } catch {
    return details.replace(
      /"(\w*(?:password|token|authorization|secret)\w*)"\s*:\s*"(?:[^"\\]|\\.)*"/gi,
      (_m, key) => `"${key}":"${REDACTED}"`
    );
  }
}

module.exports = {
  SENSITIVE_KEY_PATTERN,
  REDACTED,
  maskSensitive,
  maskJsonString,
};
