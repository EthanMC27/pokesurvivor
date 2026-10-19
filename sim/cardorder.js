#!/usr/bin/env node
/* ============ sim/cardorder.js — qué cartas se cogen y cuándo (para copiarlo a mano) ============
 * Uso: node sim/cardorder.js f.jsonl [g.jsonl ...] --dex 798 [--min-time 1260] [--seeds 301-310] [--main meteor-mash]
 *
 * Toma las partidas "buenas" (las que duran al menos --min-time s) y da:
 *   1. hitos (mediana del minuto): aprender cada movimiento del grupo principal, subirlo al máximo,
 *      evolucionar el principal, Potencia n.º 5/10/20/30/40, Coraza/Vigor/Carrera...
 *   2. minuto a minuto, qué tipo de carta se coge (% de las cartas de ese minuto) y las más repetidas.
 */
const fs = require('fs');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const files = args.filter((x, i) => !x.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const range = s => { const o = []; for (const p of s.split(',')) { const [a, b] = p.split('-').map(Number); for (let i = a; i <= (b || a); i++) o.push(i); } return new Set(o); };
const dex = +opt('--dex'), minT = +(opt('--min-time') || 1260), main = opt('--main') || 'meteor-mash';
const seeds = opt('--seeds') ? range(opt('--seeds')) : null;
const rs = files.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l)))
  .filter(r => !r.error && r.dex === dex && r.time >= minT && (!seeds || seeds.has(r.seed)));
if (!rs.length) { console.log('ninguna partida'); process.exit(0); }
const med = a => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const fm = t => t == null ? '—' : (t / 60).toFixed(1);
console.log(`${rs[0].name} (${dex}): ${rs.length} partidas de ≥ ${minT} s (semillas ${rs.map(r => r.seed).join(', ')})\n`);

// Movimientos del grupo principal: el grupo del hueco que contiene `main` al final.
const groupOf = r => { const g = (r.moves || []).find(s => s.split('+').some(x => x.split(':')[0] === main)); return g ? g.split('+').map(x => x.split(':')[0]) : [main]; };
const cnt = {}; for (const r of rs) for (const id of groupOf(r)) cnt[id] = (cnt[id] || 0) + 1;
const group = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id, n]) => id + ' (' + n + '/' + rs.length + ')');
console.log('Grupo principal al final: ' + group.join(', ') + '\n');

const nth = (r, key, n) => { const a = r.cards.filter(c => c.key === key); return a.length >= n ? a[n - 1].t : null; };
const learnT = (r, id) => r.cards.some(c => c.key === 'new:' + id) ? nth(r, 'new:' + id, 1) : (r.cards.some(c => c.key === 'up:' + id) ? 0 : null);
const ids = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 4);
const rows = [];
for (const id of ids) {
  rows.push([`aprender ${id}`, rs.map(r => learnT(r, id))]);
  rows.push([`${id} al máximo (nv 5)`, rs.map(r => nth(r, 'up:' + id, 4))]);
}
rows.push([`evolucionar ${main}`, rs.map(r => nth(r, 'evo:' + main, 1))]);
for (const n of [1, 5, 10, 20, 30, 40]) rows.push([`Potencia n.º ${n}`, rs.map(r => nth(r, 'stat:atk', n))]);
for (const [k, name] of [['stat:def', 'Coraza'], ['stat:hp', 'Vigor'], ['stat:spd', 'Carrera'], ['stat:cd', 'Reflejos']])
  for (const n of [1, 5]) rows.push([`${name} n.º ${n}`, rs.map(r => nth(r, k, n))]);
console.log('Hitos (minuto mediano · cuántas partidas lo alcanzan):');
for (const [k, ts] of rows) console.log('  ' + k.padEnd(34) + fm(med(ts)).padStart(6) + '   ' + ts.filter(t => t != null).length + '/' + rs.length);

// Minuto a minuto.
const kind = k => k.startsWith('stat:') ? { atk: 'Potencia', def: 'Coraza', hp: 'Vigor', spd: 'Carrera', cd: 'Reflejos', rgn: 'Síntesis', mag: 'Imán', xp: 'Aprendizaje', heal: 'Baya Zidra' }[k.slice(5)] || k
  : k.startsWith('new:') ? 'nuevo ' + k.slice(4) : k.startsWith('up:') ? (ids.includes(k.slice(3)) ? 'mejora ' + k.slice(3) : 'mejora (fuera del grupo)') : k.startsWith('evo:') ? 'evolución ' + k.slice(4) : k;
const spans = [[0, 1], [1, 2], [2, 3], [3, 5], [5, 7], [7, 10], [10, 13], [13, 16], [16, 20], [20, 25], [25, 31]];
console.log('\nPor tramos (cartas por partida en el tramo; las 5 más cogidas, % de las cartas del tramo):');
for (const [a, b] of spans) {
  const cs = rs.flatMap(r => r.cards.filter(c => c.t >= a * 60 && c.t < b * 60 && c.key !== 'reroll'));
  if (!cs.length) continue;
  const by = {}; for (const c of cs) { const k = kind(c.key); by[k] = (by[k] || 0) + 1; }
  const top = Object.entries(by).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => `${k} ${Math.round(100 * n / cs.length)}%`);
  console.log(`  min ${String(a).padStart(2)}-${String(b).padEnd(2)} ${(cs.length / rs.length).toFixed(1).padStart(5)} cartas: ${top.join(', ')}`);
}
