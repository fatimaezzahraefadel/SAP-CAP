import { describe, expect, it } from 'vitest';
import type { Project, Ticket } from '@/app/types/entities';
import {
  buildCalendarDays,
  buildTicketsByDate,
  filterTickets,
  sortProjectsByName,
} from '@/app/features/tickets/model';
import type { TicketFilters } from '@/app/features/tickets/model';

const createTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'TCK-2025-7001',
  ticketCode: 'TK-2025-7001',
  projectId: 'PRJ-S4-001',
  createdBy: 'USR-MGR-001',
  assignedTo: 'USR-CONS-001',
  assignedToRole: 'CONSULTANT_TECHNIQUE',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  nature: 'ENHANCEMENT',
  title: 'Développement module FI',
  description: 'Ajout contrôle TVA intracommunautaire.',
  dueDate: '2025-03-21T00:00:00.000Z',
  createdAt: '2025-02-18T08:00:00.000Z',
  updatedAt: '2025-02-20T10:00:00.000Z',
  history: [],
  effortHours: 12,
  estimationHours: 16,
  complexity: 'MOYEN',
  wricefId: 'ENH-FI-TAX-003',
  module: 'FI',
  ...overrides,
});

const createProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'PRJ-S4-001',
  name: 'Alpha S/4 Conversion',
  managerId: 'USR-MGR-001',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  status: 'ACTIVE',
  priority: 'HIGH',
  description: 'Programme de migration vers S/4HANA.',
  ...overrides,
});

const filtersAllActive: TicketFilters = {
  searchQuery: 'tva',
  statusFilter: 'IN_PROGRESS',
  moduleFilter: 'FI',
  complexityFilter: 'MOYEN',
  projectFilter: 'PRJ-S4-001',
  assigneeFilter: 'USR-CONS-001',
  dateFrom: '2025-02-01',
  dateTo: '2025-03-31',
  wricefFilter: 'enh-fi',
};

const emptyFilters: TicketFilters = {
  searchQuery: '',
  statusFilter: 'ALL',
  moduleFilter: 'ALL',
  complexityFilter: 'ALL',
  projectFilter: 'ALL',
  assigneeFilter: 'ALL',
  dateFrom: '',
  dateTo: '',
  wricefFilter: '',
};


describe('filterTickets', () => {
  it('returns expected output for typical input', () => {
    const tickets = [
      createTicket(),
      createTicket({
        id: 'TCK-2025-7002',
        ticketCode: 'TK-2025-7002',
        title: 'Rapport marge contribution',
        description: 'Extrait CO mensuel',
        module: 'CO',
        complexity: 'COMPLEXE',
        status: 'NEW',
        wricefId: 'RPT-CO-MAR-002',
      }),
    ];

    const result = filterTickets(tickets, { ...emptyFilters, searchQuery: 'marge' }, (projectId) =>
      projectId === 'PRJ-S4-001' ? 'Alpha S/4 Conversion' : 'Unknown'
    );

    expect(result.map((ticket) => ticket.ticketCode)).toEqual(['TK-2025-7002']);
  });

  it('handles empty input without throwing', () => {
    const result = filterTickets([], emptyFilters, () => 'Unknown');
    expect(result).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    const tickets = [
      createTicket({
        wricefId: null,
        assignedTo: undefined,
        module: null,
        dueDate: undefined,
      }),
    ];

    const result = filterTickets(tickets, { ...emptyFilters, wricefFilter: 'enh' }, () => 'Alpha S/4 Conversion');
    expect(result).toEqual([]);
  });

  it('handles edge case with all filters active simultaneously', () => {
    const tickets = [
      createTicket(),
      createTicket({
        id: 'TCK-2025-7003',
        ticketCode: 'TK-2025-7003',
        status: 'IN_TEST',
      }),
    ];

    const result = filterTickets(tickets, filtersAllActive, () => 'Alpha S/4 Conversion');
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-2025-7001']);
  });
});

