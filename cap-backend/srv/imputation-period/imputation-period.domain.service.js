'use strict';

const ImputationPeriodRepo = require('./imputation-period.repo');
const AuthDomainService = require('../auth/auth.domain.service');
const {
  assertRequiredValue,
  assertEntityExists,
  assertDateRange,
  ENTITIES,
  MANAGER_ROLES,
  requireOwnerOrRole,
} = require('../shared/services/validation');
const { restrictReadToOwnerUnlessStaff } = require('../shared/services/authz');
const { nowIso } = require('../shared/utils/timestamp');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
const isManagerRole = (claims) => MANAGER_ROLES.has(String(claims?.role ?? ''));

const PERIOD_TRANSITIONS = {
  submit: new Set(['DRAFT', 'REJECTED']),
  validate: new Set(['SUBMITTED']),
  rejectEntry: new Set(['SUBMITTED']),
};

class ImputationPeriodDomainService {
  constructor(_srv) {
    this.repo = new ImputationPeriodRepo();
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
    if (!isManagerRole(claims)) {
      if (data.consultantId !== undefined && String(data.consultantId) !== dbUserId) {
        req.reject(403, 'consultantId must match the authenticated user');
      }
      data.consultantId = dbUserId;
    }

    assertRequiredValue(data.consultantId, 'consultantId', req);
    assertRequiredValue(data.startDate, 'startDate', req);
    assertRequiredValue(data.endDate, 'endDate', req);
    await assertEntityExists(ENTITIES.Users, data.consultantId, 'consultantId', req);

    if (!String(data.periodKey ?? '').trim()) req.error(400, 'periodKey is required');
    assertDateRange(data.startDate, data.endDate, req);
    if (data.status === undefined) data.status = 'DRAFT';
  }

  async beforeUpdate(req) {
    const data = req.data;
    const claims = this.auth.getRequestClaims(req);
    const id = extractEntityId(req);
    const current = id ? await this.repo.findById(id) : null;
    if (!current) {
      req.reject(404, 'Imputation period not found');
      return;
    }

    requireOwnerOrRole(
      req,
      current.consultantId,
      MANAGER_ROLES,
      'You can only update your own imputation periods'
    );

    if (
      data.consultantId !== undefined &&
      String(data.consultantId) !== String(current.consultantId)
    ) {
      req.reject(403, 'consultantId cannot be reassigned');
    }

    const protectedFields = [
      'status',
      'submittedAt',
      'validatedBy',
      'validatedAt',
      'sentToStraTIME',
      'sentBy',
      'sentAt',
    ];

    for (const field of protectedFields) {
      if (data[field] !== undefined && current && data[field] !== current[field]) {
        req.reject(403, 'Use submit/validate/rejectEntry/sendToStraTIME actions to change status metadata');
      }
    }

    if (data.consultantId !== undefined) {
      if (!isManagerRole(claims)) {
        data.consultantId = current.consultantId;
      }
      await assertEntityExists(ENTITIES.Users, data.consultantId, 'consultantId', req);
    }
    if (data.periodKey !== undefined && !String(data.periodKey).trim()) {
      req.error(400, 'periodKey is required');
    }
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const startDate = data.startDate ?? current?.startDate;
      const endDate = data.endDate ?? current?.endDate;
      assertDateRange(startDate, endDate, req);
    }
  }

  async beforeDelete(req) {
    const id = extractEntityId(req);
    if (!id) return;

    const current = await this.repo.findById(id);
    if (!current) return;

    requireOwnerOrRole(
      req,
      current.consultantId,
      MANAGER_ROLES,
      'You can only delete your own imputation periods'
    );
  }

  async submit(req) {
    return this._applyTransition(req, 'submit', () => {
      return {
        status: 'SUBMITTED',
        submittedAt: nowIso(),
        validatedBy: null,
        validatedAt: null,
        sentToStraTIME: false,
        sentBy: null,
        sentAt: null,
      };
    });
  }

  async validate(req) {
    return this._applyTransition(req, 'validate', (claims) => ({
      status: 'VALIDATED',
      validatedBy: claims.sub,
      validatedAt: nowIso(),
    }));
  }

  async rejectEntry(req) {
    return this._applyTransition(req, 'rejectEntry', (claims) => ({
      status: 'REJECTED',
      validatedBy: claims.sub,
      validatedAt: nowIso(),
    }));
  }

  async sendToStraTIME(req) {
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'Missing ImputationPeriods ID');

    const current = await this.repo.findById(id);
    if (!current) req.reject(404, `ImputationPeriods '${id}' not found`);

    const claims = this.auth.getRequestClaims(req);
    this.auth.requireReviewerRole(req, claims);

    return this.repo.updateById(id, {
      sentToStraTIME: true,
      sentBy: claims.sub,
      sentAt: nowIso(),
    });
  }

  async _applyTransition(req, action, buildChanges) {
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'Missing ImputationPeriods ID');

    const current = await this.repo.findById(id);
    if (!current) req.reject(404, `ImputationPeriods '${id}' not found`);

    const claims = this.auth.getRequestClaims(req);
    if (action === 'submit') {
      this.auth.requireOwnerOrReviewer(req, current, 'consultantId', claims);
    } else {
      this.auth.requireReviewerRole(req, claims);
    }

    const allowedFrom = PERIOD_TRANSITIONS[action] ?? new Set();
    if (!allowedFrom.has(current.status)) {
      req.reject(409, `Cannot ${action} ImputationPeriods '${id}': current status is '${current.status}'`);
    }

    return this.repo.updateById(id, buildChanges(claims));
  }
}

module.exports = ImputationPeriodDomainService;
