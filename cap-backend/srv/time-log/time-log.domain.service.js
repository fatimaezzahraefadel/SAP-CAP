'use strict';

const TimeLogRepo = require('./time-log.repo');
const AuthDomainService = require('../auth/auth.domain.service');
const { assertEntityExists, ENTITIES, MANAGER_ROLES, requireOwnerOrRole } = require('../shared/services/validation');
const { restrictReadToOwnerUnlessStaff } = require('../shared/services/authz');
const { nowIso } = require('../shared/utils/timestamp');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
const isManagerRole = (claims) => MANAGER_ROLES.has(String(claims?.role ?? ''));

const assertDuration = (value, req) => {
  if (value === undefined || value === null) return;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 1440) {
    req.error(400, 'durationMinutes must be between 0 and 1440');
  }
};

class TimeLogDomainService {
  constructor(_srv) {
    this.repo = new TimeLogRepo();
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

    assertDuration(data.durationMinutes, req);
    if (!data.date) req.error(400, 'date is required');
  }

  async beforeUpdate(req) {
    const data = req.data;
    const claims = this.auth.getRequestClaims(req);
    const id = extractEntityId(req);
    const current = id ? await this.repo.findById(id) : null;
    if (!current) {
      req.reject(404, 'TimeLog not found');
      return;
    }

    requireOwnerOrRole(req, current.consultantId, MANAGER_ROLES, 'You can only update your own time logs');

    if (current?.sentToStraTIME) {
      req.reject(409, 'TimeLog is immutable once sent to StraTIME');
    }

    const protectedFields = ['sentToStraTIME', 'sentAt'];
    for (const field of protectedFields) {
      if (data[field] !== undefined && current && data[field] !== current[field]) {
        req.reject(403, 'Use sendToStraTIME action to update StraTIME metadata');
      }
    }

    if (data.consultantId !== undefined) {
      if (String(data.consultantId) !== String(current.consultantId)) {
        req.reject(403, 'consultantId cannot be reassigned');
      }
      if (!isManagerRole(claims)) {
        data.consultantId = current.consultantId;
      }
      await assertEntityExists(ENTITIES.Users, data.consultantId, 'consultantId', req);
    }
    if (data.ticketId !== undefined) {
      await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);
    }
    if (data.projectId !== undefined) {
      await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    }

    assertDuration(data.durationMinutes, req);
    if (data.date !== undefined && !data.date) req.error(400, 'date is required');
  }

  async beforeDelete(req) {
    const id = extractEntityId(req);
    if (!id) return;

    const current = await this.repo.findById(id);
    if (!current) return;

    requireOwnerOrRole(req, current.consultantId, MANAGER_ROLES, 'You can only delete your own time logs');
  }

  async sendToStraTIME(req) {
    const id = extractEntityId(req);
    if (!id) req.reject(400, 'Missing TimeLogs ID');

    const current = await this.repo.findById(id);
    if (!current) req.reject(404, `TimeLogs '${id}' not found`);

    const claims = this.auth.getRequestClaims(req);
    this.auth.requireOwnerOrReviewer(req, current, 'consultantId', claims);

    return this.repo.updateById(id, {
      sentToStraTIME: true,
      sentAt: nowIso(),
    });
  }
}

module.exports = TimeLogDomainService;
