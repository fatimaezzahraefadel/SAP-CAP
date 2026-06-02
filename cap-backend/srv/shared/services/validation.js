'use strict';

const cds = require('@sap/cds');

// ---- Entity FQN constants (avoids typos / magic strings) -----------------
const ENTITIES = Object.freeze({
  Users: 'sap.performance.dashboard.db.Users',
  Projects: 'sap.performance.dashboard.db.Projects',
  Tickets: 'sap.performance.dashboard.db.Tickets',
  TicketComments: 'sap.performance.dashboard.db.TicketComments',
  Allocations: 'sap.performance.dashboard.db.Allocations',
  Deliverables: 'sap.performance.dashboard.db.Deliverables',
  Imputations: 'sap.performance.dashboard.db.Imputations',
  ImputationPeriods: 'sap.performance.dashboard.db.ImputationPeriods',
  TimeLogs: 'sap.performance.dashboard.db.TimeLogs',
  Timesheets: 'sap.performance.dashboard.db.Timesheets',
  Wricefs: 'sap.performance.dashboard.db.Wricefs',
  WricefObjects: 'sap.performance.dashboard.db.WricefObjects',
  LeaveRequests: 'sap.performance.dashboard.db.LeaveRequests',
  Evaluations: 'sap.performance.dashboard.db.Evaluations',
  DocumentationObjects: 'sap.performance.dashboard.db.DocumentationObjects',
  Notifications: 'sap.performance.dashboard.db.Notifications',
  ProjectFeedback: 'sap.performance.dashboard.db.ProjectFeedback',
  ReferenceData: 'sap.performance.dashboard.db.ReferenceData',
  TicketHistory: 'sap.performance.dashboard.db.TicketHistory',
});

// ---- Generic existence check ---------------------------------------------
const assertEntityExists = async (entityName, id, fieldName, req) => {
  if (id === undefined || id === null) return;
  const normalized = String(id).trim();
  if (!normalized) {
    req.error(400, `${fieldName} is required`);
    return;
  }

  const existing = await cds.db.run(
    SELECT.one.from(entityName).columns('ID').where({ ID: normalized })
  );
  if (!existing) req.error(400, `Unknown ${fieldName} '${normalized}'`);
};

const assertRequiredValue = (value, fieldName, req) => {
  if (value === undefined || value === null) {
    req.error(400, `${fieldName} is required`);
    return;
  }

  if (typeof value === 'string' && !value.trim()) {
    req.error(400, `${fieldName} is required`);
  }
};

const assertDateRange = (startDate, endDate, req) => {
  if (!startDate || !endDate) return;
  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    req.error(400, 'endDate must be on or after startDate');
  }
};

const assertPositiveNumber = (value, fieldName, req) => {
  if (value === undefined || value === null) return;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    req.error(400, `${fieldName} must be greater than or equal to 0`);
  }
};

const assertInEnum = (value, allowedValues, fieldName, req) => {
  if (value === undefined || value === null) return;
  if (!allowedValues.includes(value)) {
    req.error(400, `${fieldName} must be one of [${allowedValues.join(', ')}]`);
  }
};

// ---- RBAC role sets --------------------------------------------------------
const ADMIN_ONLY = new Set(['ADMIN']);
const MANAGER_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER']);
const ALL_NON_CONSULTANT_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'DEV_COORDINATOR']);
const ALL_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'DEV_COORDINATOR', 'CONSULTANT_TECHNIQUE', 'CONSULTANT_FONCTIONNEL']);

const requireRole = (req, allowedRoles, message) => {
  const role = req._authClaims?.role;
  if (!allowedRoles.has(role)) {
    req.reject(403, message || 'Forbidden: insufficient role');
  }
};

const requireOwnerOrRole = (req, ownerId, allowedRoles, message) => {
  const claims = req._authClaims;
  if (String(claims?.sub ?? '') === String(ownerId ?? '')) return;
  if (!allowedRoles.has(claims?.role)) {
    req.reject(403, message || 'Forbidden: not owner and insufficient role');
  }
};

module.exports = {
  ENTITIES,
  assertRequiredValue,
  assertEntityExists,
  assertDateRange,
  assertPositiveNumber,
  assertInEnum,
  // RBAC
  ADMIN_ONLY,
  MANAGER_ROLES,
  ALL_NON_CONSULTANT_ROLES,
  ALL_ROLES,
  requireRole,
  requireOwnerOrRole,
};
