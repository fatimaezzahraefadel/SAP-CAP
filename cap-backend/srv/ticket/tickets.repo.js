'use strict';
/**
 * ticket.repo.js – ALL DB operations for Tickets.
 * NO business rules here. Only SELECT / INSERT / UPDATE / DELETE.
 * Cross-domain existence checks use shared/services/validation.js.
 */
const cds = require('@sap/cds');
const { ENTITIES } = require('../shared/services/validation');

class TicketRepo {
  /** Check whether a ticket code already exists */
  async existsByTicketCode(ticketCode) {
    const existing = await cds.db.run(
      SELECT.one.from(ENTITIES.Tickets)
        .columns('ID')
        .where({ ticketCode })
    );
    return Boolean(existing);
  }

  /** Fetch a ticket by ID */
  async findById(id) {
    return cds.db.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: id }));
  }

  /** Persist a new ticket */
  async insert(data) {
    await cds.db.run(INSERT.into(ENTITIES.Tickets).entries(data));
    return cds.db.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: data.ID }));
  }

  /** Update ticket fields */
  async update(id, changes) {
    await cds.db.run(UPDATE(ENTITIES.Tickets).where({ ID: id }).with(changes));
    return cds.db.run(SELECT.one.from(ENTITIES.Tickets).where({ ID: id }));
  }
}

module.exports = TicketRepo;
