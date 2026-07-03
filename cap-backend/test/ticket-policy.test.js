'use strict';

// Unit tests for the ticket authorization policy. These exercise the pure
// predicate (no DB / server needed) so they run fast and document the rules.
const { canUpdateTicket } = require('../srv/ticket/tickets.policy');

const FONC = 'CONSULTANT_FONCTIONNEL';
const TECH = 'CONSULTANT_TECHNIQUE';

const ctx = (role, userId) => ({ role, userId });
const ownTicket = (status) => ({ ID: 'tk-1', status, createdBy: 'u-fonc' });
// CAP merges the entity key into the change set on UPDATE; mirror that here.
const statusMove = (status) => ({ ID: 'tk-1', status, history: [], updatedAt: 'now' });

describe('canUpdateTicket — functional consultant Kanban moves', () => {
  test('owner can move their own PENDING_APPROVAL ticket via a status move', () => {
    const resource = { current: ownTicket('PENDING_APPROVAL'), changes: statusMove('APPROVED') };
    expect(canUpdateTicket(ctx(FONC, 'u-fonc'), resource)).toBe(true);
  });

  test('owner can move their own NEW ticket to IN_PROGRESS', () => {
    const resource = { current: ownTicket('NEW'), changes: statusMove('IN_PROGRESS') };
    expect(canUpdateTicket(ctx(FONC, 'u-fonc'), resource)).toBe(true);
  });

  test('non-owner functional consultant cannot move a foreign ticket', () => {
    const resource = { current: ownTicket('PENDING_APPROVAL'), changes: statusMove('APPROVED') };
    expect(canUpdateTicket(ctx(FONC, 'u-other'), resource)).toBe(false);
  });

  test('a status move bundled with forbidden field edits is rejected', () => {
    const resource = {
      current: ownTicket('PENDING_APPROVAL'),
      changes: { ID: 'tk-1', status: 'APPROVED', title: 'sneaky rename' },
    };
    expect(canUpdateTicket(ctx(FONC, 'u-fonc'), resource)).toBe(false);
  });

  test('unassigned technical consultant still cannot move the ticket', () => {
    const resource = { current: { ID: 'tk-1', status: 'NEW', assignedTo: 'u-someone' }, changes: statusMove('IN_PROGRESS') };
    expect(canUpdateTicket(ctx(TECH, 'u-tech'), resource)).toBe(false);
  });
});
