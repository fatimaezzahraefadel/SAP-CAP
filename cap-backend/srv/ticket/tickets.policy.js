'use strict';

const cds = require('@sap/cds');
const policies = require('../_shared/security/policies');
const { Actions } = require('../_shared/security/actions');
const { Roles, RoleSets } = require('../_shared/security/roles');
const { ENTITIES } = require('../shared/services/validation');

const TECH_UPDATE_FIELDS = new Set([
  'status',
  'effortHours',
  'effortComment',
  'history',
  'tags',
  'updatedAt',
]);

const FUNCTIONAL_DETAIL_FIELDS = new Set([
  'title',
  'description',
  'nature',
  'priority',
  'complexity',
  'module',
  'dueDate',
  'tags',
  'documentationObjectIds',
  'comments',
  'updatedAt',
]);

const FUNCTIONAL_TEST_FIELDS = new Set([
  'status',
  'effortComment',
  'comments',
  'history',
  'documentationObjectIds',
  'updatedAt',
]);

// A pure Kanban status move — the functional owner may drive their own ticket
// through any valid workflow transition (transition validity itself is still
// enforced in tickets.domain.js / the UPDATE handler).
const STATUS_MOVE_FIELDS = new Set(['status', 'history', 'updatedAt']);

const EDITABLE_FUNCTIONAL_STATUSES = new Set(['PENDING_APPROVAL', 'REJECTED']);
const FUNCTIONAL_TEST_STATUSES = new Set(['IN_TEST']);
const FUNCTIONAL_TEST_TARGET_STATUSES = new Set(['DONE', 'IN_PROGRESS']);
const NON_APPROVED_STATUSES = new Set(['PENDING_APPROVAL', 'NEW', 'REJECTED']);

const getTicket = (resource) => resource?.current ?? resource ?? null;
const getChanges = (resource) => resource?.changes ?? {};

// CAP merges the entity key (ID) into req.data for UPDATE/PATCH, so it shows up
// in `changes` even though the client never sends it. Ignore key/system fields
// when checking which business fields a role is allowed to modify.
const IGNORED_CHANGE_FIELDS = new Set(['ID']);
const hasOnlyFields = (changes, allowedFields) =>
  Object.keys(changes ?? {})
    .filter((field) => !IGNORED_CHANGE_FIELDS.has(field))
    .every((field) => allowedFields.has(field));

const isStaff = (ctx) => RoleSets.STAFF.has(ctx.role);
const isAssignedTech = (ctx, ticket) =>
  ctx.role === Roles.CONSULTANT_TECHNIQUE && String(ticket?.assignedTo ?? '') === ctx.userId;
const isFunctionalOwner = (ctx, ticket) =>
  ctx.role === Roles.CONSULTANT_FONCTIONNEL && String(ticket?.createdBy ?? '') === ctx.userId;
const isFunctionalTester = (ctx, ticket) =>
  ctx.role === Roles.CONSULTANT_FONCTIONNEL && String(ticket?.functionalTesterId ?? '') === ctx.userId;

function canCreateTicket(ctx, data) {
  if (!RoleSets.TICKET_CREATORS.has(ctx.role)) return false;

  if (ctx.role === Roles.CONSULTANT_FONCTIONNEL) {
    if (data?.createdBy !== undefined && String(data.createdBy) !== ctx.userId) return false;
    if (data) {
      data.createdBy = ctx.userId;
      data.status = 'PENDING_APPROVAL';
    }
  }

  return true;
}

function canReadTicket(ctx, ticket) {
  if (isStaff(ctx)) return true;
  if (!ticket) {
    return ctx.role === Roles.CONSULTANT_TECHNIQUE || ctx.role === Roles.CONSULTANT_FONCTIONNEL;
  }
  if (isAssignedTech(ctx, ticket)) return true;
  if (isFunctionalOwner(ctx, ticket) || isFunctionalTester(ctx, ticket)) return true;
  return false;
}

