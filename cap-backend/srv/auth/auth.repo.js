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

  async upsertUserFromXsuaa({ id, email, name, role }) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const userId = String(id ?? '').trim();
    const displayName = String(name ?? normalizedEmail ?? userId).trim();

    const userColumns = [
      'ID',
      'name',
      'email',
      'role',
      'active',
      'availabilityPercent',
      'teamId',
      'avatarUrl',
      'identityProvider',
      'externalId',
    ];

    const existing =
      (normalizedEmail
        ? await cds.db.run(
            SELECT.one.from('sap.performance.dashboard.db.Users')
              .columns(...userColumns)
              .where({ email: normalizedEmail })
          )
        : null) ||
      (userId
        ? await cds.db.run(
            SELECT.one.from('sap.performance.dashboard.db.Users')
              .columns(...userColumns)
              .where({ ID: userId })
          )
        : null);

    if (existing) {
      await cds.db.run(
        UPDATE('sap.performance.dashboard.db.Users')
          .set({
            name: displayName || existing.name,
            email: normalizedEmail || existing.email,
            role,
            active: true,
            identityProvider: 'XSUAA',
            externalId: userId || existing.externalId,
          })
          .where({ ID: existing.ID })
      );
      return {
        ...existing,
        name: displayName || existing.name,
        email: normalizedEmail || existing.email,
        role,
        active: true,
        identityProvider: 'XSUAA',
        externalId: userId || existing.externalId,
      };
    }

    const created = {
      ID: userId,
      name: displayName || normalizedEmail || userId,
      email: normalizedEmail || `${userId}@xsuaa.local`,
      role,
      active: true,
      availabilityPercent: 100,
      identityProvider: 'XSUAA',
      externalId: userId,
    };

    await cds.db.run(INSERT.into('sap.performance.dashboard.db.Users').entries(created));
    return created;
  }

}

module.exports = AuthRepo;
