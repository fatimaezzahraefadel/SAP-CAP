'use strict';

/**
 * Single chokepoint for reading the authenticated user.
 *
 * Two token sources are supported transparently so domains never have to care
 * which one is active:
 *
 *  1. **Mocked-JWT mode (local dev / tests)** — auth/auth.domain.service.js
 *     verifies an HS256 JWT and stores the claims on `req._authClaims` (or
 *     `req.authContext`) as `{ sub, role, email }`.
 *
 *  2. **XSUAA mode (BTP Cloud Foundry)** — `@sap/xssec` validates the bearer
 *     token issued by XSUAA and CAP populates `req.user` with `{ id, attr,
 *     hasRole(scope) }`. Scopes look like `<xsappname>.Admin`; this module
 *     maps them back to the internal role constants used by the permission
 *     engine.
 *
 * Everything downstream (policies, repos, audit) keeps reading the same clean
 * `{ userId, role, email, isAuthenticated }` object.
 */

const normalizeString = (value) => String(value ?? '').trim();

// Map an XSUAA scope tail (`Admin`, `Manager`, ...) to the internal role
// constant. Keep this in sync with srv/_shared/security/roles.js and the
// `role-templates` block in xs-security.json at the repo root.
const XSUAA_SCOPE_TO_ROLE = Object.freeze({
  Admin: 'ADMIN',
  Manager: 'MANAGER',
  ProjectManager: 'PROJECT_MANAGER',
  DevCoordinator: 'DEV_COORDINATOR',
  ConsultantTechnique: 'CONSULTANT_TECHNIQUE',
  ConsultantFonctionnel: 'CONSULTANT_FONCTIONNEL',
});

// Priority order — if a user holds multiple role scopes, the highest wins.
// Matches the natural privilege hierarchy used in the policies.
const ROLE_PRIORITY = [
  'ADMIN',
  'MANAGER',
  'PROJECT_MANAGER',
  'DEV_COORDINATOR',
  'CONSULTANT_FONCTIONNEL',
  'CONSULTANT_TECHNIQUE',
];

/**
 * Derive the internal role string from an XSUAA-shaped `req.user`.
 * Two shapes are accepted:
 *   - `user.roles` — array of scope strings (preferred, CAP normalises to this)
 *   - `user.hasRole(scopeTail)` — passport-style predicate from @sap/xssec
 *   - `user.is(scopeTail)` — CAP user role predicate
 */
function roleFromXsuaaUser(user) {
  if (!user || typeof user !== 'object') return '';

  const candidates = new Set();

  if (Array.isArray(user.roles)) {
    for (const scope of user.roles) {
      const tail = String(scope).split('.').pop();
      const mapped = XSUAA_SCOPE_TO_ROLE[tail];
      if (mapped) candidates.add(mapped);
    }
  }

  if (typeof user.hasRole === 'function') {
    for (const [scopeTail, internalRole] of Object.entries(XSUAA_SCOPE_TO_ROLE)) {
      try {
        if (user.hasRole(scopeTail)) candidates.add(internalRole);
      } catch {
        // hasRole signatures vary across @sap/xssec versions — ignore failures.
      }
    }
  }

  if (typeof user.is === 'function') {
    for (const [scopeTail, internalRole] of Object.entries(XSUAA_SCOPE_TO_ROLE)) {
      try {
        if (user.is(scopeTail)) candidates.add(internalRole);
      } catch {
        // CAP role predicates are environment-specific — ignore failures.
      }
    }
  }

  for (const role of ROLE_PRIORITY) {
    if (candidates.has(role)) return role;
  }
  return '';
}

function getRequestContext(req) {
  const claims = req?.authContext ?? req?._authClaims ?? null;

  // Userid — prefer the verified claim, fall back to req.user.id (XSUAA) or
  // the dev-only x-user-id header.
  const userId = normalizeString(
    claims?.sub ?? claims?.userId ?? req?.user?.id ?? req?.headers?.['x-user-id']
  );

  // Role — prefer the mocked claim, otherwise derive from XSUAA scopes.
  const role = normalizeString(claims?.role) || roleFromXsuaaUser(req?.user);

  const email = normalizeString(
    claims?.email ?? req?.user?.attr?.email ?? req?.user?.email
  );

  return {
    userId,
    role,
    email,
    isAuthenticated: Boolean(userId && role),
  };
}

module.exports = {
  getRequestContext,
  XSUAA_SCOPE_TO_ROLE,
  ROLE_PRIORITY,
  roleFromXsuaaUser, // exported for tests
};
