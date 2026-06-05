'use strict';
/**
 * Integration tests for the Ticket domain (CRUD) and Imputation state machine.
 *
 * Uses @sap/cds built-in test bootstrapper with an in-memory SQLite DB.
 * Run: npm test
 */
process.env.CDS_REQUIRES_DB_KIND = 'sqlite';
process.env.CDS_REQUIRES_DB_CREDENTIALS_DATABASE = ':memory:';
const cds = require('@sap/cds');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
cds.env.requires = cds.env.requires || {};
cds.env.requires.db = {
  ...(cds.env.requires.db || {}),
  kind: 'sqlite',
  credentials: {
    ...((cds.env.requires.db && cds.env.requires.db.credentials) || {}),
    database: ':memory:',
  },
};

// Boot the CAP server with a fresh in-memory SQLite DB, independent of local db/performance.db.
const { GET, POST, PATCH, DELETE, expect: _expect } = cds
  .test('serve', 'all', '--in-memory')
  .in(__dirname + '/..');

// Helper: create an auth header (the service expects Bearer tokens)
// Since these are integration tests hitting the service directly via cds.test,
// we authenticate via the service's own /authenticate action.
let authToken = null;
let adminAuthToken = null;
let consultantAuthToken = null;
let functionalConsultantAuthToken = null;

const withAuth = () => ({
  headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
});

const withAdminAuth = () => ({
  headers: adminAuthToken ? { Authorization: `Bearer ${adminAuthToken}` } : {},
});

const withConsultantAuth = () => ({
  headers: consultantAuthToken ? { Authorization: `Bearer ${consultantAuthToken}` } : {},
});

const withFunctionalConsultantAuth = () => ({
  headers: functionalConsultantAuthToken
    ? { Authorization: `Bearer ${functionalConsultantAuthToken}` }
    : {},
});

const ensureAuth = async () => {
  if (authToken) return;
  const { data } = await POST('/odata/v4/user/authenticate', {
    email: 'marc.manager@inetum.com',
    password: 'Manager#2026',
  });
  authToken = data.token;
};

const ensureAdminAuth = async () => {
  if (adminAuthToken) return;
  const { data } = await POST('/odata/v4/user/authenticate', {
    email: 'alice.admin@inetum.com',
    password: 'Admin#2026',
  });
  adminAuthToken = data.token;
};

const ensureConsultantAuth = async () => {
  if (consultantAuthToken) return;
  const { data } = await POST('/odata/v4/user/authenticate', {
    email: 'theo.tech@inetum.com',
    password: 'Tech#2026',
  });
  consultantAuthToken = data.token;
};

const ensureFunctionalConsultantAuth = async () => {
  if (functionalConsultantAuthToken) return;
  const { data } = await POST('/odata/v4/user/authenticate', {
    email: 'fatima.fonc@inetum.com',
    password: 'Func#2026',
  });
  functionalConsultantAuthToken = data.token;
};

// ---------------------------------------------------------------------------
// Dynamic seed ID resolution – avoids hardcoded DB IDs tied to specific CSV rows.
// IDs are resolved once at the start of the test run by querying the live API.
// ---------------------------------------------------------------------------
const seedIds = {
  adminId: null,
  managerId: null,
  techId: null,
  foncId: null,
  project1Id: null,
  project2Id: null,
  anyTicketId: null,
  foncTicketId: null,
  newStatusTicketId: null,
  draftImputationId: null,
  approvedLeaveId: null,
};

const requireSeedId = (key) => {
  const value = seedIds[key];
  expect(value).toBeTruthy();
  return value;
};

const resolveSeedIds = async () => {
  await ensureAdminAuth();
  await ensureAuth();

  // Resolve user IDs by canonical email addresses (stable across re-seeds)
  const { data: usersData } = await GET(
    '/odata/v4/user/Users?$filter=active eq true',
    withAdminAuth()
  );
  const users = usersData.value ?? [];
  seedIds.adminId = users.find((u) => u.email === 'alice.admin@inetum.com')?.ID ?? null;
  seedIds.managerId = users.find((u) => u.email === 'marc.manager@inetum.com')?.ID ?? null;
  seedIds.techId = users.find((u) => u.email === 'theo.tech@inetum.com')?.ID ?? null;
  seedIds.foncId = users.find((u) => u.email === 'fatima.fonc@inetum.com')?.ID ?? null;

  // Resolve projects by canonical names instead of relying on list order
  const { data: projectsData } = await GET('/odata/v4/core/Projects?$top=100', withAdminAuth());
  const projects = projectsData.value ?? [];
  seedIds.project1Id =
    projects.find((p) => p.name === 'SAP S/4HANA Migration - Acme Corp')?.ID ?? null;
  seedIds.project2Id =
    projects.find((p) => p.name === 'Fiori Launchpad - Groupe Lebon')?.ID ?? null;

  // Resolve tickets by canonical ticketCode instead of relying on list order
  const { data: ticketsData } = await GET('/odata/v4/ticket/Tickets?$top=100', withAdminAuth());
  const tickets = ticketsData.value ?? [];
  seedIds.anyTicketId = tickets.find((t) => t.ticketCode === 'TK-2026-0001')?.ID ?? null;
  if (seedIds.foncId) {
    seedIds.foncTicketId = tickets.find((t) => t.assignedTo === seedIds.foncId)?.ID ?? null;
  }
  seedIds.newStatusTicketId = tickets.find((t) => t.ticketCode === 'TK-2026-0002')?.ID ?? null;

  // Resolve a non-VALIDATED imputation (for direct-PATCH guard test)
  const { data: impData } = await GET(
    "/odata/v4/time/Imputations?$filter=validationStatus eq 'SUBMITTED'&$top=5",
    withAdminAuth()
  );
  seedIds.draftImputationId =
    (impData.value ?? []).find((imputation) => imputation.periodKey === '2026-02-H1')?.ID ?? null;

  // Resolve an APPROVED leave request (for invalid-transition test)
  const { data: leaveData } = await GET(
    "/odata/v4/user/LeaveRequests?$filter=status eq 'APPROVED'&$top=10",
    withAdminAuth()
  );
  seedIds.approvedLeaveId =
    (leaveData.value ?? []).find((leave) => leave.reason === 'Annual holidays')?.ID ?? null;
};

