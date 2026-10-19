#!/usr/bin/env node
/* ============ sim/movecards.js — ficha de los ataques (tabla en Markdown) ============
 * Uso: node sim/movecards.js [--new] [--only id,id] [--single sim/out/move-dps-1.json] [--sort evo]
 *
 * Por ataque: tipo, forma (kind), físico/especial, recarga, daño base, evolución y la stat
 * que pide, y el daño/s medido (sim/bots/move-dps.json, horda de 15 enemigos inmortales, por
 * unidad del ataque con el que pega) a nivel 1, al máximo y evolucionado. Con --single (una
 * tabla hecha con calib-moves.js --n 1) añade el daño a un solo enemigo y la proporción
 * horda / uno solo: cuánto "reparte" el ataque. `--new` = sólo los 38 del 19-10-2026.
 * Las cifras son por unidad de ataque: para comparar Pokémon hay que multiplicar por su
 * Ataque o At. Esp. (y ×1,2 si es monotipo del tipo del ataque).
 */
const fs = require('fs'), path = require('path');
const { load } = require('./load');

const a = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) {
  const k = process.argv[i].slice(2), v = process.argv[i + 1];
  a[k] = v && !v.startsWith('--') ? (i++, v) : true;
}
const { G } = load(1);
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'bots', 'move-dps.json'), 'utf8'));
const S = a.single && fs.existsSync(a.single) ? JSON.parse(fs.readFileSync(a.single, 'utf8')) : null;
// Los 38 nuevos: los que van detrás de Infortunio (el último de antes) en G.Moves.ALL.
const iHex = G.Moves.ALL.findIndex(m => m.id === 'hex');
const NEW = new Set(G.Moves.ALL.slice(iHex + 1).map(m => m.id).filter(id => id !== 'nasty-plot'));
let ids = G.Moves.ALL.filter(m => m.kind !== 'buff').map(m => m.id);
if (a.new) ids = ids.filter(id => NEW.has(id));
if (a.only) ids = String(a.only).split(',');
const KIND = { homing: 'persigue', bounce: 'rebota', charge: 'carga (rayo)', spin: 'giro', quake: 'onda por el suelo',
  vortex: 'remolino', shove: 'empujón', stun: 'aturdir', melee: 'cuerpo a cuerpo', dash: 'embestida', cone: 'abanico',
  orbit: 'órbita', projectile: 'proyectil', beam: 'rayo', nova: 'nova', aura: 'aura', boomerang: 'bumerán', chain: 'cadena',
  mine: 'minas', meteor: 'meteoros', turret: 'torreta', trail: 'rastro' };
const STAT = { atk: 'Potencia', cd: 'Reflejos', spd: 'Carrera', def: 'Coraza', hp: 'Vigor', rgn: 'Síntesis', mag: 'Imán', xp: 'Aprendizaje' };
const f0 = x => x == null ? '-' : Math.round(x).toString();
const rows = ids.map(id => {
  const d = G.Moves.BY_ID[id], t = T[id] || { lv: [] }, s = S && S[id];
  const ev = G.Moves.EVO[id];
  const lv = t.lv || [], evo = lv[lv.length - 1], max = lv[lv.length - 2];
  const sEvo = s ? s.lv[s.lv.length - 1] : null;
  return { id, d, ev, l1: lv[0], max, evo, sEvo, ratio: sEvo ? evo / sEvo : null };
});
if (a.sort) rows.sort((x, y) => (y[a.sort] || 0) - (x[a.sort] || 0));
const head = ['ataque', 'id', 'tipo', 'forma', 'cat.', 'recarga', 'daño', 'evolución (pide)', 'horda nv1', 'horda máx', 'horda evo', ...(S ? ['1 solo evo', 'horda/1'] : []), 'nuevo'];
console.log('| ' + head.join(' | ') + ' |');
console.log('|' + head.map(() => '---').join('|') + '|');
for (const r of rows) {
  const d = r.d;
  console.log('| ' + [d.name, r.id, G.U.TYPE_NAME[d.type] || d.type, KIND[d.kind] || d.kind, d.cat === 'physical' ? 'físico' : 'especial',
    d.cd + ' s', d.dmg, r.ev ? `${r.ev[0]} (${STAT[r.ev[1]] || r.ev[1]})` : '-', f0(r.l1), f0(r.max), f0(r.evo),
    ...(S ? [f0(r.sEvo), r.ratio ? r.ratio.toFixed(1) : '-'] : []), NEW.has(r.id) ? 'sí' : ''].join(' | ') + ' |');
}
