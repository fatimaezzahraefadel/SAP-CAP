'use strict';

const DeliverableDomainService = require('./deliverable.domain.service');

module.exports = (srv) => {
  const domain = new DeliverableDomainService(srv);

  srv.before('CREATE', 'Deliverables', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'Deliverables', (req) => domain.beforeUpdate(req));
  srv.before('DELETE', 'Deliverables', (req) => domain.beforeDelete(req));
  srv.after('CREATE', 'Deliverables', (data, req) => domain.afterCreate(data, req));
};

module.exports.primaryEntity = 'Deliverables';
