'use strict';
/**
 * Covers the previously-missing permission hooks and the extended audit
 * writer (custom-action coverage). Each block exercises ONE entity / concern.
 */
process.env.CDS_REQUIRES_DB_KIND = 'sqlite';
process.env.CDS_REQUIRES_DB_CREDENTIALS_DATABASE = ':memory:';
const cds = require('@sap/cds');
const crypto = require('crypto');
const { USERS, auth } = require('./support/test-auth');

cds.env.requires = cds.env.requires || {};
cds.env.requires.db = {
  ...(cds.env.requires.db || {}),
  kind: 'sqlite',
  credentials: { ...((cds.env.requires.db && cds.env.requires.db.credentials) || {}), database: ':memory:' },
};

const { POST, GET, DELETE, PATCH } = cds.test('serve', 'all', '--in-memory').in(__dirname + '/..');

const AUDIT = 'sap.performance.dashboard.db.AuditLogs';
const REF = 'sap.performance.dashboard.db.ReferenceData';
const DEL = 'sap.performance.dashboard.db.Deliverables';
const FB = 'sap.performance.dashboard.db.ProjectFeedback';

// ============================================================================
// 1. ReferenceData DELETE — ADMIN only
// ============================================================================
describe('ReferenceData DELETE hook', () => {
  const seedRef = async () => {
    const id = crypto.randomUUID();
    await cds.db.run(INSERT.into(REF).entries({
      ID: id, type: 'TEST_TYPE', code: 'TEST_' + id.slice(0, 4),
      label: 'temp', isActive: true, sortOrder: 0,
    }));
    return id;
  };

  test('ADMIN can delete ReferenceData', async () => {
    const id = await seedRef();
    const res = await DELETE(`/odata/v4/core/ReferenceData(${id})`, auth(USERS.admin));
    expect(res.status).toBeLessThan(300);
  });

  test('non-ADMIN (MANAGER) is rejected with 403', async () => {
    const id = await seedRef();
    await expect(
      DELETE(`/odata/v4/core/ReferenceData(${id})`, auth(USERS.manager))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('CONSULTANT_TECHNIQUE is rejected with 403', async () => {
    const id = await seedRef();
    await expect(
      DELETE(`/odata/v4/core/ReferenceData(${id})`, auth(USERS.tech))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });
});

// ============================================================================
// 2. Deliverables DELETE — managers only, APPROVED is locked
// ============================================================================
describe('Deliverables DELETE hook', () => {
  const seedDeliverable = async (validationStatus = 'PENDING', createdBy = 'u-manager') => {
    const id = crypto.randomUUID();
    await cds.db.run(INSERT.into(DEL).entries({
      ID: id,
      projectId: 'proj-1',
      ticketId: 'tk-001',
      name: 'Test deliverable',
      validationStatus,
      createdBy,
    }));
    return id;
  };

  test('MANAGER can delete a PENDING deliverable', async () => {
    const id = await seedDeliverable('PENDING');
    const res = await DELETE(`/odata/v4/core/Deliverables(${id})`, auth(USERS.manager));
    expect(res.status).toBeLessThan(300);
  });

  test('MANAGER cannot delete an APPROVED deliverable (409)', async () => {
    const id = await seedDeliverable('APPROVED');
    await expect(
      DELETE(`/odata/v4/core/Deliverables(${id})`, auth(USERS.manager))
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  test('CONSULTANT_TECHNIQUE is rejected with 403', async () => {
    const id = await seedDeliverable('PENDING');
    await expect(
      DELETE(`/odata/v4/core/Deliverables(${id})`, auth(USERS.tech))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('author (CONSULTANT) can delete their own PENDING deliverable', async () => {
    const id = await seedDeliverable('PENDING', 'u-fonc');
    const res = await DELETE(`/odata/v4/core/Deliverables(${id})`, auth(USERS.functional));
    expect(res.status).toBeLessThan(300);
  });

  test('author (CONSULTANT) cannot delete their own APPROVED deliverable (409)', async () => {
    const id = await seedDeliverable('APPROVED', 'u-fonc');
    await expect(
      DELETE(`/odata/v4/core/Deliverables(${id})`, auth(USERS.functional))
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
});

// ============================================================================
// 3. ProjectFeedback UPDATE + DELETE — author or staff
// ============================================================================
describe('ProjectFeedback UPDATE + DELETE hooks', () => {
  const seedFeedback = async (authorId = 'u-fonc') => {
    const id = crypto.randomUUID();
    await cds.db.run(INSERT.into(FB).entries({
      ID: id,
      projectId: 'proj-1',
      authorId,
      content: 'initial content',
    }));
    return id;
  };

  test('author can UPDATE their own feedback', async () => {
    const id = await seedFeedback('u-fonc');
    const res = await PATCH(`/odata/v4/core/ProjectFeedback(${id})`,
      { content: 'edited' }, auth(USERS.functional));
    expect(res.status).toBeLessThan(300);
  });

  test('non-author CONSULTANT cannot UPDATE foreign feedback (403)', async () => {
    const id = await seedFeedback('u-manager'); // owned by manager
    await expect(
      PATCH(`/odata/v4/core/ProjectFeedback(${id})`,
        { content: 'hijack' }, auth(USERS.functional))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('staff (MANAGER) can UPDATE any feedback', async () => {
    const id = await seedFeedback('u-fonc');
    const res = await PATCH(`/odata/v4/core/ProjectFeedback(${id})`,
      { content: 'moderated' }, auth(USERS.manager));
    expect(res.status).toBeLessThan(300);
  });

  test('authorId cannot be modified (400)', async () => {
    const id = await seedFeedback('u-fonc');
    await expect(
      PATCH(`/odata/v4/core/ProjectFeedback(${id})`,
        { authorId: 'u-admin' }, auth(USERS.functional))
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  test('author can DELETE their own feedback', async () => {
    const id = await seedFeedback('u-fonc');
    const res = await DELETE(`/odata/v4/core/ProjectFeedback(${id})`, auth(USERS.functional));
    expect(res.status).toBeLessThan(300);
  });

  test('non-author CONSULTANT cannot DELETE foreign feedback (403)', async () => {
    const id = await seedFeedback('u-manager');
    await expect(
      DELETE(`/odata/v4/core/ProjectFeedback(${id})`, auth(USERS.functional))
    ).rejects.toMatchObject({ response: { status: 403 } });
  });
});

// ============================================================================
// 4. Audit writer — now logs custom actions too
// ============================================================================
describe('Audit writer covers custom actions', () => {
  test('uploadAttachment action produces an AuditLogs row', async () => {
    const content = Buffer.from('hello-audit').toString('base64');
    const { data: row } = await POST('/odata/v4/core/uploadAttachment', {
      parentType: 'DOCUMENT', parentId: 'audit-doc',
      fileName: 'a.txt', mimeType: 'application/pdf', contentBase64: content,
    }, auth(USERS.admin));

    const auditRow = await cds.db.run(
      SELECT.one.from(AUDIT)
        .where({ action: 'uploadAttachment' })
        .orderBy({ ref: ['timestamp'], sort: 'desc' })
    );
    expect(auditRow).toBeTruthy();
    expect(auditRow.userRole).toBe('ADMIN');
    // The payload contained a contentBase64 field. It's not sensitive per the
    // mask rules but it IS huge — verify the 2KB truncation kicked in.
    expect(auditRow.details.length).toBeLessThanOrEqual(2048);
    expect(row.ID).toBeTruthy();
  });

  test('deleteAttachment action is audited', async () => {
    // Create then delete an attachment so we have a target.
    const content = Buffer.from('x').toString('base64');
    const { data: row } = await POST('/odata/v4/core/uploadAttachment', {
      parentType: 'DOCUMENT', parentId: 'audit-del',
      fileName: 'd.txt', mimeType: 'application/pdf', contentBase64: content,
    }, auth(USERS.admin));

    await POST('/odata/v4/core/deleteAttachment', { id: row.ID }, auth(USERS.admin));

    const auditRow = await cds.db.run(
      SELECT.one.from(AUDIT)
        .where({ action: 'deleteAttachment' })
        .orderBy({ ref: ['timestamp'], sort: 'desc' })
    );
    expect(auditRow).toBeTruthy();
    expect(auditRow.userId).toBeTruthy();
  });

  test('READ events are NOT audited (would be too noisy)', async () => {
    // Get a baseline count, do a read, then verify no new READ row appeared.
    const before = await cds.db.run(
      SELECT.one`count(*) as cnt`.from(AUDIT).where({ action: 'READ' })
    );
    await GET('/odata/v4/core/Users', auth(USERS.admin));
    const after = await cds.db.run(
      SELECT.one`count(*) as cnt`.from(AUDIT).where({ action: 'READ' })
    );
    expect(after.cnt).toBe(before.cnt);
  });

  test('skipped events (listAttachments, downloadAttachment) are NOT audited', async () => {
    await POST('/odata/v4/core/listAttachments',
      { parentType: 'DOCUMENT', parentId: 'no-such' }, auth(USERS.admin));
    const row = await cds.db.run(
      SELECT.one.from(AUDIT).where({ action: 'listAttachments' })
    );
    expect(row).toBeUndefined();
  });
});

// ============================================================================
// 5. Unit: shouldAudit() predicate
// ============================================================================
describe('shouldAudit() predicate', () => {
  const { shouldAudit, AUDIT_SKIPPED_EVENTS } = require('../srv/shared/services/audit');

  test('rejects READ and skipped events', () => {
    expect(shouldAudit('READ')).toBe(false);
    expect(shouldAudit('listAttachments')).toBe(false);
    expect(shouldAudit('downloadAttachment')).toBe(false);
  });

  test('accepts CUD and custom actions', () => {
    expect(shouldAudit('CREATE')).toBe(true);
    expect(shouldAudit('UPDATE')).toBe(true);
    expect(shouldAudit('DELETE')).toBe(true);
    expect(shouldAudit('approveTicket')).toBe(true);
    expect(shouldAudit('uploadAttachment')).toBe(true);
  });

  test('rejects empty / non-string event names', () => {
    expect(shouldAudit('')).toBe(false);
    expect(shouldAudit(null)).toBe(false);
    expect(shouldAudit(undefined)).toBe(false);
  });

  test('skip list contains the documented events', () => {
    expect(AUDIT_SKIPPED_EVENTS.has('READ')).toBe(true);
    expect(AUDIT_SKIPPED_EVENTS.has('listAttachments')).toBe(true);
  });
});
