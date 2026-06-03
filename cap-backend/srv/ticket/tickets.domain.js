'use strict';
/**
 * ticket.domain.service.js – ALL business rules for Tickets.
 * NO direct DB calls; delegate to TicketRepo.
 * NO HTTP/CDS request handling; called by ticket.impl.js.
 */
const TicketRepo = require('./tickets.repo');
const { generateTicketCode } = require('../shared/utils/id');
const { nowIso } = require('../shared/utils/timestamp');
const { assertEntityExists, assertInEnum, ENTITIES, MANAGER_ROLES, requireRole } = require('../shared/services/validation');
const { TICKET_STATUS, TICKET_PRIORITY, TICKET_NATURE, TICKET_COMPLEXITY } = require('../shared/constants/enums');
const cds = require('@sap/cds');

const CONSULTANT_ROLES = new Set(['CONSULTANT_TECHNIQUE', 'CONSULTANT_FONCTIONNEL']);

const TICKET_STATUS_TRANSITIONS = {
  PENDING_APPROVAL: new Set(['NEW', 'REJECTED']),
  APPROVED: new Set(['NEW', 'IN_PROGRESS', 'REJECTED']),
  NEW: new Set(['IN_PROGRESS', 'BLOCKED', 'REJECTED']),
  IN_PROGRESS: new Set(['IN_TEST', 'BLOCKED', 'DONE', 'REJECTED']),
  IN_TEST: new Set(['DONE', 'IN_PROGRESS', 'REJECTED']),
  BLOCKED: new Set(['IN_PROGRESS', 'REJECTED']),
  DONE: new Set([]),
  REJECTED: new Set(['NEW', 'PENDING_APPROVAL']),
};

class TicketDomainService {
  constructor(_srv) {
    this.repo = new TicketRepo();
  }

  /**
   * beforeRead – enforce data visibility.
   * Consultants only see tickets assigned to themselves.
   */
  beforeRead(req) {
    const claims = req._authClaims;
    const role = String(claims?.role ?? '');
    const userId = String(claims?.sub ?? '').trim();
    if (!CONSULTANT_ROLES.has(role) || !userId) return;

    const select = req.query?.SELECT;
    if (!select) return;

    // Consultants see tickets assigned to them, assigned to their role, or that they created
    const visibilityFilter = [
      '(',
      { ref: ['assignedTo'] }, '=', { val: userId },
      'or',
      { ref: ['assignedToRole'] }, '=', { val: role },
      'or',
      { ref: ['createdBy'] }, '=', { val: userId },
      ')',
    ];
    if (Array.isArray(select.where) && select.where.length > 0) {
      select.where = ['(', ...select.where, ')', 'and', ...visibilityFilter];
      return;
    }

    select.where = visibilityFilter;
  }

  /**
   * beforeCreate – called by impl before CAP inserts the record.
   * Injects: ticketCode, createdAt, default status/effortHours/history.
   */
  async beforeCreate(req) {
    const data = req.data;
    const claims = req._authClaims;
    const userId = String(claims?.sub ?? '').trim();

    // Guard required fields
    if (!data.projectId) req.error(400, 'projectId is required');
    if (!userId) req.reject(401, 'Missing authenticated user');
    if (data.createdBy !== undefined && String(data.createdBy) !== userId) {
      req.reject(403, 'createdBy must match the authenticated user');
    }
    data.createdBy = userId;
    if (!data.title)     req.error(400, 'title is required');
    if (!data.nature)    req.error(400, 'nature is required');

    assertInEnum(data.priority, Object.values(TICKET_PRIORITY), 'priority', req);
    assertInEnum(data.nature, Object.values(TICKET_NATURE), 'nature', req);
    assertInEnum(data.complexity, Object.values(TICKET_COMPLEXITY), 'complexity', req);

    if (typeof data.assignedTo === 'string' && !data.assignedTo.trim()) data.assignedTo = null;
    if (typeof data.functionalTesterId === 'string' && !data.functionalTesterId.trim()) data.functionalTesterId = null;

    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    await assertEntityExists(ENTITIES.Users, data.createdBy, 'createdBy', req);
    if (data.assignedTo) await assertEntityExists(ENTITIES.Users, data.assignedTo, 'assignedTo', req);
    if (data.functionalTesterId) await assertEntityExists(ENTITIES.Users, data.functionalTesterId, 'functionalTesterId', req);

    // Auto-generate ticketCode: TK-YYYY-XXXXXX
    const year = new Date().getFullYear();
    data.ticketCode = await this._allocateTicketCode(year);

    // Defaults
    const creatorRole = claims?.role;
    if (creatorRole === 'CONSULTANT_FONCTIONNEL') {
      data.status = 'PENDING_APPROVAL';
      if (data.assignedTo && data.assignedTo !== userId) {
        req.reject(403, 'Functional consultants can only self-assign tickets to themselves');
      }
      data.assignedTo = userId;
      data.assignedToRole = 'CONSULTANT_FONCTIONNEL';
      if (data.functionalTesterId) {
        req.reject(403, 'Functional consultants cannot assign functional testers directly');
      }
      data.functionalTesterId = null;
    } else {
      data.status = data.status || 'NEW';
    }
    data.effortHours     = data.effortHours  ?? 0;
    data.estimationHours = data.estimationHours ?? 0;
    data.allocatedHours  = data.allocatedHours ?? 0;
    // createdAt is auto-set by the `managed` mixin; no need to set it here

    if (data.history !== undefined) {
      data.history = this._coerceHistoryRows(data.history);
    }
    if (data.tags !== undefined) {
      data.tags = this._coerceTagRows(data.tags);
    }
    if (data.documentationObjectIds !== undefined) {
      data.documentationObjectIds = this._coerceDocumentationRows(data.documentationObjectIds);
    }
  }

