#!/usr/bin/env node
/* ============ sim/steelreport.js — análisis del barrido de Acero ============
 * Uso: node sim/steelreport.js [sim/out/steel1.jsonl] [--md sim/out/steel1-summary.md] [--all]
 *
 * Por Pokémon: mediana y peor 10 % del tiempo, cuántas llegan al min 30, nivel en los
 * min 15 y 30 (mediana entre las que llegan), derrotados, Potencia al tope (40 cartas),
 * con qué frecuencia Puño Meteoro es el grupo principal y si se evolucionó (y en qué minuto),
 * y el grupo principal típico. Después compara, dentro de cada Pokémon, las partidas con
 * Puño Meteoro principal contra las que no.
 *
 * "Grupo principal" = el grupo fusionado (2+ movimientos) con Puño Meteoro si lo hay; si no,
 * el hueco con más movimientos fusionados (empate: más niveles). Al final de una partida
 * larga los 3-4 huecos están llenos, así que "el más grande" no dice cuál era el foco.
 */
const fs = require('fs'), path = require('path');
const { load } = require('./load');
const args = process.argv.slice(2);
const file = args.find(x => !x.startsWith('--')) || path.join(__dirname, 'out', 'steel1.jsonl');
const mdOut = args.includes('--md') ? args[args.indexOf('--md') + 1] : null;
const { G } = load(1);

const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => !r.error);
const sorted = a => a.filter(x => x != null).sort((x, y) => x - y);
const q = (a, p) => { a = sorted(a); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null; };
const med = a => q(a, 0.5);
const mmss = s => s == null ? '-' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
const lvAt = (r, m) => { const c = (r.curve || []).find(x => x.m === m); return c ? c.lv : null; };
const killsAt = (r, m) => { const c = (r.curve || []).find(x => x.m === m); return c ? c.kills : null; };

function mainGroup(r) {
  const gs = r.moves.map(s => s.split('+').map(x => { const [id, lv] = x.split(':'); return { id, lv: parseInt(lv), evo: x.endsWith('*') }; }));
  const mm = gs.find(g => g.length >= 2 && g.some(m => m.id === 'meteor-mash'));
  if (mm) return mm;
  gs.sort((a, b) => b.length - a.length || b.reduce((s, m) => s + m.lv, 0) - a.reduce((s, m) => s + m.lv, 0));
  return gs[0] || [];
}
function info(r) {
  const g = mainGroup(r);
  const mm = g.find(m => m.id === 'meteor-mash');
  const evoCard = r.cards.find(c => c.key === 'evo:meteor-mash');
  return {
    mmMain: !!mm, mmEvo: !!(mm && mm.evo), mmEvoT: evoCard ? evoCard.t : null,
    group: g.map(m => m.id).sort().join('+'),
    capped: r.cards.filter(c => c.key === 'stat:atk').length >= 40,
    reached: r.time >= 1800
  };
}

const by = {};
for (const r of rows) (by[r.dex] = by[r.dex] || []).push(r);
const stats = [];
for (const dex in by) {
  const rs = by[dex], p = G.DEX_BY[dex], inf = rs.map(info);
  const reach = rs.filter(r => r.time >= 1800);
  const grp = {};
  inf.forEach(i => { grp[i.group] = (grp[i.group] || 0) + 1; });
  const topG = Object.entries(grp).sort((a, b) => b[1] - a[1])[0];
  stats.push({
    dex: +dex, name: p.name, types: p.types.join('/'), rarity: p.rarity, leg: !!p.leg, hp: p.hp, spd: p.spd, atk: p.atk, n: rs.length,
    tMed: med(rs.map(r => r.time)), tP10: q(rs.map(r => r.time), 0.1), r30: reach.length,
    lv15: med(rs.map(r => lvAt(r, 15))), n15: rs.filter(r => lvAt(r, 15) != null).length,
    lv30: med(reach.map(r => lvAt(r, 30))), k30: med(reach.map(r => killsAt(r, 30))),
    kills: med(rs.map(r => r.kills)), lvEnd: med(rs.map(r => r.level)),
    cap: inf.filter(i => i.capped).length, mmMain: inf.filter(i => i.mmMain).length, mmEvo: inf.filter(i => i.mmEvo).length,
    mmEvoT: med(inf.map(i => i.mmEvoT)),
    group: topG ? topG[0] + (topG[1] < rs.length ? ` (${topG[1]}/${rs.length})` : '') : '',
    rows: rs, inf
  });
}

// Puntuación: tiempo mediano, y a igualdad, nivel en el min 15.
stats.sort((a, b) => b.tMed - a.tMed || b.r30 - a.r30 || (b.lv15 || 0) - (a.lv15 || 0));
const head = '| # | Pokémon | Tipos | Rareza | Mediana | Peor 10 % | Llegan al 30 | Nivel min 15 | Nivel min 30* | Derrotados (mediana) | Potencia al tope | Puño Meteoro principal / evolucionado | Grupo principal típico |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
const line = (s, i) => `| ${i + 1} | ${s.name} (${s.dex})${s.leg ? ' L' : ''} | ${s.types} | ${s.rarity} | ${mmss(s.tMed)} | ${mmss(s.tP10)} | ${s.r30}/${s.n} | ${s.lv15 == null ? '-' : s.lv15}${s.n15 < s.n ? ` (${s.n15})` : ''} | ${s.lv30 == null ? '-' : s.lv30} | ${s.kills} | ${s.cap}/${s.n} | ${s.mmMain}/${s.mmEvo} | ${s.group} |`;
const all = args.includes('--all');
const top = stats.slice(0, all ? stats.length : 15);
console.log(head);
top.forEach((s, i) => console.log(line(s, i)));

