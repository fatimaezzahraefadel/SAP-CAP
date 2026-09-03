'use strict';

const cds = require('@sap/cds');

// ---------------------------------------------------------------------------
// Demo dataset — "3 of everything".
//
// Purpose: make every screen of the platform look alive in production, even on
// a freshly deployed / empty landscape. Applied at runtime (on `served`), AFTER
// ensure-reference-users and ensure-sample-tickets, so it can reference the
// canonical users (u-*), the CSV-seeded projects (proj-1..3) and the sample
// evaluation tickets (tk-eval-*).
//
// Design rules:
//   - every business entity has AT LEAST 3 rows once the app is seeded,
//   - every status/enum of a workflow appears at least once (so each Kanban
//     column, badge and filter has something to show),
//   - every row uses a stable `demo-` prefixed ID and is inserted idempotently
//     (matched by ID): existing rows and manual edits are NEVER touched, and
//     the seed can be replayed on every boot without creating duplicates.
//
// Reference "today" is mid-2026 (the app's demo window); dates are chosen so
// leave requests, imputations, certificates and tickets read as current.
// ---------------------------------------------------------------------------

const N = 'sap.performance.dashboard.db.';
const T = (isoDate) => `${isoDate}T09:00:00.000Z`;

// --- Projects (3) -----------------------------------------------------------
// One per remaining ProjectStatus so, combined with the CSV projects (ACTIVE,
// ACTIVE, PLANNED), the portfolio shows every status.
const PROJECTS = [
  { ID: 'demo-proj-hr', name: 'SuccessFactors HR Core Rollout', projectType: 'TMA', managerId: 'u-manager', startDate: '2026-03-01', endDate: '2026-11-30', status: 'ACTIVE', priority: 'MEDIUM', description: 'Rollout of SuccessFactors Employee Central and time-off management.', progress: 45, complexity: 'MEDIUM', createdAt: T('2026-03-01') },
  { ID: 'demo-proj-cfin', name: 'Central Finance Consolidation', projectType: 'BUILD', managerId: 'u-manager', startDate: '2026-05-01', endDate: '2027-02-28', status: 'ON_HOLD', priority: 'HIGH', description: 'Central Finance (cFIN) real-time replication and group consolidation.', progress: 5, complexity: 'HIGH', createdAt: T('2026-04-15') },
  { ID: 'demo-proj-payroll', name: 'Legacy Payroll Decommission', projectType: 'TMA', managerId: 'u-manager', startDate: '2025-09-01', endDate: '2026-05-31', status: 'COMPLETED', priority: 'LOW', description: 'Decommission of the legacy payroll system after S/4 go-live.', progress: 100, complexity: 'LOW', createdAt: T('2025-09-01') },
];

// --- Project tech keywords (3) ---------------------------------------------
const PROJECT_KEYWORDS = [
  { ID: 'demo-kw-hr', project_ID: 'demo-proj-hr', keyword: 'SuccessFactors' },
  { ID: 'demo-kw-cfin', project_ID: 'demo-proj-cfin', keyword: 'Central Finance' },
  { ID: 'demo-kw-payroll', project_ID: 'demo-proj-payroll', keyword: 'Payroll' },
];

// --- Skills for the runtime-seeded consultants (3) --------------------------
const USER_SKILLS = [
  { ID: 'demo-skill-t2-wm', user_ID: 'u-tech-2', skill: 'SAP WM' },
  { ID: 'demo-skill-t2-mm', user_ID: 'u-tech-2', skill: 'SAP MM' },
  { ID: 'demo-skill-t3-bw', user_ID: 'u-tech-3', skill: 'SAP BW' },
];

// --- Allocations (6) --------------------------------------------------------
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