  /**
   * beforeUpdate – called by impl before CAP updates the record.
   * Injects updatedAt and re-serializes any JSON array fields.
   */
  async beforeUpdate(req) {
    const data = req.data;
    const claims = req._authClaims;
    const userId = String(claims?.sub ?? '').trim();
    data.updatedAt = nowIso();
    const id = req.params?.[0]?.ID ?? req.params?.[0] ?? data.ID;

    assertInEnum(data.priority, Object.values(TICKET_PRIORITY), 'priority', req);
    assertInEnum(data.nature, Object.values(TICKET_NATURE), 'nature', req);
    assertInEnum(data.complexity, Object.values(TICKET_COMPLEXITY), 'complexity', req);

    if (typeof data.assignedTo === 'string' && !data.assignedTo.trim()) data.assignedTo = null;
    if (typeof data.functionalTesterId === 'string' && !data.functionalTesterId.trim()) data.functionalTesterId = null;

    if (data.createdBy !== undefined) {
      if (!userId) req.reject(401, 'Missing authenticated user');
      if (String(data.createdBy) !== userId) {
        req.reject(403, 'createdBy cannot be reassigned to another user');
      }
      data.createdBy = userId;
    }

    const current = id ? await this.repo.findById(id) : null;
    if (current && current.status === 'PENDING_APPROVAL') {
      const role = claims?.role;
      const isApprovalRole = role === 'ADMIN' || role === 'MANAGER' || role === 'PROJECT_MANAGER';
      if (!isApprovalRole && (data.status !== undefined || data.assignedTo !== undefined || data.assignedToRole !== undefined || data.functionalTesterId !== undefined || data.allocatedHours !== undefined)) {
        req.reject(403, 'Pending approval tickets can only be advanced by staff or managers');
      }
    }

    if (data.status !== undefined && current && data.status !== current.status) {
      const allowed = TICKET_STATUS_TRANSITIONS[current.status] || new Set();
      if (!allowed.has(data.status)) {
        req.reject(409, `Invalid ticket status transition: ${current.status} -> ${data.status}`);
      }
    }

    if (data.projectId !== undefined) await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    if (data.createdBy !== undefined) await assertEntityExists(ENTITIES.Users, data.createdBy, 'createdBy', req);
    if (data.assignedTo !== undefined && data.assignedTo !== null) {
      await assertEntityExists(ENTITIES.Users, data.assignedTo, 'assignedTo', req);
    }
    if (data.functionalTesterId !== undefined && data.functionalTesterId !== null) {
      await assertEntityExists(ENTITIES.Users, data.functionalTesterId, 'functionalTesterId', req);
    }

    if (data.history !== undefined) {
      data.history = this._coerceHistoryRows(data.history);
    }
    if (data.tags !== undefined) {
      data.tags = this._coerceTagRows(data.tags);
    }
    if (data.documentationObjectIds !== undefined) {
      data.documentationObjectIds = this._coerceDocumentationRows(data.documentationObjectIds);
    }
  }

