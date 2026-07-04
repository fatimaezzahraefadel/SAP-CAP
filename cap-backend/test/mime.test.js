'use strict';

const { isAllowedMimeType } = require('../srv/shared/utils/mime');

describe('isAllowedMimeType', () => {
  test('accepts the real MIME types browsers send for allow-listed extensions', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true);
    expect(isAllowedMimeType('image/png')).toBe(true);
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
    expect(isAllowedMimeType('text/plain')).toBe(true);
    expect(isAllowedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(isAllowedMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });

  test('accepts bare extensions and is case-insensitive', () => {
    expect(isAllowedMimeType('pdf')).toBe(true);
    expect(isAllowedMimeType('DOCX')).toBe(true);
    expect(isAllowedMimeType('Application/PDF')).toBe(true);
  });

  test('ignores MIME parameters', () => {
    expect(isAllowedMimeType('text/plain; charset=utf-8')).toBe(true);
  });

  test('rejects types outside the allowlist', () => {
    expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
    expect(isAllowedMimeType('text/html')).toBe(false);
    expect(isAllowedMimeType('application/zip')).toBe(false);
    expect(isAllowedMimeType('')).toBe(false);
    expect(isAllowedMimeType(null)).toBe(false);
  });
});
