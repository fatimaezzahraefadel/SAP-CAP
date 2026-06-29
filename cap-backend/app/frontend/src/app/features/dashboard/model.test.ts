import { describe, expect, it } from 'vitest';
import type { Allocation, Ticket, User } from '@/app/types/entities';
import { computeProductivityMetrics, computeTace } from '@/app/features/dashboard/model';

const TODAY = '2026-06-15';

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'USR-1',
  name: 'Consultant',
  email: 'c@example.test',
  role: 'CONSULTANT_TECHNIQUE',
  active: true,
  skills: [],
  certifications: [],
  availabilityPercent: 100,
  ...overrides,
});

const createAllocation = (overrides: Partial<Allocation> = {}): Allocation => ({
  id: 'ALL-1',
  userId: 'USR-1',
  projectId: 'PRJ-1',
  allocationPercent: 50,
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  ...overrides,
});

const createTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'TCK-1',
  ticketCode: 'TK-1',
  projectId: 'PRJ-1',
  createdBy: 'USR-PM',
  assignedTo: 'USR-1',
  assignedToRole: 'CONSULTANT_TECHNIQUE',
  status: 'NEW',
  priority: 'MEDIUM',
  nature: 'PROGRAMME',
  title: 'Ticket',
  description: 'desc',
  dueDate: '2026-06-10T00:00:00.000Z',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-05T10:00:00.000Z',
  history: [],
  effortHours: 0,
  estimationHours: 0,
  complexity: 'SIMPLE',
  module: 'FI',
  ...overrides,
});

describe('computeTace', () => {
  it('returns 0 when there is no active technical consultant', () => {
    expect(computeTace([], [], TODAY)).toBe(0);
    const inactive = createUser({ active: false });
    expect(computeTace([inactive], [createAllocation()], TODAY)).toBe(0);
  });

  it('averages capped current load across active tech consultants', () => {
    const u1 = createUser({ id: 'U1' });
    const u2 = createUser({ id: 'U2' });
    const allocations = [
      createAllocation({ userId: 'U1', allocationPercent: 60 }),
      createAllocation({ userId: 'U1', allocationPercent: 60 }), // U1 sums to 120 -> capped 100
      createAllocation({ userId: 'U2', allocationPercent: 40 }),
    ];
    // (100 + 40) / 2 = 70
    expect(computeTace([u1, u2], allocations, TODAY)).toBe(70);
  });

  it('ignores allocations not active on the reference day and non-tech roles', () => {
    const tech = createUser({ id: 'U1' });
    const func = createUser({ id: 'U2', role: 'CONSULTANT_FONCTIONNEL' });
    const allocations = [
      createAllocation({ userId: 'U1', allocationPercent: 80, startDate: '2026-06-01', endDate: '2026-06-30' }),
      createAllocation({ userId: 'U1', allocationPercent: 50, startDate: '2026-01-01', endDate: '2026-01-31' }), // past
      createAllocation({ userId: 'U2', allocationPercent: 100 }), // functional -> excluded from TACE
    ];
    expect(computeTace([tech, func], allocations, TODAY)).toBe(80);
  });
});

describe('computeProductivityMetrics', () => {
  it('returns neutral values for an empty ticket set', () => {
    const m = computeProductivityMetrics([]);
    expect(m.throughputRate).toBe(0);
    expect(m.criticalIssues).toBe(0);
    expect(m.slaRate).toBe(100);
    expect(m.slaOnTime).toBe(0);
    expect(m.slaTotal).toBe(0);
  });

  it('excludes REJECTED tickets from the throughput denominator', () => {
    const tickets = [
      createTicket({ id: 'a', status: 'DONE' }),
      createTicket({ id: 'b', status: 'IN_PROGRESS' }),
      createTicket({ id: 'c', status: 'REJECTED' }),
    ];
    // 1 done / 2 actionable (a, b) = 50%
    expect(computeProductivityMetrics(tickets).throughputRate).toBe(50);
  });

  it('counts CRITICAL or BLOCKED tickets as critical issues', () => {
    const tickets = [
      createTicket({ id: 'a', priority: 'CRITICAL' }),
      createTicket({ id: 'b', status: 'BLOCKED' }),
      createTicket({ id: 'c', priority: 'LOW', status: 'NEW' }),
    ];
    expect(computeProductivityMetrics(tickets).criticalIssues).toBe(2);
  });

  it('computes SLA on calendar dates and ignores done tickets without a due date', () => {
    const tickets = [
      // on time: completed 2026-06-05 (date) <= due 2026-06-10
      createTicket({ id: 'a', status: 'DONE', updatedAt: '2026-06-05T23:00:00Z', dueDate: '2026-06-10' }),
      // late: completed 2026-06-12 > due 2026-06-10
      createTicket({ id: 'b', status: 'DONE', updatedAt: '2026-06-12T08:00:00Z', dueDate: '2026-06-10' }),
      // done but no due date -> excluded from SLA denominator
      createTicket({ id: 'c', status: 'DONE', updatedAt: '2026-06-05T08:00:00Z', dueDate: undefined }),
    ];
    const m = computeProductivityMetrics(tickets);
    expect(m.slaTotal).toBe(2);
    expect(m.slaOnTime).toBe(1);
    expect(m.slaRate).toBe(50);
  });

  it('treats same-day completion (timestamp after midnight due date) as on time', () => {
    const tickets = [
      createTicket({ id: 'a', status: 'DONE', updatedAt: '2026-06-10T18:30:00Z', dueDate: '2026-06-10T00:00:00.000Z' }),
    ];
    const m = computeProductivityMetrics(tickets);
    expect(m.slaOnTime).toBe(1);
    expect(m.slaRate).toBe(100);
  });
});
