import { describe, expect, it } from 'vitest';
import type { Ticket, TicketComplexity, TicketStatus } from '@/app/types/entities';
import { scoreConsultantTickets, scoreTicket } from '@/app/features/evaluations/scoring';

const TODAY = '2026-06-15';

const createTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'TCK-1',
  ticketCode: 'TK-1',
  projectId: 'PRJ-1',
  createdBy: 'USR-PM',
  assignedTo: 'USR-1',
  assignedToRole: 'CONSULTANT_TECHNIQUE',
  status: 'NEW' as TicketStatus,
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
  complexity: 'SIMPLE' as TicketComplexity,
  module: 'FI',
  ...overrides,
});

describe('scoreTicket', () => {
  it('rewards an on-time completion with base points plus difficulty bonus', () => {
    const line = scoreTicket(
      createTicket({ status: 'DONE', updatedAt: '2026-06-09T18:00:00Z', dueDate: '2026-06-10', complexity: 'COMPLEXE' }),
      TODAY
    );
    expect(line.category).toBe('ON_TIME');
    expect(line.base).toBe(4);
    expect(line.bonus).toBe(2);
    expect(line.points).toBe(6);
  });

  it('treats same-day completion as on time', () => {
    const line = scoreTicket(
      createTicket({ status: 'DONE', updatedAt: '2026-06-10T23:00:00Z', dueDate: '2026-06-10T00:00:00.000Z', complexity: 'SIMPLE' }),
      TODAY
    );
    expect(line.category).toBe('ON_TIME');
    expect(line.points).toBe(4);
  });

  it('penalises a late completion but still credits the difficulty bonus', () => {
    const line = scoreTicket(
      createTicket({ status: 'DONE', updatedAt: '2026-06-12T08:00:00Z', dueDate: '2026-06-10', complexity: 'MOYEN' }),
      TODAY
    );
    expect(line.category).toBe('LATE');
    expect(line.base).toBe(-2);
    expect(line.bonus).toBe(1);
    expect(line.points).toBe(-1);
  });

  it('penalises an open ticket whose due date has passed (no bonus)', () => {
    const line = scoreTicket(
      createTicket({ status: 'IN_PROGRESS', dueDate: '2026-06-10', complexity: 'TRES_COMPLEXE' }),
      TODAY
    );
    expect(line.category).toBe('OVERDUE_OPEN');
    expect(line.points).toBe(-3);
    expect(line.bonus).toBe(0);
  });

  it('is neutral for an open ticket not yet due', () => {
    const line = scoreTicket(
      createTicket({ status: 'IN_PROGRESS', dueDate: '2026-06-30' }),
      TODAY
    );
    expect(line.category).toBe('PENDING');
    expect(line.points).toBe(0);
  });

  it('excludes done tickets without a due date and rejected tickets', () => {
    expect(scoreTicket(createTicket({ status: 'DONE', dueDate: undefined }), TODAY).category).toBe('NO_DUE_DATE');
    expect(scoreTicket(createTicket({ status: 'REJECTED', dueDate: '2026-06-01' }), TODAY).category).toBe('EXCLUDED');
    expect(scoreTicket(createTicket({ status: 'DONE', dueDate: undefined }), TODAY).points).toBe(0);
  });
});

describe('scoreConsultantTickets', () => {
  it('aggregates the total and per-category counts', () => {
    const tickets = [
      createTicket({ id: 'a', status: 'DONE', updatedAt: '2026-06-09T08:00:00Z', dueDate: '2026-06-10', complexity: 'COMPLEXE' }), // +6
      createTicket({ id: 'b', status: 'DONE', updatedAt: '2026-06-12T08:00:00Z', dueDate: '2026-06-10', complexity: 'MOYEN' }), // -1
      createTicket({ id: 'c', status: 'IN_PROGRESS', dueDate: '2026-06-01' }), // -3 overdue open
      createTicket({ id: 'd', status: 'NEW', dueDate: '2026-06-30' }), // 0 pending
      createTicket({ id: 'e', status: 'REJECTED' }), // excluded
    ];
    const result = scoreConsultantTickets(tickets, TODAY);
    expect(result.total).toBe(6 - 1 - 3 + 0);
    expect(result.counts).toEqual({ onTime: 1, late: 1, overdueOpen: 1, pending: 1, excluded: 1 });
    expect(result.lines).toHaveLength(5);
  });

  it('returns a zero total for an empty ticket list', () => {
    const result = scoreConsultantTickets([], TODAY);
    expect(result.total).toBe(0);
    expect(result.lines).toHaveLength(0);
  });
});
