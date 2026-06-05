'use strict';

const ReferenceDataDomainService = require('./reference-data.domain.service');

module.exports = (srv) => {
  const domain = new ReferenceDataDomainService(srv);

  srv.before('CREATE', 'ReferenceData', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'ReferenceData', (req) => domain.beforeUpdate(req));
  srv.before('DELETE', 'ReferenceData', (req) => domain.beforeDelete(req));
};

module.exports.primaryEntity = 'ReferenceData';