beforeAll(async () => {
  await resolveSeedIds();
  requireSeedId('adminId');
  requireSeedId('managerId');
  requireSeedId('techId');
  requireSeedId('foncId');
  requireSeedId('project1Id');
  requireSeedId('project2Id');
  requireSeedId('anyTicketId');
  requireSeedId('foncTicketId');
  requireSeedId('newStatusTicketId');
  requireSeedId('draftImputationId');
  requireSeedId('approvedLeaveId');
}, 30000);

describe('Authentication', () => {
  test('POST /authenticate with valid credentials returns token + user', async () => {
    const { status, data } = await POST('/odata/v4/user/authenticate', {
      email: 'marc.manager@inetum.com',
      password: 'Manager#2026',
    });
    expect(status).toBe(200);
    expect(data.token).toBeTruthy();
    expect(data.user).toBeTruthy();
    expect(data.user.email).toBe('marc.manager@inetum.com');
    expect(data.user.role).toBe('MANAGER');
    expect(data.expiresAt).toBeTruthy();

    // Store token for subsequent tests
    authToken = data.token;
  });

  test('POST /authenticate works for every seeded demo account', async () => {
    const demoAccounts = [
      ['alice.admin@inetum.com', 'Admin#2026', 'ADMIN'],
      ['marc.manager@inetum.com', 'Manager#2026', 'MANAGER'],
      ['theo.tech@inetum.com', 'Tech#2026', 'CONSULTANT_TECHNIQUE'],
      ['fatima.fonc@inetum.com', 'Func#2026', 'CONSULTANT_FONCTIONNEL'],
      ['pierre.pm@inetum.com', 'PM#2026', 'PROJECT_MANAGER'],
      ['diana.devco@inetum.com', 'DevCo#2026', 'DEV_COORDINATOR'],
    ];

    for (const [email, password, role] of demoAccounts) {
      const { status, data } = await POST('/odata/v4/user/authenticate', {
        email,
        password,
      });

      expect(status).toBe(200);
      expect(data.token).toBeTruthy();
      expect(data.user.email).toBe(email);
      expect(data.user.role).toBe(role);
    }
  });

  test('POST /authenticate with bad password returns 401', async () => {
    try {
      await POST('/odata/v4/user/authenticate', {
        email: 'marc.manager@inetum.com',
        password: 'wrong',
      });
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(401);
    }
  });

  test('POST /quickAccessAccounts returns demo accounts', async () => {
    const { status, data } = await POST('/odata/v4/user/quickAccessAccounts', {});
    expect(status).toBe(200);
    const accounts = data.value ?? data;
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts.some((a) => a.email === 'alice.admin@inetum.com')).toBe(true);
  });
});

