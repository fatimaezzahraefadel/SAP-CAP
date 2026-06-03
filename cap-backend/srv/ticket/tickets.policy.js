'use strict';

const { getUserId, getRole, isStaff, isConsultant } = require('../shared/services/authz');

const Actions = {
  TICKET_CREATE: 'ticket:create',
  TICKET_READ: 'ticket:read',
  TICKET_UPDATE: 'ticket:update',
  TICKET_DELETE: 'ticket:delete',
  TICKET_APPROVE: 'ticket:approve',
  TICKET_REJECT: 'ticket:reject',
  TICKET_START: 'ticket:start',
  TICKET_START_TEST: 'ticket:startTest',
  TICKET_COMPLETE: 'ticket:complete',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
  ATTACHMENT_UPLOAD: 'attachment:upload',
  ATTACHMENT_DOWNLOAD: 'attachment:download',
  ATTACHMENT_DELETE: 'attachment:delete',
  AUDIT_READ: 'audit:read',
};

const DELETE_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER']);
const APPROVAL_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER']);
const CREATE_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'DEV_COORDINATOR']);

const requirePolicy = async (req, action, ticket = null) => {
  switch (action) {
    case Actions.TICKET_CREATE:
      return requireCreate(req);
    case Actions.TICKET_READ:
      return requireRead(req);
    case Actions.TICKET_UPDATE:
      return requireUpdate(req, ticket);
    case Actions.TICKET_DELETE:
      return requireDelete(req, ticket);
    case Actions.TICKET_APPROVE:
      return requireApprove(req);
    case Actions.TICKET_REJECT:
      return requireReject(req);
    case Actions.TICKET_START:
      return requireStart(req, ticket);
    case Actions.TICKET_START_TEST:
      return requireStartTest(req, ticket);
    case Actions.TICKET_COMPLETE:
      return requireComplete(req, ticket);
    default:
      return;
  }
};

const requireCreate = (req) => {
  if (CREATE_ROLES.has(getRole(req))) return;
  if (getRole(req) === 'CONSULTANT_FONCTIONNEL') return;
  req.reject(403, 'You are not allowed to create tickets');
};

const requireRead = (req) => {
  if (isStaff(req) || isConsultant(req)) return;
  req.reject(403, 'You are not allowed to read tickets');
};

const requireUpdate = (req, ticket) => {
  if (!ticket) req.reject(404, 'Ticket not found');
  if (isStaff(req)) return;

  const role = getRole(req);
  const userId = getUserId(req);

  if (role === 'CONSULTANT_TECHNIQUE') {
    if (ticket.assignedTo !== userId) {
      req.reject(403, 'Technical consultants can only update their own assigned tickets');
    }
    return;
  }

  if (role === 'CONSULTANT_FONCTIONNEL') {
    const ownsTicket = ticket.createdBy === userId;
    const isTester = ticket.functionalTesterId === userId;
    if (!ownsTicket && !isTester) {
      req.reject(403, 'Functional consultants can only update tickets they created or test');
    }
    return;
  }

  req.reject(403, 'You are not allowed to update tickets');
};

const requireDelete = (req, ticket) => {
  if (!ticket) req.reject(404, 'Ticket not found');
  const role = getRole(req);
  const userId = getUserId(req);

  if (DELETE_ROLES.has(role)) return;

  if (role === 'CONSULTANT_FONCTIONNEL') {
    if (ticket.createdBy !== userId) {
      req.reject(403, 'Functional consultants can only delete their own tickets');
    }
    if (ticket.status === 'APPROVED') {
      req.reject(403, 'Approved tickets cannot be deleted');
    }
    if ((ticket.allocatedHours ?? 0) > 0) {
      req.reject(403, 'Ticket with allocated hours cannot be deleted');
    }
    if (ticket.hasValidDeliverable) {
      req.reject(403, 'Tickets with valid deliverables cannot be deleted');
    }
    if (ticket.hasLockedAttachment) {
      req.reject(403, 'Tickets with locked attachments cannot be deleted');
    }
    return;
  }

  req.reject(403, 'You are not allowed to delete tickets');
};

const requireApprove = (req) => {
  if (APPROVAL_ROLES.has(getRole(req))) return;
  req.reject(403, 'Only managers or project managers can approve tickets');
};

const requireReject = (req) => {
  if (APPROVAL_ROLES.has(getRole(req))) return;
  req.reject(403, 'Only managers or project managers can reject tickets');
};

const requireStart = (req, ticket) => {
  if (!ticket) req.reject(404, 'Ticket not found');
  if (isStaff(req)) return;
  const role = getRole(req);
  const userId = getUserId(req);

  if (role === 'CONSULTANT_TECHNIQUE' && ticket.assignedTo === userId) return;

  req.reject(403, 'Only the assigned technical consultant or staff can start this ticket');
};

const requireStartTest = (req, ticket) => {
  if (!ticket) req.reject(404, 'Ticket not found');
  if (isStaff(req)) return;
  const role = getRole(req);
  const userId = getUserId(req);

  if (role === 'CONSULTANT_TECHNIQUE' && ticket.assignedTo === userId) return;

  req.reject(403, 'Only the assigned technical consultant or staff can move the ticket to IN_TEST');
};

const requireComplete = (req, ticket) => {
  if (!ticket) req.reject(404, 'Ticket not found');
  if (isStaff(req)) return;
  const role = getRole(req);
  const userId = getUserId(req);

  if (role === 'CONSULTANT_FONCTIONNEL' && ticket.functionalTesterId === userId) return;

  req.reject(403, 'Only the assigned functional tester or staff can complete this ticket');
};

module.exports = {
  Actions,
  require: requirePolicy,
};
