'use strict';

const cds = require('@sap/cds');

// ---------------------------------------------------------------------------
// Demo dataset.
//
// Purpose: make every feature of the platform look "alive" during a demo,
// even on a freshly deployed / empty landscape. Applied at runtime (on
// `served`), AFTER ensure-reference-users and ensure-sample-tickets, so it can
// reference the canonical users (u-*), the seeded projects (proj-1..3) and the
// sample evaluation tickets (tk-eval-*).
//
// Every row uses a stable `demo-` prefixed ID and is inserted idempotently
// (matched by ID): existing rows and manual edits are NEVER touched, and the
// seed can be replayed on every boot without creating duplicates.
//
// Reference "today" is mid-2026 (the app's demo window), so dates are chosen so
// leave requests, imputations and tickets read as current / actionable.
// ---------------------------------------------------------------------------

const N = 'sap.performance.dashboard.db.';
const T = (isoDate) => `${isoDate}T09:00:00.000Z`;

// --- Projects -------------------------------------------------------------
// A richer portfolio: an active TMA, a project in the planning phase and a
// completed one, so the projects list shows every ProjectStatus.
const PROJECTS = [
  { ID: 'demo-proj-hr', name: 'SuccessFactors HR Core Rollout', projectType: 'TMA', managerId: 'u-manager', startDate: '2026-03-01', endDate: '2026-11-30', status: 'ACTIVE', priority: 'MEDIUM', description: 'Rollout of SuccessFactors Employee Central and time-off management.', progress: 45, complexity: 'MEDIUM', createdAt: T('2026-03-01') },
  { ID: 'demo-proj-cfin', name: 'Central Finance Consolidation', projectType: 'BUILD', managerId: 'u-manager', startDate: '2026-05-01', endDate: '2027-02-28', status: 'PLANNED', priority: 'HIGH', description: 'Central Finance (cFIN) real-time replication and group consolidation.', progress: 5, complexity: 'HIGH', createdAt: T('2026-04-15') },
  { ID: 'demo-proj-payroll', name: 'Legacy Payroll Decommission', projectType: 'TMA', managerId: 'u-manager', startDate: '2025-09-01', endDate: '2026-05-31', status: 'COMPLETED', priority: 'LOW', description: 'Decommission of the legacy payroll system after S/4 go-live.', progress: 100, complexity: 'LOW', createdAt: T('2025-09-01') },
];

// --- Allocations ----------------------------------------------------------
// Give the runtime-seeded consultants (Karim u-tech-2, Léa u-tech-3) real
// capacity so the allocation / capacity views are populated for them.
const ALLOCATIONS = [
  { ID: 'demo-alloc-t2-1', userId: 'u-tech-2', projectId: 'proj-1', allocationPercent: 70, startDate: '2026-01-01', endDate: '2026-12-31' },
  { ID: 'demo-alloc-t2-2', userId: 'u-tech-2', projectId: 'demo-proj-hr', allocationPercent: 30, startDate: '2026-03-01', endDate: '2026-11-30' },
  { ID: 'demo-alloc-t3-1', userId: 'u-tech-3', projectId: 'demo-proj-hr', allocationPercent: 60, startDate: '2026-03-01', endDate: '2026-11-30' },
  { ID: 'demo-alloc-t3-2', userId: 'u-tech-3', projectId: 'proj-3', allocationPercent: 40, startDate: '2026-01-01', endDate: '2026-06-30' },
  { ID: 'demo-alloc-fonc', userId: 'u-fonc', projectId: 'demo-proj-hr', allocationPercent: 50, startDate: '2026-03-01', endDate: '2026-11-30' },
  { ID: 'demo-alloc-pm', userId: 'u-pm', projectId: 'demo-proj-hr', allocationPercent: 40, startDate: '2026-03-01', endDate: '2026-11-30' },
];

