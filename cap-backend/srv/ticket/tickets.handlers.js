'use strict';

const TicketDomainService = require('./tickets.domain');
require('./tickets.policy');
const policies = require('../_shared/security/policies');
const { Actions } = require('../_shared/security/actions');
const { getRequestContext } = require('../_shared/auth/request-context');
const validation = require('./tickets.validation');
const mapper = require('./tickets.mapper');
const { restrictTicketRead } = require('../shared/services/authz');

module.exports = (srv) => {
  const domain = new TicketDomainService();

  const requirePermission = async (req, action, resource) => {
    const ctx = getRequestContext(req);
    try {
      return await policies.require(ctx, action, resource);
    } catch (err) {
      if (err?.statusCode === 403 || err?.status === 403 || err?.code === 403) {
        req.reject(403, err.message || 'Forbidden: insufficient permission');
      }
      throw err;
    }
  };

  srv.before('READ', 'Tickets', async (req) => {
    await requirePermission(req, Actions.TICKET_READ);
    restrictTicketRead(req);
  });

  srv.before('CREATE', 'Tickets', async (req) => {
    await requirePermission(req, Actions.TICKET_CREATE, req.data);
    mapper.normalizeTicketPayload(req);
    await validation.validateCreate(req);
    await domain.beforeCreate(req);
  });

  srv.before('UPDATE', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await requirePermission(req, Actions.TICKET_UPDATE, { current: ticket, changes: req.data });

    mapper.normalizeTicketPayload(req);
    await validation.validateUpdate(req, ticket);
    await domain.beforeUpdate(req, ticket);

    const requestedStatus = req.data?.status;
    if (requestedStatus && ticket?.status && requestedStatus !== ticket.status) {
      domain.ensureStatusTransitionAllowed(ticket.status, requestedStatus, req);
    }
  });

  srv.before('DELETE', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await requirePermission(req, Actions.TICKET_DELETE, ticket);
  });

  srv.on('approveTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await requirePermission(req, Actions.TICKET_APPROVE, ticket);
    return domain.approveTicket(req);
  });

  srv.on('rejectTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await requirePermission(req, Actions.TICKET_REJECT, ticket);
    return domain.rejectTicket(req);
  });

  srv.on('startTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await requirePermission(req, Actions.TICKET_UPDATE, { current: ticket, changes: { status: 'IN_PROGRESS' } });
    return domain.startTicket(req);
  });

  srv.on('startTesting', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await requirePermission(req, Actions.TICKET_UPDATE, { current: ticket, changes: { status: 'IN_TEST' } });
    return domain.startTesting(req);
  });

  srv.on('completeTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await requirePermission(req, Actions.TICKET_UPDATE, { current: ticket, changes: { status: 'DONE' } });
    return domain.completeTicket(req);
  });

  srv.after(['READ', 'CREATE', 'UPDATE'], 'Tickets', (data) => domain.afterRead(data));
};

module.exports.primaryEntity = 'Tickets';
