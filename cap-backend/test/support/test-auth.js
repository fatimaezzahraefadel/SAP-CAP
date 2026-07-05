'use strict';

const USERS = Object.freeze({
  admin: {
    id: 'u-admin',
    email: 'alice.admin@inetum.com',
    name: 'Alice Admin',
    role: 'ADMIN',
  },
  manager: {
    id: 'u-manager',
    email: 'marc.manager@inetum.com',
    name: 'Marc Manager',
    role: 'MANAGER',
  },
  tech: {
    id: 'u-tech',
    email: 'theo.tech@inetum.com',
    name: 'Theo Technique',
    role: 'CONSULTANT_TECHNIQUE',
  },
  functional: {
    id: 'u-fonc',
    email: 'fatima.fonc@inetum.com',
    name: 'Fatima Fonctionnel',
    role: 'CONSULTANT_FONCTIONNEL',
  },
  projectManager: {
    id: 'u-pm',
    email: 'pierre.pm@inetum.com',
    name: 'Pierre PM',
    role: 'PROJECT_MANAGER',
  },
  devCoordinator: {
    id: 'u-devco',
    email: 'diana.devco@inetum.com',
    name: 'Diana DevCo',
    role: 'DEV_COORDINATOR',
  },
});

const authHeaders = (user) => ({
  'x-test-user-id': user.id,
  'x-test-user-role': user.role,
  'x-test-user-email': user.email,
  'x-test-user-name': user.name,
});

const auth = (user) => ({ headers: authHeaders(user) });

module.exports = {
  USERS,
  auth,
  authHeaders,
};