// Bola de nieve: por nivel en el min 15 (entre las que llegan al 15).
const snow = stats.filter(s => s.lv15 != null).slice().sort((a, b) => b.lv15 - a.lv15);
console.log('\nBola de nieve (nivel min 15):');
for (const s of snow.slice(0, 15)) console.log(`  ${s.name.padEnd(12)} nv15 ${s.lv15} (${s.n15}/${s.n})  nv30 ${s.lv30 ?? '-'}  derrot.30 ${s.k30 ?? '-'}  tope ${s.cap}  t ${mmss(s.tMed)} p10 ${mmss(s.tP10)} ≥30 ${s.r30}  PM ${s.mmMain}/${s.mmEvo} evo~${mmss(s.mmEvoT)}`);

// Puño Meteoro principal o no, dentro del mismo Pokémon (sólo los que tienen de las dos clases).
console.log('\nPuño Meteoro en el grupo principal: sí vs no (mismo Pokémon)');
let pairs = [];
for (const s of stats) {
  const yes = s.rows.filter((r, k) => s.inf[k].mmMain), no = s.rows.filter((r, k) => !s.inf[k].mmMain);
  if (yes.length >= 2 && no.length >= 2) {
    const d = { name: s.name, ny: yes.length, nn: no.length, tY: med(yes.map(r => r.time)), tN: med(no.map(r => r.time)),
      l15Y: med(yes.map(r => lvAt(r, 15))), l15N: med(no.map(r => lvAt(r, 15))), l10Y: med(yes.map(r => lvAt(r, 10))), l10N: med(no.map(r => lvAt(r, 10))),
      kY: med(yes.map(r => r.kills / Math.max(1, r.time) * 60)), kN: med(no.map(r => r.kills / Math.max(1, r.time) * 60)) };
    pairs.push(d);
    console.log(`  ${s.name.padEnd(12)} sí ${d.ny}: t ${mmss(d.tY)} nv10 ${d.l10Y ?? '-'} nv15 ${d.l15Y ?? '-'} derrot/min ${Math.round(d.kY)} | no ${d.nn}: t ${mmss(d.tN)} nv10 ${d.l10N ?? '-'} nv15 ${d.l15N ?? '-'} derrot/min ${Math.round(d.kN)}`);
  }
}
// Global, todas las partidas
const allR = stats.flatMap(s => s.rows.map((r, k) => ({ r, i: s.inf[k] })));
const grpSum = f => { const x = allR.filter(f); return `${x.length} partidas: t ${mmss(med(x.map(o => o.r.time)))}, ≥30 ${x.filter(o => o.i.reached).length}, nv10 ${med(x.map(o => lvAt(o.r, 10)))}, nv15 ${med(x.map(o => lvAt(o.r, 15)))}, tope ${x.filter(o => o.i.capped).length}`; };
console.log('\nTodas: PM principal evolucionado:', grpSum(o => o.i.mmEvo));
console.log('Todas: PM principal sin evolucionar:', grpSum(o => o.i.mmMain && !o.i.mmEvo));
console.log('Todas: sin PM en el principal:', grpSum(o => !o.i.mmMain));
// Partidas a la par en el min 10 (para no confundir "llega lejos" con "tiene PM")
const ok10 = allR.filter(o => lvAt(o.r, 10) != null);
console.log('Llegan al min 10, nivel min 10: PM evo', med(ok10.filter(o => o.i.mmEvo).map(o => lvAt(o.r, 10))), '| sin PM', med(ok10.filter(o => !o.i.mmMain).map(o => lvAt(o.r, 10))));

if (mdOut) {
  const md = ['# Barrido de Acero — resumen', '',
    `Escenario: todos los Pokémon de tipo Acero (${stats.length}), bot \`best\`, Mejoras al máximo, \`--ban auto\`, semillas 201-210, tope 1900 s. Datos: \`${path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/')}\`.`,
    'Orden: tiempo mediano, luego llegadas al minuto 30. Nivel min 15: mediana entre las partidas que llegan (entre paréntesis cuántas, si no todas). *Nivel min 30: mediana entre las que llegan al 30. Potencia al tope = 40 cartas de Potencia. Puño Meteoro: partidas en que está en el grupo principal / y evolucionado. L = legendario/singular.', '',
    head, ...stats.slice(0, 15).map(line), '',
    '## Todos', '', head, ...stats.map(line), ''];
  fs.writeFileSync(mdOut, md.join('\n'));
  console.log('\n->', mdOut);
}
