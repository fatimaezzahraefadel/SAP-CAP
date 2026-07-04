'use strict';

const crypto = require('node:crypto');
const AttachmentsRepo = require('./attachments.repo');
const { nowIso } = require('../shared/utils/timestamp');
const { getRequestContext } = require('../_shared/auth/request-context');
const { isAllowedMimeType } = require('../shared/utils/mime');

const MAX_SIZE_MB = Number(process.env.ATTACHMENT_MAX_SIZE_MB || 25);

const safeFileName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 250);

class AttachmentsDomainService {
  constructor(_srv) {
    this.repo = new AttachmentsRepo();
  }

  _currentUserId(req) {
    return getRequestContext(req).userId || 'system';
  }

  async upload(req) {
    const { parentType, parentId, fileName, mimeType, contentBase64 } = req.data || {};
    if (!parentType || !parentId || !fileName || !mimeType || !contentBase64) {
      return req.error(400, 'Missing upload parameters');
    }

    if (!isAllowedMimeType(mimeType)) {
      return req.error(400, 'MIME type not allowed');
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    const sizeBytes = buffer.length;
    if (!sizeBytes) return req.error(400, 'Empty file payload');
    if (sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
      return req.error(400, `File too large. Max ${MAX_SIZE_MB} MB`);
    }

    const cleaned = safeFileName(fileName || 'attachment');
    const storageKey = `${parentType}/${parentId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleaned}`;
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const entry = {
      parentType,
      parentId,
      fileName: cleaned,
      originalName: fileName,
      mimeType,
      content: buffer, // store the raw bytes directly in the DB (LargeBinary -> BLOB)
      sizeBytes,
      storageKey,
      checksumSha256: checksum,
      uploadedBy: this._currentUserId(req),
      status: 'ACTIVE',
    };

    await this.repo.insert(entry);

    // Return metadata only (never the binary blob).
    return this.repo.findByStorageKey(storageKey);
  }

  async download(req) {
    const { id } = req.data || {};
    if (!id) return req.error(400, 'id is required');
    const row = await this.repo.findById(id);
    if (!row) return req.error(404, 'Attachment not found');
    // Public, token-free URL served by the express route in the impl.
    return `/attachments/${row.ID}`;
  }

  async list(req) {
    const { parentType, parentId } = req.data || {};
    if (!parentType || !parentId) return [];
    return this.repo.listActiveByParent(parentType, parentId);
  }

  async remove(req) {
    const { id } = req.data || {};
    if (!id) return req.error(400, 'id is required');

    const row = await this.repo.findById(id);
    if (!row) return req.error(404, 'Attachment not found');

    // Soft delete: flip status and stamp who/when; the binary stays until purged.
    await this.repo.markDeleted(id, this._currentUserId(req), nowIso());
    return this.repo.findById(id);
  }

  /**
   * Returns the stored payload plus metadata for the download route. `content`
   * is whatever the DB layer hands back — for @sap/cds + sqlite that's a Node
   * Readable stream; the route handles streams, Buffers and base64 strings.
   */
  async getFile(id) {
    const row = await this.repo.findContentById(id);
    if (!row || row.content === null || row.content === undefined || row.status === 'DELETED') return null;

    return {
      content: row.content,
      mimeType: row.mimeType,
      originalName: row.originalName,
      fileName: row.fileName,
      sizeBytes: row.sizeBytes,
    };
  }
}

module.exports = AttachmentsDomainService;
