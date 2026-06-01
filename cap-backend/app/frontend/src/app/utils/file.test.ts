import { describe, expect, it } from 'vitest';
import { sanitizeFileName } from './file';

describe('sanitizeFileName', () => {
  it('keeps valid file names intact', () => {
    expect(sanitizeFileName('Documentation.pdf')).toBe('Documentation.pdf');
  });

  it('removes path segments from names', () => {
    expect(sanitizeFileName('C:\\Users\\User\\report.docx')).toBe('report.docx');
    expect(sanitizeFileName('/tmp/notes.txt')).toBe('notes.txt');
  });

  it('strips invalid characters and trims whitespace', () => {
    expect(sanitizeFileName('  inva<>lid:?*|name .pdf  ')).toBe('invalidname .pdf');
  });

  it('falls back to Attachment when name becomes empty', () => {
    expect(sanitizeFileName('  <>:"/\\|?*  ')).toBe('Attachment');
  });
});
