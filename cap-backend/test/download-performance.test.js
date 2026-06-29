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

describe('Download Performance Test (Concurrent Requests)', () => {
  let createdDeliverableId;

  beforeAll(async () => {
    // Authenticate
    const { data } = await POST('/odata/v4/user/authenticate', {
      email: 'theo.tech@inetum.com',
      password: 'Tech#2026',
    });
    authToken = data.token;

    // Setup: create a deliverable to download
    const { data: projects } = await GET('/odata/v4/core/Projects', withAuth());
    const projectId = projects.value[0]?.ID;
    const { data: tickets } = await GET('/odata/v4/ticket/Tickets?$top=1', withAuth());
    const ticketId = tickets.value[0]?.ID;
    
    if (projectId && ticketId) {
      // 1MB payload
      const size = 1 * 1024 * 1024;
      const base64String = Buffer.alloc(size, 'b').toString('base64');
      
      const { data: deliverable } = await POST('/odata/v4/core/Deliverables', {
        projectId: projectId,
        ticketId: ticketId,
        type: 'ARCH',
        name: 'Concurrent Download Test File',
        fileRef: 'perf://download-test.pdf',
        functionalComment: base64String,
      }, withAuth());
      
      createdDeliverableId = deliverable.ID;
    }
  });

  test('Concurrent downloads simulation (50 simultaneous requests)', async () => {
    if (!createdDeliverableId) {
      console.warn('No deliverable setup, skipping concurrent test');
      return;
    }

    const CONCURRENCY = 50;
    const requests = [];

    const start = performance.now();

    for (let i = 0; i < CONCURRENCY; i++) {
      // Simulate download by fetching the deliverable which contains the large base64 string
      requests.push(GET(`/odata/v4/core/Deliverables('${createdDeliverableId}')`, withAuth()));
    }

    const responses = await Promise.all(requests);
    
    const end = performance.now();
    const durationMs = end - start;

    console.log(`Concurrent fetch of 50x1MB payloads took ${durationMs.toFixed(2)} ms`);

    responses.forEach(res => {
      expect(res.status).toBe(200);
      expect(res.data.ID).toBe(createdDeliverableId);
      expect(res.data.functionalComment).toBeDefined();
    });

    // Should complete within a reasonable timeframe (e.g. 5000ms locally)
    expect(durationMs).toBeLessThan(5000);
  });
});
