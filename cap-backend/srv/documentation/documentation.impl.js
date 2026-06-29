'use strict';

const cds = require('@sap/cds');
const DocumentationDomainService = require('./documentation.domain.service');
require('./documents.policy');
const policies = require('../_shared/security/policies');
const { Actions } = require('../_shared/security/actions');
const { getRequestContext } = require('../_shared/auth/request-context');
const { ENTITIES } = require('../shared/services/validation');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

module.exports = (srv) => {
  const domain = new DocumentationDomainService(srv);

  const requirePermission = async (req, action, resource) => {
    const ctx = getRequestContext(req);
    try {
      return await policies.require(ctx, action, resource);
    } catch (err) {
      if (err?.statusCode === 403 || err?.status === 403 || err?.code === 403) {
        req.reject(403, err.message || 'Forbidden: insufficient permission');
      }
      throw err;
    }
  };

  const loadDocument = (id) => {
    if (!id) return null;
    return cds.db.run(SELECT.one.from(ENTITIES.DocumentationObjects).where({ ID: id }));
  };

  srv.before('READ', 'DocumentationObjects', (req) => requirePermission(req, Actions.DOCUMENT_READ));

  srv.after('READ', 'DocumentationObjects', async (data, req) => {
    const ctx = getRequestContext(req);
    if (!data) return;

    if (Array.isArray(data)) {
      const allowed = [];
      for (const row of data) {
        if (await policies.can(ctx, Actions.DOCUMENT_READ, row)) allowed.push(row);
      }
      data.splice(0, data.length, ...allowed);
      return;
    }

    if (!await policies.can(ctx, Actions.DOCUMENT_READ, data)) {
      req.reject(403, 'Forbidden: insufficient permission');
    }
  });

  srv.before('CREATE', 'DocumentationObjects', async (req) => {
    await requirePermission(req, Actions.DOCUMENT_CREATE, req.data);
    await domain.beforeCreate(req);
  });

  srv.before('UPDATE', 'DocumentationObjects', async (req) => {
    const document = await loadDocument(extractEntityId(req));
    await requirePermission(req, Actions.DOCUMENT_UPDATE, { current: document, changes: req.data });
    await domain.beforeUpdate(req);
  });

  srv.before('DELETE', 'DocumentationObjects', async (req) => {
    const document = await loadDocument(extractEntityId(req));
    await requirePermission(req, Actions.DOCUMENT_DELETE, document);
  });

  srv.on('cleanupOrphanAttachments', (req) => domain.cleanupOrphanAttachments(req));
  srv.on('purgeDeletedAttachments', (req) => domain.purgeDeletedAttachments(req));
  srv.on('cleanupDuplicateAttachments', (req) => domain.cleanupDuplicateAttachments(req));
  srv.on('reconcileStorage', (req) => domain.reconcileStorage(req));
};

module.exports.primaryEntity = 'DocumentationObjects';
