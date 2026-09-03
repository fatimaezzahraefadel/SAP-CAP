'use strict';

const cds = require('@sap/cds');

const USERS_ENTITY = 'sap.performance.dashboard.db.Users';

// ---------------------------------------------------------------------------
// Canonical reference users.
//
// This mirrors db/data/sap.performance.dashboard.db-Users.csv but is applied at
// runtime (on `served`) instead of relying solely on the HDI `.hdbtabledata`
// import. The CSV import only runs against an *empty* table the first time the
// HANA container is deployed; if that first deploy happened while HANA was
// unavailable (a common case on trial landscapes that auto-stop), the seed
// silently never lands and the manager/dispatch assignment dropdowns end up
// empty. Re-applying it here is idempotent: existing rows are never touched,
// only missing IDs are inserted.
// ---------------------------------------------------------------------------
const REFERENCE_USERS = [
  { ID: 'u-admin',  name: 'Alice Admin',           email: 'alice.admin@inetum.com',      role: 'ADMIN',                active: true, availabilityPercent: 100, teamId: 'team-1' },
  { ID: 'u-manager',name: 'Zakaria EZ-ZAYTTE',     email: 'zakaria.ezzaytte@inetum.com', role: 'MANAGER',              active: true, availabilityPercent: 80,  teamId: 'team-1' },
  { ID: 'u-tech',   name: 'Fatima-Ezzahrae FADEL', email: 'fatima.fadel@inetum.com',     role: 'CONSULTANT_TECHNIQUE', active: true, availabilityPercent: 90,  teamId: 'team-1' },
];

/**
 * Inserts any reference users that are not already present, matched by ID.
 * Returns the number of users inserted (0 when nothing was missing).
 */
async function ensureReferenceUsers() {
  const db = cds.db;
  if (!db) return 0;

  const referenceIds = REFERENCE_USERS.map((u) => u.ID);
  const existing = await db.run(
    SELECT.from(USERS_ENTITY).columns('ID', 'identityProvider')
  );
  const existingById = new Map(existing.map((u) => [u.ID, u]));
  const existingIds = new Set(existingById.keys());

  // Heal reference users that were inserted by an earlier seed without the
  // XSUAA marker — otherwise the UserService read filter hides them on BTP.
  // Also update name and email in case they changed.
  const toHeal = referenceIds.filter((id) => existingById.has(id));
  for (const id of toHeal) {
    const ref = REFERENCE_USERS.find((u) => u.ID === id);
    if (!ref) continue;
    await db.run(
      UPDATE(USERS_ENTITY)
        .set({ identityProvider: 'XSUAA', externalId: id, name: ref.name, email: ref.email })
        .where({ ID: id })
    );
  }

  const missing = REFERENCE_USERS.filter((u) => !existingIds.has(u.ID)).map((u) => ({
    ...u,
    // The UserService read handler only returns rows tagged as XSUAA-provisioned
    // (srv/user/user.domain.service.js#beforeRead). Tag the reference users the
    // same way so they are visible/assignable on BTP, even though they never log
    // in themselves (they are assignable resources only).
    identityProvider: 'XSUAA',
    externalId: u.ID,
  }));
  if (missing.length === 0) return 0;

  await db.run(INSERT.into(USERS_ENTITY).entries(missing));
  return missing.length;
}

module.exports = { ensureReferenceUsers, REFERENCE_USERS };