// --- WRICEF (validation workflow) -----------------------------------------
// One WRICEF package whose objects span every WricefStatus, so the WRICEF
// validation screen shows the full DRAFT -> PENDING -> VALIDATED/REJECTED flow.
const WRICEFS = [
  { ID: 'demo-wricef-hr', projectId: 'demo-proj-hr', sourceFileName: 'SuccessFactors_HR_WRICEF.xlsx', importedAt: T('2026-03-05'), status: 'PENDING_VALIDATION', autoCreated: false, submittedBy: 'u-tech', submittedAt: T('2026-06-20'), createdAt: T('2026-03-05') },
];
const WRICEF_OBJECTS = [
  { ID: 'demo-wo-1', wricefId: 'demo-wricef-hr', projectId: 'demo-proj-hr', type: 'W', title: 'Time-off approval workflow', description: 'Multi-level time-off approval routed to the line manager and HR.', complexity: 'MOYEN', module: 'HR', status: 'PENDING_VALIDATION', createdAt: T('2026-03-05') },
  { ID: 'demo-wo-2', wricefId: 'demo-wricef-hr', projectId: 'demo-proj-hr', type: 'R', title: 'Headcount & turnover report', description: 'Monthly headcount and turnover analytics report.', complexity: 'SIMPLE', module: 'HR', status: 'VALIDATED', createdAt: T('2026-03-05') },
  { ID: 'demo-wo-3', wricefId: 'demo-wricef-hr', projectId: 'demo-proj-hr', type: 'E', title: 'Org structure enhancement', description: 'Enhancement to sync the org structure with the HR mini-master.', complexity: 'COMPLEXE', module: 'HR', status: 'DRAFT', createdAt: T('2026-03-05') },
  { ID: 'demo-wo-4', wricefId: 'demo-wricef-hr', projectId: 'demo-proj-hr', type: 'I', title: 'Payroll outbound interface', description: 'Outbound interface pushing payroll-relevant data to the provider.', complexity: 'TRES_COMPLEXE', module: 'HR', status: 'REJECTED', rejectionReason: 'Mapping incomplete for retro-active changes; resubmit with delta logic.', createdAt: T('2026-03-05') },
];

// --- Documentation --------------------------------------------------------
const DOCS = [
  { ID: 'demo-doc-hr-sfd', title: 'SuccessFactors SFD – Time Off', description: 'Solution & Functional Design for the time-off management scope.', type: 'SFD', content: 'Functional design covering absence types, accruals and approval flow.', projectId: 'demo-proj-hr', authorId: 'u-fonc', sourceSystem: 'MANUAL', createdAt: T('2026-03-12') },
  { ID: 'demo-doc-fiori-guide', title: 'Fiori Launchpad Admin Guide', description: 'Administration guide for the Fiori launchpad configuration.', type: 'GUIDE', content: 'Catalog, group and role assignment procedures for the launchpad.', projectId: 'proj-2', authorId: 'u-tech', sourceSystem: 'MANUAL', createdAt: T('2026-04-02') },
  { ID: 'demo-doc-cutover', title: 'S/4HANA Cutover Checklist', description: 'Go-live cutover runbook for the Acme migration.', type: 'GENERAL', content: 'Step-by-step cutover activities, owners and rollback points.', projectId: 'proj-1', authorId: 'u-manager', sourceSystem: 'MANUAL', createdAt: T('2026-05-10') },
];

