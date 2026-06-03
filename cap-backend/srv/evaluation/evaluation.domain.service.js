'use strict';

const {
  assertEntityExists,
  assertPositiveNumber,
  ENTITIES,
  MANAGER_ROLES,
  ALL_NON_CONSULTANT_ROLES,
  requireRole,
} = require('../shared/services/validation');

class EvaluationDomainService {
  constructor(_srv) {
  }

  async beforeRead(req) {
    requireRole(req, ALL_NON_CONSULTANT_ROLES, 'Consultants cannot access evaluations');
  }

  async beforeCreate(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can create evaluations');
    const data = req.data;

    await assertEntityExists(ENTITIES.Users, data.userId, 'userId', req);
    await assertEntityExists(ENTITIES.Users, data.evaluatorId, 'evaluatorId', req);
    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);

    assertPositiveNumber(data.score, 'score', req);
  }

  async beforeUpdate(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can update evaluations');
    const data = req.data;

    if (data.userId !== undefined) await assertEntityExists(ENTITIES.Users, data.userId, 'userId', req);
    if (data.evaluatorId !== undefined) await assertEntityExists(ENTITIES.Users, data.evaluatorId, 'evaluatorId', req);
    if (data.projectId !== undefined) await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);

    if (data.score !== undefined) assertPositiveNumber(data.score, 'score', req);
  }

  async beforeDelete(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can delete evaluations');
  }
}

module.exports = EvaluationDomainService;