// --- WRICEF packages (3) — one per validation stage --------------------------
const WRICEFS = [
  { ID: 'demo-wricef-hr', projectId: 'demo-proj-hr', sourceFileName: 'SuccessFactors_HR_WRICEF.xlsx', importedAt: T('2026-03-05'), status: 'PENDING_VALIDATION', autoCreated: false, submittedBy: 'u-tech', submittedAt: T('2026-06-20'), createdAt: T('2026-03-05') },
  { ID: 'demo-wricef-acme', projectId: 'proj-1', sourceFileName: 'Acme_S4_Migration_WRICEF.xlsx', importedAt: T('2026-02-10'), status: 'VALIDATED', autoCreated: false, submittedBy: 'u-tech-2', submittedAt: T('2026-02-15'), createdAt: T('2026-02-10') },
  { ID: 'demo-wricef-cfin', projectId: 'demo-proj-cfin', sourceFileName: 'Central_Finance_WRICEF.xlsx', importedAt: T('2026-06-01'), status: 'DRAFT', autoCreated: false, createdAt: T('2026-06-01') },
];

// One object per WRICEF letter across the packages, spanning every status.
const WRICEF_OBJECTS = [
  // HR package — pending functional validation
  { ID: 'demo-wo-hr-1', wricefId: 'demo-wricef-hr', projectId: 'demo-proj-hr', type: 'W', title: 'Time-off approval workflow', description: 'Multi-level time-off approval routed to the line manager and HR.', complexity: 'MOYEN', module: 'HR', status: 'PENDING_VALIDATION', createdAt: T('2026-03-05') },
  { ID: 'demo-wo-hr-2', wricefId: 'demo-wricef-hr', projectId: 'demo-proj-hr', type: 'R', title: 'Headcount & turnover report', description: 'Monthly headcount and turnover analytics report.', complexity: 'SIMPLE', module: 'HR', status: 'VALIDATED', createdAt: T('2026-03-05') },
  { ID: 'demo-wo-hr-3', wricefId: 'demo-wricef-hr', projectId: 'demo-proj-hr', type: 'I', title: 'Payroll outbound interface', description: 'Outbound interface pushing payroll-relevant data to the provider.', complexity: 'TRES_COMPLEXE', module: 'HR', status: 'REJECTED', rejectionReason: 'Mapping incomplete for retro-active changes; resubmit with delta logic.', createdAt: T('2026-03-05') },
  // Acme package — fully validated
  { ID: 'demo-wo-acme-1', wricefId: 'demo-wricef-acme', projectId: 'proj-1', type: 'C', title: 'Vendor master conversion', description: 'LSMW replacement converting legacy vendor masters to BP.', complexity: 'COMPLEXE', module: 'MM', status: 'VALIDATED', createdAt: T('2026-02-10') },
  { ID: 'demo-wo-acme-2', wricefId: 'demo-wricef-acme', projectId: 'proj-1', type: 'E', title: 'Pricing user-exit rework', description: 'Rework of SD pricing user-exits for S/4 compatibility.', complexity: 'MOYEN', module: 'SD', status: 'VALIDATED', createdAt: T('2026-02-10') },
  { ID: 'demo-wo-acme-3', wricefId: 'demo-wricef-acme', projectId: 'proj-1', type: 'F', title: 'Invoice PDF form (Adobe)', description: 'Adobe Forms replacement of the legacy SAPscript invoice.', complexity: 'SIMPLE', module: 'FI', status: 'VALIDATED', createdAt: T('2026-02-10') },
  // cFIN package — still being drafted
  { ID: 'demo-wo-cfin-1', wricefId: 'demo-wricef-cfin', projectId: 'demo-proj-cfin', type: 'I', title: 'Real-time FI document replication', description: 'SLT-based replication of FI documents into the cFIN system.', complexity: 'TRES_COMPLEXE', module: 'FI', status: 'DRAFT', createdAt: T('2026-06-01') },
  { ID: 'demo-wo-cfin-2', wricefId: 'demo-wricef-cfin', projectId: 'demo-proj-cfin', type: 'R', title: 'Group consolidation report', description: 'Consolidated P&L report across company codes.', complexity: 'COMPLEXE', module: 'CO', status: 'DRAFT', createdAt: T('2026-06-01') },
  { ID: 'demo-wo-cfin-3', wricefId: 'demo-wricef-cfin', projectId: 'demo-proj-cfin', type: 'E', title: 'Document splitting enhancement', description: 'Enhancement of document splitting rules for the new ledger.', complexity: 'MOYEN', module: 'FI', status: 'DRAFT', createdAt: T('2026-06-01') },
];

