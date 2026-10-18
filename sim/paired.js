#!/usr/bin/env node
/* ============ sim/paired.js — comparación emparejada (misma semilla y Pokémon) ============
 * Uso: node sim/paired.js base.json nuevo.json [--min 10,20,30]
 *
 * Empareja las partidas por (dex, semilla) y da, por Pokémon y en total:
 *   t     media geométrica del cociente de tiempos nuevo/base (con su ±1 error típico),
 *         partidas en que el nuevo dura más / menos, medianas
 *   nvM / kM   nivel y derrotados en el minuto M (sólo las parejas vivas las dos en M):
 *         diferencia media de nivel y cociente medio de derrotados
 *   vidas (inmortales) vidas perdidas antes del min 30, cociente geométrico
 */
const fs = require('fs');
const args = process.argv.slice(2);
const mins = args.includes('--min') ? args[args.indexOf('--min') + 1].split(',').map(Number) : [10, 20, 30];
const files = args.filter((x, i) => !x.startsWith('--') && args[i - 1] !== '--min');
const [A, B] = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')).filter(r => !r.error));
const key = r => r.dex + ':' + r.seed;
const mapA = new Map(A.map(r => [key(r), r]));
const pairs = B.filter(r => mapA.has(key(r))).map(b => [mapA.get(key(b)), b]);

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const se = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length); };
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mmss = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

function row(label, ps) {
  const lr = ps.map(([a, b]) => Math.log(b.time / a.time));
  const m = mean(lr), e = se(lr);
  const win = ps.filter(([a, b]) => b.time > a.time + 1).length, lose = ps.filter(([a, b]) => b.time < a.time - 1).length;
  const c = [label.padEnd(14), String(ps.length).padStart(3),
    ('×' + Math.exp(m).toFixed(3) + ' ±' + (e * 100).toFixed(1) + '%').padEnd(16), (win + '/' + lose).padStart(6),
    mmss(med(ps.map(p => p[0].time))).padStart(6), mmss(med(ps.map(p => p[1].time))).padStart(6)];
  for (const M of mins) {
    const q = ps.map(([a, b]) => [a.curve && a.curve[M - 1], b.curve && b.curve[M - 1]]).filter(([x, y]) => x && y);
    if (!q.length) { c.push('    -    '); continue; }
    const dl = mean(q.map(([x, y]) => y.lv - x.lv)), dls = se(q.map(([x, y]) => y.lv - x.lv));
    const kr = Math.exp(mean(q.map(([x, y]) => Math.log((y.kills + 1) / (x.kills + 1)))));
    c.push(`nv${M} ${(mean(q.map(([x]) => x.lv))).toFixed(0)}${dl >= 0 ? '+' : ''}${dl.toFixed(1)}±${(dls || 0).toFixed(1)} k×${kr.toFixed(2)} (${q.length})`);
  }
  if (ps.some(([a]) => a.immortal)) {
    const l = ps.map(([a, b]) => Math.log((b.lives30 ?? b.lives) + 0.5) - Math.log((a.lives30 ?? a.lives) + 0.5));
    c.push('vidas ×' + Math.exp(mean(l)).toFixed(2) + ' ±' + (se(l) * 100).toFixed(0) + '%');
  }
  console.log(c.join('  '));
}
console.log(`${files[1]} frente a ${files[0]}: t = cociente geométrico de tiempo (±1 e.t.), gana/pierde, medianas base y nuevo; nvM = nivel base + diferencia; k = derrotados nuevo/base`);
for (const dex of [...new Set(pairs.map(p => p[0].dex))]) row(String(pairs.find(p => p[0].dex === dex)[0].name || dex), pairs.filter(p => p[0].dex === dex));
row('todos', pairs);
