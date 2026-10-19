#!/usr/bin/env node
/* ============ sim/snowstats.js — resumen de variantes "bola de nieve" ============
 * Uso: node sim/snowstats.js base.jsonl var1.jsonl var2.jsonl ... [--seeds 301-310]
 *
 * Por variante y Pokémon: partidas, mediana de tiempo, p10, cuántas llegan al min 30,
 * nivel mediano en los min 10/15/30 (sólo de las vivas en ese minuto), derrotados al
 * final (mediana), cuántas llegan al tope de Potencia (40 cartas) y en qué minuto (mediana).
 * Contra la primera (base), emparejado por semilla: cociente geométrico de tiempo ±1 e.t.
 * Acepta .jsonl (sweep.js) o .json (run.js --json).
 */
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const files = args.filter((x, i) => !x.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const range = s => { const o = []; for (const p of s.split(',')) { const [a, b] = p.split('-').map(Number); for (let i = a; i <= (b || a); i++) o.push(i); } return new Set(o); };
const seeds = opt('--seeds') ? range(opt('--seeds')) : null;
// --cap S: recorta cada partida a S segundos (para comparar con barridos más cortos; el
// simulador es determinista, así que una partida de 1900 s recortada es la de S s).
const cap = +opt('--cap') || 0;
const goal = cap || 1800;
const read = f => {
  const t = fs.readFileSync(f, 'utf8').trim();
  const rs = t.startsWith('[') ? JSON.parse(t) : t.split('\n').filter(Boolean).map(l => JSON.parse(l));
  return rs.filter(r => !r.error && (!seeds || seeds.has(r.seed))).map(r => cap && r.time > cap ? Object.assign({}, r, { time: cap, curve: r.curve.slice(0, Math.floor(cap / 60)), cards: r.cards.filter(c => c.t <= cap), kills: (r.curve[Math.floor(cap / 60) - 1] || r).kills }) : r);
};
const q = (a, p) => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null; };
const mmss = s => s == null ? '-' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const lvAt = (r, m) => r.curve && r.curve[m - 1] ? r.curve[m - 1].lv : null;
const capT = r => { const a = r.cards.filter(c => c.key === 'stat:atk'); return a.length >= 40 ? a[39].t : null; };

const sets = files.map(f => ({ name: path.basename(f).replace(/\.jsonl?$/, ''), rs: read(f) }));
const base = sets[0];
const dexs = [...new Set(sets.flatMap(s => s.rs.map(r => r.dex)))];
const hdr = ['variante', 'Pokémon', 'n', 't med', 'p10', cap ? 'vivas ' + Math.round(cap / 60) : '≥30', 'nv10', 'nv15', 'nv30', 'derr.', 'tope Pot.', 'min tope', 'atk@15', 'vs base'];
const rows = [hdr];
for (const dex of dexs) {
  for (const s of sets) {
    const rs = s.rs.filter(r => r.dex === dex);
    if (!rs.length) continue;
    const caps = rs.map(capT).filter(x => x != null);
    let vs = '';
    if (s !== base) {
      const bm = new Map(base.rs.filter(r => r.dex === dex).map(r => [r.seed, r]));
      const lr = rs.filter(r => bm.has(r.seed)).map(r => Math.log(r.time / bm.get(r.seed).time));
      if (lr.length > 1) {
        const m = mean(lr), e = Math.sqrt(lr.reduce((a, x) => a + (x - m) ** 2, 0) / (lr.length - 1) / lr.length);
        vs = '×' + Math.exp(m).toFixed(2) + ' ±' + (e * 100).toFixed(0) + '% (' + lr.length + ')';
      }
    }
    const atk15 = rs.filter(r => r.time >= 900).map(r => r.cards.filter(c => c.key === 'stat:atk' && c.t <= 900).length);
    rows.push([s.name, (rs[0].name || dex) + '', rs.length, mmss(q(rs.map(r => r.time), 0.5)), mmss(q(rs.map(r => r.time), 0.1)),
      rs.filter(r => r.time >= goal).length + '/' + rs.length,
      q(rs.map(r => lvAt(r, 10)), 0.5) ?? '-', q(rs.map(r => lvAt(r, 15)), 0.5) ?? '-', q(rs.map(r => lvAt(r, 30)), 0.5) ?? '-',
      q(rs.map(r => r.kills), 0.5), caps.length + '/' + rs.length, caps.length ? (q(caps, 0.5) / 60).toFixed(1) : '-',
      atk15.length ? q(atk15, 0.5) : '-', vs]);
  }
}
// Totales por variante (todos los Pokémon), emparejados con la base.
for (const s of sets) {
  const rs = s.rs; let vs = '';
  if (s !== base) {
    const bm = new Map(base.rs.map(r => [r.dex + ':' + r.seed, r]));
    const lr = rs.filter(r => bm.has(r.dex + ':' + r.seed)).map(r => Math.log(r.time / bm.get(r.dex + ':' + r.seed).time));
    const m = mean(lr), e = Math.sqrt(lr.reduce((a, x) => a + (x - m) ** 2, 0) / (lr.length - 1) / lr.length);
    vs = '×' + Math.exp(m).toFixed(2) + ' ±' + (e * 100).toFixed(0) + '% (' + lr.length + ')';
  }
  const caps = rs.map(capT).filter(x => x != null);
  rows.push([s.name, 'TODOS', rs.length, mmss(q(rs.map(r => r.time), 0.5)), mmss(q(rs.map(r => r.time), 0.1)),
    rs.filter(r => r.time >= goal).length + '/' + rs.length, q(rs.map(r => lvAt(r, 10)), 0.5) ?? '-', q(rs.map(r => lvAt(r, 15)), 0.5) ?? '-',
    q(rs.map(r => lvAt(r, 30)), 0.5) ?? '-', q(rs.map(r => r.kills), 0.5), caps.length + '/' + rs.length,
    caps.length ? (q(caps, 0.5) / 60).toFixed(1) : '-', '', vs]);
}
const w = hdr.map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
for (const r of rows) console.log(r.map((c, i) => String(c).padEnd(w[i])).join('  '));
