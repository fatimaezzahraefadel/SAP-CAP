'use strict';

const cds = require('@sap/cds');

class AuthRepo {
  async findUserByEmail(email) {
    const users = await cds.db.run(
      SELECT.from('sap.performance.dashboard.db.Users')
        .columns(
          'ID',
          'name',
          'email',
          'role',
          'active',
          'availabilityPercent',
          'teamId',
          'avatarUrl'
        )
        .where({ email })
    );
    const user = users[0];
    if (user && (user.active === true || user.active === 'true' || user.active === 1 || user.active === '1')) {
      return user;
    }
    return null;
  }

  async findUserByRole(role) {
    const users = await cds.db.run(
      SELECT.from('sap.performance.dashboard.db.Users')
        .columns(
          'ID',
          'name',
          'email',
          'role',
          'active',
          'availabilityPercent',
          'teamId',
          'avatarUrl'
        )
        .where({ role })
    );
    const user = users.find(u => u.active === true || u.active === 'true' || u.active === 1 || u.active === '1');
    return user ?? null;
  }

}

module.exports = AuthRepo;
