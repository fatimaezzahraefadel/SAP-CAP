'use strict';

const cds = require('@sap/cds');
const { assertEntityExists, assertRequiredValue, ENTITIES } = require('../shared/services/validation');
const { getRequestContext } = require('../_shared/auth/request-context');

class NotificationDomainService {
  constructor(_srv) {
  }

  async beforeCreate(req) {
    const ctx = getRequestContext(req);
    if (!ctx.isAuthenticated) {
      req.reject(403, 'Not authorized to create notifications');
    }
    assertRequiredValue(req.data.userId, 'userId', req);
    // Notifications are a workflow side effect: any authenticated user can
    // notify the relevant counterpart (a manager allocating a consultant, a
    // consultant submitting a deliverable to a manager, etc.). We only require
    // that the recipient is a real user.
    await assertEntityExists(ENTITIES.Users, req.data.userId, 'userId', req);
  }

  beforeRead(req) {
    const ctx = getRequestContext(req);
    if (!ctx.isAuthenticated || ctx.role === 'ADMIN') return;

    const select = req.query?.SELECT;
    if (!select) return;

    const ownershipFilter = [{ ref: ['userId'] }, '=', { val: ctx.userId }];
    if (Array.isArray(select.where) && select.where.length > 0) {
      select.where = ['(', ...select.where, ')', 'and', ...ownershipFilter];
    } else {
      select.where = ownershipFilter;
    }
  }

  async beforeUpdate(req) {
    await this._checkOwnership(req);
  }

  async beforeDelete(req) {
    await this._checkOwnership(req);
  }

  async _checkOwnership(req) {
    const id = req.data?.ID ?? req.params?.[0]?.ID ?? req.params?.[0];
    const ctx = getRequestContext(req);
    if (!id || !ctx.isAuthenticated || ctx.role === 'ADMIN') return;

    const notif = await cds.db.run(SELECT.one.from(ENTITIES.Notifications).where({ ID: id }));
    if (notif && notif.userId !== ctx.userId) {
      req.reject(403, 'Not authorized to modify this notification');
    }
  }
}

module.exports = NotificationDomainService;
