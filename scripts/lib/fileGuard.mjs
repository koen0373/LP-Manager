import fs from 'fs';
export function writeNdjsonSafe(targetPath, lines) {
  const tmp = targetPath + '.tmp.' + Math.random().toString(36).slice(2);
  fs.writeFileSync(tmp, lines.join('\n') + '\n', 'utf8');
  const lc = lines.length;
  if (lc <= 0) { fs.unlinkSync(tmp); throw new Error('empty_write_blocked'); }
  fs.renameSync(tmp, targetPath);
  return lc;
}
export function countLines(p){ try{ return fs.readFileSync(p,'utf8').split('\n').filter(Boolean).length; }catch{ return 0; } }
