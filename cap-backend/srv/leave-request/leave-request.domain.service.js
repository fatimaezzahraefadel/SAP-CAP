'use strict';

const cds = require('@sap/cds');
const LeaveRequestRepo = require('./leave-request.repo');
const AuthDomainService = require('../auth/auth.domain.service');
const { nowIso } = require('../shared/utils/timestamp');
const {
  assertRequiredValue,
  assertEntityExists,
  assertDateRange,
  ENTITIES,
  MANAGER_ROLES,
  requireRole,
  requireOwnerOrRole,
} = require('../shared/services/validation');
const { restrictReadToSelfOrManager } = require('../shared/services/authz');

const LEAVE_TRANSITIONS = {
  PENDING: new Set(['APPROVED', 'REJECTED']),
  APPROVED: new Set([]),
  REJECTED: new Set(['PENDING']),
};

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
const isManagerRole = (claims) => MANAGER_ROLES.has(String(claims?.role ?? ''));

class LeaveRequestDomainService {
  constructor(_srv) {
    this.repo = new LeaveRequestRepo();
    this.auth = new AuthDomainService();
  }

  beforeRead(req) {
    restrictReadToSelfOrManager(req, ['consultantId', 'managerId']);
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

    if (data.managerId === 'TBD') {
      const defaultManager = await cds.tx(req).run(
        SELECT.one.from('sap.performance.dashboard.db.Users').where({ role: 'MANAGER' })
      );
      data.managerId = defaultManager ? defaultManager.ID : data.consultantId;
    }

    assertRequiredValue(data.consultantId, 'consultantId', req);
    assertRequiredValue(data.managerId, 'managerId', req);
    assertRequiredValue(data.startDate, 'startDate', req);
    assertRequiredValue(data.endDate, 'endDate', req);
    await assertEntityExists(ENTITIES.Users, data.consultantId, 'consultantId', req);
    await assertEntityExists(ENTITIES.Users, data.managerId, 'managerId', req);

    assertDateRange(data.startDate, data.endDate, req);
    if (data.status === undefined) data.status = 'PENDING';
  }

  async beforeUpdate(req) {
    const data = req.data;
    const id = extractEntityId(req);
    const current = id ? await this.repo.findById(id) : null;
    if (!current) {
      req.reject(404, 'Leave request not found');
      return;
    }

    const claims = this.auth.getRequestClaims(req);
    requireOwnerOrRole(
      req,
      current.consultantId,
      MANAGER_ROLES,
      'You can only update your own leave requests'
    );

    if (data.consultantId !== undefined && String(data.consultantId) !== String(current.consultantId)) {
      req.reject(403, 'consultantId cannot be reassigned');
    }
    if (data.managerId !== undefined && String(data.managerId) !== String(current.managerId)) {
      req.reject(403, 'managerId cannot be reassigned');
    }
    if (data.consultantId !== undefined && !isManagerRole(claims)) {
      data.consultantId = current.consultantId;
    }
    if (data.managerId !== undefined && !isManagerRole(claims)) {
      data.managerId = current.managerId;
    }

    await assertEntityExists(ENTITIES.Users, data.consultantId, 'consultantId', req);
    await assertEntityExists(ENTITIES.Users, data.managerId, 'managerId', req);

    if (data.startDate !== undefined || data.endDate !== undefined) {
      const startDate = data.startDate ?? current?.startDate;
      const endDate = data.endDate ?? current?.endDate;
      assertDateRange(startDate, endDate, req);
    }

    if (data.status !== undefined && current && data.status !== current.status) {
      requireRole(req, MANAGER_ROLES, 'Only managers can approve/reject leave requests');
      const allowed = LEAVE_TRANSITIONS[current.status] || new Set();
      if (!allowed.has(data.status)) {
        req.reject(409, `Invalid leave request status transition: ${current.status} -> ${data.status}`);
      }
      if (data.status === 'APPROVED' || data.status === 'REJECTED') {
        data.reviewedAt = nowIso();
      }
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
      'You can only delete your own leave requests'
    );
  }
}

module.exports = LeaveRequestDomainService;
