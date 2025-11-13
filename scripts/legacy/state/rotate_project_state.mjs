#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const options = {
  days: 14,
  maxLines: 300,
  dryRun: false,
};

for (const arg of args) {
  if (arg.startsWith('--days=')) {
    options.days = Number(arg.split('=')[1]) || options.days;
  } else if (arg.startsWith('--max-lines=')) {
    options.maxLines = Number(arg.split('=')[1]) || options.maxLines;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
}

const projectStatePath = path.resolve('PROJECT_STATE.md');
const openActionsPath = path.resolve('docs/state/open_actions.md');
const changelogDir = path.resolve('docs/state/changelog');

if (!fs.existsSync(changelogDir)) {
  fs.mkdirSync(changelogDir, { recursive: true });
}

const projectState = fs.readFileSync(projectStatePath, 'utf8');
let updatedState = projectState;

const today = new Date();
today.setHours(0, 0, 0, 0);
const cutoff = new Date(today);
cutoff.setDate(cutoff.getDate() - options.days);

const changelogRegex = /^## Changelog — (\d{4}-\d{2}-\d{2})([\s\S]*?)(?=^## |^# |\Z)/gim;
const archivedEntries = [];
updatedState = updatedState.replace(changelogRegex, (match, dateStr, body, offset, full) => {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (date.getTime() <= cutoff.getTime()) {
    archivedEntries.push({ date: dateStr, text: match.trim() });
    return '\n';
  }
  return match;
});

const ensureChangelogFile = (monthKey) => {
  const filePath = path.join(changelogDir, `${monthKey}.md`);
  if (!fs.existsSync(filePath)) {
    const header = `# ${monthKey} Changelog Archive`;
    if (!options.dryRun) {
      fs.writeFileSync(filePath, `${header}\n\n`, 'utf8');
    }
    return { filePath, header, body: '' };
  }
  const raw = fs.readFileSync(filePath, 'utf8').trimEnd();
  const [headerLine, ...rest] = raw.split('\n');
  const header = headerLine.startsWith('# ')
    ? headerLine
    : `# ${monthKey} Changelog Archive`;
  let body = rest.join('\n').trim();
  if (body.startsWith('_No') || body.startsWith('_Place')) {
    body = '';
  }
  return { filePath, header, body };
};

for (const entry of archivedEntries) {
  const monthKey = entry.date.slice(0, 7);
  const file = ensureChangelogFile(monthKey);
  const newBody = file.body ? `${file.body}\n\n${entry.text}` : entry.text;
  if (!options.dryRun) {
    fs.writeFileSync(
      file.filePath,
      `${file.header}\n\n${newBody.trim()}\n`,
      'utf8',
    );
  }
  console.log(`[state] Archived changelog ${entry.date} → ${path.relative(process.cwd(), file.filePath)}`);
}

const openActionsRegex = /(## Open actions[^\n]*\n)([\s\S]*?)(?=^## |^# |\Z)/i;
const openMatch = openActionsRegex.exec(updatedState);
if (openMatch) {
  const [fullMatch, heading, body] = openMatch;
  const bulletLines = body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().startsWith('- '));
  const kept = bulletLines.slice(0, 10);
  const overflow = bulletLines.slice(10);

  if (overflow.length > 0) {
    let openDoc = fs.readFileSync(openActionsPath, 'utf8').trimEnd();
    for (const item of overflow) {
      if (!openDoc.includes(item)) {
        openDoc = `${openDoc}\n${item}`.trimEnd();
      }
    }
    openDoc = openDoc.endsWith('\n') ? openDoc : `${openDoc}\n`;
    if (!options.dryRun) {
      fs.writeFileSync(openActionsPath, openDoc, 'utf8');
    }
  }

  const newSection = `${heading.trim()}\n${kept.join('\n')}\n`;
  const sectionIndex = openMatch.index ?? 0;
  updatedState =
    updatedState.slice(0, sectionIndex) +
    newSection +
    updatedState.slice(sectionIndex + fullMatch.length);
}

const trimmed = updatedState.replace(/\n{3,}/g, '\n\n').trim() + '\n';
const lineCount = trimmed.split('\n').filter((line, idx, arr) => !(idx === arr.length - 1 && line === '')).length;

if (lineCount > options.maxLines) {
  console.error(
    `[state] PROJECT_STATE.md is ${lineCount} lines (> ${options.maxLines}). Move more content or raise --max-lines.`,
  );
  if (!options.dryRun) {
    process.exit(1);
  }
}

if (!options.dryRun) {
  fs.writeFileSync(projectStatePath, trimmed, 'utf8');
}

console.log(`[state] PROJECT_STATE.md line count: ${lineCount}`);
if (archivedEntries.length === 0) {
  console.log('[state] No changelog entries required archiving.');
}
if (!openMatch) {
  console.warn('[state] Open actions section not found.');
}
