#!/usr/bin/env node
/* ============ sim/selftest.js — comprobaciones rápidas del simulador (1-2 min) ============
 * Uso: node sim/selftest.js
 *   - determinismo: misma semilla y mismo bot = partida idéntica
 *   - semillas distintas = partidas distintas
 *   - invariantes: reloj, vida, cartas = niveles subidos, cambios de cartas con su tope
 *   - el entorno falso no rompe la lógica (cámara, performance.now, Banda Focus)
 *   - los atajos de velocidad de load.js dan lo mismo que el código tal cual (SIM_NOPATCH)
 *   - inmortal no cae; en la Sentencia salen legendarios y se cuentan los vencidos
 */
const { runOne } = require('./engine');
const { load } = require('./load');
const flee = require('./bots/flee');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FALLO ') + msg); if (!cond) fails++; };

// Bot de prueba: huye (flee) y coge siempre la 1.ª carta; si `rr`, cambia las cartas siempre que pueda.
function bot(rr = false) {
  const b = flee();
  return Object.assign({}, b, { name: rr ? 'test-rr' : 'test', reroll: rr ? () => true : undefined });
}

const t0 = Date.now();

console.log('Entorno falso');
{
  const { ctx, G } = load(1);
  ok(ctx.performance.now() > 60000, 'performance.now() empieza lejos de 0 (Banda Focus usable desde el principio)');
  G.Camera.resize(1280, 720, 1);
  ok(Math.abs(G.Camera.w - 768) < 1 && Math.abs(G.Camera.h - 432) < 1, 'vista de la cámara 768×432 como en 16:9');
  ok(G.Coop && G.Coop.active === false, 'cooperativo inactivo');
  ok(typeof G.Settings.get('calm') === 'boolean', 'ajustes reales (no un agujero)');
}

console.log('Determinismo');
const opts = { dex: 94, seed: 7, maxTime: 150, upgrades: 'max' };
let trace1 = [];
const a = runOne(Object.assign({}, opts, { bot: bot(), trace: t => trace1.push(t) }));
const b = runOne(Object.assign({}, opts, { bot: bot() }));
ok(JSON.stringify(a) === JSON.stringify(b), `semilla 7 dos veces: idéntica (${a.time}s nv${a.level} ${a.kills} derrotados)`);
const c = runOne(Object.assign({}, opts, { seed: 8, bot: bot() }));
ok(JSON.stringify(a) !== JSON.stringify(c), 'semilla 8: distinta');

console.log('Invariantes');
for (const r of [a, c]) {
  ok(r.time <= opts.maxTime && r.time >= 0, `reloj dentro del tope (${r.time}s)`);
  ok(r.cards.length + r.pendingLevels === r.level - 1, `una carta por nivel subido (${r.cards.length} + ${r.pendingLevels} pendientes = nv${r.level} - 1)`);
  ok(r.dead || r.time >= opts.maxTime - 1, 'acaba por caer o por el tope');
}
ok(trace1.every(t => t.hp <= t.max + 1e-6 && t.hp >= 0), 'vida siempre entre 0 y el máximo');
ok(trace1.length >= Math.floor(a.timeExact) - 1, 'trace una vez por segundo');

console.log('Cambios de cartas');
const r0 = runOne({ dex: 94, seed: 3, maxTime: 150, bot: bot(true) });
ok(r0.rerolls === (r0.cards.length ? 1 : 0), `sin mejoras: 1 cambio gratis (${r0.rerolls})`);
const r5 = runOne({ dex: 94, seed: 3, maxTime: 150, bot: bot(true), upgrades: { reroll: 5 } });
ok(r5.rerolls === (r5.cards.length ? 6 : 0), `con 5 de Cambio de cartas: 6 (${r5.rerolls})`);

