// AI Assignee Recommender - deterministic implementation
//
// Architecture: put behind IAssigneeRecommender interface.
// Currently a deterministic scoring algorithm; later replace with real AI.

import {
  AssigneeRecommendation,
  Ticket,
  TicketNature,
  User,
} from '../types/entities';
import { odataFetch } from './odata/core';

// ---------------------------------------------------------------------------
// Interface (swap out for real AI later)
// ---------------------------------------------------------------------------

export interface IAssigneeRecommender {
  recommend(
    ticket: Partial<Ticket>,
    allUsers: User[],
    allTickets: Ticket[],
    /** Weight config - optional override */
    weights?: ScoringWeights,
  ): AssigneeRecommendation[] | Promise<AssigneeRecommendation[]>;
}

export interface ScoringWeights {
  availability: number;
  skillsMatch: number;
  performance: number;
  similarTickets: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  availability: 0.30,
  skillsMatch: 0.35,
  performance: 0.15,
  similarTickets: 0.20,
};

// ---------------------------------------------------------------------------
// Nature -> suggested skill mapping (heuristic baseline)
// ---------------------------------------------------------------------------

const NATURE_SKILL_MAP: Record<TicketNature, string[]> = {
  WORKFLOW: ['SAP Workflow', 'ABAP', 'BPM', 'Fiori', 'workflow'],
  FORMULAIRE: ['SAP Forms', 'ABAP', 'Adobe Forms', 'SmartForms', 'formulaire', 'UI5'],
  PROGRAMME: ['ABAP', 'Java', 'Node.js', 'CAP', 'BTP', 'programme'],
  ENHANCEMENT: ['ABAP', 'Fiori', 'Enhancement Framework', 'BAdI', 'enhancement'],
  MODULE: ['SAP MM', 'SAP SD', 'SAP FI', 'SAP CO', 'SAP PP', 'module', 'Business Analysis'],
  REPORT: ['ABAP', 'CDS Views', 'SAP Analytics Cloud', 'BW/4HANA', 'report', 'ALV'],
};

const ACTIVE_TICKET_STATUSES = new Set(['NEW', 'IN_PROGRESS', 'IN_TEST', 'BLOCKED']);

// ---------------------------------------------------------------------------
// Deterministic recommender
// ---------------------------------------------------------------------------

export class HeuristicAssigneeRecommender implements IAssigneeRecommender {
  recommend(
    ticket: Partial<Ticket>,
    allUsers: User[],
    allTickets: Ticket[],
    weights: ScoringWeights = DEFAULT_WEIGHTS,
  ): AssigneeRecommendation[] {
    const candidates = allUsers.filter((user) => user.active && user.role === 'CONSULTANT_TECHNIQUE');

    const scored = candidates
      .map((user) => {
        const availability = this.scoreAvailability(user, allTickets);
        const skills = this.scoreSkillsMatch(user, ticket);
        const performance = this.scorePerformance(user, allTickets);
        const similar = this.scoreSimilarTickets(user, ticket, allTickets);

        const totalScore =
          availability * weights.availability +
          skills * weights.skillsMatch +
          performance * weights.performance +
          similar * weights.similarTickets;

        const explanationParts: string[] = [];
        if (availability > 70) explanationParts.push('high availability');
        if (skills > 60) explanationParts.push('strong skills match');
        if (performance > 60) explanationParts.push('good track record');
        if (similar > 50) explanationParts.push('experience with similar tickets');
        if (explanationParts.length === 0) explanationParts.push('general compatibility');

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          score: Math.round(totalScore * 10) / 10,
          factors: {
            availabilityScore: Math.round(availability),
            skillsMatchScore: Math.round(skills),
            performanceScore: Math.round(performance),
            similarTicketsScore: Math.round(similar),
          },
          explanation: `Recommended due to ${explanationParts.join(', ')}. Overall score: ${Math.round(totalScore)}%.`,
        } satisfies AssigneeRecommendation;
      })
      .filter((recommendation) => recommendation.factors.availabilityScore >= 10);

