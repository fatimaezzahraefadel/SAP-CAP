import { describe, expect, it } from 'vitest';
import { normalizeAttachments, toAttachmentRows } from './documentationApi';

describe('documentationApi attachment migration', () => {
  it('normalizes legacy fileUrl entries to url', () => {
    const attachments = normalizeAttachments([
      { fileName: 'report.pdf', fileUrl: 'https://example.com/report.pdf', size: 1234 },
    ]);

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toEqual({
      filename: 'report.pdf',
      url: 'https://example.com/report.pdf',
      size: 1234,
    });
  });

  it('normalizes new url entries to fileUrl rows for payload', () => {
    const rows = toAttachmentRows([
      { filename: 'report.pdf', url: 'https://example.com/report.pdf' },
    ]);

    expect(rows).toEqual([
      { fileName: 'report.pdf', fileUrl: 'https://example.com/report.pdf', fileSize: 0 },
    ]);
  });

  it('keeps legacy fileUrl entries when building payload rows', () => {
    const rows = toAttachmentRows([
      { filename: 'report.pdf', fileUrl: 'https://example.com/report.pdf' },
    ]);

    expect(rows).toEqual([
      { fileName: 'report.pdf', fileUrl: 'https://example.com/report.pdf', fileSize: 0 },
    ]);
  });
});
