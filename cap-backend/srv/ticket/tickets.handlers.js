'use strict';

const TicketDomainService = require('./tickets.domain');
const policies = require('./tickets.policy');
const validation = require('./tickets.validation');
const mapper = require('./tickets.mapper');
const { Actions } = require('./tickets.policy');
const { restrictTicketRead } = require('../shared/services/authz');

module.exports = (srv) => {
  const domain = new TicketDomainService();

  srv.before('READ', 'Tickets', async (req) => {
    await policies.require(req, Actions.TICKET_READ);
    restrictTicketRead(req);
  });

  srv.before('CREATE', 'Tickets', async (req) => {
    await policies.require(req, Actions.TICKET_CREATE);
    mapper.normalizeTicketPayload(req);
    await validation.validateCreate(req);
    await domain.beforeCreate(req);
  });

  srv.before('UPDATE', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await policies.require(req, Actions.TICKET_UPDATE, ticket);

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
    await policies.require(req, Actions.TICKET_DELETE, ticket);
  });

  srv.on('approveTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await policies.require(req, Actions.TICKET_APPROVE, ticket);
    return domain.approveTicket(req);
  });

  srv.on('rejectTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await policies.require(req, Actions.TICKET_REJECT, ticket);
    return domain.rejectTicket(req);
  });

  srv.on('startTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await policies.require(req, Actions.TICKET_START, ticket);
    return domain.startTicket(req);
  });

  srv.on('startTesting', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await policies.require(req, Actions.TICKET_START_TEST, ticket);
    return domain.startTesting(req);
  });

  srv.on('completeTicket', 'Tickets', async (req) => {
    const ticketId = req.params?.[0]?.ID ?? req.params?.[0];
    const ticket = await domain.loadTicket(ticketId);
    await policies.require(req, Actions.TICKET_COMPLETE, ticket);
    return domain.completeTicket(req);
  });

  srv.after(['READ', 'CREATE', 'UPDATE'], 'Tickets', (data) => domain.afterRead(data));
};

module.exports.primaryEntity = 'Tickets';
