'use strict';

const cds = require('@sap/cds');

const CommentRepo = require('./comment.repo');
const { restrictTicketChildRead } = require('../shared/services/authz');
const { assertEntityExists, ENTITIES, MANAGER_ROLES } = require('../shared/services/validation');
const { getRequestContext } = require('../_shared/auth/request-context');

const COMMENT_TYPES = ['GENERAL', 'BLOCKER', 'QUESTION', 'UPDATE', 'FEEDBACK'];
const CONSULTANT_ROLES = new Set(['CONSULTANT_TECHNIQUE', 'CONSULTANT_FONCTIONNEL']);
const INTERNAL_READERS = new Set(['ADMIN', 'MANAGER', 'PROJECT_MANAGER']);

class CommentDomainService {
  constructor(_srv) {
    this.repo = new CommentRepo();
  }

  /**
   * beforeRead – filter out internal comments for non-manager roles.
   * Consultants / DevCoordinator cannot see isInternal=true rows.
   */
  beforeRead(req) {
    const { role } = getRequestContext(req);
    const select = req.query?.SELECT;
    if (!select) return;

    if (CONSULTANT_ROLES.has(role)) {
      restrictTicketChildRead(req, 'ticketId');
    }

    if (INTERNAL_READERS.has(role)) return;

    const internalFilter = [{ ref: ['isInternal'] }, '=', { val: false }];
    if (Array.isArray(select.where) && select.where.length > 0) {
      select.where = ['(', ...select.where, ')', 'and', ...internalFilter];
    } else {
      select.where = internalFilter;
    }
  }

  /**
   * beforeCreate – validate FK references, enforce role-based rules.
   */
  async beforeCreate(req) {
    const data = req.data;
    const ctx = getRequestContext(req);

    if (!data.ticketId) req.error(400, 'ticketId is required');
    if (!data.message?.trim()) req.error(400, 'message is required');

    // Always stamp the authenticated author to prevent comment spoofing.
    if (!ctx.userId) req.reject(401, 'Missing authenticated user');
    if (data.authorId !== undefined && String(data.authorId) !== ctx.userId) {
      req.reject(403, 'authorId must match the authenticated user');
    }
    data.authorId = ctx.userId;

    await assertEntityExists(ENTITIES.Tickets, data.ticketId, 'ticketId', req);
    await assertEntityExists(ENTITIES.Users, data.authorId, 'authorId', req);

    // Only managers can post internal comments
    if (data.isInternal && !INTERNAL_READERS.has(ctx.role)) {
      req.reject(403, 'Only managers can post internal comments');
    }

    // Consultants can only comment on tickets they are assigned to or created
    if (CONSULTANT_ROLES.has(ctx.role)) {
      const ticket = await this._getTicket(data.ticketId);
      if (ticket && ticket.createdBy !== ctx.userId && ticket.assignedTo !== ctx.userId) {
        req.reject(403, 'You can only comment on tickets you created or are assigned to');
      }
    }

    // Validate commentType
    if (data.commentType && !COMMENT_TYPES.includes(data.commentType)) {
      req.error(400, `commentType must be one of [${COMMENT_TYPES.join(', ')}]`);
    }

    // Validate parent comment exists and belongs to same ticket
    if (data.parentCommentId) {
      const parent = await this.repo.findById(data.parentCommentId);
      if (!parent) req.error(400, `Unknown parentCommentId '${data.parentCommentId}'`);
      if (parent && parent.ticketId !== data.ticketId) {
        req.error(400, 'Parent comment must belong to the same ticket');
      }
    }

    data.resolved = data.resolved ?? false;
    data.commentType = data.commentType || 'GENERAL';
  }

  /**
   * beforeUpdate – only allow resolving comments.
   * Author or manager can mark as resolved.
   */
  async beforeUpdate(req) {
    const id = req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;
    const data = req.data;
    const ctx = getRequestContext(req);

    const comment = await this.repo.findById(id);
    if (!comment) {
      req.reject(404, 'Comment not found');
      return;
    }

    // Only allow updating the `resolved` field
    const allowedFields = new Set(['resolved', 'ID']);
    const updateKeys = Object.keys(data).filter((k) => !k.startsWith('@'));
    for (const key of updateKeys) {
      if (!allowedFields.has(key)) {
        req.reject(400, `Cannot update field '${key}' on a comment`);
        return;
      }
    }

    // Author can resolve their own, manager can resolve any
    if (comment.authorId !== ctx.userId && !MANAGER_ROLES.has(ctx.role)) {
      req.reject(403, 'Only the author or a manager can resolve a comment');
    }
  }

  async _getTicket(ticketId) {
    return cds.db.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: ticketId }));
  }
}

module.exports = CommentDomainService;
