#!/usr/bin/env node
/* ============ sim/offerodds.js — probabilidad de que salga cada carta (código real de levelup.js) ============
 * Monte Carlo de G.LevelUp.offer con estados de jugador típicos (Gengar). Sin partida: sólo el sorteo.
 *   node sim/offerodds.js [N]
 */
const { load } = require('./load');
const { G } = load(1);
const N = +process.argv[2] || 20000;
const mon = G.DEX_BY[94];
const mv = (id, lvl, evo) => { const m = G.Moves.instance(id, lvl); if (evo) G.Moves.evolve(m); return m; };
function fake(groups, statsTaken) {
  const slots = groups.map(g => g.map(([id, l, e]) => mv(id, l, e)));
  const moves = slots.flat();
  return { mon, slots, moves, maxMoves: 4, banned: new Set(['agility', 'substitute', 'toxic']), statsTaken: Object.assign({ cd: 1, atk: 1, rgn: 1, hp: 1, spd: 1, mag: 1, def: 1, xp: 1 }, statsTaken || {}),
           hasMove(id) { return moves.some(m => m.id === id); } };
}
const MAX = { spd: 8, mag: 6, xp: 8, cd: 10, def: 12 };
const S = {
  'A 2 huecos libres, 2 mov. sin subir': [[['shadow-ball', 3]], [['toxic-spikes', 2]]],
  'B 1 hueco libre, 3 sin subir': [[['shadow-ball', 3]], [['toxic-spikes', 2]], [['lick', 1]]],
  'C 4 llenos, 4 sin subir': [[['shadow-ball', 3]], [['toxic-spikes', 2]], [['lick', 1]], [['hex', 1]]],
  'D 4 llenos, grupo hecho + 3 sueltos sin subir': [[['shadow-ball', 5, 1], ['toxic-spikes', 5, 1], ['swords-dance', 5], ['harden', 5]], [['lick', 1]], [['hex', 1]], [['sludge', 2]]],
  'E 4 llenos, 1 sin subir': [[['shadow-ball', 5, 1], ['toxic-spikes', 5, 1], ['swords-dance', 5], ['harden', 5]], [['lick', 5, 1]], [['hex', 5, 1]], [['sludge', 2]]],
  'F 4 llenos, todo al máximo': [[['shadow-ball', 5, 1], ['toxic-spikes', 5, 1], ['swords-dance', 5], ['harden', 5]], [['lick', 5, 1]], [['hex', 5, 1]], [['sludge', 5, 1]]],
  'G = F tras un vínculo de más (1 hueco libre)': [[['shadow-ball', 5, 1], ['toxic-spikes', 5, 1], ['swords-dance', 5], ['harden', 5]], [['lick', 5, 1], ['hex', 5, 1]], [['sludge', 5, 1]]],
  'H = F con Carrera, Imán y Aprendizaje al tope': ['F', { spd: 8, mag: 6, xp: 8 }],
  'I = F con Carrera, Imán, Aprendizaje, Reflejos y Coraza al tope': ['F', MAX]
};
const rows = [];
for (const name in S) {
  let def = S[name], st = null;
  if (typeof def[0] === 'string') { st = def[1]; def = S[Object.keys(S).find(k => k.startsWith(def[0]))]; }
  const cnt = {}; let pot = 0, potR = 0;
  for (let i = 0; i < N; i++) {
    const pl = fake(def, st);
    const o = G.LevelUp.offer(pl);
    const has = o.some(c => c.key === 'stat:atk');
    if (has) pot++;
    // con un cambio de cartas si no sale
    if (has || G.LevelUp.offer(pl).some(c => c.key === 'stat:atk')) potR++;
    for (const c of o) { const t = c.key.split(':')[0]; cnt[t] = (cnt[t] || 0) + 1; }
  }
  rows.push([name, (100 * pot / N).toFixed(1) + ' %', (100 * potR / N).toFixed(1) + ' %',
    ['new', 'up', 'stat', 'evo'].map(t => ((cnt[t] || 0) / N).toFixed(2)).join(' / ')]);
}
console.log('estado | Potencia en la tanda | con 1 cambio | cartas por tanda new/up/stat/evo');
for (const r of rows) console.log(r.join(' | '));
