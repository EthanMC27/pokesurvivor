#!/usr/bin/env node
/* ============ sim/sweep.js — barrido de muchos Pokémon ============
 * Uso: node sim/sweep.js --out sim/out/sweep1.jsonl [--dex all | 4,94,...] [--seeds 1-2]
 *        [--max 900] [--bot best] [--upgrades max] [--ban auto] [--jobs 14] [--opts '{...}']
 *
 * Cada partida se apunta en cuanto acaba (una línea JSON por partida), así que
 * si se corta se puede relanzar con el mismo --out: salta lo que ya está hecho.
 * Al final (o con --summary sólo) escribe <out>.csv con un resumen por Pokémon.
 */
const fs = require('fs'), path = require('path');
const { runJobs, range } = require('./run');
const { load } = require('./load');

function parseArgs(a) {
  const o = {};
  for (let i = 2; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
  return o;
}

const a = parseArgs(process.argv);
const out = a.out || path.join(__dirname, 'out', 'sweep.jsonl');
const bot = a.bot || 'best';
const { G } = load(1);
const dexs = !a.dex || a.dex === 'all' ? G.DEX.filter(p => G.SPRITE_META[p.dex]).map(p => p.dex) : String(a.dex).split(',').map(Number);
const seeds = range(a.seeds || '1-2');

// Vetos automáticos con un solo juego cargado (cards.bans(mon, G)).
let bansFn = null;
if (a.ban === 'auto') {
  for (const p of [path.join(__dirname, 'bots', bot), path.join(__dirname, 'bots', 'cards')]) {
    try { const m = require(p); if (typeof m.bans === 'function') { bansFn = m.bans; break; } } catch (e) {}
  }
}
const banOf = dex => a.ban === 'auto' ? (bansFn ? bansFn(G.DEX_BY[dex], G) : undefined) : a.ban ? String(a.ban).split(',') : undefined;

const done = new Set();
if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) {
  if (!l.trim()) continue;
  try { const r = JSON.parse(l); if (!r.error) done.add(r.dex + ':' + r.seed); } catch (e) {}
}

function summary() {
  const rows = fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => !r.error);
  const by = {};
  for (const r of rows) (by[r.dex] = by[r.dex] || []).push(r);
  const lines = ['dex,name,types,atk,hp,spd,rarity,leg,n,timeMed,timeMin,timeMean,levelMean,killsMean,bondsMean,capped,topMove'];
  const med = v => { v = v.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  for (const dex in by) {
    const rs = by[dex], p = G.DEX_BY[dex];
    const mean = k => (rs.reduce((s, r) => s + r[k], 0) / rs.length).toFixed(1);
    const top = {};
    for (const r of rs) { const m = (r.moves[0] || '').split('+')[0].split(':')[0]; top[m] = (top[m] || 0) + 1; }
    const topMove = Object.entries(top).sort((x, y) => y[1] - x[1])[0][0];
    lines.push([dex, '"' + p.name + '"', p.types.join('/'), p.atk, p.hp, p.spd, p.rarity, p.leg ? 1 : 0, rs.length,
      med(rs.map(r => r.time)), Math.min(...rs.map(r => r.time)), mean('time'), mean('level'), mean('kills'), mean('bonds'),
      rs.filter(r => !r.dead).length, topMove].join(','));
  }
  fs.writeFileSync(out.replace(/\.jsonl$/, '') + '.csv', lines.join('\n'));
  console.log('resumen:', Object.keys(by).length, 'Pokémon,', rows.length, 'partidas ->', out.replace(/\.jsonl$/, '') + '.csv');
}

if (a.summary) { summary(); process.exit(0); }

const upgrades = a.upgrades === 'none' ? {} : 'max';
const jobs = [];
for (const dex of dexs) {
  const ban = banOf(dex);
  for (const seed of seeds) if (!done.has(dex + ':' + seed))
    jobs.push({ dex, seed, bot, upgrades, maxTime: +a.max || 900, ban, botOpts: a.opts ? JSON.parse(a.opts) : {} });
}
console.log(`${dexs.length} Pokémon × ${seeds.length} semillas: ${jobs.length} partidas por hacer (${done.size} ya hechas)`);
const t0 = Date.now();
let n = 0;
runJobs(jobs, +a.jobs || undefined, r => {
  // Sin curva ni cartas detalladas por partida no se puede estudiar la estrategia: se guardan.
  fs.appendFileSync(out, JSON.stringify(r) + '\n');
  if (++n % 25 === 0 || n === jobs.length) {
    const el = (Date.now() - t0) / 1000;
    console.log(`${n}/${jobs.length}  ${(el / 60).toFixed(0)} min, quedan ~${((el / n) * (jobs.length - n) / 60).toFixed(0)} min`);
  }
}).then(summary);
