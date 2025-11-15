#!/usr/bin/env node
/* eslint-disable no-console */
const holdMs = Number(process.env.HOLD_MS || 5000);
console.log(JSON.stringify({ ok: true, pid: process.pid, holdMs }));
setTimeout(() => {
  console.log(JSON.stringify({ ok: true, done: true, pid: process.pid }));
}, holdMs);
