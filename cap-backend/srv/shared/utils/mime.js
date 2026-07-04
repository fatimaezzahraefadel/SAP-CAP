'use strict';

// The ATTACHMENT_ALLOWED_MIME_TYPES env var is a comma-separated list of file
// extensions (e.g. "pdf,docx") and/or full MIME types (e.g. "application/pdf").
// Browsers send full MIME types on upload, so extensions are expanded to the
// MIME types they correspond to before matching.
const MIME_BY_EXTENSION = Object.freeze({
  pdf:  ['application/pdf'],
  png:  ['image/png'],
  jpg:  ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif:  ['image/gif'],
  txt:  ['text/plain'],
  csv:  ['text/csv'],
  doc:  ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls:  ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt:  ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
});

const configured = (process.env.ATTACHMENT_ALLOWED_MIME_TYPES || 'pdf,png,jpg,jpeg,docx,xlsx,txt')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED = new Set();
for (const token of configured) {
  ALLOWED.add(token);
  if (!token.includes('/')) {
    for (const mime of MIME_BY_EXTENSION[token] ?? []) ALLOWED.add(mime);
  }
}

const isAllowedMimeType = (mimeType) => {
  // Strip any parameters, e.g. "text/plain; charset=utf-8".
  const normalized = String(mimeType || '').toLowerCase().split(';')[0].trim();
  if (!normalized) return false;
  if (ALLOWED.has(normalized)) return true;
  // Keep accepting clients that send just the subtype/extension ("pdf").
  return ALLOWED.has(normalized.split('/').pop());
};

module.exports = { isAllowedMimeType };