function canUpdateTicket(ctx, resource) {
  const ticket = getTicket(resource);
  if (!ticket) return false;
  if (isStaff(ctx)) return true;

  const changes = getChanges(resource);

  if (isAssignedTech(ctx, ticket)) {
    return hasOnlyFields(changes, TECH_UPDATE_FIELDS);
  }

  if (isFunctionalOwner(ctx, ticket)) {
    // The author may drag their own ticket through the workflow (status move),
    // edit details while it is still pending/rejected, and run functional tests.
    if (isStatusMove(changes)) return true;
    if (EDITABLE_FUNCTIONAL_STATUSES.has(ticket.status)) {
      return hasOnlyFields(changes, FUNCTIONAL_DETAIL_FIELDS);
    }
    if (FUNCTIONAL_TEST_STATUSES.has(ticket.status)) {
      return isAllowedFunctionalTestChange(changes);
    }
  }

  if (isFunctionalTester(ctx, ticket) && FUNCTIONAL_TEST_STATUSES.has(ticket.status)) {
    return isAllowedFunctionalTestChange(changes);
  }

  return false;
}

function isAllowedFunctionalTestChange(changes) {
  if (!hasOnlyFields(changes, FUNCTIONAL_TEST_FIELDS)) return false;
  if (changes?.status === undefined) return true;
  return FUNCTIONAL_TEST_TARGET_STATUSES.has(changes.status);
}

function isStatusMove(changes) {
  return changes?.status !== undefined && hasOnlyFields(changes, STATUS_MOVE_FIELDS);
}

async function canDeleteTicket(ctx, ticket) {
  if (!ticket) return false;
  if (ctx.role === Roles.MANAGER) return true;
  if (!isFunctionalOwner(ctx, ticket)) return false;
  if (!NON_APPROVED_STATUSES.has(ticket.status)) return false;

  const [hasTime, hasValidatedDeliverable, hasLockedFiles] = await Promise.all([
    hasImputedTime(ticket.ID),
    hasApprovedDeliverable(ticket.ID),
    hasLockedAttachment(ticket.ID),
  ]);

  return !hasTime && !hasValidatedDeliverable && !hasLockedFiles;
}

function canApproveOrReject(ctx) {
  return RoleSets.TICKET_APPROVERS.has(ctx.role);
}

async function hasImputedTime(ticketId) {
  if (!ticketId) return false;

  const [timeLog, imputation] = await Promise.all([
    cds.db.run(
      SELECT.one.from(ENTITIES.TimeLogs).columns('ID').where({
        ticketId,
        durationMinutes: { '>': 0 },
      })
    ),
    cds.db.run(
      SELECT.one.from(ENTITIES.Imputations).columns('ID').where({
        ticketId,
        hours: { '>': 0 },
      })
    ),
  ]);

  return Boolean(timeLog || imputation);
}

async function hasApprovedDeliverable(ticketId) {
  if (!ticketId) return false;
  const deliverable = await cds.db.run(
    SELECT.one.from(ENTITIES.Deliverables).columns('ID').where({
      ticketId,
      validationStatus: 'APPROVED',
    })
  );
  return Boolean(deliverable);
}

async function hasLockedAttachment(ticketId) {
  if (!ticketId) return false;
  const attachments = await cds.db.run(
    SELECT.from(ENTITIES.Attachments).where({
      parentType: 'TICKET',
      parentId: ticketId,
    })
  );

  return attachments.some((attachment) =>
    attachment.locked === true ||
    attachment.isLocked === true ||
    String(attachment.status ?? '').toUpperCase() === 'LOCKED'
  );
}

policies.register(Actions.TICKET_CREATE, canCreateTicket);
policies.register(Actions.TICKET_READ, canReadTicket);
policies.register(Actions.TICKET_UPDATE, canUpdateTicket);
policies.register(Actions.TICKET_DELETE, canDeleteTicket);
policies.register(Actions.TICKET_APPROVE, canApproveOrReject);
policies.register(Actions.TICKET_REJECT, canApproveOrReject);

module.exports = {
  Actions,
  canCreateTicket,
  canReadTicket,
  canUpdateTicket,
  canDeleteTicket,
  canApproveOrReject,
};
