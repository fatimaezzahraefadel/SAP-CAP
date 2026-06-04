const sqlite3 = require('sqlite3').verbose();
const filePath = process.argv[2] || 'db/performance.db';
const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('OPEN ERR', err);
    process.exit(1);
  }
  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", (err, rows) => {
    if (err) {
      console.error('QUERY ERR', err);
      process.exit(1);
    }
    console.log(filePath);
    console.log(rows.map(r => r.name).join('\n'));
    db.close();
  });
});