// --- Notifications --------------------------------------------------------
// At least one unread notification per persona so the bell shows a badge and
// the notification centre is populated on every dashboard.
const NOTIFICATIONS = [
  { ID: 'demo-notif-mgr-1', userId: 'u-manager', type: 'LEAVE_REQUEST', title: 'Leave request to review', message: 'Karim Technique requested leave from 2026-07-20 to 2026-07-24.', targetPath: '/manager/leaves', read: false, createdAt: T('2026-06-28') },
  { ID: 'demo-notif-mgr-2', userId: 'u-manager', type: 'TICKET_APPROVAL', title: 'Ticket awaiting approval', message: 'A new ticket is pending your approval on Central Finance.', targetPath: '/manager/tickets', read: false, createdAt: T('2026-06-29') },
  { ID: 'demo-notif-tech-1', userId: 'u-tech', type: 'TICKET_ASSIGNED', title: 'New ticket assigned', message: 'You have been assigned "Enhancement export comptable".', targetPath: '/consultant-tech/tickets', read: false, createdAt: T('2026-06-27') },
  { ID: 'demo-notif-t2-1', userId: 'u-tech-2', type: 'TICKET_ASSIGNED', title: 'New ticket assigned', message: 'You have been assigned "Programme de reprise des données MM".', targetPath: '/consultant-tech/tickets', read: false, createdAt: T('2026-06-26') },
  { ID: 'demo-notif-t3-1', userId: 'u-tech-3', type: 'EVALUATION', title: 'New evaluation available', message: 'Your Q2 2026 evaluation has been published.', targetPath: '/consultant-tech/dashboard', read: false, createdAt: T('2026-06-30') },
  { ID: 'demo-notif-fonc-1', userId: 'u-fonc', type: 'WRICEF_VALIDATION', title: 'WRICEF to validate', message: 'The HR WRICEF package is pending functional validation.', targetPath: '/consultant-func/wricef', read: false, createdAt: T('2026-06-25') },
  { ID: 'demo-notif-pm-1', userId: 'u-pm', type: 'IMPUTATION', title: 'Timesheet to validate', message: 'Karim Technique submitted his 2026-06-H2 imputations.', targetPath: '/project-manager/imputations', read: false, createdAt: T('2026-06-30') },
];

// --- Leave requests -------------------------------------------------------
const LEAVES = [
  { ID: 'demo-leave-t2', consultantId: 'u-tech-2', startDate: '2026-07-20', endDate: '2026-07-24', reason: 'Summer holidays', status: 'PENDING', managerId: 'u-manager', createdAt: T('2026-06-28') },
  { ID: 'demo-leave-t3', consultantId: 'u-tech-3', startDate: '2026-08-10', endDate: '2026-08-14', reason: 'Family event', status: 'PENDING', managerId: 'u-manager', createdAt: T('2026-06-29') },
  { ID: 'demo-leave-fonc', consultantId: 'u-fonc', startDate: '2026-06-15', endDate: '2026-06-16', reason: 'Medical appointment', status: 'APPROVED', managerId: 'u-manager', createdAt: T('2026-06-05'), reviewedAt: T('2026-06-06') },
];

// --- Imputation periods + imputations (time tracking) ---------------------
const IMPUTATION_PERIODS = [
  { ID: 'demo-period-tech', periodKey: '2026-06-H2', consultantId: 'u-tech', startDate: '2026-06-16', endDate: '2026-06-30', status: 'VALIDATED', totalHours: 40, submittedAt: T('2026-06-30'), validatedBy: 'u-pm', validatedAt: T('2026-07-01'), sentToStraTIME: false },
  { ID: 'demo-period-t2', periodKey: '2026-06-H2', consultantId: 'u-tech-2', startDate: '2026-06-16', endDate: '2026-06-30', status: 'SUBMITTED', totalHours: 38, submittedAt: T('2026-06-30'), sentToStraTIME: false },
  { ID: 'demo-period-t3', periodKey: '2026-06-H2', consultantId: 'u-tech-3', startDate: '2026-06-16', endDate: '2026-06-30', status: 'DRAFT', totalHours: 12, sentToStraTIME: false },
];
const IMPUTATIONS = [
  { ID: 'demo-imp-tech-1', consultantId: 'u-tech', ticketId: 'tk-eval-u-tech-01', projectId: 'proj-1', module: 'FI', date: '2026-06-17', hours: 7, description: 'FI calculation engine refactor', validationStatus: 'VALIDATED', periodKey: '2026-06-H2', validatedBy: 'u-pm', validatedAt: T('2026-07-01'), createdAt: T('2026-06-17') },
  { ID: 'demo-imp-t2-1', consultantId: 'u-tech-2', ticketId: 'tk-eval-u-tech-2-01', projectId: 'proj-1', module: 'WM', date: '2026-06-18', hours: 6, description: 'WM stock management module', validationStatus: 'SUBMITTED', periodKey: '2026-06-H2', createdAt: T('2026-06-18') },
  { ID: 'demo-imp-t2-2', consultantId: 'u-tech-2', ticketId: 'tk-eval-u-tech-2-02', projectId: 'proj-2', module: 'SD', date: '2026-06-19', hours: 5, description: 'Real-time sync enhancement', validationStatus: 'SUBMITTED', periodKey: '2026-06-H2', createdAt: T('2026-06-19') },
  { ID: 'demo-imp-t3-1', consultantId: 'u-tech-3', ticketId: 'tk-eval-u-tech-3-01', projectId: 'proj-3', module: 'BW', date: '2026-06-20', hours: 4, description: 'Log purge program', validationStatus: 'DRAFT', periodKey: '2026-06-H2', createdAt: T('2026-06-20') },
];

