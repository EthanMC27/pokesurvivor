#!/usr/bin/env node
/* ============ sim/screenreport.js — criba de bola de nieve (nivel en el minuto 15) ============
 * Uso: node sim/screenreport.js sim/out/v5/screen.jsonl [--top 40] [--min 15] [--dex-out f.txt]
 *
 * Por Pokémon: nivel en el minuto `min` (media de las semillas; una partida muerta antes cuenta
 * con el nivel con el que cayó, así que morir pronto penaliza), cuántas llegan vivas a ese minuto,
 * derrotados, tipos, rareza, monotipo, físico/especial y el grupo principal (hueco con más nivel).
 * --dex-out escribe los `top` mejores (lista separada por comas) para la ronda siguiente.
 */
const fs = require('fs');
const { load } = require('./load');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = args.find(x => !x.startsWith('--') && !(args[args.indexOf(x) - 1] || '').startsWith('--'));
const top = +opt('--top', 40), M = +opt('--min', 15);
const { G } = load(1);
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => !r.error);
const by = {};
for (const r of rows) (by[r.dex] = by[r.dex] || []).push(r);
const lvAt = r => (r.curve[M - 1] ? r.curve[M - 1].lv : r.level);
const out = [];
for (const dex in by) {
  const rs = by[dex], p = G.DEX_BY[dex];
  const lv = rs.reduce((a, r) => a + lvAt(r), 0) / rs.length;
  const alive = rs.filter(r => r.time >= M * 60 - 1).length;
  const kills = rs.reduce((a, r) => a + (r.curve[M - 1] ? r.curve[M - 1].kills : r.kills), 0) / rs.length;
  // Grupo principal: el hueco con más niveles (evolucionado = +3).
  const main = r => r.moves.map(s => ({ s, v: s.split('+').reduce((a, x) => a + (parseInt(x.split(':')[1]) || 0) + (x.endsWith('*') ? 3 : 0), 0) }))
    .sort((a, b) => b.v - a.v)[0];
  const g = rs.map(r => { const m = main(r); return m ? m.s.split('+').map(x => x.split(':')[0]).sort().join('+') : ''; });
  out.push({ dex: +dex, name: p.name, types: p.types.join('/'), rar: p.rarity, leg: p.leg ? 'leg' : '', mono: p.types.length === 1 ? 'mono' : '',
             side: G.Stats.sideOf(p) === 'special' ? 'esp' : 'fís', lv, alive, n: rs.length, kills, grp: g[0] });
}
out.sort((a, b) => b.lv - a.lv);
console.log(`| # | Pokémon | dex | tipos | rareza | lado | nivel min ${M} | vivos | derrotados | grupo principal (1.ª semilla) |`);
console.log('|---|---|---|---|---|---|---|---|---|---|');
out.slice(0, top).forEach((r, i) => console.log(`| ${i + 1} | ${r.name} | ${r.dex} | ${r.types}${r.mono ? ' (mono)' : ''} | ${r.rar}${r.leg ? ' leg.' : ''} | ${r.side} | ${r.lv.toFixed(1)} | ${r.alive}/${r.n} | ${Math.round(r.kills)} | ${r.grp} |`));
const allLv = out.map(r => r.lv).sort((a, b) => a - b);
console.log(`\n${out.length} Pokémon; nivel min ${M}: mediana ${allLv[allLv.length >> 1].toFixed(1)}, p90 ${allLv[Math.floor(allLv.length * 0.9)].toFixed(1)}`);
// Por movimiento principal del grupo: cuántos del top usan cada uno.
const cnt = {};
for (const r of out.slice(0, top)) for (const id of r.grp.split('+')) cnt[id] = (cnt[id] || 0) + 1;
console.log('En el top ' + top + ':', Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} ${v}`).join(', '));
if (opt('--dex-out')) fs.writeFileSync(opt('--dex-out'), out.slice(0, top).map(r => r.dex).join(','));