// --- Documentation (3) ------------------------------------------------------
const DOCS = [
  { ID: 'demo-doc-hr-sfd', title: 'SuccessFactors SFD – Time Off', description: 'Solution & Functional Design for the time-off management scope.', type: 'SFD', content: 'Functional design covering absence types, accruals and approval flow.', projectId: 'demo-proj-hr', authorId: 'u-fonc', sourceSystem: 'MANUAL', createdAt: T('2026-03-12') },
  { ID: 'demo-doc-fiori-guide', title: 'Fiori Launchpad Admin Guide', description: 'Administration guide for the Fiori launchpad configuration.', type: 'GUIDE', content: 'Catalog, group and role assignment procedures for the launchpad.', projectId: 'proj-2', authorId: 'u-tech', sourceSystem: 'MANUAL', createdAt: T('2026-04-02') },
  { ID: 'demo-doc-cutover', title: 'S/4HANA Cutover Checklist', description: 'Go-live cutover runbook for the Acme migration.', type: 'GENERAL', content: 'Step-by-step cutover activities, owners and rollback points.', projectId: 'proj-1', authorId: 'u-manager', sourceSystem: 'MANUAL', createdAt: T('2026-05-10') },
];

// --- Notifications (vides — pas de notifications demo) -----------------------
const NOTIFICATIONS = [];

// --- Leave requests (3 — one per status) -------------------------------------
const LEAVES = [
  { ID: 'demo-leave-t2', consultantId: 'u-tech-2', startDate: '2026-07-20', endDate: '2026-07-24', reason: 'Summer holidays', status: 'PENDING', managerId: 'u-manager', createdAt: T('2026-06-28') },
  { ID: 'demo-leave-fonc', consultantId: 'u-fonc', startDate: '2026-06-15', endDate: '2026-06-16', reason: 'Medical appointment', status: 'APPROVED', managerId: 'u-manager', createdAt: T('2026-06-05'), reviewedAt: T('2026-06-06') },
  { ID: 'demo-leave-t3', consultantId: 'u-tech-3', startDate: '2026-08-10', endDate: '2026-08-21', reason: 'Extended family event', status: 'REJECTED', managerId: 'u-manager', createdAt: T('2026-06-20'), reviewedAt: T('2026-06-22') },
];

// --- Imputation periods (3 — one per status) + imputations (4) ---------------
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

// --- TimeLogs (3 — granular, StraTIME export) --------------------------------
const TIMELOGS = [
  { ID: 'demo-tl-tech-1', consultantId: 'u-tech', ticketId: 'tk-eval-u-tech-01', projectId: 'proj-1', date: '2026-06-17', durationMinutes: 420, description: 'FI engine refactor', sentToStraTIME: false, createdAt: T('2026-06-17') },
  { ID: 'demo-tl-t2-1', consultantId: 'u-tech-2', ticketId: 'tk-eval-u-tech-2-01', projectId: 'proj-1', date: '2026-06-18', durationMinutes: 360, description: 'WM module build', sentToStraTIME: false, createdAt: T('2026-06-18') },
  { ID: 'demo-tl-t3-1', consultantId: 'u-tech-3', ticketId: 'tk-eval-u-tech-3-01', projectId: 'proj-3', date: '2026-06-20', durationMinutes: 240, description: 'Log purge development', sentToStraTIME: false, createdAt: T('2026-06-20') },
];

// --- Timesheets (3 — legacy daily hours) --------------------------------------
const TIMESHEETS = [
  { ID: 'demo-ts-tech', userId: 'u-tech', date: '2026-06-17', hours: 7, projectId: 'proj-1', ticketId: 'tk-eval-u-tech-01', comment: 'FI engine refactor' },
  { ID: 'demo-ts-t2', userId: 'u-tech-2', date: '2026-06-18', hours: 6, projectId: 'proj-1', ticketId: 'tk-eval-u-tech-2-01', comment: 'WM module build' },
  { ID: 'demo-ts-fonc', userId: 'u-fonc', date: '2026-06-19', hours: 5, projectId: 'demo-proj-hr', comment: 'Time-off SFD workshops' },
];

