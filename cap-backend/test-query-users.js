const cds = require('@sap/cds');

(async () => {
  try {
    const db = await cds.connect.to('db');
    const users = await db.run(
      SELECT.from('sap.performance.dashboard.db.Users')
            .where({ role: 'CONSULTANT_TECHNIQUE' })
            .limit(5)
    );
    console.log("Found Technical Consultants:", users.length);
    console.log("First user:", JSON.stringify(users[0], null, 2));

    const activeUsers = await db.run(
      SELECT.from('sap.performance.dashboard.db.Users')
            .where({ active: true, role: 'CONSULTANT_TECHNIQUE' })
            .limit(5)
    );
    console.log("Found ACTIVE Technical Consultants:", activeUsers.length);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
