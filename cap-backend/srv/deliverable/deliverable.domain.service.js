'use strict';

const DeliverableRepo = require('./deliverable.repo');
const { assertEntityExists, ENTITIES, MANAGER_ROLES, requireRole } = require('../shared/services/validation');

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
    // Only managers can delete; an APPROVED deliverable is contractually
    // delivered work and is protected from deletion regardless of role.
    requireRole(req, MANAGER_ROLES, 'Only managers can delete deliverables');
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'Deliverable id is required');

    const current = await this.repo.findById(id);
    if (current && current.validationStatus === 'APPROVED') {
      req.reject(409, 'Cannot delete an APPROVED deliverable');
    }
  }
}

module.exports = DeliverableDomainService;