// --- Evaluations (3 — ticket-based scores matching the sample tickets) -------
// Scores mirror what the Evaluations screen computes from tk-eval-* tickets
// (see ensure-sample-tickets.js): consistent numbers, no surprises in a demo.
const EVALUATIONS = [
  { ID: 'demo-eval-t2', userId: 'u-tech-2', evaluatorId: 'u-manager', period: '2026-S1', score: 15, feedback: 'Top performer: the very complex WM module landed ahead of schedule.', createdAt: T('2026-06-30') },
  { ID: 'demo-eval-tech', userId: 'u-tech', evaluatorId: 'u-manager', period: '2026-S1', score: 12, feedback: 'Strong, consistent delivery across FI and workflow topics.', createdAt: T('2026-06-30') },
  { ID: 'demo-eval-t3', userId: 'u-tech-3', evaluatorId: 'u-manager', period: '2026-S1', score: 2, feedback: 'Solid technically; needs to improve on deadline commitment.', createdAt: T('2026-06-30') },
];
const EVAL_GRIDS = [
  { ID: 'demo-grid-t2-1', evaluation_ID: 'demo-eval-t2', criteria: 'Technical quality', rating: 'EXCELLENT' },
  { ID: 'demo-grid-t2-2', evaluation_ID: 'demo-eval-t2', criteria: 'Autonomy', rating: 'GOOD' },
  { ID: 'demo-grid-t2-3', evaluation_ID: 'demo-eval-t2', criteria: 'Collaboration', rating: 'GOOD' },
];

// --- Deliverables (3 — one per validation status) -----------------------------
const DELIVERABLES = [
  { ID: 'demo-del-1', projectId: 'proj-1', ticketId: 'tk-eval-u-tech-01', type: 'Document', name: 'FI Engine Cutover Runbook', validationStatus: 'PENDING', createdBy: 'u-tech', createdAt: T('2026-06-19') },
  { ID: 'demo-del-2', projectId: 'demo-proj-hr', type: 'Code', name: 'Time-off Fiori application', validationStatus: 'APPROVED', functionalComment: 'Validated against SFD scenarios.', createdBy: 'u-tech-3', createdAt: T('2026-06-10') },
  { ID: 'demo-del-3', projectId: 'proj-2', ticketId: 'tk-eval-u-fonc-02', type: 'Document', name: 'Customer form specification v2', validationStatus: 'CHANGES_REQUESTED', functionalComment: 'Add the credit-block scenario before resubmitting.', createdBy: 'u-fonc', createdAt: T('2026-06-24') },
];

// --- Unassigned / pending tickets (3 — dispatch & approval demo) --------------
const TICKETS = [
  { ID: 'demo-tk-new-1', ticketCode: 'TK-2026-1001', projectId: 'proj-1', createdBy: 'u-manager', status: 'NEW', priority: 'HIGH', nature: 'PROGRAMME', title: 'Correction interface IDoc commandes', description: 'IDoc ORDERS05 rejeté en erreur de mapping partenaire.', dueDate: '2026-07-18', module: 'MM', complexity: 'MOYEN', createdAt: T('2026-06-28') },
  { ID: 'demo-tk-new-2', ticketCode: 'TK-2026-1002', projectId: 'demo-proj-hr', createdBy: 'u-manager', status: 'NEW', priority: 'MEDIUM', nature: 'FORMULAIRE', title: 'Écran Fiori de saisie des congés v2', description: 'Nouvelle version du formulaire de demande de congés.', dueDate: '2026-07-25', module: 'HR', complexity: 'SIMPLE', createdAt: T('2026-06-29') },
  { ID: 'demo-tk-pending', ticketCode: 'TK-2026-1003', projectId: 'demo-proj-cfin', createdBy: 'u-manager', status: 'PENDING_APPROVAL', priority: 'HIGH', nature: 'ENHANCEMENT', title: 'Réplication temps réel cFIN', description: 'Enhancement de la réplication temps réel vers Central Finance.', dueDate: '2026-08-15', module: 'FI', complexity: 'COMPLEXE', createdAt: T('2026-06-30') },
];

// --- Ticket tags (3) ----------------------------------------------------------
const TICKET_TAGS = [
  { ID: 'demo-tag-1', ticket_ID: 'demo-tk-new-1', tag: 'idoc' },
  { ID: 'demo-tag-2', ticket_ID: 'demo-tk-new-2', tag: 'fiori' },
  { ID: 'demo-tag-3', ticket_ID: 'demo-tk-pending', tag: 'cfin' },
];

