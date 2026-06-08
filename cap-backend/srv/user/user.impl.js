'use strict';

const UserDomainService = require('./user.domain.service');

module.exports = (srv) => {
  const domain = new UserDomainService(srv);

  srv.before('READ', 'Users', (req) => domain.beforeRead(req));
  srv.before('CREATE', 'Users', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'Users', (req) => domain.beforeUpdate(req));
  srv.before('DELETE', 'Users', (req) => domain.beforeDelete(req));
};

module.exports.primaryEntity = 'Users';