// --- TimeLogs (granular, StraTIME export) ---------------------------------
const TIMELOGS = [
  { ID: 'demo-tl-tech-1', consultantId: 'u-tech', ticketId: 'tk-eval-u-tech-01', projectId: 'proj-1', date: '2026-06-17', durationMinutes: 420, description: 'FI engine refactor', sentToStraTIME: false, createdAt: T('2026-06-17') },
  { ID: 'demo-tl-t2-1', consultantId: 'u-tech-2', ticketId: 'tk-eval-u-tech-2-01', projectId: 'proj-1', date: '2026-06-18', durationMinutes: 360, description: 'WM module build', sentToStraTIME: false, createdAt: T('2026-06-18') },
];

// --- Evaluations (stored, with qualitative grid) --------------------------
const EVALUATIONS = [
  { ID: 'demo-eval-t2', userId: 'u-tech-2', evaluatorId: 'u-manager', period: '2026-Q2', score: 4.6, feedback: 'Top performer: complex WM module delivered ahead of schedule.', createdAt: T('2026-06-30') },
  { ID: 'demo-eval-t3', userId: 'u-tech-3', evaluatorId: 'u-manager', period: '2026-Q2', score: 2.8, feedback: 'Solid technically; needs to improve on deadline commitment.', createdAt: T('2026-06-30') },
];
const EVAL_GRIDS = [
  { ID: 'demo-grid-t2-1', evaluation_ID: 'demo-eval-t2', criteria: 'Technical quality', rating: 'EXCELLENT' },
  { ID: 'demo-grid-t2-2', evaluation_ID: 'demo-eval-t2', criteria: 'Autonomy', rating: 'GOOD' },
  { ID: 'demo-grid-t3-1', evaluation_ID: 'demo-eval-t3', criteria: 'Technical quality', rating: 'GOOD' },
  { ID: 'demo-grid-t3-2', evaluation_ID: 'demo-eval-t3', criteria: 'Deadline respect', rating: 'NEEDS_IMPROVEMENT' },
];

// --- Deliverables ---------------------------------------------------------
const DELIVERABLES = [
  { ID: 'demo-del-1', projectId: 'proj-1', ticketId: 'tk-eval-u-tech-01', type: 'Document', name: 'FI Engine Cutover Runbook', validationStatus: 'PENDING', createdAt: T('2026-06-19') },
  { ID: 'demo-del-2', projectId: 'demo-proj-hr', type: 'Code', name: 'Time-off Fiori application', validationStatus: 'APPROVED', functionalComment: 'Validated against SFD scenarios.', createdAt: T('2026-06-10') },
];

// --- Unassigned / pending tickets (dispatch & approval demo) --------------
const TICKETS = [
  { ID: 'demo-tk-new-1', ticketCode: 'TK-2026-1001', projectId: 'proj-1', createdBy: 'u-manager', status: 'NEW', priority: 'HIGH', nature: 'PROGRAMME', title: 'Correction interface IDoc commandes', description: 'IDoc ORDERS05 rejeté en erreur de mapping partenaire.', dueDate: '2026-07-18', module: 'MM', complexity: 'MOYEN', createdAt: T('2026-06-28') },
  { ID: 'demo-tk-new-2', ticketCode: 'TK-2026-1002', projectId: 'demo-proj-hr', createdBy: 'u-manager', status: 'NEW', priority: 'MEDIUM', nature: 'FORMULAIRE', title: 'Écran Fiori de saisie des congés v2', description: 'Nouvelle version du formulaire de demande de congés.', dueDate: '2026-07-25', module: 'HR', complexity: 'SIMPLE', createdAt: T('2026-06-29') },
  { ID: 'demo-tk-pending', ticketCode: 'TK-2026-1003', projectId: 'demo-proj-cfin', createdBy: 'u-manager', status: 'PENDING_APPROVAL', priority: 'HIGH', nature: 'ENHANCEMENT', title: 'Réplication temps réel cFIN', description: 'Enhancement de la réplication temps réel vers Central Finance.', dueDate: '2026-08-15', module: 'FI', complexity: 'COMPLEXE', createdAt: T('2026-06-30') },
];

