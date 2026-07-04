'use strict';

const cds = require('@sap/cds');
const DeliverableRepo = require('./deliverable.repo');
const { assertEntityExists, ENTITIES, MANAGER_ROLES, requireRole, requireOwnerOrRole } = require('../shared/services/validation');
const { getRequestContext } = require('../_shared/auth/request-context');

const DELIVERABLE_TRANSITIONS = {
  PENDING: new Set(['APPROVED', 'CHANGES_REQUESTED']),
  CHANGES_REQUESTED: new Set(['PENDING', 'APPROVED']),
  APPROVED: new Set([]),
};

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

class DeliverableDomainService {
  constructor(_srv) {
    this.repo = new DeliverableRepo();
  }

  async beforeCreate(req) {
    const data = req.data;

    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);

    if (!String(data.name ?? '').trim()) req.error(400, 'name is required');
    if (data.validationStatus === undefined) data.validationStatus = 'PENDING';

    // Stamp the authenticated application user as the author so ownership
    // checks (e.g. self-delete) work under the mocked-JWT auth, where CAP's
    // managed `createdBy` does not carry the application user id.
    const ctx = getRequestContext(req);
    if (ctx.userId) data.createdBy = ctx.userId;
  }

  /**
   * Notify the project manager that a new deliverable was submitted for review.
   * Generated server-side (trusted) because a consultant cannot POST a
   * Notification targeting another user — that path is blocked as recipient
   * spoofing in notification.domain.service.js. A notification failure must
   * never roll back a successfully created deliverable.
   */
  async afterCreate(data, req) {
    try {
      const project = await cds.db.run(
        SELECT.one.from(ENTITIES.Projects).columns('managerId').where({ ID: data.projectId })
      );
      if (!project?.managerId) return;

      const ctx = getRequestContext(req);
      // Don't notify the manager about their own submission.
      if (String(project.managerId) === ctx.userId) return;

      const submitter = ctx.userId
        ? await cds.db.run(
            SELECT.one.from(ENTITIES.Users).columns('name').where({ ID: ctx.userId })
          )
        : null;
      const author = submitter?.name || ctx.email || 'Un consultant';

      await cds.db.run(INSERT.into(ENTITIES.Notifications).entries({
        userId: project.managerId,
        type: 'DELIVERABLE_SUBMITTED',
        title: 'Nouvelle spécification fonctionnelle',
        message: `${author} a soumis « ${data.name} » pour validation.`,
        targetPath: `{roleBasePath}/projects/${data.projectId}`,
        read: false,
      }));
    } catch (err) {
      req.warn?.(`Failed to create DELIVERABLE_SUBMITTED notification: ${err.message}`);
    }
  }

  async beforeUpdate(req) {
    const data = req.data;

    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);

    if (data.validationStatus !== undefined) {
      const id = extractEntityId(req);
      const current = id ? await this.repo.findById(id) : null;
      if (current && data.validationStatus !== current.validationStatus) {
        requireRole(req, MANAGER_ROLES, 'Only managers can change deliverable validation status');
        const allowed = DELIVERABLE_TRANSITIONS[current.validationStatus] || new Set();
        if (!allowed.has(data.validationStatus)) {
          req.reject(
            409,
            `Invalid deliverable validationStatus transition: ${current.validationStatus} -> ${data.validationStatus}`
          );
        }
      }
    }
  }

  async beforeDelete(req) {
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'Deliverable id is required');

    const current = await this.repo.findById(id);

    // An APPROVED deliverable is contractually delivered work and is protected
    // from deletion regardless of role.
    if (current && current.validationStatus === 'APPROVED') {
      req.reject(409, 'Cannot delete an APPROVED deliverable');
    }

    // Managers can delete any deliverable; everyone else may delete only the
    // (non-approved) deliverables they authored.
    requireOwnerOrRole(req, current?.createdBy, MANAGER_ROLES, 'You can only delete your own deliverables');
  }
}

module.exports = DeliverableDomainService;
