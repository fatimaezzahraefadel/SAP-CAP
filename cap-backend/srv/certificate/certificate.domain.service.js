'use strict';

const CertificateRepo = require('./certificate.repo');
const AttachmentsRepo = require('../attachments/attachments.repo');
const AuthDomainService = require('../auth/auth.domain.service');
const { getRequestContext } = require('../_shared/auth/request-context');
const {
  assertRequiredValue,
  assertEntityExists,
  assertDateRange,
  assertInEnum,
  ENTITIES,
  MANAGER_ROLES,
  requireOwnerOrRole,
} = require('../shared/services/validation');
const crypto = require('node:crypto');
const { isAllowedMimeType } = require('../shared/utils/mime');

const CERTIFICATE_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'];

const MAX_DOC_SIZE_MB = Number(process.env.ATTACHMENT_MAX_SIZE_MB || 25);

const safeFileName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 250);
const extractId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

class CertificateDomainService {
  constructor(_srv) {
    this.repo = new CertificateRepo();
    this.attachRepo = new AttachmentsRepo();
    this.auth = new AuthDomainService();
  }

  _userId(req) {
    return getRequestContext(req).userId || 'system';
  }

  // ---- CRUD hooks -----------------------------------------------------------

  async beforeCreate(req) {
    const data = req.data;
    const userId = this._userId(req);
    const claims = this.auth.getRequestClaims(req);

    if (!MANAGER_ROLES.has(String(claims?.role ?? ''))) {
      data.userId = userId;
    }

    assertRequiredValue(data.userId, 'userId', req);
    assertRequiredValue(data.title, 'title', req);
    await assertEntityExists(ENTITIES.Users, data.userId, 'userId', req);
    assertDateRange(data.issuedDate, data.expiryDate, req);
    assertInEnum(data.status, CERTIFICATE_STATUSES, 'status', req);

    if (data.status === undefined) data.status = 'ACTIVE';
  }

  async beforeUpdate(req) {
    const id = extractId(req);
    const current = id ? await this.repo.findById(id) : null;
    if (!current) {
      req.reject(404, 'Certificate not found');
      return;
    }

    requireOwnerOrRole(req, current.userId, MANAGER_ROLES, 'You can only update your own certificates');

    const data = req.data;
    if (data.userId !== undefined && String(data.userId) !== String(current.userId)) {
      req.reject(403, 'userId cannot be reassigned');
    }

    if (data.status !== undefined) {
      assertInEnum(data.status, CERTIFICATE_STATUSES, 'status', req);
    }

    const issuedDate = data.issuedDate ?? current.issuedDate;
    const expiryDate = data.expiryDate ?? current.expiryDate;
    assertDateRange(issuedDate, expiryDate, req);
  }

  async beforeDelete(req) {
    const id = extractId(req);
    if (!id) return;
    const current = await this.repo.findById(id);
    if (!current) return;
    requireOwnerOrRole(req, current.userId, MANAGER_ROLES, 'You can only delete your own certificates');
  }

  // ---- Document actions -----------------------------------------------------

  async uploadDocument(req) {
    const { certId, fileName, mimeType, contentBase64 } = req.data || {};
    if (!certId || !fileName || !mimeType || !contentBase64) {
      return req.error(400, 'certId, fileName, mimeType and contentBase64 are required');
    }

    const cert = await this.repo.findById(certId);
    if (!cert) return req.error(404, 'Certificate not found');

    requireOwnerOrRole(req, cert.userId, MANAGER_ROLES, 'You can only upload documents to your own certificates');

    if (!isAllowedMimeType(mimeType)) {
      return req.error(400, 'MIME type not allowed');
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    const sizeBytes = buffer.length;
    if (!sizeBytes) return req.error(400, 'Empty file payload');
    if (sizeBytes > MAX_DOC_SIZE_MB * 1024 * 1024) {
      return req.error(400, `File too large. Max ${MAX_DOC_SIZE_MB} MB`);
    }

    const cleaned = safeFileName(fileName);
    const storageKey = `CERTIFICATE/${certId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleaned}`;
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const entry = {
      parentType: 'CERTIFICATE',
      parentId: certId,
      fileName: cleaned,
      originalName: fileName,
      mimeType,
      content: buffer,
      sizeBytes,
      storageKey,
      checksumSha256: checksum,
      uploadedBy: this._userId(req),
      status: 'ACTIVE',
    };

    await this.attachRepo.insert(entry);
    return this.attachRepo.findByStorageKey(storageKey);
  }

  async listDocuments(req) {
    const { certId } = req.data || {};
    if (!certId) return req.error(400, 'certId is required');

    const cert = await this.repo.findById(certId);
    if (!cert) return req.error(404, 'Certificate not found');

    requireOwnerOrRole(req, cert.userId, MANAGER_ROLES, 'You can only list documents of your own certificates');

    return this.attachRepo.listActiveByParent('CERTIFICATE', certId);
  }

  async deleteDocument(req) {
    const { attachmentId } = req.data || {};
    if (!attachmentId) return req.error(400, 'attachmentId is required');

    const attachment = await this.attachRepo.findById(attachmentId);
    if (!attachment) return req.error(404, 'Document not found');
    if (attachment.parentType !== 'CERTIFICATE') return req.error(400, 'Attachment is not a certificate document');

    const cert = await this.repo.findById(attachment.parentId);
    if (cert) {
      requireOwnerOrRole(req, cert.userId, MANAGER_ROLES, 'You can only delete documents of your own certificates');
    }

    const nowIso = new Date().toISOString();
    await this.attachRepo.markDeleted(attachmentId, this._userId(req), nowIso);
    return this.attachRepo.findById(attachmentId);
  }
}

module.exports = CertificateDomainService;