// --- Ticket comments (3 — one per comment type worth demoing) ------------------
const TICKET_COMMENTS = [
  { ID: 'demo-com-1', ticket_ID: 'demo-tk-new-1', ticketId: 'demo-tk-new-1', authorId: 'u-manager', message: 'Le partenaire EDI confirme que le segment E1EDKA1 est absent.', commentType: 'UPDATE', isInternal: false, resolved: false, createdAt: T('2026-06-29') },
  { ID: 'demo-com-2', ticket_ID: 'demo-tk-new-1', ticketId: 'demo-tk-new-1', authorId: 'u-tech', message: 'Besoin d\'un accès au mapping PI pour reproduire — qui peut le fournir ?', commentType: 'QUESTION', isInternal: true, resolved: false, createdAt: T('2026-06-30') },
  { ID: 'demo-com-3', ticket_ID: 'demo-tk-pending', ticketId: 'demo-tk-pending', authorId: 'u-fonc', message: 'Le périmètre inclut-il les documents de régularisation ?', commentType: 'BLOCKER', isInternal: false, resolved: false, createdAt: T('2026-07-01') },
];

// --- Certificates (3 — active / expiring soon / expired) -----------------------
const CERTIFICATES = [
  { ID: 'demo-cert-tech', userId: 'u-tech', title: 'SAP Certified Development Associate – ABAP', issuingOrg: 'SAP', issuedDate: '2025-01-15', expiryDate: '2028-01-15', credentialId: 'C_TAW12_750-114233', credentialUrl: 'https://www.credly.com/badges/demo-abap', status: 'ACTIVE', description: 'ABAP with SAP NetWeaver 7.50.', createdAt: T('2025-01-15') },
  { ID: 'demo-cert-t2', userId: 'u-tech-2', title: 'SAP Certified Application Associate – EWM', issuingOrg: 'SAP', issuedDate: '2024-08-01', expiryDate: '2026-07-28', credentialId: 'C_EWM_95-208771', credentialUrl: 'https://www.credly.com/badges/demo-ewm', status: 'ACTIVE', description: 'Extended Warehouse Management 9.5. Renewal due this month.', createdAt: T('2024-08-01') },
  { ID: 'demo-cert-fonc', userId: 'u-fonc', title: 'SAP Certified Application Associate – SuccessFactors EC', issuingOrg: 'SAP', issuedDate: '2023-05-10', expiryDate: '2026-05-10', credentialId: 'C_THR81_2311-302115', credentialUrl: 'https://www.credly.com/badges/demo-sfec', status: 'EXPIRED', description: 'Employee Central core configuration.', createdAt: T('2023-05-10') },
];

// --- Project feedback (3) -------------------------------------------------------
const PROJECT_FEEDBACK = [
  { ID: 'demo-fb-1', projectId: 'proj-1', authorId: 'u-manager', content: 'Migration on track; FI stabilization ahead of plan thanks to the engine refactor.', createdAt: T('2026-06-20') },
  { ID: 'demo-fb-2', projectId: 'demo-proj-hr', authorId: 'u-pm', content: 'Time-off scope validated by HR; awaiting payroll interface decision.', createdAt: T('2026-06-25') },
  { ID: 'demo-fb-3', projectId: 'proj-2', authorId: 'u-fonc', content: 'Launchpad adoption is good; users ask for a mobile-friendly leave form.', createdAt: T('2026-06-28') },
];

// --- Reference data ---------------------------------------------------------
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
  ['ProjectTechKeywords', PROJECT_KEYWORDS],
  ['UserSkills', USER_SKILLS],
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
  ['Timesheets', TIMESHEETS],
  ['Evaluations', EVALUATIONS],
  ['EvaluationQualitativeGrids', EVAL_GRIDS],
  ['Deliverables', DELIVERABLES],
  ['Tickets', TICKETS],
  ['TicketTags', TICKET_TAGS],
  ['TicketComments', TICKET_COMMENTS],
  ['Certificates', CERTIFICATES],
  ['ProjectFeedback', PROJECT_FEEDBACK],
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
  // Données de demo désactivées — la plateforme démarre vide pour les tests réels
  return 0;
}

module.exports = { ensureDemoData };