// --- Reference data -------------------------------------------------------
// Fill the currently empty PROJECT_TYPE bucket and round out the other types so
// the Reference Data screen looks complete.
const REFERENCE_DATA = [
  { ID: 'demo-ref-pt-1', type: 'PROJECT_TYPE', code: 'TMA', label: 'TMA (Maintenance)', active: true, order: 1 },
  { ID: 'demo-ref-pt-2', type: 'PROJECT_TYPE', code: 'BUILD', label: 'Build (Projet)', active: true, order: 2 },
  { ID: 'demo-ref-st-1', type: 'TICKET_STATUS', code: 'IN_TEST', label: 'In Test', active: true, order: 4 },
  { ID: 'demo-ref-st-2', type: 'TICKET_STATUS', code: 'BLOCKED', label: 'Blocked', active: true, order: 5 },
  { ID: 'demo-ref-st-3', type: 'TICKET_STATUS', code: 'PENDING_APPROVAL', label: 'Pending Approval', active: true, order: 6 },
  { ID: 'demo-ref-sk-1', type: 'SKILL', code: 'MM', label: 'SAP MM – Materials', active: true, order: null },
  { ID: 'demo-ref-sk-2', type: 'SKILL', code: 'SD', label: 'SAP SD – Sales', active: true, order: null },
  { ID: 'demo-ref-sk-3', type: 'SKILL', code: 'HANA', label: 'SAP HANA DB', active: true, order: null },
  { ID: 'demo-ref-sk-4', type: 'SKILL', code: 'BW', label: 'SAP BW / Analytics', active: false, order: null },
];

// Ordered so that parents are inserted before children (FKs / associations).
const DATASET = [
  ['Projects', PROJECTS],
  ['ReferenceData', REFERENCE_DATA],
  ['Allocations', ALLOCATIONS],
  ['Wricefs', WRICEFS],
  ['WricefObjects', WRICEF_OBJECTS],
  ['DocumentationObjects', DOCS],
  ['Notifications', NOTIFICATIONS],
  ['LeaveRequests', LEAVES],
  ['ImputationPeriods', IMPUTATION_PERIODS],
  ['Imputations', IMPUTATIONS],
  ['TimeLogs', TIMELOGS],
  ['Evaluations', EVALUATIONS],
  ['EvaluationQualitativeGrids', EVAL_GRIDS],
  ['Deliverables', DELIVERABLES],
  ['Tickets', TICKETS],
];

/**
 * Inserts any rows of `entity` (short name) not already present, matched by ID.
 * Returns the number of rows inserted.
 */
async function ensureRows(entity, rows) {
  const db = cds.db;
  if (!db || !rows || rows.length === 0) return 0;

  const fq = N + entity;
  const ids = rows.map((r) => r.ID);
  const existing = await db.run(SELECT.from(fq).columns('ID').where({ ID: { in: ids } }));
  const have = new Set(existing.map((r) => r.ID));

  const missing = rows.filter((r) => !have.has(r.ID));
  if (missing.length === 0) return 0;

  await db.run(INSERT.into(fq).entries(missing));
  return missing.length;
}

/**
 * Seeds the full demo dataset. Idempotent and safe to run on every boot.
 * Returns the total number of rows inserted across all entities.
 */
async function ensureDemoData() {
  const db = cds.db;
  if (!db) return 0;

  let total = 0;
  for (const [entity, rows] of DATASET) {
    total += await ensureRows(entity, rows);
  }
  return total;
}

module.exports = { ensureDemoData };
