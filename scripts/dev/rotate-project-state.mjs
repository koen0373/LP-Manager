import fs from 'fs'; import path from 'path';
const root = process.cwd();
const file = path.join(root, 'PROJECT_STATE.md');
if (!fs.existsSync(file)) { console.log(JSON.stringify({rotated:0, keptDays:7, note:"no PROJECT_STATE.md"})); process.exit(0); }
let src = fs.readFileSync(file, 'utf8');
const today = new Date();
const keepBefore = new Date(today.getTime() - 7*24*60*60*1000);
const rx = /(^|\n)##?\s*Changelog\s*—\s*(\d{4}-\d{2}-\d{2})[\s\S]*?(?=(?:\n##?\s*Changelog\s*—\s*\d{4}-\d{2}-\d{2}|$))/g;
let out = [], rotated = 0;
src = src.replace(rx, (m, _lead, d) => {
  const dt = new Date(d+'T00:00:00Z');
  if (dt < keepBefore) { out.push({date:d, text:m.trimStart()}); rotated++; return ''; }
  return m;
});
for (const b of out) {
  const [y,m,dd] = b.date.split('-').map(Number);
  const date = new Date(Date.UTC(y,m-1,dd));
  const firstJan = new Date(Date.UTC(y,0,1));
  const week = Math.ceil((((date - firstJan)/86400000)+firstJan.getUTCDay()+1)/7);
  const dir = path.join(root, 'docs/changelog', String(y));
  fs.mkdirSync(dir, {recursive:true});
  const arch = path.join(dir, `CHANGELOG-${y}-W${String(week).padStart(2,'0')}.md`);
  fs.appendFileSync(arch, `\n\n---\n### Changelog — ${b.date}\n\n${b.text}\n`);
}
const marker = '<!-- CHANGELOG_ARCHIVE_INDEX -->';
while (src.split(marker).length>2) src = src.replace(marker,''); // dedup
if (!src.includes(marker)) src = src.trimEnd() + `\n\n${marker}\nSee archives in /docs/changelog/.\n`;
fs.writeFileSync(file, src.endsWith('\n')?src:src+'\n','utf8');
console.log(JSON.stringify({rotated, keptDays:7}));
