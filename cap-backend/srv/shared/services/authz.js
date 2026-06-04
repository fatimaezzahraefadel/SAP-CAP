'use strict';

const cds = require('@sap/cds');
const { ENTITIES } = require('./validation');
const { getRequestContext } = require('../../_shared/auth/request-context');

const ADMIN_ONLY = new Set(['ADMIN']);
const REVIEWER_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER']);
const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'DEV_COORDINATOR']);
const CONSULTANT_ROLES = new Set(['CONSULTANT_TECHNIQUE', 'CONSULTANT_FONCTIONNEL']);

const getClaims = (req) => {
  const ctx = getRequestContext(req);
  return {
    sub: ctx.userId,
    role: ctx.role,
    email: ctx.email,
    isAuthenticated: ctx.isAuthenticated,
  };
};
const getUserId = (req) => String(getClaims(req).sub ?? '').trim();
const getRole = (req) => String(getClaims(req).role ?? '').trim();
const isAdmin = (reqOrRole) =>
  ADMIN_ONLY.has(typeof reqOrRole === 'string' ? reqOrRole : getRole(reqOrRole));
const isReviewer = (reqOrRole) =>
  REVIEWER_ROLES.has(typeof reqOrRole === 'string' ? reqOrRole : getRole(reqOrRole));
const isStaff = (reqOrRole) =>
  STAFF_ROLES.has(typeof reqOrRole === 'string' ? reqOrRole : getRole(reqOrRole));
const isConsultant = (reqOrRole) =>
  CONSULTANT_ROLES.has(typeof reqOrRole === 'string' ? reqOrRole : getRole(reqOrRole));

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

const wrapExistingWhere = (where) => (Array.isArray(where) && where.length > 0 ? ['(', ...where, ')'] : []);

const addWhere = (req, filter) => {
  const select = req.query?.SELECT;
  if (!select) return;

  const existing = wrapExistingWhere(select.where);
  select.where = existing.length > 0 ? [...existing, 'and', ...filter] : filter;
};

const ownerFilter = (field, userId) => [{ ref: [field] }, '=', { val: userId }];

const orFilter = (...filters) => {
  const nonEmpty = filters.filter((filter) => Array.isArray(filter) && filter.length > 0);
  if (nonEmpty.length === 0) return [];
  return nonEmpty.reduce((acc, filter, index) => {
    if (index === 0) return ['(', ...filter];
    return [...acc, 'or', ...filter];
  }, []).concat(')');
};

const restrictReadToOwnerUnlessStaff = (req, ownerField) => {
  if (isStaff(req)) return;
  const userId = getUserId(req);
  if (!userId) req.reject(401, 'Missing authenticated user');
  addWhere(req, ownerFilter(ownerField, userId));
};

const restrictReadToSelfOrManager = (req, fields) => {
  if (isStaff(req)) return;
  const userId = getUserId(req);
  if (!userId) req.reject(401, 'Missing authenticated user');
  addWhere(req, orFilter(...fields.map((field) => ownerFilter(field, userId))));
};

const ticketVisibilityFilter = (userId, role) =>
  orFilter(
    ownerFilter('assignedTo', userId),
    ownerFilter('createdBy', userId),
    [{ ref: ['assignedToRole'] }, '=', { val: role }]
  );

const restrictTicketRead = (req) => {
  if (!isConsultant(req)) return;
  const userId = getUserId(req);
  if (!userId) req.reject(401, 'Missing authenticated user');
  addWhere(req, ticketVisibilityFilter(userId, getRole(req)));
};

const ticketSubqueryForVisibleTickets = (req) => ({
  SELECT: {
    from: { ref: [ENTITIES.Tickets] },
    columns: [{ ref: ['ID'] }],
    where: ticketVisibilityFilter(getUserId(req), getRole(req)),
  },
});

const restrictTicketChildRead = (req, ticketIdField) => {
  if (!isConsultant(req)) return;
  const userId = getUserId(req);
  if (!userId) req.reject(401, 'Missing authenticated user');
  addWhere(req, [{ ref: [ticketIdField] }, 'in', ticketSubqueryForVisibleTickets(req)]);
};

const ensureOwnerOrReviewer = (req, ownerId, message) => {
  const userId = getUserId(req);
  if (String(ownerId ?? '') === userId) return;
  if (isReviewer(req)) return;
  req.reject(403, message || 'Forbidden: not owner and insufficient role');
};

const forceOwnerForNonReviewer = (req, field) => {
  if (isReviewer(req)) return;
  const userId = getUserId(req);
  if (!userId) req.reject(401, 'Missing authenticated user');
  if (req.data[field] !== undefined && String(req.data[field]) !== userId) {
    req.reject(403, `Cannot create or modify ${field} for another user`);
  }
  req.data[field] = userId;
};

const loadById = async (entity, id) => {
  if (!id) return null;
  return cds.db.run(SELECT.one.from(entity).where({ ID: id }));
};

module.exports = {
  ADMIN_ONLY,
  REVIEWER_ROLES,
  STAFF_ROLES,
  CONSULTANT_ROLES,
  addWhere,
  ownerFilter,
  orFilter,
  extractEntityId,
  getClaims,
  getUserId,
  getRole,
  isAdmin,
  isReviewer,
  isStaff,
  isConsultant,
  restrictReadToOwnerUnlessStaff,
  restrictReadToSelfOrManager,
  restrictTicketRead,
  restrictTicketChildRead,
  ensureOwnerOrReviewer,
  forceOwnerForNonReviewer,
  loadById,
};
