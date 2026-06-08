'use strict';

const crypto = require('node:crypto');
const cds = require('@sap/cds');
const AuthRepo = require('./auth.repo');
const { getRequestContext } = require('../_shared/auth/request-context');

const DEMO_PASSWORD_BY_EMAIL = Object.freeze({
  'alice.admin@inetum.com': 'Admin#2026',
  'marc.manager@inetum.com': 'Manager#2026',
  'theo.tech@inetum.com': 'Tech#2026',
  'fatima.fonc@inetum.com': 'Func#2026',
  'pierre.pm@inetum.com': 'PM#2026',
  'diana.devco@inetum.com': 'DevCo#2026',
});

const DEFAULT_DEV_JWT_SECRET = 'dev-local-mock-jwt-secret-change-me';
const authConfig = cds.env?.requires?.auth;
const MOCKED_AUTH_ENABLED =
  authConfig === 'mocked' ||
  authConfig?.kind === 'mocked' ||
  authConfig?.strategy === 'mocked';
const XSUAA_AUTH_ENABLED = authConfig?.kind === 'xsuaa' || authConfig?.strategy === 'xsuaa';

const JWT_SECRET = process.env.MOCK_JWT_SECRET || DEFAULT_DEV_JWT_SECRET;
if (MOCKED_AUTH_ENABLED && !process.env.MOCK_JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[auth] FATAL: MOCK_JWT_SECRET must be set in production. Refusing to start with default secret.');
  }
  console.warn('[auth] MOCK_JWT_SECRET is not set; using development fallback secret.');
}

const JWT_TTL_SECONDS = Number(process.env.MOCK_JWT_TTL_SECONDS || 8 * 60 * 60);
const REVIEWER_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER']);
const PUBLIC_EVENTS = new Set(['authenticate']);
const MOCKED_ANONYMOUS_IDS = new Set(['anonymous', 'unauthenticated-user']);

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left ?? ''), 'utf8');
  const rightBuffer = Buffer.from(String(right ?? ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const toBase64Url = (value) =>
  Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const fromBase64Url = (value) => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const signMockJwt = (claims) => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify(claims));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${header}.${payload}.${signature}`;
};

const verifyMockJwt = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  if (!safeEqual(signature, expected)) return null;
  try {
    const decoded = JSON.parse(fromBase64Url(payload));
    if (decoded.exp && Number(decoded.exp) <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
};

const getHeader = (req, name) => {
  const lowerName = String(name).toLowerCase();
  const headers = req?.headers ?? req?.http?.req?.headers ?? req?._?.req?.headers ?? {};
  return headers[name] ?? headers[lowerName] ?? '';
};

const extractBearerToken = (req) => {
  const authHeader = String(getHeader(req, 'authorization') || '');
  const [scheme, token] = authHeader.split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token.trim();
};

const claimsFromMockedUser = (req) => {
  const reqUser = req?.user;
  const reqUserId = String(reqUser?.id ?? reqUser?.ID ?? '').trim();
  const reqUserEmail = String(reqUser?.email ?? '').trim();
  const reqUserRole = String(reqUser?.role ?? '').trim();

  // In CAP mocked mode, req.user may be sparse; ensure stable fallback claims.
  return {
    sub: reqUserId,
    email: reqUserEmail || 'mocked.dev@local',
    role: reqUserRole || 'ADMIN',
    name: reqUser?.name || 'Mocked Dev User',
    mocked: true,
  };
};

const hasMockedPrincipal = (req) => {
  const reqUser = req?.user;
  const id = String(reqUser?.id ?? reqUser?.ID ?? '').trim();
  if (!id) return false;
  return !MOCKED_ANONYMOUS_IDS.has(id.toLowerCase());
};

class AuthDomainService {
  constructor(_srv) {
    this.repo = new AuthRepo();
  }

  isPublicEvent(event) {
    return PUBLIC_EVENTS.has(event);
  }

  verify(token) {
    return verifyMockJwt(token);
  }

  authenticateRequest(req) {
    const token = extractBearerToken(req);

    if (MOCKED_AUTH_ENABLED && token) {
      const claims = this.verify(token);
      if (!claims?.sub || !claims?.role) req.reject(401, 'Invalid or expired token');
      return claims;
    }

    if (MOCKED_AUTH_ENABLED && hasMockedPrincipal(req)) {
      return claimsFromMockedUser(req);
    }

    const ctx = getRequestContext(req);
    if (ctx.isAuthenticated) {
      return { sub: ctx.userId, userId: ctx.userId, role: ctx.role, email: ctx.email };
    }

    req.reject(401, 'Missing Bearer token');
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
    const displayName = String(
      xsuaaUser.name ||
      attr.displayName ||
      [attr.given_name, attr.family_name].filter(Boolean).join(' ') ||
      email ||
      ''
    ).trim();

    if (XSUAA_AUTH_ENABLED) {
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

    const user =
      (email ? await this.repo.findUserByEmail(email) : null) ||
      await this.repo.findUserByRole(claims.role);

    if (!user) req.reject(403, `No active local app user is configured for role ${claims.role}`);

    return this.toAuthUser(user, {
      email: email || user.email,
      name: displayName || user.name,
    });
  }

  async authenticate(req) {
    const email = normalizeEmail(req.data?.email);
    const password = String(req.data?.password ?? '');

    if (!email || !password) req.reject(401, 'Invalid credentials');
    const expectedPassword = DEMO_PASSWORD_BY_EMAIL[email];
    if (!expectedPassword || !safeEqual(password, expectedPassword)) {
      req.reject(401, 'Invalid credentials');
    }

    const user = await this.repo.findUserByEmail(email);
    if (!user) req.reject(401, 'Invalid credentials');

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAtEpoch = issuedAt + JWT_TTL_SECONDS;
    const token = signMockJwt({
      iss: 'sap-performance-dashboard',
      aud: 'sap-performance-dashboard-ui',
      iat: issuedAt,
      exp: expiresAtEpoch,
      sub: user.ID,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      token,
      expiresAt: new Date(expiresAtEpoch * 1000).toISOString(),
      user: this.toAuthUser(user),
    };
  }

}

module.exports = AuthDomainService;
module.exports.DEMO_PASSWORD_BY_EMAIL = DEMO_PASSWORD_BY_EMAIL;
module.exports.JWT_TTL_SECONDS = JWT_TTL_SECONDS;
module.exports.REVIEWER_ROLES = REVIEWER_ROLES;
module.exports.PUBLIC_EVENTS = PUBLIC_EVENTS;
module.exports.signMockJwt = signMockJwt;
module.exports.verifyMockJwt = verifyMockJwt;
module.exports.safeEqual = safeEqual;
module.exports.toBase64Url = toBase64Url;
module.exports.fromBase64Url = fromBase64Url;
