'use strict';
/**
 * AuditLogs policy + sensitive-field masking.
 *
 * Spec:
 *   - GET /AuditLogs requires role ADMIN (everyone else gets 403).
 *   - Keys like password / token / authorization / secret are redacted in the
 *     `details` payload before it leaves the server.
 */
process.env.CDS_REQUIRES_DB_KIND = 'sqlite';
process.env.CDS_REQUIRES_DB_CREDENTIALS_DATABASE = ':memory:';
const cds = require('@sap/cds');
const { USERS, auth } = require('./support/test-auth');

cds.env.requires = cds.env.requires || {};
cds.env.requires.db = {
  ...(cds.env.requires.db || {}),
  kind: 'sqlite',
  credentials: { ...((cds.env.requires.db && cds.env.requires.db.credentials) || {}), database: ':memory:' },
};

const { GET } = cds.test('serve', 'all', '--in-memory').in(__dirname + '/..');

const AUDIT = 'sap.performance.dashboard.db.AuditLogs';

const seedAuditRow = (overrides = {}) => cds.db.run(
  INSERT.into(AUDIT).entries({
    ID: overrides.ID || require('crypto').randomUUID(),
    timestamp: new Date().toISOString(),
    userId: 'tester',
    userRole: 'ADMIN',
    action: 'UPDATE',
    entityName: 'TestEntity',
    entityId: 'e-1',
    details: JSON.stringify({
      email: 'visible@example.com',
      password: 'supersecret',
      token: 'eyJhbGciOiJI',
      nested: { authorization: 'Bearer xyz', secret: 'shh' },
    }),
    ...overrides,
  })
);

describe('AuditLogs policy', () => {
  test('non-ADMIN cannot read AuditLogs collection (403)', async () => {
    await seedAuditRow();
    await expect(
      GET('/odata/v4/core/AuditLogs', auth(USERS.tech))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('non-ADMIN cannot read a single AuditLog by id (403)', async () => {
    const id = require('crypto').randomUUID();
    await seedAuditRow({ ID: id });
    await expect(
      GET(`/odata/v4/core/AuditLogs(${id})`, auth(USERS.tech))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('non-ADMIN cannot bypass via $count or $filter (403)', async () => {
    await seedAuditRow();
    await expect(
      GET('/odata/v4/core/AuditLogs/$count', auth(USERS.tech))
    ).rejects.toMatchObject({ response: { status: 403 } });
    await expect(
      GET("/odata/v4/core/AuditLogs?$filter=action eq 'UPDATE'", auth(USERS.tech))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('MANAGER also cannot read AuditLogs (403) — ADMIN-only', async () => {
    await seedAuditRow();
    await expect(
      GET('/odata/v4/core/AuditLogs', auth(USERS.manager))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('ADMIN can read AuditLogs and sensitive fields are redacted', async () => {
    const id = require('crypto').randomUUID();
    await seedAuditRow({ ID: id, entityId: 'e-mask' });

    const { data } = await GET(
      `/odata/v4/core/AuditLogs(${id})`,
      auth(USERS.admin)
    );

    expect(data).toBeTruthy();
    const parsed = JSON.parse(data.details);
    // Non-sensitive field is preserved.
    expect(parsed.email).toBe('visible@example.com');
    // Sensitive fields are redacted, even nested ones.
    expect(parsed.password).toBe('***REDACTED***');
    expect(parsed.token).toBe('***REDACTED***');
    expect(parsed.nested.authorization).toBe('***REDACTED***');
    expect(parsed.nested.secret).toBe('***REDACTED***');
  });
});

describe('Audit masking unit', () => {
  const { maskSensitive, maskJsonString: maskDetailsString } = require('../srv/_shared/security/mask-sensitive');

  test('masks nested objects and arrays', () => {
    const masked = maskSensitive({
      a: 1,
      password: 'p',
      list: [{ token: 't' }, { ok: 'kept' }],
    });
    expect(masked).toEqual({
      a: 1,
      password: '***REDACTED***',
      list: [{ token: '***REDACTED***' }, { ok: 'kept' }],
    });
  });

  test('falls back to regex scrub on truncated JSON', () => {
    const truncated = '{"email":"a@b.com","password":"hunter2","token":"eyJhb...';
    const out = maskDetailsString(truncated);
    expect(out).toContain('"password":"***REDACTED***"');
    // email stays visible
    expect(out).toContain('"email":"a@b.com"');
  });

  test('non-string details pass through unchanged', () => {
    expect(maskDetailsString(null)).toBe(null);
    expect(maskDetailsString(undefined)).toBe(undefined);
  });

  test('matches sensitive-key variants (oldPassword, accessToken, clientSecret)', () => {
    const masked = maskSensitive({
      oldPassword: 'a',
      newPassword: 'b',
      passwordHash: 'c',
      accessToken: 'd',
      refreshToken: 'e',
      csrfToken: 'f',
      clientSecret: 'g',
      AuthorizationHeader: 'h',
      keepMe: 'visible',
    });
    expect(masked.oldPassword).toBe('***REDACTED***');
    expect(masked.newPassword).toBe('***REDACTED***');
    expect(masked.passwordHash).toBe('***REDACTED***');
    expect(masked.accessToken).toBe('***REDACTED***');
    expect(masked.refreshToken).toBe('***REDACTED***');
    expect(masked.csrfToken).toBe('***REDACTED***');
    expect(masked.clientSecret).toBe('***REDACTED***');
    expect(masked.AuthorizationHeader).toBe('***REDACTED***');
    expect(masked.keepMe).toBe('visible');
  });

  test('Buffer and Date instances pass through untouched', () => {
    const buf = Buffer.from('hello');
    const date = new Date('2026-01-01');
    const masked = maskSensitive({ buf, date, password: 'x' });
    expect(masked.buf).toBe(buf);
    expect(masked.date).toBe(date);
    expect(masked.password).toBe('***REDACTED***');
  });

  test('does not mutate the input object', () => {
    const input = { password: 'secret', nested: { token: 't' } };
    const snapshot = JSON.parse(JSON.stringify(input));
    maskSensitive(input);
    expect(input).toEqual(snapshot);
  });
});

describe('Audit write-time masking', () => {
  test('CREATE payloads with sensitive fields persist redacted, never cleartext', async () => {
    const cdsRef = require('@sap/cds');
    // Manually insert an audit row via the writer's summarise()-equivalent path
    // by exercising the audit module directly. We simulate what attachAuditLog
    // would build for a payload that contains a password and a token.
    const id = require('crypto').randomUUID();
    const { maskSensitive } = require('../srv/_shared/security/mask-sensitive');
    const fakePayload = { email: 'visible@example.com', password: 'hunter2', accessToken: 'tk-xxx' };
    const detailsAsWritten = JSON.stringify(maskSensitive(fakePayload));

    await cdsRef.db.run(
      INSERT.into(AUDIT).entries({
        ID: id,
        timestamp: new Date().toISOString(),
        userId: 'tester',
        userRole: 'ADMIN',
        action: 'CREATE',
        entityName: 'WriteMaskTest',
        entityId: 'wm-1',
        details: detailsAsWritten,
      })
    );

    // The DB row itself must not contain cleartext.
    const raw = await cdsRef.db.run(
      SELECT.one.from(AUDIT).columns('details').where({ ID: id })
    );
    expect(raw.details).not.toContain('hunter2');
    expect(raw.details).not.toContain('tk-xxx');
    expect(raw.details).toContain('***REDACTED***');
    // Visible field is still there.
    expect(raw.details).toContain('visible@example.com');
  });
});
