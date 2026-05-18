const fs = require('fs');
const p = 'E:\\VCP\\Plugin\\DiscourseReader\\DiscourseReader.js';
let c = fs.readFileSync(p, 'utf8');
// Remove BOM if present
if (c.charCodeAt(0) === 0xFEFF) { c = c.slice(1); console.log('BOM removed'); }
// Find replyTopic writeJSON line and insert debug
const lines = c.split('\n');
let inserted = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Reply posted! post_id=')) {
    lines.splice(i, 0, '  console.error("[DEBUG replyTopic] raw data:", JSON.stringify(data).substring(0, 800));');
    console.log('Debug inserted before line ' + (i+1));
    inserted = true;
    break;
  }
}
if (!inserted) console.log('WARNING: target line not found');
fs.writeFileSync(p, lines.join('\n'));
console.log('Done, total lines: ' + lines.length);