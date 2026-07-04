'use strict';

const { ENTITIES, assertRequiredValue, assertEntityExists, assertInEnum, assertPositiveNumber } = require('../shared/services/validation');
const { getUserId, getRole } = require('../shared/services/authz');
const { TICKET_STATUS, TICKET_PRIORITY, TICKET_NATURE, TICKET_COMPLEXITY } = require('../shared/constants/enums');

// IMPORTANT: keep this in sync with the same map in tickets.domain.js.
// Working statuses (NEW, IN_PROGRESS, IN_TEST, BLOCKED, DONE) are freely
// interchangeable in both directions; the approval gate stays one-way.
const TICKET_STATUS_TRANSITIONS = {
  PENDING_APPROVAL: new Set(['APPROVED', 'REJECTED']),
  APPROVED: new Set(['NEW', 'IN_PROGRESS', 'REJECTED']),
  NEW: new Set(['IN_PROGRESS', 'IN_TEST', 'BLOCKED', 'DONE', 'REJECTED']),
  IN_PROGRESS: new Set(['NEW', 'IN_TEST', 'BLOCKED', 'DONE', 'REJECTED']),
  IN_TEST: new Set(['NEW', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'REJECTED']),
  BLOCKED: new Set(['NEW', 'IN_PROGRESS', 'IN_TEST', 'DONE', 'REJECTED']),
  DONE: new Set(['NEW', 'IN_PROGRESS', 'IN_TEST', 'BLOCKED', 'REJECTED']),
  REJECTED: new Set(['NEW', 'PENDING_APPROVAL']),
};

const assertTransition = (currentStatus, requestedStatus, req) => {
  if (requestedStatus === undefined || requestedStatus === null) return;
  if (!currentStatus || currentStatus === requestedStatus) return;

  const allowed = TICKET_STATUS_TRANSITIONS[currentStatus] || new Set();
  if (!allowed.has(requestedStatus)) {
    req.reject(409, `Invalid ticket status transition: ${currentStatus} -> ${requestedStatus}`);
  }
};

const validateCreate = async (req) => {
  const data = req.data ?? {};
  const role = getRole(req);
  const userId = getUserId(req);

  if (!userId) req.reject(401, 'Missing authenticated user');

  assertRequiredValue(data.projectId, 'projectId', req);
  assertRequiredValue(data.title, 'title', req);
  assertRequiredValue(data.nature, 'nature', req);
  assertInEnum(data.priority, Object.values(TICKET_PRIORITY), 'priority', req);
  assertInEnum(data.nature, Object.values(TICKET_NATURE), 'nature', req);
  assertInEnum(data.complexity, Object.values(TICKET_COMPLEXITY), 'complexity', req);
  assertPositiveNumber(data.effortHours, 'effortHours', req);
  assertPositiveNumber(data.estimationHours, 'estimationHours', req);
  assertPositiveNumber(data.allocatedHours, 'allocatedHours', req);

  await assertEntityExists(ENTITIES.Users, userId, 'createdBy', req);
  await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);

  if (data.assignedTo) {
    await assertEntityExists(ENTITIES.Users, data.assignedTo, 'assignedTo', req);
  }
  if (data.functionalTesterId) {
    await assertEntityExists(ENTITIES.Users, data.functionalTesterId, 'functionalTesterId', req);
  }

  if (role === 'CONSULTANT_FONCTIONNEL') {
    if (data.assignedTo && data.assignedTo !== userId) {
      req.reject(403, 'Functional consultants can only self-assign tickets to themselves');
    }
    if (data.assignedToRole && data.assignedToRole !== 'CONSULTANT_FONCTIONNEL') {
      req.reject(403, 'Functional consultant assignable role must be CONSULTANT_FONCTIONNEL');
    }
    if (data.status && data.status !== TICKET_STATUS.PENDING_APPROVAL) {
      req.reject(403, 'Functional consultant tickets must be created in PENDING_APPROVAL');
    }
  }
};

const validateUpdate = async (req, currentTicket) => {
  const data = req.data ?? {};

  if (!currentTicket) req.reject(404, 'Ticket not found');

  assertInEnum(data.priority, Object.values(TICKET_PRIORITY), 'priority', req);
  assertInEnum(data.nature, Object.values(TICKET_NATURE), 'nature', req);
  assertInEnum(data.complexity, Object.values(TICKET_COMPLEXITY), 'complexity', req);
  assertPositiveNumber(data.effortHours, 'effortHours', req);
  assertPositiveNumber(data.estimationHours, 'estimationHours', req);
  assertPositiveNumber(data.allocatedHours, 'allocatedHours', req);

  if (data.status !== undefined) {
    assertTransition(currentTicket.status, data.status, req);
    if (currentTicket.status === TICKET_STATUS.PENDING_APPROVAL) {
      const role = getRole(req);
      const canApprove = role === 'ADMIN' || role === 'MANAGER' || role === 'PROJECT_MANAGER';
      if (!canApprove) {
        req.reject(403, 'Only managers or project managers can advance tickets pending approval');
      }
    }
  }

  if (data.createdBy !== undefined && String(data.createdBy) !== String(getUserId(req))) {
    req.reject(403, 'createdBy cannot be reassigned to another user');
  }

  if (data.assignedTo !== undefined && data.assignedTo !== null) {
    await assertEntityExists(ENTITIES.Users, data.assignedTo, 'assignedTo', req);
  }
  if (data.functionalTesterId !== undefined && data.functionalTesterId !== null) {
    await assertEntityExists(ENTITIES.Users, data.functionalTesterId, 'functionalTesterId', req);
  }
};

module.exports = {
  validateCreate,
  validateUpdate,
  assertTransition,
};
