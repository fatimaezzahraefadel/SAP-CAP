import { Ticket, TicketStatus } from '@/app/types/entities';

export const STATUS_ORDER: TicketStatus[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'NEW',
  'IN_PROGRESS',
  'IN_TEST',
  'BLOCKED',
  'DONE',
  'REJECTED',
];

// Allowed status transitions — mirrors the backend state machine
// (srv/ticket/tickets.domain.js TICKET_STATUS_TRANSITIONS). Used to block
// invalid Kanban drops client-side before hitting the server.
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['NEW', 'IN_PROGRESS', 'REJECTED'],
  NEW: ['IN_PROGRESS', 'BLOCKED', 'REJECTED'],
  IN_PROGRESS: ['IN_TEST', 'BLOCKED', 'DONE', 'REJECTED'],
  IN_TEST: ['DONE', 'IN_PROGRESS', 'REJECTED'],
  BLOCKED: ['IN_PROGRESS', 'REJECTED'],
  DONE: [],
  REJECTED: ['NEW', 'PENDING_APPROVAL'],
};

export const isStatusTransitionAllowed = (from: TicketStatus, to: TicketStatus): boolean =>
  from === to || (TICKET_STATUS_TRANSITIONS[from] ?? []).includes(to);

export const statusColor: Record<TicketStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  IN_TEST: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  BLOCKED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DONE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  REJECTED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300',
};

export const priorityColor: Record<Ticket['priority'], string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};
