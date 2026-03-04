const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../src/styles/index.css');
const outPath = path.join(__dirname, '../src/styles/index.generated.ts');

const css = fs.readFileSync(cssPath, 'utf8');
fs.writeFileSync(outPath, `export default ${JSON.stringify(css)};\n`);