    return scored
      .sort((a, b) => {
        const scoreDelta = b.score - a.score;
        if (Math.abs(scoreDelta) > 0.1) return scoreDelta;
        return b.factors.availabilityScore - a.factors.availabilityScore;
      })
      .slice(0, 5);
  }

  private scoreAvailability(user: User, allTickets: Ticket[]): number {
    const assignedOpenTickets = allTickets.filter(
      (ticket) => ticket.assignedTo === user.id && ACTIVE_TICKET_STATUSES.has(ticket.status),
    );

    const assignedHours = assignedOpenTickets.reduce((sum, ticket) => {
      return sum + (ticket.allocatedHours ?? ticket.effortHours ?? 4);
    }, 0);

    const loadPercent = Math.min(100, (assignedHours / 40) * 100);
    const availability = Math.max(0, Math.min(100, user.availabilityPercent ?? 100));

    return Math.max(0, Math.min(100, availability - loadPercent * 0.7));
  }

  private scoreSkillsMatch(user: User, ticket: Partial<Ticket>): number {
    const ticketSkills = new Set<string>();

    if (ticket.nature) {
      for (const skill of NATURE_SKILL_MAP[ticket.nature] ?? []) {
        this.addNormalizedSkill(ticketSkills, skill);
      }
    }

    if (ticket.tags) {
      ticket.tags.forEach((tag) => this.addNormalizedSkill(ticketSkills, tag));
    }

    if (ticketSkills.size === 0) {
      return 50;
    }

    const normalizedUserSkills = new Set(user.skills.map((skill) => this.normalizeSkill(skill)));
    let score = 0;

    ticketSkills.forEach((ticketSkill) => {
      if (normalizedUserSkills.has(ticketSkill)) {
        score += 1;
      } else if ([...normalizedUserSkills].some((userSkill) => userSkill.includes(ticketSkill) || ticketSkill.includes(userSkill))) {
        score += 0.75;
      }
    });

    return Math.min(100, Math.round((score / ticketSkills.size) * 100));
  }

  private scorePerformance(user: User, allTickets: Ticket[]): number {
    const assigned = allTickets.filter((ticket) => ticket.assignedTo === user.id);
    if (assigned.length === 0) {
      return 55;
    }

    const completed = assigned.filter((ticket) => ticket.status === 'DONE').length;
    const completionRate = completed / assigned.length;
    const experienceBonus = Math.min(20, completed * 2);
    return Math.min(100, Math.round(40 + completionRate * 50 + experienceBonus));
  }

  private scoreSimilarTickets(
    user: User,
    ticket: Partial<Ticket>,
    allTickets: Ticket[],
  ): number {
    if (!ticket.nature && !ticket.tags?.length) {
      return 30;
    }

    const sameNatureDone = ticket.nature
      ? allTickets.filter(
          (entry) =>
            entry.assignedTo === user.id &&
            entry.status === 'DONE' &&
            entry.nature === ticket.nature,
        ).length
      : 0;

    const sameTagsDone = ticket.tags?.length
      ? allTickets.filter(
          (entry) =>
            entry.assignedTo === user.id &&
            entry.status === 'DONE' &&
            entry.tags?.some((tag) => ticket.tags?.includes(tag)),
        ).length
      : 0;

    return Math.min(100, 30 + sameNatureDone * 20 + sameTagsDone * 10);
  }

  private normalizeSkill(skill: string): string {
    return skill.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  }

  private addNormalizedSkill(set: Set<string>, skill: string): void {
    const normalized = this.normalizeSkill(skill);
    if (normalized) {
      set.add(normalized);
    }
  }
}

export class GeminiAiRecommender implements IAssigneeRecommender {
  private fallbackRecommender = new HeuristicAssigneeRecommender();

  async recommend(
    ticket: Partial<Ticket>,
    allUsers: User[],
    allTickets: Ticket[],
    weights: ScoringWeights = DEFAULT_WEIGHTS,
  ): Promise<AssigneeRecommendation[]> {
    try {
      const response = await odataFetch<{ value: AssigneeRecommendation[] }>(
        'ticket',
        '/recommendAssignees',
        {
          method: 'POST',
          body: JSON.stringify({ ticketId: ticket.id })
        }
      );
      
      if (response && Array.isArray(response.value) && response.value.length > 0) {
        return response.value;
      }
      
      console.warn('AI Recommender returned empty or invalid response, falling back to heuristic');
      return this.fallbackRecommender.recommend(ticket, allUsers, allTickets, weights);
    } catch (error) {
      console.error('Error calling AI endpoint:', error);
      const fallback = new HeuristicAssigneeRecommender();
      return fallback.recommend(ticket, allUsers, allTickets, weights);
    }
  }
}

export const assigneeRecommender: IAssigneeRecommender = new GeminiAiRecommender();
