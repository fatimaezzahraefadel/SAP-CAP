'use strict';

const cds = require('@sap/cds');
const AttachmentsDomainService = require('./attachments.domain.service');

module.exports = (srv) => {
  const domain = new AttachmentsDomainService(srv);

  srv.on('uploadAttachment', (req) => domain.upload(req));
  srv.on('downloadAttachment', (req) => domain.download(req));
  srv.on('listAttachments', (req) => domain.list(req));
  srv.on('deleteAttachment', (req) => domain.remove(req));

  // Public route that streams the stored bytes back. Registered directly on the
  // express app (outside CAP auth) so plain <a href download> links work without
  // attaching a Bearer token.
  cds.on('served', () => {
    const app = cds.app;
    if (!app) return;

    app.get('/attachments/:id', async (req, res) => {
      try {
        const file = await domain.getFile(req.params.id);
        if (!file) return res.status(404).send('Not found');

        // originalName is stored as uploaded; strip characters that would break
        // or terminate the header value before embedding it.
        const downloadName = String(file.originalName || file.fileName || 'download')
          .replace(/[\r\n"\\;]/g, '_');

        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

        const body = file.content;

        // @sap/cds returns LargeBinary as a Node Readable stream.
        if (body && typeof body.pipe === 'function') {
          if (file.sizeBytes) res.setHeader('Content-Length', file.sizeBytes);
          body.on('error', () => { if (!res.headersSent) res.status(500); res.end(); });
          return body.pipe(res);
        }

        // Fallbacks: some drivers/rows return a Buffer or a base64 string.
        const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'base64');
        res.setHeader('Content-Length', buf.length);
        return res.send(buf);
      } catch (e) {
        return res.status(500).send('Error serving file');
      }
    });
  });
};

module.exports.primaryEntity = 'Attachments';
