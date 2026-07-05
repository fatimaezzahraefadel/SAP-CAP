'use strict';

describe('AuthDomainService in XSUAA mode', () => {
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@sap/cds');
    if (originalJestWorkerId === undefined) delete process.env.JEST_WORKER_ID;
    else process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  test('accepts CAP XSUAA user context', () => {
    jest.doMock('@sap/cds', () => ({
      env: {
        requires: {
          auth: { kind: 'xsuaa' },
        },
      },
    }));

    jest.isolateModules(() => {
      const AuthDomainService = require('../srv/auth/auth.domain.service');
      const domain = new AuthDomainService();

      const claims = domain.authenticateRequest({
        user: {
          id: 'xsuaa-user-1',
          roles: ['ticket-cap.Manager'],
          attr: { email: 'manager@example.test' },
        },
        reject: (status, message) => {
          throw new Error(`${status}: ${message}`);
        },
      });

      expect(claims).toEqual({
        sub: 'xsuaa-user-1',
        userId: 'xsuaa-user-1',
        role: 'MANAGER',
        email: 'manager@example.test',
      });
    });
  });

  test('accepts explicit test principal headers only under Jest', () => {
    process.env.JEST_WORKER_ID = '1';

    jest.isolateModules(() => {
      const AuthDomainService = require('../srv/auth/auth.domain.service');
      const domain = new AuthDomainService();

      const claims = domain.authenticateRequest({
        headers: {
          'x-test-user-id': 'u-admin',
          'x-test-user-role': 'ADMIN',
          'x-test-user-email': 'alice.admin@inetum.com',
        },
        reject: (status, message) => {
          throw new Error(`${status}: ${message}`);
        },
      });

      expect(claims).toEqual(expect.objectContaining({
        sub: 'u-admin',
        userId: 'u-admin',
        role: 'ADMIN',
        email: 'alice.admin@inetum.com',
        test: true,
      }));
    });
  });

  test('currentUser provisions an XSUAA user profile with the assigned BTP role', async () => {
    jest.doMock('@sap/cds', () => ({
      env: {
        requires: {
          auth: { kind: 'xsuaa' },
        },
      },
    }));

    await jest.isolateModulesAsync(async () => {
      const AuthDomainService = require('../srv/auth/auth.domain.service');
      const domain = new AuthDomainService();
      domain.repo = {
        upsertUserFromXsuaa: jest.fn().mockResolvedValue({
          ID: 'sap-user-1',
          name: 'SAP Admin',
          email: 'sap.admin@example.test',
          role: 'ADMIN',
          active: true,
          availabilityPercent: 100,
        }),
      };

      const user = await domain.currentUser({
        user: {
          id: 'sap-user-1',
          roles: ['ticket-cap.Admin'],
          attr: { email: 'sap.admin@example.test', given_name: 'SAP', family_name: 'Admin' },
        },
        reject: (status, message) => {
          throw new Error(`${status}: ${message}`);
        },
      });

      expect(user).toEqual(expect.objectContaining({
        id: 'sap-user-1',
        name: 'SAP Admin',
        email: 'sap.admin@example.test',
        role: 'ADMIN',
        active: true,
      }));
      expect(domain.repo.upsertUserFromXsuaa).toHaveBeenCalledWith({
        id: 'sap-user-1',
        email: 'sap.admin@example.test',
        name: 'SAP Admin',
        role: 'ADMIN',
      });
    });
  });
});
