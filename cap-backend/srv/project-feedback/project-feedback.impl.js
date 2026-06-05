'use strict';

const ProjectFeedbackDomainService = require('./project-feedback.domain.service');

module.exports = (srv) => {
  const domain = new ProjectFeedbackDomainService(srv);

  srv.before('CREATE', 'ProjectFeedback', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'ProjectFeedback', (req) => domain.beforeUpdate(req));
  srv.before('DELETE', 'ProjectFeedback', (req) => domain.beforeDelete(req));
};

module.exports.primaryEntity = 'ProjectFeedback';