console.log('Repertorio, Veto y paso de 1/60');
const pool = (() => { const { G } = load(1); return G.Moves.poolFor(G.DEX_BY[94]).filter(id => G.Moves.BY_ID[id].kind !== 'buff' && id !== G.startMoveOf(94)); })();
const ban = pool.slice(0, 3);                      // Veto 3: estos tres no pueden salir de 2.º
let banOk = true, two = true;
for (let seed = 1; seed <= 6; seed++) {
  const rb = runOne({ dex: 94, seed, maxTime: 0.1, bot: bot(), upgrades: { moves: 1, ban: 3 }, ban });
  const ids = rb.moves.map(s => s.split(':')[0]);
  if (ids.length !== 2) two = false;
  if (ban.includes(ids[1])) banOk = false;
}
ok(two, 'Repertorio: empieza con 2 movimientos');
ok(banOk, `Veto: el 2.º movimiento nunca es uno vetado (${ban.join(', ')}; ${pool.length} posibles)`);
const r60 = runOne({ dex: 94, seed: 7, maxTime: 30, bot: bot(), dt: 1 / 60 });
ok(r60.frames >= 30 * 60 - 2, `dt 1/60: ${r60.frames} fotogramas en 30 s`);

console.log('Atajos de velocidad (load.js) = código tal cual');
{
  const { patched } = require('./load');
  const names = patched();
  ok(names.length > 0, `atajos aplicados: ${names.join(', ') || 'ninguno (¿ha cambiado el juego?)'}`);
  // La misma partida con y sin atajos (SIM_NOPATCH=1 en otro proceso) tiene que ser idéntica.
  const { spawnSync } = require('child_process');
  const code = `const { runOne } = require(${JSON.stringify(__dirname + '/engine')}); const flee = require(${JSON.stringify(__dirname + '/bots/flee')});
    const r = runOne({ dex: 68, seed: 5, maxTime: 200, upgrades: 'max', immortal: true, bot: flee() }); delete r.frames; process.stdout.write(JSON.stringify(r));`;
  const run = env => spawnSync(process.execPath, ['-e', code], { env: Object.assign({}, process.env, env), encoding: 'utf8', maxBuffer: 1 << 26 }).stdout;
  const p1 = run({ SIM_NOPATCH: '' }), p0 = run({ SIM_NOPATCH: '1' });
  ok(p1 && p1 === p0, `con y sin atajos: idéntica (${p1 ? JSON.parse(p1).time + 's nv' + JSON.parse(p1).level : 'sin salida'})`);
}

console.log('Inmortal y Sentencia');
{
  // Inmortal con Banda Focus: nunca cae, la vida no baja de lo que tenía y apunta vidas.
  let minHp = Infinity;
  const ri = runOne({ dex: 4, seed: 2, maxTime: 240, upgrades: 'max', immortal: true, item: 'focussash', bot: bot(), trace: t => { minHp = Math.min(minHp, t.hp); } });
  ok(!ri.dead && ri.time >= 239, `inmortal: llega al tope sin caer (${ri.time}s, ${ri.lives} vidas)`);
  ok(ri.lives > 0 && minHp > 0, 'inmortal: el daño se apunta y la vida nunca llega a 0');
  // La Sentencia ya (debugStart): salen legendarios y los vencidos se cuentan (Progress.kill -> bossDown).
  const jb = Object.assign(bot(), { init(api) { api.G.Judgment.debugStart(); } });
  const rj = runOne({ dex: 94, seed: 4, maxTime: 60, upgrades: 'max', immortal: true, bot: jb });
  const j = rj.judge;
  ok(j && j.spawned >= 5, `Sentencia: salen legendarios (${j ? j.spawned : 0} en ${j ? Math.round(j.time) : 0} s)`);
  ok(j && j.bosses === j.log.filter(x => x.down != null).length && j.bosses > 0, `Sentencia: se cuentan los vencidos (${j ? j.bosses : 0})`);
}

console.log(`\n${fails ? fails + ' FALLOS' : 'Todo bien'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
