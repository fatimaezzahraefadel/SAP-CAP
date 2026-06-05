'use strict';

describe('AuthDomainService in XSUAA mode', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMockJwtSecret = process.env.MOCK_JWT_SECRET;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@sap/cds');
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMockJwtSecret === undefined) {
      delete process.env.MOCK_JWT_SECRET;
    } else {
      process.env.MOCK_JWT_SECRET = originalMockJwtSecret;
    }
  });

  test('does not require MOCK_JWT_SECRET and accepts CAP XSUAA user context', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MOCK_JWT_SECRET;

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
        headers: {
          authorization: 'Bearer xsuaa-token-from-approuter',
        },
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

  test('currentUser maps an XSUAA role to an active local app user', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MOCK_JWT_SECRET;

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
        findUserByEmail: jest.fn().mockResolvedValue(null),
        findUserByRole: jest.fn().mockResolvedValue({
          ID: 'u-admin',
          name: 'Admin Profile',
          email: 'alice.admin@inetum.com',
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
        id: 'u-admin',
        name: 'SAP Admin',
        email: 'sap.admin@example.test',
        role: 'ADMIN',
        active: true,
      }));
      expect(domain.repo.findUserByRole).toHaveBeenCalledWith('ADMIN');
    });
  });
});
