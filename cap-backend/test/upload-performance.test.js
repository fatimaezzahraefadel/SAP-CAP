'use strict';

process.env.CDS_REQUIRES_DB_KIND = 'sqlite';
process.env.CDS_REQUIRES_DB_CREDENTIALS_DATABASE = ':memory:';
const cds = require('@sap/cds');

const { POST, GET, expect: _expect } = cds
  .test('serve', 'all', '--in-memory')
  .in(__dirname + '/..');

let authToken = null;
const withAuth = () => ({
  headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
});

describe('Upload Performance Test (Simulated Large Payload)', () => {
  beforeAll(async () => {
    // Authenticate as a technical consultant for deliverables
    const { data } = await POST('/odata/v4/user/authenticate', {
      email: 'theo.tech@inetum.com',
      password: 'Tech#2026',
    });
    authToken = data.token;
  });

  test('Upload simulated 5MB payload performance', async () => {
    // Generate a 5MB base64 string
    const size = 5 * 1024 * 1024;
    const base64String = Buffer.alloc(size, 'a').toString('base64');

    // Simulate getting a project ID from seeded data
    // Assuming there is a project with name 'Project Alpha' or we just use a known seed ID.
    // For this test, we can use a known valid payload. If it fails due to ID, it still tests network parsing time.
    // However, it's better to fetch a real projectId.
    const { data: projects } = await GET('/odata/v4/core/Projects', withAuth());
    const projectId = projects.value[0]?.ID;
    const { data: tickets } = await GET('/odata/v4/ticket/Tickets?$top=1', withAuth());
    const ticketId = tickets.value[0]?.ID;
    
    if (!projectId || !ticketId) {
      console.warn('No project or ticket found, skipping performance test');
      return;
    }

    const payload = {
      projectId: projectId,
      ticketId: ticketId,
      type: 'SPEC',
      name: 'Large Requirements Document',
      fileRef: 'perf://upload-test.pdf',
      functionalComment: base64String,
    };

    const start = performance.now();
    
    const { status } = await POST('/odata/v4/core/Deliverables', payload, withAuth());
    
    const end = performance.now();
    const durationMs = end - start;
    
    console.log(`Upload 5MB payload took ${durationMs.toFixed(2)} ms`);

    expect(status).toBe(201);
    // Assertion on performance: should be under 2000ms for 5MB on a local system
    expect(durationMs).toBeLessThan(2000);
  });
});
