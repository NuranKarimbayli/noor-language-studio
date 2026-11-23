// Scan tsx files for hardcoded English UI strings not wrapped in t().
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
})(SRC);

const WORD = /[A-Za-z]{2,}/;
const results = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const ln = i + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import') || trimmed.startsWith('export type') || trimmed.startsWith('interface')) return;

    // JSX text: >Text<  (single-line only)
    const jsx = line.match(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g);
    if (jsx) {
      for (const m of jsx) {
        const txt = m.slice(1, -1).trim();
        if (txt && WORD.test(txt) && !txt.includes('{') && !/^[\d\s\-–—·|/:]+$/.test(txt)) {
          // skip if inside t() on same line or it's a known non-UI token
          results.push(`${path.relative(SRC, file)}:${ln}: JSX_TEXT "${txt}"`);
        }
      }
    }

    // Attributes with literal English
    for (const m of line.matchAll(/(placeholder|title|aria-label)="([^"]*[A-Za-z][^"]*)"/g)) {
      results.push(`${path.relative(SRC, file)}:${ln}: ATTR ${m[1]}="${m[2]}"`);
    }

    // Common call args: notify('...'), setError('...'), throw new Error('...')
    for (const m of line.matchAll(/(?:notify|onNotify|setError|setNotice|alert|confirm)\(\s*['"`]([^'"`]*[A-Za-z][^'"`]*)['"`]/g)) {
      results.push(`${path.relative(SRC, file)}:${ln}: CALL "${m[1]}"`);
    }
    for (const m of line.matchAll(/throw new Error\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
      results.push(`${path.relative(SRC, file)}:${ln}: THROW "${m[1]}"`);
    }
  });
}

console.log(results.join('\n'));
console.log(`\n--- ${results.length} candidates ---`);
