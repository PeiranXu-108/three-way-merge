const fs = require('fs');
const path = require('path');
const srcCss = path.join(__dirname, '../src/styles/index.css');
const destDir = path.join(__dirname, '../dist');
const destCss = path.join(destDir, 'index.css');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}
fs.copyFileSync(srcCss, destCss);