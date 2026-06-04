'use strict';

const Roles = Object.freeze({
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  DEV_COORDINATOR: 'DEV_COORDINATOR',
  CONSULTANT_TECHNIQUE: 'CONSULTANT_TECHNIQUE',
  CONSULTANT_FONCTIONNEL: 'CONSULTANT_FONCTIONNEL',
});

const RoleSets = Object.freeze({
  STAFF: new Set([
    Roles.ADMIN,
    Roles.MANAGER,
    Roles.PROJECT_MANAGER,
    Roles.DEV_COORDINATOR,
  ]),
  TICKET_CREATORS: new Set([
    Roles.MANAGER,
    Roles.PROJECT_MANAGER,
    Roles.DEV_COORDINATOR,
    Roles.CONSULTANT_FONCTIONNEL,
  ]),
  TICKET_APPROVERS: new Set([
    Roles.MANAGER,
    Roles.PROJECT_MANAGER,
  ]),
  DOCUMENT_STAFF: new Set([
    Roles.ADMIN,
    Roles.MANAGER,
    Roles.PROJECT_MANAGER,
    Roles.DEV_COORDINATOR,
  ]),
});

module.exports = {
  Roles,
  RoleSets,
};