describe('Ticket CRUD', () => {
  test('Consultant sees only tickets assigned to self', async () => {
    await ensureConsultantAuth();
    const techId = requireSeedId('techId');
    const { status, data } = await GET('/odata/v4/ticket/Tickets', withConsultantAuth());
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThan(0);
    data.value.forEach((ticket) => {
      expect(ticket.assignedTo).toBe(techId);
    });
  });

  test('Manager can still read tickets beyond own assignment', async () => {
    const foncId = requireSeedId('foncId');
    const { status, data } = await GET(
      `/odata/v4/ticket/Tickets?$filter=assignedTo eq '${foncId}'&$top=1`,
      withAuth()
    );
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThanOrEqual(1);
    expect(data.value[0].assignedTo).toBe(foncId);
  });

  test('GET /Tickets returns seed tickets', async () => {
    const { status, data } = await GET('/odata/v4/ticket/Tickets?$top=5', withAuth());
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThan(0);
  });

  test('GET /Tickets with $count returns inline count', async () => {
    const { status, data } = await GET('/odata/v4/ticket/Tickets?$count=true&$top=1', withAuth());
    expect(status).toBe(200);
    expect(typeof data['@odata.count']).toBe('number');
    expect(data['@odata.count']).toBeGreaterThan(0);
  });

  test('GET /Tickets by ID returns a single ticket', async () => {
    const ticketId = requireSeedId('anyTicketId');
    const { status, data } = await GET(`/odata/v4/ticket/Tickets('${ticketId}')`, withAuth());
    expect(status).toBe(200);
    expect(data.ID).toBe(ticketId);
    expect(data.title).toBeTruthy();
  });

  test('GET /Tickets with $filter by status works', async () => {
    const { status, data } = await GET(
      "/odata/v4/ticket/Tickets?$filter=status eq 'IN_PROGRESS'",
      withAuth()
    );
    expect(status).toBe(200);
    data.value.forEach((ticket) => {
      expect(ticket.status).toBe('IN_PROGRESS');
    });
  });

  let createdTicketId;

  test('POST /Tickets creates a new ticket', async () => {
    const payload = {
      projectId: requireSeedId('project1Id'),
      createdBy: requireSeedId('managerId'),
      title: 'Test ticket from integration test',
      nature: 'PROGRAMME',
      priority: 'LOW',
      description: 'Integration test ticket',
    };

    const { status, data } = await POST('/odata/v4/ticket/Tickets', payload, withAuth());
    expect(status).toBe(201);
    expect(data.ID).toBeTruthy();
    expect(data.ticketCode).toMatch(/^TK-\d{4}-[A-F0-9]{6}$/);
    expect(data.status).toBe('NEW');
    expect(data.title).toBe(payload.title);
    createdTicketId = data.ID;
  });

  test('CREATE /Tickets writes an audit log entry', async () => {
    expect(createdTicketId).toBeTruthy();
    const auditRow = await cds.db.run(
      SELECT.one
        .from('sap.performance.dashboard.db.AuditLogs')
        .where({ entityId: createdTicketId, action: 'CREATE' })
    );
    expect(auditRow).toBeTruthy();
    expect(auditRow.entityName).toBe('TicketService.Tickets');
  });

  test('PATCH /Tickets updates ticket status', async () => {
    expect(createdTicketId).toBeTruthy();
    const { status, data } = await PATCH(
      `/odata/v4/ticket/Tickets('${createdTicketId}')`,
      { status: 'IN_PROGRESS' },
      withAuth()
    );
    expect(status).toBe(200);
    expect(data.status).toBe('IN_PROGRESS');
  });

  test('POST /Tickets with missing required fields returns 400', async () => {
    try {
      await POST('/odata/v4/ticket/Tickets', { title: 'Missing fields' }, withAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });

  test('POST /Tickets with unknown projectId returns 400', async () => {
    try {
      await POST(
        '/odata/v4/ticket/Tickets',
        {
          projectId: 'nonexistent-project',
          createdBy: requireSeedId('managerId'),
          title: 'Bad project test',
          nature: 'REPORT',
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });
});

describe('User entity', () => {
  test('GET /Users returns seed users', async () => {
    const { status, data } = await GET('/odata/v4/user/Users?$filter=active eq true', withAuth());
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThanOrEqual(6);
  });

  test('GET /Users by ID returns a single user', async () => {
    const adminId = requireSeedId('adminId');
    const { status, data } = await GET(`/odata/v4/user/Users('${adminId}')`, withAuth());
    expect(status).toBe(200);
    expect(data.email).toBe('alice.admin@inetum.com');
  });
});

describe('Projects entity', () => {
  test('GET /Projects returns seed projects', async () => {
    const { status, data } = await GET('/odata/v4/core/Projects', withAuth());
    expect(status).toBe(200);
    expect(data.value.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Imputation state machine', () => {
  beforeAll(async () => {
    await ensureAuth();
  });

  const createDraftPeriod = async () => {
    const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
    const { data } = await POST(
      '/odata/v4/time/ImputationPeriods',
      {
        periodKey: `IT-${suffix}`,
        consultantId: requireSeedId('techId'),
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      },
      withAuth()
    );
    return data;
  };

  test('POST /Imputations(id)/validate transitions DRAFT -> VALIDATED', async () => {
    const { data: list } = await GET('/odata/v4/time/Imputations?$top=1', withAuth());
    expect(list.value.length).toBeGreaterThan(0);
    const imp = list.value[0];

    // Only test if currently in a valid from-state
    if (['DRAFT', 'SUBMITTED', 'REJECTED'].includes(imp.validationStatus)) {
      const { status, data } = await POST(
        `/odata/v4/time/Imputations('${imp.ID}')/validate`,
        { validatedBy: requireSeedId('managerId') },
        withAuth()
      );
      expect(status).toBe(200);
      expect(data.validationStatus).toBe('VALIDATED');
    }
  });

  test('POST /ImputationPeriods(id)/submit transitions DRAFT -> SUBMITTED', async () => {
    const draftPeriod = await createDraftPeriod();
    const { status, data } = await POST(
      `/odata/v4/time/ImputationPeriods('${draftPeriod.ID}')/submit`,
      {},
      withAuth()
    );
    expect(status).toBe(200);
    expect(data.status).toBe('SUBMITTED');
  });

  test('POST /ImputationPeriods(id)/validate on SUBMITTED transitions to VALIDATED', async () => {
    const created = await createDraftPeriod();
    await POST(`/odata/v4/time/ImputationPeriods('${created.ID}')/submit`, {}, withAuth());

    const { status, data } = await POST(
      `/odata/v4/time/ImputationPeriods('${created.ID}')/validate`,
      { validatedBy: requireSeedId('managerId') },
      withAuth()
    );
    expect(status).toBe(200);
    expect(data.status).toBe('VALIDATED');
  });

  test('POST /ImputationPeriods(id)/submit on already SUBMITTED returns 409', async () => {
    const created = await createDraftPeriod();
    await POST(`/odata/v4/time/ImputationPeriods('${created.ID}')/submit`, {}, withAuth());

    try {
      await POST(
        `/odata/v4/time/ImputationPeriods('${created.ID}')/submit`,
        {},
        withAuth()
      );
      fail('Should have thrown a conflict error');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(409);
    }
  });
});

describe('Unauthenticated access', () => {
  test('GET /Tickets without token returns 401', async () => {
    try {
      await GET('/odata/v4/ticket/Tickets', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(401);
    }
  });

  test('GET /Projects without token returns 401', async () => {
    try {
      await GET('/odata/v4/core/Projects');
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(401);
    }
  });
});

describe('Validation and state-machine guards', () => {
  beforeAll(async () => {
    await ensureAuth();
  });

  test('Ticket invalid status transition returns 409', async () => {
    try {
      await PATCH(`/odata/v4/ticket/Tickets('${requireSeedId('newStatusTicketId')}')`, { status: 'DONE' }, withAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(409);
    }
  });

  test('Project delete with children returns 409', async () => {
    await ensureAdminAuth();
    try {
      await DELETE(`/odata/v4/core/Projects('${requireSeedId('project1Id')}')`, withAdminAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(409);
    }
  });

  test('User delete with references returns 409', async () => {
    await ensureAdminAuth();
    try {
      await DELETE(`/odata/v4/user/Users('${requireSeedId('managerId')}')`, withAdminAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(409);
    }
  });

  test('Imputation direct PATCH of validationStatus returns 403', async () => {
    try {
      await PATCH(
        `/odata/v4/time/Imputations('${requireSeedId('draftImputationId')}')`,
        { validationStatus: 'VALIDATED' },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('ImputationPeriod direct PATCH of status returns 403', async () => {
    const periodSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data: createdPeriod } = await POST(
      '/odata/v4/time/ImputationPeriods',
      {
        periodKey: `2026-03-GUARD-${periodSuffix}`,
        consultantId: requireSeedId('techId'),
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      },
      withAuth()
    );

    try {
      await PATCH(
        `/odata/v4/time/ImputationPeriods('${createdPeriod.ID}')`,
        { status: 'SUBMITTED' },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('LeaveRequest invalid transition returns 409', async () => {
    try {
      await PATCH(
        `/odata/v4/user/LeaveRequests('${requireSeedId('approvedLeaveId')}')`,
        { status: 'PENDING' },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(409);
    }
  });

  test('Allocation create with invalid percent returns 400', async () => {
    try {
      await POST(
        '/odata/v4/user/Allocations',
        {
          userId: requireSeedId('techId'),
          projectId: requireSeedId('project1Id'),
          allocationPercent: 120,
          startDate: '2026-02-01',
          endDate: '2026-03-01',
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });

  test('Allocation create with unknown userId returns 400', async () => {
    try {
      await POST(
        '/odata/v4/user/Allocations',
        {
          userId: 'u-unknown',
          projectId: requireSeedId('project1Id'),
          allocationPercent: 50,
          startDate: '2026-02-01',
          endDate: '2026-03-01',
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });

  test('Notification create rejects cross-user recipient spoofing', async () => {
    await ensureConsultantAuth();
    try {
      await POST(
        '/odata/v4/user/Notifications',
        {
          userId: requireSeedId('managerId'),
          type: 'TEST',
          title: 'Spoofed notification',
          message: 'Should fail',
        },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('LeaveRequest create with missing required fields returns 400', async () => {
    try {
      await POST(
        '/odata/v4/user/LeaveRequests',
        {
          managerId: requireSeedId('managerId'),
        },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });

  test('ImputationPeriod create with missing dates returns 400', async () => {
    try {
      await POST(
        '/odata/v4/time/ImputationPeriods',
        {
          periodKey: `REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          consultantId: requireSeedId('techId'),
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });

  test('Timesheet create with missing projectId returns 400', async () => {
    try {
      await POST(
        '/odata/v4/time/Timesheets',
        {
          userId: requireSeedId('managerId'),
          date: '2026-03-12',
          hours: 4,
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });

  test('Wricef delete cascades WricefObjects', async () => {
    const { data: wricef } = await POST(
      '/odata/v4/core/Wricefs',
      {
        projectId: requireSeedId('project2Id'),
        sourceFileName: 'cascade-test.xlsx',
      },
      withAuth()
    );
    expect(wricef.ID).toBeTruthy();

    await POST(
      '/odata/v4/core/WricefObjects',
      {
        wricefId: wricef.ID,
        projectId: requireSeedId('project2Id'),
        type: 'W',
        title: 'Cascade object 1',
      },
      withAuth()
    );
    await POST(
      '/odata/v4/core/WricefObjects',
      {
        wricefId: wricef.ID,
        projectId: requireSeedId('project2Id'),
        type: 'R',
        title: 'Cascade object 2',
      },
      withAuth()
    );

    const delRes = await DELETE(`/odata/v4/core/Wricefs('${wricef.ID}')`, withAuth());
    expect(delRes.status).toBe(204);

    const { data: remaining } = await GET(
      `/odata/v4/core/WricefObjects?$filter=wricefId eq '${wricef.ID}'`,
      withAuth()
    );
    expect(remaining.value.length).toBe(0);
  });

  test('ReferenceData duplicate type+code returns 409', async () => {
    await ensureAdminAuth();
    try {
      await POST(
        '/odata/v4/core/ReferenceData',
        { type: 'PRIORITY', code: 'LOW', label: 'Duplicate low' },
        withAdminAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(409);
    }
  });

  test('Consultant cannot read Evaluations', async () => {
    await ensureConsultantAuth();
    try {
      await GET('/odata/v4/time/Evaluations?$top=1', withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot create DocumentationObjects as another author', async () => {
    await ensureConsultantAuth();
    try {
      await POST(
        '/odata/v4/core/DocumentationObjects',
        {
          title: 'Ownership guard',
          description: 'Should fail',
          type: 'GENERAL',
          projectId: requireSeedId('project1Id'),
          authorId: requireSeedId('managerId'),
        },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot create Imputations for another consultant', async () => {
    await ensureConsultantAuth();
    try {
      await POST(
        '/odata/v4/time/Imputations',
        {
          consultantId: requireSeedId('managerId'),
          ticketId: requireSeedId('anyTicketId'),
          projectId: requireSeedId('project1Id'),
          module: 'ABAP',
          date: '2026-03-05',
          hours: 2,
          periodKey: '2026-03-H1',
          description: 'Ownership guard',
        },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot delete WRICEF', async () => {
    await ensureConsultantAuth();
    const { data: wricef } = await POST(
      '/odata/v4/core/Wricefs',
      {
        projectId: requireSeedId('project2Id'),
        sourceFileName: 'delete-guard.xlsx',
      },
      withAuth()
    );

    try {
      await DELETE(`/odata/v4/core/Wricefs('${wricef.ID}')`, withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    } finally {
      await DELETE(`/odata/v4/core/Wricefs('${wricef.ID}')`, withAuth());
    }
  });

  test('DocumentationObjects PATCH auto-updates updatedAt', async () => {
    const { data: created } = await POST(
      '/odata/v4/core/DocumentationObjects',
      {
        title: 'Doc update test',
        description: 'Before update',
        type: 'GENERAL',
        projectId: requireSeedId('project1Id'),
        authorId: requireSeedId('managerId'),
      },
      withAuth()
    );
    expect(created.updatedAt).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const { data: updated } = await PATCH(
      `/odata/v4/core/DocumentationObjects('${created.ID}')`,
      { description: 'After update' },
      withAuth()
    );
    expect(updated.updatedAt).toBeTruthy();
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  test('Consultant cannot read comments for an unrelated ticket', async () => {
    await ensureConsultantAuth();
    const ticketId = requireSeedId('foncTicketId');
    const { data: createdComment } = await POST(
      '/odata/v4/ticket/TicketComments',
      {
        ticketId,
        message: 'Manager-only visibility check comment',
      },
      withAuth()
    );
    expect(createdComment.ID).toBeTruthy();

    const { status, data } = await GET(
      `/odata/v4/ticket/TicketComments?$filter=ticketId eq '${ticketId}'`,
      withConsultantAuth()
    );
    expect(status).toBe(200);
    expect(data.value).toEqual([]);
  });

  test('DocumentationObjects create rejects spoofed authorId', async () => {
    try {
      await POST(
        '/odata/v4/core/DocumentationObjects',
        {
          title: 'Spoofed author test',
          description: 'Should fail',
          type: 'GENERAL',
          projectId: requireSeedId('project1Id'),
          authorId: requireSeedId('techId'),
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Ticket create rejects spoofed createdBy', async () => {
    try {
      await POST(
        '/odata/v4/ticket/Tickets',
        {
          projectId: requireSeedId('project1Id'),
          createdBy: requireSeedId('techId'),
          title: 'Spoofed creator test',
          nature: 'PROGRAMME',
          priority: 'LOW',
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Ticket approval rejects non-technical assignee', async () => {
    await ensureFunctionalConsultantAuth();
    const { data: pendingTicket } = await POST(
      '/odata/v4/ticket/Tickets',
      {
        projectId: requireSeedId('project1Id'),
        createdBy: requireSeedId('foncId'),
        title: 'Approval role validation test',
        nature: 'PROGRAMME',
        priority: 'LOW',
      },
      withFunctionalConsultantAuth()
    );
    expect(pendingTicket.ID).toBeTruthy();

    try {
      await POST(
        `/odata/v4/ticket/Tickets('${pendingTicket.ID}')/approveTicket`,
        {
          techConsultantId: requireSeedId('managerId'),
          allocatedHours: 8,
        },
        withAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(400);
    }
  });

  test('Ticket approval records history entry', async () => {
    await ensureAuth();
    await ensureFunctionalConsultantAuth();

    const { data: pendingTicket } = await POST(
      '/odata/v4/ticket/Tickets',
      {
        projectId: requireSeedId('project1Id'),
        createdBy: requireSeedId('foncId'),
        title: 'Approval history test',
        nature: 'PROGRAMME',
        priority: 'LOW',
      },
      withFunctionalConsultantAuth()
    );
    expect(pendingTicket.ID).toBeTruthy();

    const { data: approvedTicket } = await POST(
      `/odata/v4/ticket/Tickets('${pendingTicket.ID}')/approveTicket`,
      {
        techConsultantId: requireSeedId('techId'),
        allocatedHours: 12,
      },
      withAuth()
    );
    expect(approvedTicket.status).toBe('APPROVED');

    const historyRows = await cds.db.run(
      SELECT.from('sap.performance.dashboard.db.TicketHistory').where({ ticket_ID: pendingTicket.ID })
    );
    const historyEntry = (historyRows || []).find((row) => row.event === 'APPROVED');
    expect(historyEntry).toBeTruthy();
    expect(historyEntry.details).toContain('assigned to');
  });

  test('Ticket rejection records history entry', async () => {
    await ensureAuth();
    await ensureFunctionalConsultantAuth();

    const { data: pendingTicket } = await POST(
      '/odata/v4/ticket/Tickets',
      {
        projectId: requireSeedId('project1Id'),
        createdBy: requireSeedId('foncId'),
        title: 'Rejection history test',
        nature: 'PROGRAMME',
        priority: 'LOW',
      },
      withFunctionalConsultantAuth()
    );
    expect(pendingTicket.ID).toBeTruthy();

    await POST(
      `/odata/v4/ticket/Tickets('${pendingTicket.ID}')/rejectTicket`,
      {
        reason: 'Out of scope',
      },
      withAuth()
    );

    const historyRows = await cds.db.run(
      SELECT.from('sap.performance.dashboard.db.TicketHistory').where({ ticket_ID: pendingTicket.ID })
    );
    const historyEntry = (historyRows || []).find((row) => row.event === 'REJECTED');
    expect(historyEntry).toBeTruthy();
    expect(historyEntry.details).toBe('Out of scope');
  });

  test('Comment create rejects spoofed authorId', async () => {
    await ensureConsultantAuth();
    try {
      await POST(
        '/odata/v4/ticket/TicketComments',
        {
          ticketId: requireSeedId('anyTicketId'),
          authorId: requireSeedId('managerId'),
          message: 'Spoofed comment author',
        },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot read another user leave request', async () => {
    await ensureAuth();
    await ensureConsultantAuth();
    const { data: created } = await POST(
      '/odata/v4/user/LeaveRequests',
      {
        consultantId: requireSeedId('managerId'),
        managerId: requireSeedId('adminId'),
        startDate: '2026-03-20',
        endDate: '2026-03-21',
        reason: 'Manager-only leave fixture',
      },
      withAuth()
    );

    const { status, data } = await GET(
      `/odata/v4/user/LeaveRequests?$filter=ID eq '${created.ID}'`,
      withConsultantAuth()
    );
    expect(status).toBe(200);
    expect(data.value).toEqual([]);
  });

  test('Consultant cannot read another user imputation', async () => {
    await ensureAuth();
    await ensureConsultantAuth();
    const periodKey = `AUTHZ-IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data: created } = await POST(
      '/odata/v4/time/Imputations',
      {
        ticketId: requireSeedId('anyTicketId'),
        projectId: requireSeedId('project1Id'),
        periodKey,
        date: '2026-03-10',
        hours: 2,
        description: 'Manager-owned imputation',
      },
      withAuth()
    );

    const { status, data } = await GET(
      `/odata/v4/time/Imputations?$filter=ID eq '${created.ID}'`,
      withConsultantAuth()
    );
    expect(status).toBe(200);
    expect(data.value).toEqual([]);
  });

  test('Consultant cannot update or delete another user imputation period', async () => {
    await ensureAuth();
    await ensureConsultantAuth();
    const periodKey = `AUTHZ-PER-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data: created } = await POST(
      '/odata/v4/time/ImputationPeriods',
      {
        consultantId: requireSeedId('managerId'),
        periodKey,
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      },
      withAuth()
    );

    const { status, data } = await GET(
      `/odata/v4/time/ImputationPeriods?$filter=ID eq '${created.ID}'`,
      withConsultantAuth()
    );
    expect(status).toBe(200);
    expect(data.value).toEqual([]);

    try {
      await PATCH(
        `/odata/v4/time/ImputationPeriods('${created.ID}')`,
        { totalHours: 99 },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }

    try {
      await DELETE(`/odata/v4/time/ImputationPeriods('${created.ID}')`, withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot update or delete another user time log', async () => {
    await ensureAuth();
    await ensureConsultantAuth();
    const { data: created } = await POST(
      '/odata/v4/time/TimeLogs',
      {
        ticketId: requireSeedId('anyTicketId'),
        projectId: requireSeedId('project1Id'),
        date: '2026-03-11',
        durationMinutes: 90,
        description: 'Manager-owned time log',
      },
      withAuth()
    );

    const { status, data } = await GET(
      `/odata/v4/time/TimeLogs?$filter=ID eq '${created.ID}'`,
      withConsultantAuth()
    );
    expect(status).toBe(200);
    expect(data.value).toEqual([]);

    try {
      await PATCH(
        `/odata/v4/time/TimeLogs('${created.ID}')`,
        { description: 'tampered' },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }

    try {
      await DELETE(`/odata/v4/time/TimeLogs('${created.ID}')`, withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot update or delete another user timesheet', async () => {
    await ensureAuth();
    await ensureConsultantAuth();
    const { data: created } = await POST(
      '/odata/v4/time/Timesheets',
      {
        userId: requireSeedId('managerId'),
        projectId: requireSeedId('project1Id'),
        ticketId: requireSeedId('anyTicketId'),
        date: '2026-03-12',
        hours: 4,
        comment: 'Manager-owned timesheet',
      },
      withAuth()
    );

    const { status, data } = await GET(
      `/odata/v4/time/Timesheets?$filter=ID eq '${created.ID}'`,
      withConsultantAuth()
    );
    expect(status).toBe(200);
    expect(data.value).toEqual([]);

    try {
      await PATCH(
        `/odata/v4/time/Timesheets('${created.ID}')`,
        { hours: 6 },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }

    try {
      await DELETE(`/odata/v4/time/Timesheets('${created.ID}')`, withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });
});

describe('Allocations CRUD', () => {
  beforeAll(async () => {
    await ensureAuth();
    await ensureConsultantAuth();
  });

  let createdAllocationId;

  test('Manager can create an allocation', async () => {
    const { status, data } = await POST(
      '/odata/v4/user/Allocations',
      {
        userId: requireSeedId('techId'),
        projectId: requireSeedId('project1Id'),
        allocationPercent: 50,
        startDate: '2026-05-01',
        endDate: '2026-06-01',
      },
      withAuth() // Auth is manager
    );
    expect(status).toBe(201);
    expect(data.ID).toBeTruthy();
    createdAllocationId = data.ID;
  });

  test('Manager can update an allocation', async () => {
    const { status, data } = await PATCH(
      `/odata/v4/user/Allocations('${createdAllocationId}')`,
      { allocationPercent: 75 },
      withAuth()
    );
    expect(status).toBe(200);
    expect(data.allocationPercent).toBe(75);
  });

  test('Consultant cannot create an allocation', async () => {
    try {
      await POST(
        '/odata/v4/user/Allocations',
        {
          userId: requireSeedId('techId'),
          projectId: requireSeedId('project1Id'),
          allocationPercent: 30,
          startDate: '2026-05-01',
          endDate: '2026-06-01',
        },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot update an allocation', async () => {
    try {
      await PATCH(
        `/odata/v4/user/Allocations('${createdAllocationId}')`,
        { allocationPercent: 10 },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot delete an allocation', async () => {
    try {
      await DELETE(`/odata/v4/user/Allocations('${createdAllocationId}')`, withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Manager can delete an allocation', async () => {
    const { status } = await DELETE(`/odata/v4/user/Allocations('${createdAllocationId}')`, withAuth());
    expect(status).toBe(204);
  });
});

describe('Evaluations CRUD', () => {
  beforeAll(async () => {
    await ensureAuth();
    await ensureConsultantAuth();
  });

  let createdEvaluationId;

  test('Manager can create an evaluation', async () => {
    const { status, data } = await POST(
      '/odata/v4/time/Evaluations',
      {
        userId: requireSeedId('techId'),
        evaluatorId: requireSeedId('managerId'),
        projectId: requireSeedId('project1Id'),
        score: 4,
        feedback: 'Good job',
      },
      withAuth()
    );
    expect(status).toBe(201);
    expect(data.ID).toBeTruthy();
    createdEvaluationId = data.ID;
  });

  test('Consultant cannot read evaluations', async () => {
    try {
      await GET('/odata/v4/time/Evaluations', withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot create an evaluation', async () => {
    try {
      await POST(
        '/odata/v4/time/Evaluations',
        {
          userId: requireSeedId('techId'),
          evaluatorId: requireSeedId('managerId'),
          projectId: requireSeedId('project1Id'),
          score: 5,
        },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot update an evaluation', async () => {
    try {
      await PATCH(
        `/odata/v4/time/Evaluations('${createdEvaluationId}')`,
        { score: 5 },
        withConsultantAuth()
      );
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Consultant cannot delete an evaluation', async () => {
    try {
      await DELETE(`/odata/v4/time/Evaluations('${createdEvaluationId}')`, withConsultantAuth());
      fail('Should have thrown');
    } catch (err) {
      expect(err.response?.status ?? err.status).toBe(403);
    }
  });

  test('Manager can update an evaluation', async () => {
    const { status, data } = await PATCH(
      `/odata/v4/time/Evaluations('${createdEvaluationId}')`,
      { score: 5, feedback: 'Excellent' },
      withAuth()
    );
    expect(status).toBe(200);
    expect(data.score).toBe(5);
  });

  test('Manager can delete an evaluation', async () => {
    const { status } = await DELETE(`/odata/v4/time/Evaluations('${createdEvaluationId}')`, withAuth());
    expect(status).toBe(204);
  });
});

describe('Documentation cleanup', () => {
  const ATTACHMENTS_ENTITY = 'sap.performance.dashboard.db.Attachments';
  const makeAttachment = (overrides) => ({
    parentType: 'DOCUMENT',
    parentId: 'doc-id',
    fileName: `attachment-${Math.random().toString(36).slice(2, 8)}.pdf`,
    originalName: 'attachment.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 12,
    storageKey: `https://example.com/${Math.random().toString(36).slice(2, 8)}.pdf`,
    checksumSha256: Math.random().toString(36).slice(2, 10),
    uploadedBy: requireSeedId('adminId'),
    status: 'ACTIVE',
    ...overrides,
  });

  test('cleanupOrphanAttachments deletes Attachments without a valid parent reference', async () => {
    await ensureAdminAuth();

    const docTitle = `Orphan cleanup ${Math.random().toString(36).slice(2, 8)}`;
    const { status: createDocStatus, data: createdDoc } = await POST(
      '/odata/v4/core/DocumentationObjects',
      {
        title: docTitle,
        description: 'Cleanup test object',
        projectId: requireSeedId('project1Id'),
      },
      withAdminAuth()
    );
    expect(createDocStatus).toBe(201);
    expect(createdDoc.ID).toBeTruthy();

    const entries = [
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'cleanup-valid.pdf',
      }),
      makeAttachment({
        parentId: '',
        fileName: 'cleanup-orphan-null.pdf',
      }),
      makeAttachment({
        parentId: '00000000-0000-0000-0000-000000000000',
        fileName: 'cleanup-orphan-bad-ref.pdf',
      }),
    ];

    await cds.db.run(INSERT.into(ATTACHMENTS_ENTITY).entries(entries));

    const beforeRows = await cds.db.run(
      SELECT.from(ATTACHMENTS_ENTITY).columns(['ID', 'fileName', 'parentId']).where({ fileName: { in: entries.map((entry) => entry.fileName) } })
    );
    expect(beforeRows.length).toBe(3);

    const { status: cleanupStatus, data: cleanupData } = await POST(
      '/odata/v4/core/cleanupOrphanAttachments',
      {},
      withAdminAuth()
    );
    expect(cleanupStatus).toBe(200);

    const deletedCount = Number(
      cleanupData?.value ?? cleanupData?.cleanupOrphanAttachments ?? cleanupData ?? 0
    );
    expect(deletedCount).toBe(2);

    const afterRows = await cds.db.run(
      SELECT.from(ATTACHMENTS_ENTITY).columns(['ID', 'fileName', 'parentId']).where({ fileName: { in: entries.map((entry) => entry.fileName) } })
    );
    expect(afterRows.length).toBe(1);
    expect(afterRows[0].fileName).toBe('cleanup-valid.pdf');
    expect(afterRows[0].parentId).toBe(createdDoc.ID);
  });

  test('purgeDeletedAttachments deletes deleted Attachments and invalid parent references', async () => {
    await ensureAdminAuth();

    const docTitle = `Purge cleanup ${Math.random().toString(36).slice(2, 8)}`;
    const { status: createDocStatus, data: createdDoc } = await POST(
      '/odata/v4/core/DocumentationObjects',
      {
        title: docTitle,
        description: 'Purge cleanup test object',
        projectId: requireSeedId('project1Id'),
      },
      withAdminAuth()
    );
    expect(createDocStatus).toBe(201);
    expect(createdDoc.ID).toBeTruthy();

    const entries = [
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'purge-valid.pdf',
      }),
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'purge-deleted.pdf',
        status: 'DELETED',
      }),
      makeAttachment({
        parentId: '00000000-0000-0000-0000-000000000000',
        fileName: 'purge-orphan-bad-ref.pdf',
      }),
    ];

    await cds.db.run(INSERT.into(ATTACHMENTS_ENTITY).entries(entries));

    const beforeRows = await cds.db.run(
      SELECT.from(ATTACHMENTS_ENTITY).columns(['ID', 'fileName', 'parentId', 'status']).where({ fileName: { in: entries.map((entry) => entry.fileName) } })
    );
    expect(beforeRows.length).toBe(3);

    const { status: cleanupStatus, data: cleanupData } = await POST(
      '/odata/v4/core/purgeDeletedAttachments',
      {},
      withAdminAuth()
    );
    expect(cleanupStatus).toBe(200);

    const deletedCount = Number(
      cleanupData?.value ?? cleanupData?.purgeDeletedAttachments ?? cleanupData ?? 0
    );
    expect(deletedCount).toBe(2);

    const afterRows = await cds.db.run(
      SELECT.from(ATTACHMENTS_ENTITY).columns(['ID', 'fileName', 'parentId', 'status']).where({ fileName: { in: entries.map((entry) => entry.fileName) } })
    );
    expect(afterRows.length).toBe(1);
    expect(afterRows[0].fileName).toBe('purge-valid.pdf');
    expect(afterRows[0].parentId).toBe(createdDoc.ID);
  });

  test('cleanupDuplicateAttachments removes duplicate Attachments for same parent and checksum', async () => {
    await ensureAdminAuth();

    const docTitle = `Duplicate cleanup ${Math.random().toString(36).slice(2, 8)}`;
    const { status: createDocStatus, data: createdDoc } = await POST(
      '/odata/v4/core/DocumentationObjects',
      {
        title: docTitle,
        description: 'Duplicate cleanup test object',
        projectId: requireSeedId('project1Id'),
      },
      withAdminAuth()
    );
    expect(createDocStatus).toBe(201);
    expect(createdDoc.ID).toBeTruthy();

    const entries = [
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'duplicate-1.pdf',
        checksumSha256: 'duplicate-checksum',
      }),
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'duplicate-2.pdf',
        checksumSha256: 'duplicate-checksum',
      }),
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'duplicate-3.pdf',
        checksumSha256: 'duplicate-checksum',
      }),
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'distinct.pdf',
        checksumSha256: 'distinct-checksum',
      }),
    ];

    await cds.db.run(INSERT.into(ATTACHMENTS_ENTITY).entries(entries));

    const beforeRows = await cds.db.run(
      SELECT.from(ATTACHMENTS_ENTITY).columns(['ID', 'fileName', 'parentId', 'checksumSha256']).where({ fileName: { in: entries.map((entry) => entry.fileName) } })
    );
    expect(beforeRows.length).toBe(4);

    const { status: cleanupStatus, data: cleanupData } = await POST(
      '/odata/v4/core/cleanupDuplicateAttachments',
      {},
      withAdminAuth()
    );
    expect(cleanupStatus).toBe(200);

    const deletedCount = Number(
      cleanupData?.value ?? cleanupData?.cleanupDuplicateAttachments ?? cleanupData ?? 0
    );
    expect(deletedCount).toBe(2);

    const afterRows = await cds.db.run(
      SELECT.from(ATTACHMENTS_ENTITY).columns(['ID', 'fileName', 'parentId', 'checksumSha256']).where({ fileName: { in: entries.map((entry) => entry.fileName) } })
    );
    expect(afterRows.length).toBe(2);
    const remainingChecksums = afterRows.map((row) => row.checksumSha256).sort();
    expect(remainingChecksums).toEqual(['distinct-checksum', 'duplicate-checksum']);
  });

  test('reconcileStorage reports missing local attachments and orphan storage files', async () => {
    await ensureAdminAuth();

    const storageRoot = path.join(os.tmpdir(), `ticket-cap-reconcile-${Date.now()}`);
    await fs.mkdir(storageRoot, { recursive: true });
    const existingFilePath = path.join(storageRoot, 'existing.pdf');
    const orphanFilePath = path.join(storageRoot, 'orphan.pdf');
    await fs.writeFile(existingFilePath, 'ok');
    await fs.writeFile(orphanFilePath, 'orphan');

    const docTitle = `Reconcile storage ${Math.random().toString(36).slice(2, 8)}`;
    const { status: createDocStatus, data: createdDoc } = await POST(
      '/odata/v4/core/DocumentationObjects',
      {
        title: docTitle,
        description: 'Reconcile storage test object',
        projectId: requireSeedId('project1Id'),
      },
      withAdminAuth()
    );
    expect(createDocStatus).toBe(201);
    expect(createdDoc.ID).toBeTruthy();

    const entries = [
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'existing.pdf',
        storageKey: 'existing.pdf',
      }),
      makeAttachment({
        parentId: createdDoc.ID,
        fileName: 'missing.pdf',
        storageKey: 'missing.pdf',
      }),
    ];

    await cds.db.run(INSERT.into(ATTACHMENTS_ENTITY).entries(entries));

    const previousStorageRoot = process.env.ATTACHMENT_STORAGE_ROOT;
    process.env.ATTACHMENT_STORAGE_ROOT = storageRoot;
    const { status: reconcileStatus, data: reconcileData } = await POST(
      '/odata/v4/core/reconcileStorage',
      {},
      withAdminAuth()
    );
    expect(reconcileStatus).toBe(200);

    const issueCount = Number(reconcileData?.value ?? reconcileData?.reconcileStorage ?? reconcileData ?? 0);
    expect(issueCount).toBe(2);

    if (previousStorageRoot === undefined) {
      delete process.env.ATTACHMENT_STORAGE_ROOT;
    } else {
      process.env.ATTACHMENT_STORAGE_ROOT = previousStorageRoot;
    }
    await fs.rm(storageRoot, { recursive: true, force: true });
  });
});
