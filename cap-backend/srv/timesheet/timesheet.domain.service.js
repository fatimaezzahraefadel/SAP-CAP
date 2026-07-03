'use strict';

const TimesheetRepo = require('./timesheet.repo');
const AuthDomainService = require('../auth/auth.domain.service');
const {
  assertRequiredValue,
  assertEntityExists,
  ENTITIES,
  MANAGER_ROLES,
  requireOwnerOrRole,
} = require('../shared/services/validation');
const { restrictReadToOwnerUnlessStaff } = require('../shared/services/authz');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
const isManagerRole = (claims) => MANAGER_ROLES.has(String(claims?.role ?? ''));

const assertHoursRange = (hours, req) => {
  if (hours === undefined || hours === null) return;
  const num = Number(hours);
  if (!Number.isFinite(num) || num < 0 || num > 24) {
    req.error(400, 'hours must be between 0 and 24');
  }
};

class TimesheetDomainService {
  constructor(_srv) {
    this.repo = new TimesheetRepo();
    this.auth = new AuthDomainService();
  }

  beforeRead(req) {
    restrictReadToOwnerUnlessStaff(req, 'userId');
  }

  async beforeCreate(req) {
    const data = req.data;
    const claims = this.auth.getRequestClaims(req);
    const authUser = await this.auth.currentUser(req);
    const dbUserId = String(authUser.id ?? '').trim();

    if (!dbUserId) req.reject(401, 'Missing authenticated user');
    if (!isManagerRole(claims)) {
      if (data.userId !== undefined && String(data.userId) !== dbUserId) {
        req.reject(403, 'userId must match the authenticated user');
      }
      data.userId = dbUserId;
    }

    assertRequiredValue(data.userId, 'userId', req);
    assertRequiredValue(data.projectId, 'projectId', req);
    assertRequiredValue(data.date, 'date', req);
    await assertEntityExists(ENTITIES.Users, data.userId, 'userId', req);
    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);

    assertHoursRange(data.hours, req);
  }

  async beforeUpdate(req) {
    const data = req.data;
    const claims = this.auth.getRequestClaims(req);
    const id = extractEntityId(req);
    const current = id ? await this.repo.findById(id) : null;
    if (!current) {
      req.reject(404, 'Timesheet not found');
      return;
    }

    requireOwnerOrRole(req, current.userId, MANAGER_ROLES, 'You can only update your own timesheets');

    if (data.userId !== undefined) {
      if (String(data.userId) !== String(current.userId)) {
        req.reject(403, 'userId cannot be reassigned');
      }
      if (!isManagerRole(claims)) {
        data.userId = current.userId;
      }
      await assertEntityExists(ENTITIES.Users, data.userId, 'userId', req);
    }
    if (data.projectId !== undefined) {
      await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    }
    if (data.ticketId !== undefined) {
      await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);
    }

    assertHoursRange(data.hours, req);
    if (data.date !== undefined && !data.date) req.error(400, 'date is required');
  }

  async beforeDelete(req) {
    const id = extractEntityId(req);
    if (!id) return;

    const current = await this.repo.findById(id);
    if (!current) return;

    requireOwnerOrRole(req, current.userId, MANAGER_ROLES, 'You can only delete your own timesheets');
  }
}

module.exports = TimesheetDomainService;
