'use strict';

const DocumentationDomainService = require('./documentation.domain.service');

module.exports = (srv) => {
  const domain = new DocumentationDomainService(srv);

  srv.before('CREATE', 'DocumentationObjects', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'DocumentationObjects', (req) => domain.beforeUpdate(req));
  srv.on('cleanupOrphanAttachments', (req) => domain.cleanupOrphanAttachments(req));
};

module.exports.primaryEntity = 'DocumentationObjects';
