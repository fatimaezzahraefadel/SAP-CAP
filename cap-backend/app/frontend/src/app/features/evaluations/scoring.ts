import { Ticket, TicketComplexity } from '../../types/entities';

/**
 * Ticket-based performance scoring for consultant evaluations.
 *
 * The evaluation score is derived from the consultant's own tickets:
 *  - a ticket finished on or before its due date earns points,
 *  - a ticket finished late, or still open past its due date, loses points,
 *  - finishing harder tickets adds a difficulty bonus.
 *
 * All functions here are pure so the rules can be unit-tested in isolation.
 */

export const ON_TIME_POINTS = 4;
export const LATE_POINTS = -2;
export const OVERDUE_OPEN_POINTS = -3;

export const DIFFICULTY_BONUS: Record<TicketComplexity, number> = {
  SIMPLE: 0,
  MOYEN: 1,
  COMPLEXE: 2,
  TRES_COMPLEXE: 3,
};

export type TicketScoreCategory =
  | 'ON_TIME'
  | 'LATE'
  | 'OVERDUE_OPEN'
  | 'PENDING'
  | 'NO_DUE_DATE'
  | 'EXCLUDED';

export interface TicketScoreLine {
  ticketId: string;
  ticketCode: string;
  title: string;
  complexity: TicketComplexity;
  category: TicketScoreCategory;
  /** Base points before the difficulty bonus. */
  base: number;
  /** Difficulty bonus applied (only on completed tickets). */
  bonus: number;
  /** Total points contributed by this ticket. */
  points: number;
}

export interface ConsultantScore {
  total: number;
  lines: TicketScoreLine[];
  counts: {
    onTime: number;
    late: number;
    overdueOpen: number;
    pending: number;
    excluded: number;
  };
}

const dateKey = (value?: string): string => (value ? value.slice(0, 10) : '');

/** Score a single ticket against the reference day (`today`, format YYYY-MM-DD). */
export const scoreTicket = (ticket: Ticket, today: string): TicketScoreLine => {
  const complexity = ticket.complexity;
  const bonus = DIFFICULTY_BONUS[complexity] ?? 0;
  const line = (category: TicketScoreCategory, base: number, withBonus: boolean): TicketScoreLine => ({
    ticketId: ticket.id,
    ticketCode: ticket.ticketCode,
    title: ticket.title,
    complexity,
    category,
    base,
    bonus: withBonus ? bonus : 0,
    points: base + (withBonus ? bonus : 0),
  });

  // Rejected tickets do not reflect the consultant's performance.
  if (ticket.status === 'REJECTED') {
    return line('EXCLUDED', 0, false);
  }

  if (ticket.status === 'DONE') {
    const due = dateKey(ticket.dueDate);
    if (!due) {
      // Can't assess timeliness without a due date.
      return line('NO_DUE_DATE', 0, false);
    }
    const completed = dateKey(ticket.updatedAt) || dateKey(ticket.createdAt);
    const onTime = completed !== '' && completed <= due;
    return onTime ? line('ON_TIME', ON_TIME_POINTS, true) : line('LATE', LATE_POINTS, true);
  }

  // Still open: penalise only if the due date has passed.
  const due = dateKey(ticket.dueDate);
  if (due && due < today) {
    return line('OVERDUE_OPEN', OVERDUE_OPEN_POINTS, false);
  }
  return line('PENDING', 0, false);
};

/** Score every ticket of a consultant and aggregate the total. */
export const scoreConsultantTickets = (tickets: Ticket[], today: string): ConsultantScore => {
  const lines = tickets.map((ticket) => scoreTicket(ticket, today));
  const counts = { onTime: 0, late: 0, overdueOpen: 0, pending: 0, excluded: 0 };
  let total = 0;

  for (const line of lines) {
    total += line.points;
    if (line.category === 'ON_TIME') counts.onTime += 1;
    else if (line.category === 'LATE') counts.late += 1;
    else if (line.category === 'OVERDUE_OPEN') counts.overdueOpen += 1;
    else if (line.category === 'EXCLUDED') counts.excluded += 1;
    else counts.pending += 1; // PENDING + NO_DUE_DATE
  }

  return { total, lines, counts };
};
