const cds = require('@sap/cds');

async function test() {
  await cds.connect.to('db', {
    kind: 'sqlite',
    credentials: { database: 'db.sqlite' }
  });

  const users = await cds.db.run(
    SELECT.from('sap.performance.dashboard.db.Users', ['ID', 'name', 'role', 'skills', 'availabilityPercent'])
      .where({ active: true, role: { 'not in': ['ADMIN', 'MANAGER'] } })
  );

  console.log('Original users output:', JSON.stringify(users, null, 2));

  const expandedUsers = await cds.db.run(
    SELECT.from('sap.performance.dashboard.db.Users', u => {
      u.ID, u.name, u.role, u.availabilityPercent, u.skills(s => { s.skill })
    }).where({ active: true, role: { 'not in': ['ADMIN', 'MANAGER'] } })
  );

  console.log('Expanded users output:', JSON.stringify(expandedUsers, null, 2));
  process.exit(0);
}

test();
