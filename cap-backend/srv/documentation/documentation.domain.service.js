'use strict';

const cds = require('@sap/cds');
const { assertEntityExists, ENTITIES, ADMIN_ONLY, requireRole } = require('../shared/services/validation');
const { nowIso } = require('../shared/utils/timestamp');
const { reconcileAttachmentStorage, resolveStorageRoot } = require('../shared/services/reconcileStorage');
const { getRequestContext } = require('../_shared/auth/request-context');

const PARENT_ENTITY_BY_TYPE = Object.freeze({
  COMMENT: ENTITIES.TicketComments,
  DELIVERABLE: ENTITIES.Deliverables,
  DOCUMENT: ENTITIES.DocumentationObjects,
  EVALUATION: ENTITIES.Evaluations,
  IMPUTATION: ENTITIES.Imputations,
  LEAVE_REQUEST: ENTITIES.LeaveRequests,
  PROJECT: ENTITIES.Projects,
  PROJECT_FEEDBACK: ENTITIES.ProjectFeedback,
  TICKET: ENTITIES.Tickets,
  TIME_LOG: ENTITIES.TimeLogs,
  TIMESHEET: ENTITIES.Timesheets,
  USER: ENTITIES.Users,
  WRICEF: ENTITIES.Wricefs,
  WRICEF_OBJECT: ENTITIES.WricefObjects,
});

class DocumentationDomainService {
  constructor(_srv) {
  }

  async beforeCreate(req) {
    const data = req.data;
    const userId = getRequestContext(req).userId;

    if (!userId) req.reject(401, 'Missing authenticated user');
    if (data.authorId !== undefined && String(data.authorId) !== userId) {
      req.reject(403, 'authorId must match the authenticated user');
    }
    data.authorId = userId;

    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    await assertEntityExists(ENTITIES.Users, data.authorId, 'authorId', req);

    const timestamp = nowIso();
    data.createdAt = timestamp;
    data.updatedAt = timestamp;
  }

  async beforeUpdate(req) {
    const data = req.data;
    const userId = getRequestContext(req).userId;

    if (data.authorId !== undefined) {
      if (!userId) req.reject(401, 'Missing authenticated user');
      if (String(data.authorId) !== userId) {
        req.reject(403, 'authorId cannot be reassigned to another user');
      }
      data.authorId = userId;
    }

    data.updatedAt = nowIso();

    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    await assertEntityExists(ENTITIES.Users, data.authorId, 'authorId', req);
  }

  async _cleanupOrphanAttachments(tx) {
    const attachments = await tx.run(
      SELECT.from(ENTITIES.Attachments).columns(['ID', 'parentType', 'parentId'])
    );

    const orphanIds = [];
    const referencedIdsByType = new Map();

    for (const attachment of attachments) {
      const parentType = String(attachment.parentType ?? '').trim().toUpperCase();
      const parentId = String(attachment.parentId ?? '').trim();
      if (!parentType || !parentId) {
        orphanIds.push(attachment.ID);
        continue;
      }

      if (!PARENT_ENTITY_BY_TYPE[parentType]) continue;

      if (!referencedIdsByType.has(parentType)) {
        referencedIdsByType.set(parentType, new Set());
      }
      referencedIdsByType.get(parentType).add(parentId);
    }

    for (const [parentType, referencedIds] of referencedIdsByType.entries()) {
      const existingRows = await tx.run(
        SELECT.from(PARENT_ENTITY_BY_TYPE[parentType]).columns('ID').where({ ID: { in: [...referencedIds] } })
      );
      const existingIds = new Set(existingRows.map((row) => String(row.ID)));
      for (const attachment of attachments) {
        const attachmentParentType = String(attachment.parentType ?? '').trim().toUpperCase();
        const parentId = String(attachment.parentId ?? '').trim();
        if (attachmentParentType === parentType && parentId && !existingIds.has(parentId)) {
          orphanIds.push(attachment.ID);
        }
      }
    }

    if (orphanIds.length === 0) {
      return 0;
    }

    const uniqueOrphanIds = [...new Set(orphanIds)];
    await tx.run(DELETE.from(ENTITIES.Attachments).where({ ID: { in: uniqueOrphanIds } }));
    return uniqueOrphanIds.length;
  }

