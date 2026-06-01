'use strict';

const cds = require('@sap/cds');
const { assertEntityExists, ENTITIES, ADMIN_ONLY, requireRole } = require('../shared/services/validation');
const { nowIso } = require('../shared/utils/timestamp');

const DOC_ATTACHED_FILES = 'sap.performance.dashboard.db.DocAttachedFiles';
const DOCUMENTATION_OBJECTS = 'sap.performance.dashboard.db.DocumentationObjects';

class DocumentationDomainService {
  constructor(_srv) {
  }

  async beforeCreate(req) {
    const data = req.data;
    const userId = String(req._authClaims?.sub ?? '').trim();

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
    const userId = String(req._authClaims?.sub ?? '').trim();

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

  async cleanupOrphanAttachments(req) {
    requireRole(req, ADMIN_ONLY, 'Only admins can run cleanupOrphanAttachments');

    const tx = await cds.tx(req).run(async (tx) => {
      const attachments = await tx.run(
        SELECT.from(DOC_ATTACHED_FILES).columns(['ID', 'docObject_ID'])
      );

      const orphanIds = [];
      const referencedDocIds = new Set();
      for (const attachment of attachments) {
        const docObjectId = attachment.docObject_ID;
        if (docObjectId) {
          referencedDocIds.add(docObjectId);
        } else {
          orphanIds.push(attachment.ID);
        }
      }

      if (referencedDocIds.size > 0) {
        const existingDocs = await tx.run(
          SELECT.from(DOCUMENTATION_OBJECTS).columns('ID').where({ ID: { in: [...referencedDocIds] } })
        );
        const existingIds = new Set(existingDocs.map((doc) => doc.ID));
        for (const attachment of attachments) {
          const docObjectId = attachment.docObject_ID;
          if (docObjectId && !existingIds.has(docObjectId)) {
            orphanIds.push(attachment.ID);
          }
        }
      }

      if (orphanIds.length === 0) {
        return 0;
      }

      await tx.run(DELETE.from(DOC_ATTACHED_FILES).where({ ID: { in: orphanIds } }));
      return orphanIds.length;
    });

    return tx;
  }
}

module.exports = DocumentationDomainService;
