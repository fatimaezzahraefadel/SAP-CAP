'use strict';

const AuthRepo = require('./auth.repo');
const { getRequestContext } = require('../_shared/auth/request-context');

const REVIEWER_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER']);
const PUBLIC_EVENTS = new Set();

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const normalizeString = (value) => String(value ?? '').trim();
const isTestRuntime = () => Boolean(process.env.JEST_WORKER_ID) || process.env.NODE_ENV === 'test';

const getHeader = (req, name) => {
  const lowerName = String(name).toLowerCase();
  const headers = req?.headers ?? req?.http?.req?.headers ?? req?._?.req?.headers ?? {};
  return headers[name] ?? headers[lowerName] ?? '';
};

const getTestClaims = (req) => {
  if (!isTestRuntime()) return null;

  const userId = normalizeString(getHeader(req, 'x-test-user-id'));
  const role = normalizeString(getHeader(req, 'x-test-user-role'));
  if (!userId || !role) return null;

  return {
    sub: userId,
    userId,
    email: normalizeEmail(getHeader(req, 'x-test-user-email')),
    role,
    name: normalizeString(getHeader(req, 'x-test-user-name')),
    test: true,
  };
};

class AuthDomainService {
  constructor(_srv) {
    this.repo = new AuthRepo();
  }

  isPublicEvent(event) {
    return PUBLIC_EVENTS.has(event);
  }

  authenticateRequest(req) {
    const testClaims = getTestClaims(req);
    if (testClaims) return testClaims;

    if (isTestRuntime() && req?._?.req) {
      req.reject(401, 'Missing authenticated test principal');
    }

    const ctx = getRequestContext(req);
    if (ctx.isAuthenticated) {
      return { sub: ctx.userId, userId: ctx.userId, role: ctx.role, email: ctx.email };
    }

    req.reject(401, 'Missing authenticated XSUAA user');
  }

  getRequestClaims(req) {
    const ctx = getRequestContext(req);
    if (ctx.isAuthenticated) {
      return { sub: ctx.userId, userId: ctx.userId, role: ctx.role, email: ctx.email };
    }
    return this.authenticateRequest(req);
  }

  requireReviewerRole(req, claims) {
    if (!REVIEWER_ROLES.has(String(claims.role))) {
      req.reject(403, 'Only reviewers can execute this action');
    }
  }

  requireOwnerOrReviewer(req, current, ownerField, claims) {
    const isOwner = String(current?.[ownerField] ?? '') === String(claims.sub ?? '');
    if (!isOwner && !REVIEWER_ROLES.has(String(claims.role))) {
      req.reject(403, 'You are not allowed to execute this action for this record');
    }
  }

  toAuthUser(user, overrides = {}) {
    return {
      id: user.ID,
      name: overrides.name || user.name,
      email: overrides.email || user.email,
      role: user.role,
      active: Boolean(user.active),
      skills: user.skills ?? '[]',
      certifications: user.certifications ?? '[]',
      availabilityPercent: Number(user.availabilityPercent ?? 100),
      teamId: user.teamId ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  async currentUser(req) {
    const claims = this.getRequestClaims(req);
    if (!claims?.role) req.reject(403, 'No Ticket-CAP role collection assigned to this SAP user');

    const xsuaaUser = req?.user ?? {};
    const attr = xsuaaUser.attr ?? {};
    const email = normalizeEmail(claims.email || attr.email);
    const displayName = normalizeString(
      xsuaaUser.name ||
      attr.displayName ||
      [attr.given_name, attr.family_name].filter(Boolean).join(' ') ||
      claims.name ||
      email
    );

    const user = await this.repo.upsertUserFromXsuaa({
      id: claims.userId || claims.sub,
      email,
      name: displayName,
      role: claims.role,
    });

    return this.toAuthUser(user, {
      email: email || user.email,
      name: displayName || user.name,
    });
  }
}

module.exports = AuthDomainService;
module.exports.REVIEWER_ROLES = REVIEWER_ROLES;
module.exports.PUBLIC_EVENTS = PUBLIC_EVENTS;
