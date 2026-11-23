// Remove duplicate top-level keys from src/i18n/ru.ts (keeps first occurrence).
// Handles both `'key': 'value',` and `'key':\n  'value',` multiline entries.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'i18n', 'ru.ts');
const lines = fs.readFileSync(file, 'utf8').split('\n');
const seen = new Set();
const out = [];
let removed = 0;
const keyRe = /^\s*'((?:[^'\\]|\\.)*)':(.*)$/;
const bareValueRe = /^\s*'(?:[^'\\]|\\.)*',?\s*$/;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matchLine = line.replace(/\r$/, '');
  const m = matchLine.match(keyRe);
  if (m && seen.has(m[1])) {
    removed++;
    // Multiline entry: value is on following bare-string line(s) — drop them.
    if (m[2].trim() === '') {
      let j = i + 1;
      while (j < lines.length && bareValueRe.test(lines[j].replace(/\r$/, ''))) j++;
      i = j - 1;
    }
    continue;
  }
  if (m) seen.add(m[1]);
  out.push(line);
}
fs.writeFileSync(file, out.join('\n'));
console.log(`removed ${removed} duplicate keys`);
