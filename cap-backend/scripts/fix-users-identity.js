const fs = require('fs');
const path = 'db/data/sap.performance.dashboard.db-Users.csv';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
// Add identityProvider column to header
lines[0] = lines[0].trim() + ';identityProvider';
// Add XSUAA value to each data row
for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim()) {
    lines[i] = lines[i].trim() + ';XSUAA';
  }
}
fs.writeFileSync(path, lines.join('\n'));
console.log('Done! Lines updated:', lines.filter(l => l.trim()).length - 1, 'users');

// Verify
const updated = fs.readFileSync(path, 'utf8').split('\n');
console.log('Header:', updated[0]);
console.log('Sample row:', updated[1]);
