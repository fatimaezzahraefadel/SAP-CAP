import { Allocation, Ticket, TicketStatus, User } from '../../types/entities';

/**
 * Pure, unit-testable KPI computations for the manager performance dashboard.
 *
 * These were previously inlined inside ManagerDashboard.page.tsx (inside
 * `useMemo`), which made them impossible to test in isolation. Extracting them
 * here lets us guarantee their correctness with unit tests.
 */

const dateKey = (value: string): string => value.slice(0, 10);

/**
 * TACE — average current load of active technical consultants.
 *
 * For each active CONSULTANT_TECHNIQUE we sum the allocation percentages of the
 * allocations that are active on `today` (capped at 100% per consultant), then
 * average across consultants. Returns a rounded integer percentage.
 */
export const computeTace = (
  users: User[],
  allocations: Allocation[],
  today: string
): number => {
  const techConsultants = users.filter(
    (user) => user.role === 'CONSULTANT_TECHNIQUE' && user.active
  );
  if (techConsultants.length === 0) return 0;

  const rates = techConsultants.map((consultant) => {
    const currentAllocations = allocations.filter(
      (allocation) =>
        allocation.userId === consultant.id &&
        dateKey(allocation.startDate) <= today &&
        dateKey(allocation.endDate) >= today
    );
    return Math.min(
      currentAllocations.reduce((sum, allocation) => sum + allocation.allocationPercent, 0),
      100
    );
  });

  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / techConsultants.length);
};

export interface ProductivityMetrics {
  /** Completion rate (%) over actionable tickets (excludes REJECTED). */
  throughputRate: number;
  /** Count of CRITICAL or BLOCKED tickets. */
  criticalIssues: number;
  /** Share (%) of done-with-due-date tickets delivered on or before due date. */
  slaRate: number;
  /** Done tickets (with a due date) delivered on time. */
  slaOnTime: number;
  /** Done tickets that have a due date (SLA denominator). */
  slaTotal: number;
}

// Tickets that were never meant to reach completion and should not weigh on the
// throughput denominator.
const NON_THROUGHPUT_STATUSES: ReadonlySet<TicketStatus> = new Set(['REJECTED']);

/**
 * Productivity / SLA metrics derived from the ticket set.
 *
 * Fixes over the previous inline version:
 *  - SLA compares **calendar dates** (`updatedAt` is a full timestamp, `dueDate`
 *    often date-only), and only counts done tickets that actually have a due
 *    date — a done ticket with no due date can be neither on-time nor late.
 *  - Throughput excludes REJECTED tickets from the denominator (cancelled work
 *    should not drag the completion rate down).
 */
export const computeProductivityMetrics = (tickets: Ticket[]): ProductivityMetrics => {
  const completed = tickets.filter((ticket) => ticket.status === 'DONE');

  const throughputDenominator = tickets.filter(
    (ticket) => !NON_THROUGHPUT_STATUSES.has(ticket.status)
  ).length;
  const throughputRate = throughputDenominator
    ? (completed.length / throughputDenominator) * 100
    : 0;

  const criticalIssues = tickets.filter(
    (ticket) => ticket.priority === 'CRITICAL' || ticket.status === 'BLOCKED'
  ).length;

  const completedWithDueDate = completed.filter(
    (ticket) => Boolean(ticket.updatedAt) && Boolean(ticket.dueDate)
  );
  const onTime = completedWithDueDate.filter(
    (ticket) => dateKey(ticket.updatedAt as string) <= dateKey(ticket.dueDate as string)
  ).length;
  const slaRate = completedWithDueDate.length
    ? (onTime / completedWithDueDate.length) * 100
    : 100;

  return {
    throughputRate,
    criticalIssues,
    slaRate,
    slaOnTime: onTime,
    slaTotal: completedWithDueDate.length,
  };
};
