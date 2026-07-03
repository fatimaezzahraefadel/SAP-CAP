'use strict';

const cds = require('@sap/cds');

const TICKETS_ENTITY = 'sap.performance.dashboard.db.Tickets';

// ---------------------------------------------------------------------------
// Sample evaluation tickets, one small portfolio per consultant.
//
// The consultant performance evaluation (Evaluations page) derives a score
// directly from each consultant's tickets, combining three dimensions:
//   - DEADLINE   : done on time (+4) / done late (-2) / open past due (-3)
//   - COMPLEXITY : SIMPLE 0 / MOYEN +1 / COMPLEXE +2 / TRES_COMPLEXE +3
//   - NATURE     : FORMULAIRE 0 / REPORT +1 / WORKFLOW +1 / ENHANCEMENT +2 /
//                  PROGRAMME +2 / MODULE +3
// (bonuses apply only to completed tickets — see
//  app/frontend/src/app/features/evaluations/scoring.ts)
//
// These rows give every evaluable consultant a spread of on-time, late,
// overdue and pending tickets across complexities and natures, so the score
// is generated the moment a manager selects them — no manual data entry.
//
// Like ensure-reference-users, this is applied at runtime (on `served`) and is
// idempotent: rows are matched by ID and only missing ones are inserted, so
// real tickets and manual edits are never touched.
// ---------------------------------------------------------------------------

// Reference "today" the seed reasons about is mid-2026; due/completion dates
// are chosen so DONE tickets read as on-time or late, and open ones as pending
// or overdue, regardless of the exact run date within that window.
const T = (isoDate) => `${isoDate}T09:00:00.000Z`;

// dim = [status, complexity, nature, dueDate, completedDate|null]
// completedDate is only meaningful for DONE tickets (drives on-time vs late).
const build = (consultantId, role, seq, title, projectId, priority, dim) => {
  const [status, complexity, nature, dueDate, completedDate] = dim;
  const idNum = String(seq).padStart(2, '0');
  const row = {
    ID: `tk-eval-${consultantId}-${idNum}`,
    ticketCode: `TK-EVAL-${consultantId.toUpperCase()}-${idNum}`,
    projectId,
    createdBy: 'u-manager',
    assignedTo: consultantId,
    assignedToRole: role,
    status,
    priority,
    nature,
    title,
    complexity,
    createdAt: T('2026-06-01'),
  };
  if (dueDate) row.dueDate = dueDate;
  // updatedAt is the completion timestamp the scoring uses for on-time/late.
  if (status === 'DONE' && completedDate) row.updatedAt = T(completedDate);
  return row;
};

const TECH = 'CONSULTANT_TECHNIQUE';
const FONC = 'CONSULTANT_FONCTIONNEL';

const SAMPLE_TICKETS = [
  // Théo Technique (u-tech) — strong performer (expected total +12)
  build('u-tech', TECH, 1, 'Refonte du moteur de calcul FI', 'proj-1', 'HIGH', ['DONE', 'COMPLEXE', 'PROGRAMME', '2026-06-20', '2026-06-18']),
  build('u-tech', TECH, 2, 'Workflow de validation des commandes', 'proj-1', 'MEDIUM', ['DONE', 'MOYEN', 'WORKFLOW', '2026-06-15', '2026-06-14']),
  build('u-tech', TECH, 3, 'Formulaire Fiori de saisie des frais', 'proj-2', 'LOW', ['DONE', 'SIMPLE', 'FORMULAIRE', '2026-06-10', '2026-06-14']),
  build('u-tech', TECH, 4, 'Enhancement export comptable', 'proj-1', 'MEDIUM', ['IN_PROGRESS', 'MOYEN', 'ENHANCEMENT', '2026-07-20', null]),

  // Karim Technique (u-tech-2) — top performer (expected total +15)
  build('u-tech-2', TECH, 1, 'Module de gestion des stocks WM', 'proj-1', 'CRITICAL', ['DONE', 'TRES_COMPLEXE', 'MODULE', '2026-06-22', '2026-06-20']),
  build('u-tech-2', TECH, 2, 'Enhancement synchronisation temps réel', 'proj-2', 'HIGH', ['DONE', 'COMPLEXE', 'ENHANCEMENT', '2026-06-12', '2026-06-19']),
  build('u-tech-2', TECH, 3, 'Programme de reprise des données MM', 'proj-1', 'HIGH', ['IN_PROGRESS', 'COMPLEXE', 'PROGRAMME', '2026-06-05', null]),
  build('u-tech-2', TECH, 4, 'Rapport analytique CO', 'proj-3', 'MEDIUM', ['DONE', 'MOYEN', 'REPORT', '2026-06-25', '2026-06-24']),

  // Léa Technique (u-tech-3) — needs improvement (expected total +2)
  build('u-tech-3', TECH, 1, 'Programme de purge des logs', 'proj-3', 'MEDIUM', ['IN_PROGRESS', 'MOYEN', 'PROGRAMME', '2026-06-08', null]),
  build('u-tech-3', TECH, 2, 'Refonte du programme d\'interface', 'proj-1', 'HIGH', ['DONE', 'MOYEN', 'PROGRAMME', '2026-06-10', '2026-06-16']),
  build('u-tech-3', TECH, 3, 'Formulaire de demande de congés', 'proj-2', 'LOW', ['DONE', 'SIMPLE', 'FORMULAIRE', '2026-06-28', '2026-06-27']),
  build('u-tech-3', TECH, 4, 'Workflow de relance fournisseur', 'proj-1', 'MEDIUM', ['NEW', 'MOYEN', 'WORKFLOW', '2026-07-25', null]),

  // Fatima Fonctionnel (u-fonc) — solid (expected total +11)
  build('u-fonc', FONC, 1, 'Cadrage du workflow d\'approbation PO', 'proj-1', 'HIGH', ['DONE', 'COMPLEXE', 'WORKFLOW', '2026-06-20', '2026-06-19']),
  build('u-fonc', FONC, 2, 'Spécification du formulaire client', 'proj-2', 'MEDIUM', ['DONE', 'MOYEN', 'FORMULAIRE', '2026-06-24', '2026-06-23']),
  build('u-fonc', FONC, 3, 'Rapport de suivi des créances', 'proj-1', 'LOW', ['DONE', 'SIMPLE', 'REPORT', '2026-06-05', '2026-06-09']),
  build('u-fonc', FONC, 4, 'Cadrage enhancement reporting BW', 'proj-3', 'MEDIUM', ['IN_PROGRESS', 'COMPLEXE', 'ENHANCEMENT', '2026-07-15', null]),
];

/**
 * Inserts any sample evaluation tickets that are not already present, matched
 * by ID. Returns the number of tickets inserted (0 when nothing was missing).
 */
async function ensureSampleTickets() {
  const db = cds.db;
  if (!db) return 0;

  const ids = SAMPLE_TICKETS.map((t) => t.ID);
  const existing = await db.run(SELECT.from(TICKETS_ENTITY).columns('ID').where({ ID: { in: ids } }));
  const existingIds = new Set(existing.map((t) => t.ID));

  const missing = SAMPLE_TICKETS.filter((t) => !existingIds.has(t.ID));
  if (missing.length === 0) return 0;

  await db.run(INSERT.into(TICKETS_ENTITY).entries(missing));
  return missing.length;
}

module.exports = { ensureSampleTickets, SAMPLE_TICKETS };
