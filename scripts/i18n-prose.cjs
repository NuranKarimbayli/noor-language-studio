// Heuristic scan for prose-like lines (multiline JSX text) not wrapped in t().
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const out = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name)) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (i < 120) return;
        const s = l.trim();
        if (!s) return;
        if (/[=;{}()`<>[\]|/]|\/\/|=>|&&|\|\||\?/.test(s)) return;
        if (!/[a-z]{2,} [a-z]{2,}/.test(s)) return;
        if (!/[a-zA-Z.'’]$/.test(s)) return;
        if (s.split(' ').length < 3) return;
        out.push(path.relative(SRC, p) + ':' + (i + 1) + ': ' + s.slice(0, 110));
      });
    }
  }
})(SRC);
console.log(out.join('\n'));
console.log('---' + out.length);