  async _purgeDeletedAttachments(tx) {
    const attachments = await tx.run(
      SELECT.from(ENTITIES.Attachments).columns('ID').where({ status: { in: ['DELETED', 'ORPHANED'] } })
    );
    const deletedIds = attachments.map((attachment) => attachment.ID);
    if (deletedIds.length === 0) return 0;

    await tx.run(DELETE.from(ENTITIES.Attachments).where({ ID: { in: deletedIds } }));
    return deletedIds.length;
  }

  async _cleanupDuplicateAttachments(tx) {
    const attachments = await tx.run(
      SELECT.from(ENTITIES.Attachments).columns([
        'ID',
        'parentType',
        'parentId',
        'fileName',
        'originalName',
        'mimeType',
        'sizeBytes',
        'storageKey',
        'checksumSha256',
      ]).where({ status: 'ACTIVE' })
    );

    const seen = new Map();
    const duplicateIds = [];

    for (const attachment of attachments) {
      const parentKey = [
        String(attachment.parentType ?? '').trim().toUpperCase(),
        String(attachment.parentId ?? '').trim(),
      ].join('::');
      const contentKey = String(attachment.checksumSha256 ?? '').trim() ||
        [
          String(attachment.originalName ?? attachment.fileName ?? '').trim().toLowerCase(),
          String(attachment.mimeType ?? '').trim().toLowerCase(),
          String(attachment.sizeBytes ?? '').trim(),
          String(attachment.storageKey ?? '').trim(),
        ].join('::');
      const key = `${parentKey}::${contentKey}`;
      if (!seen.has(key)) {
        seen.set(key, attachment.ID);
      } else {
        duplicateIds.push(attachment.ID);
      }
    }

    if (duplicateIds.length === 0) {
      return 0;
    }

    await tx.run(DELETE.from(ENTITIES.Attachments).where({ ID: { in: duplicateIds } }));
    return duplicateIds.length;
  }

  async cleanupOrphanAttachments(req) {
    requireRole(req, ADMIN_ONLY, 'Only admins can run cleanupOrphanAttachments');
    return cds.tx(req).run(async (tx) => this._cleanupOrphanAttachments(tx));
  }

  async purgeDeletedAttachments(req) {
    requireRole(req, ADMIN_ONLY, 'Only admins can run purgeDeletedAttachments');
    return cds.tx(req).run(async (tx) => {
      const orphanDeleted = await this._cleanupOrphanAttachments(tx);
      const purgedDeleted = await this._purgeDeletedAttachments(tx);
      return orphanDeleted + purgedDeleted;
    });
  }

  async cleanupDuplicateAttachments(req) {
    requireRole(req, ADMIN_ONLY, 'Only admins can run cleanupDuplicateAttachments');
    return cds.tx(req).run(async (tx) => this._cleanupDuplicateAttachments(tx));
  }

  async reconcileStorage(req) {
    requireRole(req, ADMIN_ONLY, 'Only admins can run reconcileStorage');
    return cds.tx(req).run(async (tx) => {
      const attachments = await tx.run(
        SELECT.from(ENTITIES.Attachments).columns(['ID', 'fileName', 'storageKey']).where({ status: 'ACTIVE' })
      );
      const storageRoot = resolveStorageRoot(process.env);
      const summary = await reconcileAttachmentStorage(attachments, { storageRoot });

      const issueCount = summary.missingAttachments.length + summary.orphanFiles.length;
      console.info(
        `[reconcileStorage] storageRoot=${summary.storageRoot} missing=${summary.missingAttachments.length} orphanFiles=${summary.orphanFiles.length}`
      );
      return issueCount;
    });
  }
}

module.exports = DocumentationDomainService;
