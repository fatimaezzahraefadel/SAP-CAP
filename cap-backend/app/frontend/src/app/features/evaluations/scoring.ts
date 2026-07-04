import { Ticket, TicketComplexity, TicketNature } from '../../types/entities';

/**
 * Ticket-based performance scoring for consultant evaluations.
 *
 * The evaluation score is derived from the consultant's own tickets, using the
 * three dimensions carried by every ticket:
 *  - DEADLINE: a ticket finished on or before its due date earns points; one
 *    finished late, or still open past its due date, loses points,
 *  - COMPLEXITY: finishing harder tickets adds a difficulty bonus,
 *  - NATURE: the type of work adds a bonus reflecting its technical weight
 *    (a full module delivery is worth more than a simple form).
 *
 * All functions here are pure so the rules can be unit-tested in isolation.
 */

export const ON_TIME_POINTS = 4;
export const LATE_POINTS = -2;
export const OVERDUE_OPEN_POINTS = -3;

/** Bonus earned on completion for the business complexity of the ticket. */
export const DIFFICULTY_BONUS: Record<TicketComplexity, number> = {
  SIMPLE: 0,
  MOYEN: 1,
  COMPLEXE: 2,
  TRES_COMPLEXE: 3,
};

/**
 * Bonus earned on completion for the nature of the work. Ordered by the
 * technical weight typically involved: a simple form is the lightest, a full
 * module delivery the heaviest.
 */
export const NATURE_BONUS: Record<TicketNature, number> = {
  FORMULAIRE: 0,
  REPORT: 1,
  WORKFLOW: 1,
  ENHANCEMENT: 2,
  PROGRAMME: 2,
  MODULE: 3,
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
  nature: TicketNature;
  category: TicketScoreCategory;
  /** Base points from the deadline outcome, before any bonus. */
  base: number;
  /** Complexity bonus applied (only on completed tickets). */
  complexityBonus: number;
  /** Nature bonus applied (only on completed tickets). */
  natureBonus: number;
  /** Total bonus applied (complexity + nature); kept for display. */
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
  const nature = ticket.nature;
  const complexityBonus = DIFFICULTY_BONUS[complexity] ?? 0;
  const natureBonus = NATURE_BONUS[nature] ?? 0;
  const line = (category: TicketScoreCategory, base: number, withBonus: boolean): TicketScoreLine => {
    const appliedComplexity = withBonus ? complexityBonus : 0;
    const appliedNature = withBonus ? natureBonus : 0;
    const bonus = appliedComplexity + appliedNature;
    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      title: ticket.title,
      complexity,
      nature,
      category,
      base,
      complexityBonus: appliedComplexity,
      natureBonus: appliedNature,
      bonus,
      points: base + bonus,
    };
  };

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
    // Prefer the dedicated completion stamp; fall back to updatedAt/createdAt
    // for tickets completed before completedAt existed.
    const completed =
      dateKey(ticket.completedAt) ||
      dateKey(ticket.updatedAt) ||
      dateKey(ticket.createdAt);
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
