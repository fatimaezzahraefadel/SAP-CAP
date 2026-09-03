const fs = require('fs');

const files = [
  'app/frontend/src/app/pages/gestion/GestionManagerFiori.page.tsx',
  'app/frontend/src/app/pages/gestion/GestionConsultantFiori.page.tsx',
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log('NOT FOUND:', filePath);
    return;
  }

  // Read as binary buffer then decode as latin1 to see raw bytes
  const buf = fs.readFileSync(filePath);
  
  // The file is UTF-8 but some strings were saved with wrong encoding
  // We decode as latin1 and re-encode properly
  let content = buf.toString('utf8');
  
  // Map of corrupted sequences to correct UTF-8
  const replacements = new Map([
    ['\u00c3\u00a9', '\u00e9'], // é
    ['\u00c3\u00a8', '\u00e8'], // è
    ['\u00c3\u00a0', '\u00e0'], // à
    ['\u00c3\u00ae', '\u00ee'], // î
    ['\u00c3\u00b4', '\u00f4'], // ô
    ['\u00c3\u00bb', '\u00fb'], // û
    ['\u00c3\u00a7', '\u00e7'], // ç
    ['\u00c3\u0089', '\u00c9'], // É
    ['\u00c3\u0087', '\u00c7'], // Ç
    ['\u00c3\u00aa', '\u00ea'], // ê
    ['\u00c3\u00a2', '\u00e2'], // â
    ['\u00c3\u00b9', '\u00f9'], // ù
    ['\u00c3\u00af', '\u00ef'], // ï
    ['\u00c3\u00b4', '\u00f4'], // ô
    ['\u00e2\u0080\u0099', '\u2019'], // '
    ['\u00e2\u0080\u0093', '\u2013'], // –
    ['\u00e2\u0080\u009c', '\u201c'], // "
    ['\u00e2\u0080\u009d', '\u201d'], // "
    ['\u00c3\u0082', ''],  // remove spurious Â
  ]);

  let count = 0;
  replacements.forEach((good, bad) => {
    const before = content;
    content = content.split(bad).join(good);
    if (content !== before) count++;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${filePath}: ${count} patterns replaced`);
});

console.log('Done!');
