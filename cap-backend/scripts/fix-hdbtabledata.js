const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'gen', 'db', 'src', 'gen', 'data');

if (fs.existsSync(dataDir)) {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.hdbtabledata'));
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      const json = JSON.parse(content);
      if (json.imports && json.imports.length > 0) {
        json.imports[0].import_settings.delete_existing_data = true;
        json._force_deploy_timestamp = Date.now();
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
        console.log(`Successfully patched ${file} with delete_existing_data = true`);
      }
    } catch (err) {
      console.error(`Failed to parse or patch ${file}`, err);
    }
  }
} else {
  console.log('gen/db/src/gen/data not found, skipping patch.');
}
