'use strict';

const {
  assertEntityExists,
  ENTITIES,
  ALL_NON_CONSULTANT_ROLES,
  requireOwnerOrRole,
} = require('../shared/services/validation');
const { getRequestContext } = require('../_shared/auth/request-context');
const ProjectFeedbackRepo = require('./project-feedback.repo');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

class ProjectFeedbackDomainService {
  constructor(_srv) {
    this.repo = new ProjectFeedbackRepo();
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

  async beforeUpdate(req) {
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'ProjectFeedback id is required');

    const current = await this.repo.findById(id);
    if (!current) return; // global 404 handler will take care of it

    // Only the original author or staff may edit feedback.
    requireOwnerOrRole(
      req,
      current.authorId,
      ALL_NON_CONSULTANT_ROLES,
      'You can only edit your own feedback'
    );

    // authorId is immutable — prevent reassigning ownership.
    if (req.data?.authorId !== undefined && String(req.data.authorId) !== String(current.authorId)) {
      req.reject(400, 'authorId cannot be modified');
    }

    if (req.data?.projectId !== undefined) {
      await assertEntityExists(ENTITIES.Projects, req.data.projectId, 'projectId', req);
    }
  }

  async beforeDelete(req) {
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'ProjectFeedback id is required');

    const current = await this.repo.findById(id);
    if (!current) return; // global 404 handler

    // Author can delete their own; staff (non-consultants) can delete any.
    requireOwnerOrRole(
      req,
      current.authorId,
      ALL_NON_CONSULTANT_ROLES,
      'You can only delete your own feedback'
    );
  }
}

module.exports = ProjectFeedbackDomainService;
