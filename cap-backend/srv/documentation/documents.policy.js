'use strict';

const cds = require('@sap/cds');
require('../ticket/tickets.policy');
const policies = require('../_shared/security/policies');
const { Actions } = require('../_shared/security/actions');
const { Roles, RoleSets } = require('../_shared/security/roles');
const { ENTITIES } = require('../shared/services/validation');

const getDocument = (resource) => resource?.current ?? resource ?? null;
const getChanges = (resource) => resource?.changes ?? {};
const isStaff = (ctx) => RoleSets.DOCUMENT_STAFF.has(ctx.role);
const isAuthor = (ctx, document) => String(document?.authorId ?? '') === ctx.userId;

function canCreateDocument(ctx, data) {
  if (!ctx.isAuthenticated) return false;
  if (data) data.authorId = ctx.userId;
  return true;
}

async function canReadDocument(ctx, resource) {
  const document = getDocument(resource);
  if (!document) return ctx.isAuthenticated;
  if (isStaff(ctx) || isAuthor(ctx, document)) return true;

  if (await canReadRelatedTicket(ctx, document)) return true;
  if (await canReadProject(ctx, document.projectId)) return true;

  return false;
}

function canUpdateDocument(ctx, resource) {
  const document = getDocument(resource);
  const changes = getChanges(resource);
  if (!document) return false;
  if (changes.authorId !== undefined) return false;
  return isStaff(ctx) || isAuthor(ctx, document);
}

function canDeleteDocument(ctx, document) {
  if (!document) return false;
  if (isLocked(document)) {
    return ctx.role === Roles.MANAGER || ctx.role === Roles.ADMIN;
  }
  return isAuthor(ctx, document) || ctx.role === Roles.MANAGER || ctx.role === Roles.ADMIN;
}

async function canReadRelatedTicket(ctx, document) {
  const ticketIds = extractRelatedTicketIds(document);
  if (ticketIds.length === 0 && document.ticketId) ticketIds.push(document.ticketId);
  if (ticketIds.length === 0) return false;

  const tickets = await cds.db.run(
    SELECT.from(ENTITIES.Tickets).where({ ID: { in: ticketIds } })
  );

  for (const ticket of tickets) {
    if (await policies.can(ctx, Actions.TICKET_READ, ticket)) return true;
  }
  return false;
}

async function canReadProject(ctx, projectId) {
  if (!projectId) return false;
  if (isStaff(ctx)) return true;

  const [project, allocation, ticket] = await Promise.all([
    cds.db.run(SELECT.one.from(ENTITIES.Projects).columns(['ID', 'managerId']).where({ ID: projectId })),
    cds.db.run(SELECT.one.from(ENTITIES.Allocations).columns('ID').where({ projectId, userId: ctx.userId })),
    cds.db.run(
      SELECT.one.from(ENTITIES.Tickets).columns([
        'ID',
        'createdBy',
        'assignedTo',
        'assignedToRole',
        'functionalTesterId',
      ]).where([
        { ref: ['projectId'] }, '=', { val: projectId },
        'and',
        '(',
        { ref: ['createdBy'] }, '=', { val: ctx.userId },
        'or',
        { ref: ['assignedTo'] }, '=', { val: ctx.userId },
        'or',
        { ref: ['functionalTesterId'] }, '=', { val: ctx.userId },
        ')',
      ])
    ),
  ]);

  if (project?.managerId && String(project.managerId) === ctx.userId) return true;
  return Boolean(allocation || ticket);
}

function extractRelatedTicketIds(document) {
  const related = document?.relatedTicketIds;
  if (!Array.isArray(related)) return [];
  return related
    .map((row) => row?.ticketId ?? row?.ID ?? row)
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function isLocked(document) {
  return document.locked === true ||
    document.isLocked === true ||
    String(document.status ?? '').toUpperCase() === 'LOCKED';
}

policies.register(Actions.DOCUMENT_CREATE, canCreateDocument);
policies.register(Actions.DOCUMENT_READ, canReadDocument);
policies.register(Actions.DOCUMENT_UPDATE, canUpdateDocument);
policies.register(Actions.DOCUMENT_DELETE, canDeleteDocument);

module.exports = {
  canCreateDocument,
  canReadDocument,
  canUpdateDocument,
  canDeleteDocument,
};
