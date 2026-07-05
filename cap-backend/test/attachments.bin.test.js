'use strict';
/**
 * Attachments binary lifecycle: the uploaded file is stored in the DB
 * (LargeBinary) and the /attachments/:id route streams identical bytes back.
 */
process.env.CDS_REQUIRES_DB_KIND = 'sqlite';
process.env.CDS_REQUIRES_DB_CREDENTIALS_DATABASE = ':memory:';
const cds = require('@sap/cds');
const crypto = require('crypto');
const { USERS, auth } = require('./support/test-auth');

cds.env.requires = cds.env.requires || {};
cds.env.requires.db = {
  ...(cds.env.requires.db || {}),
  kind: 'sqlite',
  credentials: { ...((cds.env.requires.db && cds.env.requires.db.credentials) || {}), database: ':memory:' },
};

const { POST, GET } = cds.test('serve', 'all', '--in-memory').in(__dirname + '/..');

const E = 'sap.performance.dashboard.db.Attachments';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

describe('Attachments binary lifecycle', () => {
  test('upload persists content and the download route returns identical bytes', async () => {
    const original = Buffer.from('%PDF-1.4\n' + 'Z'.repeat(20000) + '\n%%EOF\n', 'latin1');

    const { data: row } = await POST('/odata/v4/core/uploadAttachment', {
      parentType: 'DOCUMENT', parentId: 'doc-x', fileName: 'sample.pdf',
      mimeType: 'application/pdf', contentBase64: original.toString('base64'),
    }, auth(USERS.admin));

    // metadata response must not leak the binary
    expect('content' in row).toBe(false);
    expect(row.sizeBytes).toBe(original.length);

    // bytes are actually persisted in the DB (not NULL)
    const stored = await cds.db.run(SELECT.one.from(E).columns('sizeBytes').where({ ID: row.ID }));
    expect(stored.sizeBytes).toBe(original.length);

    // download through the real route and compare byte-for-byte
    const dl = await GET(`/attachments/${row.ID}`, { responseType: 'arraybuffer' });
    const downloaded = Buffer.from(dl.data);
    expect(dl.headers['content-type']).toContain('application/pdf');
    expect(sha(downloaded)).toBe(sha(original));
  });

  test('deleted attachments are no longer downloadable', async () => {
    const original = Buffer.from('%PDF-1.4 to-be-deleted-' + 'x'.repeat(500));
    const { data: row } = await POST('/odata/v4/core/uploadAttachment', {
      parentType: 'DOCUMENT', parentId: 'doc-del', fileName: 'd.pdf',
      mimeType: 'application/pdf', contentBase64: original.toString('base64'),
    }, auth(USERS.admin));

    await POST('/odata/v4/core/deleteAttachment', { id: row.ID }, auth(USERS.admin));

    await expect(GET(`/attachments/${row.ID}`)).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});