  /**
   * afterRead – deserialize JSON array fields back into arrays.
   * Called after READ, CREATE, UPDATE to hydrate the response.
   */
  afterRead(data) {
    if (!data) return;
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      row.history                = this._deserializeArray(row.history);
      row.tags                   = this._deserializeArray(row.tags);
      row.documentationObjectIds = this._deserializeArray(row.documentationObjectIds);
    }
  }

  async loadTicket(id) {
    if (!id) return null;
    return this.repo.findById(id);
  }

  ensureStatusTransitionAllowed(currentStatus, requestedStatus, req) {
    const allowed = TICKET_STATUS_TRANSITIONS[currentStatus] || new Set();
    if (!allowed.has(requestedStatus)) {
      if (req) {
        req.reject(409, `Invalid ticket status transition: ${currentStatus} -> ${requestedStatus}`);
        return;
      }
      throw new Error(`Invalid ticket status transition: ${currentStatus} -> ${requestedStatus}`);
    }
  }

  async startTicket(req) {
    const id = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      req.reject(404, 'Ticket not found');
      return;
    }
    if (ticket.status !== 'NEW') {
      req.reject(409, 'Ticket must be NEW to start working on it');
      return;
    }
    const updated = await this.repo.update(id, {
      status: 'IN_PROGRESS',
      updatedAt: nowIso(),
    });
    this.afterRead(updated);
    return updated;
  }

  async startTesting(req) {
    const id = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      req.reject(404, 'Ticket not found');
      return;
    }
    if (ticket.status !== 'IN_PROGRESS') {
      req.reject(409, 'Ticket must be IN_PROGRESS to start testing');
      return;
    }
    const updated = await this.repo.update(id, {
      status: 'IN_TEST',
      updatedAt: nowIso(),
    });
    this.afterRead(updated);
    return updated;
  }

  async completeTicket(req) {
    const id = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      req.reject(404, 'Ticket not found');
      return;
    }
    if (ticket.status !== 'IN_TEST') {
      req.reject(409, 'Ticket must be IN_TEST to complete it');
      return;
    }
    const updated = await this.repo.update(id, {
      status: 'DONE',
      updatedAt: nowIso(),
    });
    this.afterRead(updated);
    return updated;
  }

  // ---- Approval workflow (Feature 2) ------------------------------------

  /**
   * approveTicket – Manager approves a PENDING_APPROVAL ticket, assigns tech consultant + hours.
   */
  async approveTicket(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can approve tickets');
    const id = req.params?.[0]?.ID ?? req.params?.[0];
    const { techConsultantId, allocatedHours } = req.data ?? {};

    if (!techConsultantId) { req.reject(400, 'techConsultantId is required for approval'); return; }
    if (allocatedHours === undefined || allocatedHours === null || Number(allocatedHours) <= 0) {
      req.reject(400, 'allocatedHours must be greater than 0');
      return;
    }

    return await cds.tx(req).run(async (tx) => {
      const ticket = await tx.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: id }));
      if (!ticket) { req.reject(404, 'Ticket not found'); return; }

      if (ticket.status !== 'PENDING_APPROVAL') {
        req.reject(409, `Cannot approve ticket in status '${ticket.status}'; expected PENDING_APPROVAL`);
        return;
      }

      const techConsultant = await this._getActiveTechnicalConsultant(techConsultantId);
      if (!techConsultant) {
        req.reject(400, 'techConsultantId must reference an active technical consultant');
        return;
      }

      let functionalTester = null;
      if (req.data.functionalTesterId) {
        functionalTester = await this._getActiveFunctionalTester(req.data.functionalTesterId);
        if (!functionalTester) {
          req.reject(400, 'functionalTesterId must reference an active functional consultant');
          return;
        }
      }

      await tx.run(UPDATE(ENTITIES.Tickets).where({ ID: id }).with({
        status: TICKET_STATUS.NEW,
        assignedTo: techConsultantId,
        assignedToRole: 'CONSULTANT_TECHNIQUE',
        functionalTesterId: functionalTester ? req.data.functionalTesterId : null,
        allocatedHours: Number(allocatedHours),
        updatedAt: nowIso(),
      }));

      // Create notification for the assigned consultant (atomic part of the transaction)
      await tx.run(INSERT.into(ENTITIES.Notifications).entries({
        userId: techConsultantId,
        type: 'TICKET_ASSIGNED',
        title: `Ticket ${ticket.ticketCode} assigned to you`,
        message: `You have been assigned to ticket "${ticket.title}" with ${allocatedHours}h budget.`,
        targetPath: `{roleBasePath}/tickets/${id}`,
        read: false,
      }));

      const updated = await tx.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: id }));
      this.afterRead(updated);
      return updated;
    });
  }

  /**
   * rejectTicket – Manager rejects a PENDING_APPROVAL ticket with a reason.
   */
  async rejectTicket(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can reject tickets');
    const id = req.params?.[0]?.ID ?? req.params?.[0];
    const { reason } = req.data ?? {};

    return await cds.tx(req).run(async (tx) => {
      const ticket = await tx.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: id }));
      if (!ticket) { req.reject(404, 'Ticket not found'); return; }

      const allowedFromRej = TICKET_STATUS_TRANSITIONS[ticket.status] || new Set();
      if (!allowedFromRej.has(TICKET_STATUS.REJECTED)) {
        req.reject(409, `Cannot reject ticket in status '${ticket.status}'; transition to REJECTED not allowed`);
        return;
      }

      // Record rejection reason in history
      await tx.run(INSERT.into('sap.performance.dashboard.db.TicketHistory').entries({
        ticket_ID: id,
        event: 'REJECTED',
        details: reason || 'Rejected by manager',
      }));

      await tx.run(UPDATE(ENTITIES.Tickets).where({ ID: id }).with({
        status: TICKET_STATUS.REJECTED,
        updatedAt: nowIso(),
      }));

      // Notify the creator (atomic part of the transaction)
      if (ticket.createdBy) {
        await tx.run(INSERT.into(ENTITIES.Notifications).entries({
          userId: ticket.createdBy,
          type: 'TICKET_REJECTED',
          title: `Ticket ${ticket.ticketCode} rejected`,
          message: reason || 'Your ticket was rejected by the manager.',
          targetPath: `{roleBasePath}/tickets/${id}`,
          read: false,
        }));
      }

      const updated = await tx.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: id }));
      this.afterRead(updated);
      return updated;
    });
  }

  // ---- Private helpers ---------------------------------------------------

  _toArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim().startsWith('[')) {
      try { return JSON.parse(value); } catch { return []; }
    }
    return [];
  }

  _coerceTagRows(value) {
    const rows = this._toArray(value);
    return rows
      .map((row) => {
        if (row && typeof row === 'object') {
          const tag = String(row.tag ?? '').trim();
          return tag ? { tag } : null;
        }
        const tag = String(row ?? '').trim();
        return tag ? { tag } : null;
      })
      .filter(Boolean);
  }

  _coerceDocumentationRows(value) {
    const rows = this._toArray(value);
    return rows
      .map((row) => {
        if (row && typeof row === 'object') {
          const docObjectId = String(row.docObjectId ?? '').trim();
          return docObjectId ? { docObjectId } : null;
        }
        const docObjectId = String(row ?? '').trim();
        return docObjectId ? { docObjectId } : null;
      })
      .filter(Boolean);
  }

  _coerceHistoryRows(value) {
    const rows = this._toArray(value);
    return rows
      .map((row) => {
        if (!row || typeof row !== 'object') {
          const details = String(row ?? '').trim();
          return details ? { event: 'LEGACY', details } : null;
        }
        const event = String(row.event ?? row.action ?? 'UPDATE').trim();
        const details = row.details !== undefined ? row.details : JSON.stringify(row);
        return {
          event: event || 'UPDATE',
          details: String(details ?? ''),
        };
      })
      .filter(Boolean);
  }

  _deserializeArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim().startsWith('[')) {
      try { return JSON.parse(value); } catch { return []; }
    }
    return [];
  }

  async _allocateTicketCode(year) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateTicketCode(year);
      // Randomized suffix makes collisions unlikely, this guards against rare duplicates.
      if (!(await this.repo.existsByTicketCode(candidate))) {
        return candidate;
      }
    }
    throw new Error('Unable to allocate a unique ticketCode');
  }

  async _getActiveTechnicalConsultant(userId) {
    if (!userId) return null;
    return cds.db.run(
      SELECT.one
        .from(ENTITIES.Users)
        .columns('ID')
        .where({ ID: userId, active: true, role: 'CONSULTANT_TECHNIQUE' })
    );
  }

  async _getActiveFunctionalTester(userId) {
    if (!userId) return null;
    return cds.db.run(
      SELECT.one
        .from(ENTITIES.Users)
        .columns('ID')
        .where({ ID: userId, active: true, role: 'CONSULTANT_FONCTIONNEL' })
    );
  }
}

module.exports = TicketDomainService;
