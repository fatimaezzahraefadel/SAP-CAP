'use strict';
/**
 * Unit tests for the dual-mode request-context: mocked-JWT (local/tests) and
 * XSUAA scopes (BTP). Pure functions, no server needed.
 */
const {
  getRequestContext,
  roleFromXsuaaUser,
  XSUAA_SCOPE_TO_ROLE,
  ROLE_PRIORITY,
} = require('../srv/_shared/auth/request-context');

describe('getRequestContext — mocked-JWT mode', () => {
  test('reads sub / role / email from _authClaims', () => {
    const ctx = getRequestContext({
      _authClaims: { sub: 'u-1', role: 'ADMIN', email: 'a@b.com' },
    });
    expect(ctx).toEqual({
      userId: 'u-1', role: 'ADMIN', email: 'a@b.com', isAuthenticated: true,
    });
  });

  test('also accepts the `authContext` alias', () => {
    const ctx = getRequestContext({
      authContext: { sub: 'u-2', role: 'MANAGER' },
    });
    expect(ctx.userId).toBe('u-2');
    expect(ctx.role).toBe('MANAGER');
    expect(ctx.isAuthenticated).toBe(true);
  });

  test('missing role → isAuthenticated false', () => {
    const ctx = getRequestContext({ _authClaims: { sub: 'u-x' } });
    expect(ctx.isAuthenticated).toBe(false);
  });
});

describe('getRequestContext — XSUAA mode', () => {
  test('maps a single scope to the internal role', () => {
    const req = {
      user: {
        id: 'xsuaa-user-1',
        roles: ['ticket-cap.Manager'],
        attr: { email: 'mgr@inetum.com' },
      },
    };
    const ctx = getRequestContext(req);
    expect(ctx.userId).toBe('xsuaa-user-1');
    expect(ctx.role).toBe('MANAGER');
    expect(ctx.email).toBe('mgr@inetum.com');
    expect(ctx.isAuthenticated).toBe(true);
  });

  test('highest priority wins when multiple scopes are granted', () => {
    const req = {
      user: {
        id: 'multi-role-user',
        roles: ['ticket-cap.ConsultantTechnique', 'ticket-cap.Admin', 'ticket-cap.Manager'],
      },
    };
    expect(getRequestContext(req).role).toBe('ADMIN');
  });

  test('unknown scope tails are ignored', () => {
    const req = { user: { id: 'u', roles: ['ticket-cap.NotARealScope'] } };
    expect(getRequestContext(req).role).toBe('');
    expect(getRequestContext(req).isAuthenticated).toBe(false);
  });

  test('supports hasRole() predicate from @sap/xssec', () => {
    const granted = new Set(['Admin']);
    const req = {
      user: {
        id: 'u-hasrole',
        hasRole: (scope) => granted.has(scope),
      },
    };
    expect(getRequestContext(req).role).toBe('ADMIN');
  });

  test('supports is() predicate from CAP user objects', () => {
    const granted = new Set(['ProjectManager']);
    const req = {
      user: {
        id: 'u-is',
        is: (scope) => granted.has(scope),
      },
    };
    expect(getRequestContext(req).role).toBe('PROJECT_MANAGER');
  });

  test('all 6 documented roles map correctly', () => {
    expect(roleFromXsuaaUser({ roles: ['x.Admin'] })).toBe('ADMIN');
    expect(roleFromXsuaaUser({ roles: ['x.Manager'] })).toBe('MANAGER');
    expect(roleFromXsuaaUser({ roles: ['x.ProjectManager'] })).toBe('PROJECT_MANAGER');
    expect(roleFromXsuaaUser({ roles: ['x.DevCoordinator'] })).toBe('DEV_COORDINATOR');
    expect(roleFromXsuaaUser({ roles: ['x.ConsultantTechnique'] })).toBe('CONSULTANT_TECHNIQUE');
    expect(roleFromXsuaaUser({ roles: ['x.ConsultantFonctionnel'] })).toBe('CONSULTANT_FONCTIONNEL');
  });
});

describe('getRequestContext — no auth', () => {
  test('empty request → unauthenticated', () => {
    expect(getRequestContext({})).toEqual({
      userId: '', role: '', email: '', isAuthenticated: false,
    });
  });

  test('null / undefined safe', () => {
    expect(getRequestContext(null).isAuthenticated).toBe(false);
    expect(getRequestContext(undefined).isAuthenticated).toBe(false);
  });
});

describe('constants', () => {
  test('XSUAA_SCOPE_TO_ROLE covers every role in ROLE_PRIORITY', () => {
    const mappedRoles = new Set(Object.values(XSUAA_SCOPE_TO_ROLE));
    for (const role of ROLE_PRIORITY) {
      expect(mappedRoles.has(role)).toBe(true);
    }
  });

  test('ROLE_PRIORITY puts ADMIN first', () => {
    expect(ROLE_PRIORITY[0]).toBe('ADMIN');
  });
});