describe('buildTicketsByDate', () => {
  it('returns expected output for typical input', () => {
    const tickets = [
      createTicket({ id: 'A', dueDate: '2025-03-21T00:00:00.000Z' }),
      createTicket({ id: 'B', ticketCode: 'TK-2025-7102', dueDate: '2025-03-21T00:00:00.000Z' }),
      createTicket({ id: 'C', ticketCode: 'TK-2025-7103', dueDate: '2025-03-22T00:00:00.000Z' }),
    ];

    const result = buildTicketsByDate(tickets);
    expect(Object.keys(result)).toEqual(['2025-03-21T00:00:00.000Z', '2025-03-22T00:00:00.000Z']);
    expect(result['2025-03-21T00:00:00.000Z'].map((ticket) => ticket.id)).toEqual(['A', 'B']);
  });

  it('handles empty input without throwing', () => {
    expect(buildTicketsByDate([])).toEqual({});
  });

  it('handles null/undefined fields gracefully', () => {
    const tickets = [createTicket({ id: 'D', dueDate: undefined, createdAt: '2025-02-11T09:30:00.000Z' })];
    const result = buildTicketsByDate(tickets);
    expect(result['2025-02-11'].map((ticket) => ticket.id)).toEqual(['D']);
  });

  it('handles empty dueDate edge case with createdAt fallback', () => {
    const tickets = [createTicket({ id: 'E', dueDate: '', createdAt: '2025-02-12T14:00:00.000Z' })];
    const result = buildTicketsByDate(tickets);
    expect(Object.keys(result)).toEqual(['2025-02-12']);
  });

  it('skips tickets without dueDate or createdAt instead of throwing', () => {
    const tickets = [createTicket({ id: 'F', dueDate: undefined, createdAt: null as unknown as string })];
    expect(buildTicketsByDate(tickets)).toEqual({});
  });
});

describe('sortProjectsByName', () => {
  it('returns expected output for typical input', () => {
    const projects = [
      createProject({ id: 'PRJ-3', name: 'Zeta Rollout WM' }),
      createProject({ id: 'PRJ-1', name: 'Alpha S/4 Conversion' }),
      createProject({ id: 'PRJ-2', name: 'Delta Fiori UX' }),
    ];

    const result = sortProjectsByName(projects);
    expect(result.map((project) => project.name)).toEqual([
      'Alpha S/4 Conversion',
      'Delta Fiori UX',
      'Zeta Rollout WM',
    ]);
  });

  it('handles empty input without throwing', () => {
    expect(sortProjectsByName([])).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    const projects = [createProject({ description: undefined as unknown as string })];
    const result = sortProjectsByName(projects);
    expect(result[0].id).toBe('PRJ-S4-001');
  });

  it('handles identical names edge case with stable ordering', () => {
    const projects = [
      createProject({ id: 'PRJ-DELTA-A', name: 'Projet Delta' }),
      createProject({ id: 'PRJ-ALPHA', name: 'Projet Alpha' }),
      createProject({ id: 'PRJ-DELTA-B', name: 'Projet Delta' }),
    ];

    const result = sortProjectsByName(projects);
    expect(result.map((project) => project.id)).toEqual(['PRJ-ALPHA', 'PRJ-DELTA-A', 'PRJ-DELTA-B']);
  });
});


describe('buildCalendarDays', () => {
  it('returns expected output for typical input', () => {
    const cells = buildCalendarDays('2025-01');
    const currentMonthCells = cells.filter((cell) => cell.isCurrentMonth);

    expect(cells.length).toBe(36);
    expect(currentMonthCells).toHaveLength(31);
  });

  it('handles empty input without throwing', () => {
    expect(buildCalendarDays('')).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    expect(buildCalendarDays('2025-AB')).toEqual([]);
  });

  it('handles leap-year and December rollover edge cases', () => {
    const februaryCells = buildCalendarDays('2024-02');
    const decemberCells = buildCalendarDays('2024-12');

    const februaryCurrentMonth = februaryCells.filter((cell) => cell.isCurrentMonth);
    const decemberSpillover = decemberCells.filter(
      (cell) => !cell.isCurrentMonth && cell.date.startsWith('2025-01-')
    );

    expect(februaryCurrentMonth).toHaveLength(29);
    expect(decemberSpillover.length > 0).toBe(true);
  });
});


