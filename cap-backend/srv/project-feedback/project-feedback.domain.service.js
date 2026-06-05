'use strict';

const {
  assertEntityExists,
  ENTITIES,
  ALL_NON_CONSULTANT_ROLES,
  requireOwnerOrRole,
} = require('../shared/services/validation');
const { getRequestContext } = require('../_shared/auth/request-context');

class ProjectFeedbackDomainService {
  constructor(_srv) {
  }

  async beforeCreate(req) {
    req.data.authorId = req.data.authorId || getRequestContext(req).userId;
    requireOwnerOrRole(
      req,
      req.data.authorId,
      ALL_NON_CONSULTANT_ROLES,
      'You can only create feedback as yourself'
    );
    await assertEntityExists(ENTITIES.Projects, req.data.projectId, 'projectId', req);
    await assertEntityExists(ENTITIES.Users, req.data.authorId, 'authorId', req);
  }
}

module.exports = ProjectFeedbackDomainService;
