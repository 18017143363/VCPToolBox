const fs = require('fs');
const dir = 'E:\\VCP\\Plugin\\DiscourseReader\\';
const src = fs.readFileSync(dir + 'DiscourseReader.js', 'utf8').split('\n');
const nw = fs.readFileSync(dir + '_new_wj.js', 'utf8');
let s = -1, e = -1, d = 0;
for (let i = 0; i < src.length; i++) {
  if (src[i].includes('async function writeJSON')) { s = i; d = 0; }
  if (s >= 0) {
    d += (src[i].match(/{/g) || []).length - (src[i].match(/}/g) || []).length;
    if (d === 0 && i > s) { e = i + 1; break; }
  }
}
console.log('Replace lines ' + (s+1) + '-' + e);
const out = [...src.slice(0, s), nw, ...src.slice(e)].join('\n');
fs.writeFileSync(dir + 'DiscourseReader.js', out);
console.log('Done! New size: ' + out.length);