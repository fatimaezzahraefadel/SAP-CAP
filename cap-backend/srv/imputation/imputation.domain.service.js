'use strict';

const ImputationRepo = require('./imputation.repo');
const AuthDomainService = require('../auth/auth.domain.service');
const { assertEntityExists, ENTITIES, MANAGER_ROLES, requireOwnerOrRole } = require('../shared/services/validation');
const { restrictReadToOwnerUnlessStaff } = require('../shared/services/authz');
const { nowIso } = require('../shared/utils/timestamp');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
const isManagerRole = (claims) => MANAGER_ROLES.has(String(claims?.role ?? ''));

const IMPUTATION_TRANSITIONS = {
  validate: new Set(['DRAFT', 'SUBMITTED', 'REJECTED']),
  rejectEntry: new Set(['DRAFT', 'SUBMITTED']),
};

const assertHours = (value, req) => {
  if (value === undefined || value === null) return;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 24) {
    req.error(400, 'hours must be between 0 and 24');
  }
};

class ImputationDomainService {
  constructor(_srv) {
    this.repo = new ImputationRepo();
    this.auth = new AuthDomainService();
  }

  beforeRead(req) {
    restrictReadToOwnerUnlessStaff(req, 'consultantId');
  }

  async beforeCreate(req) {
    const data = req.data;
    const claims = this.auth.getRequestClaims(req);
    const authUser = await this.auth.currentUser(req);
    const dbUserId = String(authUser.id ?? '').trim();

    if (!dbUserId) req.reject(401, 'Missing authenticated user');
    if (data.consultantId === undefined) {
      data.consultantId = dbUserId;
    } else if (!isManagerRole(claims)) {
      if (data.consultantId !== undefined && String(data.consultantId) !== dbUserId) {
        req.reject(403, 'consultantId must match the authenticated user');
      }
      data.consultantId = dbUserId;
    }

    await assertEntityExists(ENTITIES.Users, data.consultantId, 'consultantId', req);
    await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);
    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);

    assertHours(data.hours, req);
    if (!String(data.periodKey ?? '').trim()) req.error(400, 'periodKey is required');
    if (data.validationStatus === undefined) data.validationStatus = 'DRAFT';
  }

  async beforeUpdate(req) {
    const data = req.data;
    const claims = this.auth.getRequestClaims(req);
    const id = extractEntityId(req);
    const current = id ? await this.repo.findById(id) : null;
    if (!current) {
      req.reject(404, 'Imputation not found');
      return;
    }

    requireOwnerOrRole(req, current.consultantId, MANAGER_ROLES, 'You can only update your own imputations');

    const protectedFields = ['validationStatus', 'validatedBy', 'validatedAt'];
    for (const field of protectedFields) {
      if (data[field] !== undefined && current && data[field] !== current[field]) {
        req.reject(403, 'Use validate/rejectEntry actions to change validation metadata');
      }
    }

    if (data.consultantId !== undefined) {
      if (String(data.consultantId) !== String(current.consultantId)) {
        req.reject(403, 'consultantId cannot be reassigned');
      }
      if (!isManagerRole(claims)) {
        data.consultantId = current.consultantId;
      }
    }

    await assertEntityExists(ENTITIES.Users, data.consultantId, 'consultantId', req);
    await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);
    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);

    assertHours(data.hours, req);
    if (data.periodKey !== undefined && !String(data.periodKey).trim()) {
      req.error(400, 'periodKey is required');
    }
  }

  async beforeDelete(req) {
    const id = extractEntityId(req);
    if (!id) return;
    const current = await this.repo.findById(id);
    if (!current) return;
    if (current.validationStatus !== 'DRAFT') {
      req.reject(409, 'Only DRAFT imputations can be deleted');
    }
    // Only the owning consultant or a reviewer may delete
    requireOwnerOrRole(req, current.consultantId, MANAGER_ROLES, 'You can only delete your own DRAFT imputations');
  }

  async validate(req) {
    return this._applyTransition(req, 'validate', {
      validationStatus: 'VALIDATED',
      validatedAt: nowIso(),
    });
  }

  async rejectEntry(req) {
    return this._applyTransition(req, 'rejectEntry', {
      validationStatus: 'REJECTED',
      validatedAt: nowIso(),
    });
  }

  async _applyTransition(req, action, changes) {
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'Missing Imputations ID');

    const current = await this.repo.findById(id);
    if (!current) req.reject(404, `Imputations '${id}' not found`);

    const claims = this.auth.getRequestClaims(req);
    this.auth.requireReviewerRole(req, claims);

    const allowedFrom = IMPUTATION_TRANSITIONS[action] ?? new Set();
    if (!allowedFrom.has(current.validationStatus)) {
      req.reject(
        409,
        `Cannot ${action} Imputations '${id}': current validationStatus is '${current.validationStatus}'`
      );
    }

    return this.repo.updateById(id, {
      ...changes,
      validatedBy: claims.sub,
    });
  }
}

module.exports = ImputationDomainService;
