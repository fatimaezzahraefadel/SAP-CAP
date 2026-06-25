'use strict';

const cds = require('@sap/cds');
const UserRepo = require('./user.repo');
const { ADMIN_ONLY, requireRole, requireOwnerOrRole } = require('../shared/services/validation');
const { getRequestContext } = require('../_shared/auth/request-context');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const SELF_SERVICE_FIELDS = new Set(['name', 'skills', 'certifications', 'availabilityPercent', 'avatarUrl']);
const XSUAA_AUTH_ENABLED =
  cds.env?.requires?.auth?.kind === 'xsuaa' ||
  cds.env?.requires?.auth?.strategy === 'xsuaa';
const XSUAA_MANAGED_FIELDS = new Set(['email', 'role', 'active']);

class UserDomainService {
  constructor(_srv) {
    this.repo = new UserRepo();
  }

  beforeRead(req) {
    if (!XSUAA_AUTH_ENABLED) return;

    const select = req.query?.SELECT;
    if (!select) return;

    const xsuaaProfileFilter = [
      { ref: ['identityProvider'] },
      '=',
      { val: 'XSUAA' },
    ];

    select.where = select.where?.length
      ? ['(', ...select.where, ')', 'and', ...xsuaaProfileFilter]
      : xsuaaProfileFilter;
  }

  async beforeCreate(req) {
    if (XSUAA_AUTH_ENABLED) {
      req.reject(403, 'Users are managed by BTP/XSUAA role collections');
    }

    requireRole(req, ADMIN_ONLY, 'Only ADMIN can create users');
    const email = normalizeEmail(req.data?.email);
    if (!email) req.reject(400, 'email is required');
    req.data.email = email;

    const existing = await this.repo.findByEmail(email);
    if (existing) req.reject(409, `A user with email '${email}' already exists`);
  }

  async beforeUpdate(req) {
    const id = extractEntityId(req);
    requireOwnerOrRole(req, id, ADMIN_ONLY, 'Only ADMIN can update users');

    if (XSUAA_AUTH_ENABLED) {
      const forbiddenFields = Object.keys(req.data ?? {}).filter(
        (field) => XSUAA_MANAGED_FIELDS.has(field)
      );
      if (forbiddenFields.length > 0) {
        req.reject(403, 'email, role, and active status are managed by BTP/XSUAA');
      }
    }

    const ctx = getRequestContext(req);
    if (ctx.dbUserId === String(id ?? '') || ctx.userId === String(id ?? '')) {
      const forbiddenFields = Object.keys(req.data ?? {}).filter(
        (field) => !SELF_SERVICE_FIELDS.has(field) && field !== 'ID' && field !== 'id'
      );
      if (forbiddenFields.length > 0) {
        req.reject(403, 'Only profile and certification fields can be updated by the user');
      }
    }

    if (req.data?.email === undefined) return;

    const email = normalizeEmail(req.data.email);
    if (!email) req.reject(400, 'email is required');
    req.data.email = email;

    const existing = await this.repo.findByEmail(email);
    if (existing && String(existing.ID) !== String(id)) {
      req.reject(409, `A user with email '${email}' already exists`);
    }
  }

  async beforeDelete(req) {
    if (XSUAA_AUTH_ENABLED) {
      req.reject(403, 'Users are managed by BTP/XSUAA role collections');
    }

    requireRole(req, ADMIN_ONLY, 'Only ADMIN can delete users');
    const id = extractEntityId(req);
    if (!id) return;

    const hasReferences = await this.repo.hasReferences(id);
    if (hasReferences) {
      req.reject(409, 'Cannot delete user that is referenced by other records');
    }
  }
}

module.exports = UserDomainService;
