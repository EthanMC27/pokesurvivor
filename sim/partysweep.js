#!/usr/bin/env node
/* ============ sim/partysweep.js — barrido de parejas (o tríos) en cooperativo ============
 * Uso: node sim/partysweep.js --party sim/out/v5/pairs.json --seeds 1201-1220 [--max 1900] [--jobs 14]
 *        --out sim/out/v5/party.jsonl
 *
 * pairs.json: [{ "name": "Cobalion+Polteageist", "members": [{ "dex": 638, "opts": {...} }, { "dex": 855, "opts": {...} }] }, ...]
 * Cada miembro juega con --bot best y sus opts; vetos automáticos con esas opts (cards.bans).
 * Una línea JSON por partida (con "party": nombre), reanudable con el mismo --out.
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs'), path = require('path');

if (!isMainThread) {
  const { runParty } = require('./party');
  const { load } = require('./load');
  const best = require('./bots/best');
  const { G } = load(1);
  parentPort.on('message', job => {
    try {
      const members = job.members.map(m => ({ dex: m.dex, bot: best(m.opts || {}), ban: m.ban || best.bans(m.dex, G, m.opts || {}), start: m.start }));
      const r = runParty({ members, seed: job.seed, upgrades: 'max', maxTime: job.max });
      r.party = job.name;
      parentPort.postMessage(r);
    } catch (e) {
      parentPort.postMessage({ party: job.name, seed: job.seed, error: String(e && e.stack || e) });
    }
  });
  return;
}

const a = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) {
  const k = process.argv[i].slice(2), v = process.argv[i + 1];
  a[k] = v && !v.startsWith('--') ? (i++, v) : true;
}
const range = s => { const o = []; for (const p of String(s).split(',')) { const [x, y] = p.split('-').map(Number); for (let i = x; i <= (y || x); i++) o.push(i); } return o; };
const parties = JSON.parse(fs.readFileSync(a.party, 'utf8'));
const out = a.out || path.join(__dirname, 'out', 'party.jsonl');
const done = new Set();
if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) {
  if (!l.trim()) continue;
  try { const r = JSON.parse(l); if (!r.error) done.add(r.party + ':' + r.seed); } catch (e) {}
}
const jobs = [];
for (const p of parties) for (const seed of range(a.seeds || '1-2')) if (!done.has(p.name + ':' + seed)) jobs.push({ name: p.name, members: p.members, seed, max: +a.max || 1900 });
console.log(`${parties.length} grupos: ${jobs.length} partidas por hacer (${done.size} ya hechas)`);
const nW = Math.min(+a.jobs || 3, jobs.length);
let next = 0, n = 0;
const t0 = Date.now();
for (let w = 0; w < nW; w++) {
  const wk = new Worker(__filename);
  const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else wk.terminate(); };
  wk.on('message', r => {
    fs.appendFileSync(out, JSON.stringify(r) + '\n');
    if (++n % 10 === 0 || n === jobs.length) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${n}/${jobs.length}  ${(el / 60).toFixed(0)} min, quedan ~${((el / n) * (jobs.length - n) / 60).toFixed(0)} min`);
    }
    feed();
  });
  wk.on('error', e => { console.error('hilo:', e); });
  feed();
}
