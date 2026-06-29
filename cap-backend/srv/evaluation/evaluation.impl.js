'use strict';

const EvaluationDomainService = require('./evaluation.domain.service');

module.exports = (srv) => {
  const domain = new EvaluationDomainService(srv);

  srv.before('READ', 'Evaluations', (req) => domain.beforeRead(req));
  srv.before('CREATE', 'Evaluations', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'Evaluations', (req) => domain.beforeUpdate(req));
  srv.before('DELETE', 'Evaluations', (req) => domain.beforeDelete(req));
};

module.exports.primaryEntity = 'Evaluations';
