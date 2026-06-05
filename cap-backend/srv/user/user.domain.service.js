'use strict';

const UserRepo = require('./user.repo');
const { ADMIN_ONLY, requireRole, requireOwnerOrRole } = require('../shared/services/validation');
const { getRequestContext } = require('../_shared/auth/request-context');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const SELF_SERVICE_FIELDS = new Set(['name', 'skills', 'certifications', 'availabilityPercent', 'avatarUrl']);

class UserDomainService {
  constructor(_srv) {
    this.repo = new UserRepo();
  }

  async beforeCreate(req) {
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

    if (getRequestContext(req).userId === String(id ?? '')) {
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
