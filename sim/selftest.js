#!/usr/bin/env node
/* ============ sim/selftest.js — comprobaciones rápidas del simulador (1-2 min) ============
 * Uso: node sim/selftest.js
 *   - determinismo: misma semilla y mismo bot = partida idéntica
 *   - semillas distintas = partidas distintas
 *   - invariantes: reloj, vida, cartas = niveles subidos, cambios de cartas con su tope
 *   - el entorno falso no rompe la lógica (cámara, performance.now, Banda Focus)
 *   - los atajos de velocidad de load.js dan lo mismo que el código tal cual (SIM_NOPATCH)
 *   - inmortal no cae; en la Sentencia salen legendarios y se cuentan los vencidos
 *   - (19-10-2026) Movimiento inicial, categoría del golpe en hurt, aprender no cambia de hueco
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

console.log('Versión del 19-10-2026: Movimiento inicial, físico/especial, aprender no cambia de hueco');
{
  const { G } = load(1);
  const choices = G.startChoices(94), alt = choices.find(id => id !== G.baseStartOf(94));
  const rs = runOne({ dex: 94, seed: 1, maxTime: 0.1, bot: bot(), upgrades: { start: 1 }, start: alt });
  ok(rs.moves[0].split(':')[0] === alt, `Movimiento inicial con la mejora: empieza con ${alt}`);
  const rn = runOne({ dex: 94, seed: 1, maxTime: 0.1, bot: bot(), start: alt });
  ok(rn.moves[0].split(':')[0] === G.baseStartOf(94), 'sin la mejora: el de serie (o.start se ignora)');
  // El envoltorio de hurt (engine.js) tiene que pasar la categoría del golpe (4.º argumento).
  let dP = 0, dS = 0, act = null;
  const hb = Object.assign(bot(), { init(api) {
    const pl = api.pl, h = (cat) => { pl.invuln = 0; const b = pl.hp; pl.hurt(10, null, false, cat); const d = b - pl.hp; pl.hp = b; return d; };
    dP = h('physical'); dS = h('special');
    pl.addMove(G.Moves.poolFor(pl.mon).find(id => !pl.hasMove(id)));
    act = pl.active;
  } });
  runOne({ dex: 113, seed: 1, maxTime: 0.1, bot: hb });
  const want = G.Stats.taken(G.DEX_BY[113], 'physical') / G.Stats.taken(G.DEX_BY[113], 'special');
  ok(dS > 0 && Math.abs(dP / dS - want) < 0.02, `hurt con categoría: Chansey recibe ×${(dP / dS).toFixed(2)} de un físico que de un especial (código: ×${want.toFixed(2)})`);
  ok(act === 0, 'aprender un movimiento no lo pone activo');
}

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

console.log('Versión del 21-10-2026: naturaleza, habilidad, MT y 2.º movimiento inicial');
{
  // Bot que se guarda el jugador al empezar (init) para mirarlo.
  const grab = () => { const b = bot(); const box = {}; b.init = api => { box.pl = api.pl; box.G = api.G; }; return [b, box]; };
  let [b, box] = grab();
  runOne({ dex: 376, seed: 1, maxTime: 0.1, bot: b, nature: 'adamant' });
  const base = box.G.DEX_BY[376];
  ok(Math.abs(box.pl.mon.pa - base.pa * 1.1) < 1e-9 && Math.abs(box.pl.mon.sa - base.sa * 0.9) < 1e-9,
    'Firme (adamant): Ataque ×1,1 y At. Esp. ×0,9 en una copia (G.DEX_BY sin tocar)');
  ok(box.pl.abilId === box.G.DEX_ABIL[376][0], `habilidad por defecto: la 1.ª (${box.pl.abilId})`);
  [b, box] = grab();
  runOne({ dex: 376, seed: 1, maxTime: 0.1, bot: b, abil: 'none' });
  ok(box.pl.abil === null && box.pl.mon.nature === 'serious', "abil 'none': sin habilidad; naturaleza por defecto neutra");
  // Sebo (thick-fat, Snorlax): el Fuego le hace ×0,6 (inMul en Player.hurt).
  const fire = abil => {
    const [b2, bx] = grab();
    runOne({ dex: 143, seed: 1, maxTime: 0.1, bot: b2, abil });
    const pl = bx.pl; pl.invuln = 0; const h0 = pl.hp; pl.hurt(50, 'fire', false, 'special'); return h0 - pl.hp;
  };
  const kf = fire('thick-fat') / fire('none');
  ok(Math.abs(kf - 0.6) < 0.02, `Sebo: el Fuego hace ×${kf.toFixed(2)} (código: ×0,6)`);
  // MT: un ataque que no es de sus tipos vale de movimiento inicial (G.startChoices).
  const { G: G0 } = load(1);
  const tm = G0.TM_OF(376).find(id => G0.Moves.BY_ID[id] && G0.Moves.BY_ID[id].kind !== 'buff' && !G0.Moves.poolFor(G0.DEX_BY[376], true).includes(id));
  const rt = runOne({ dex: 376, seed: 1, maxTime: 0.1, bot: bot(), upgrades: { start: 1 }, tms: [tm], start: tm });
  ok(rt.moves[0].startsWith(tm + ':'), `MT ${tm}: se puede empezar con él`);
  // 2.º movimiento inicial (mejora start2 con Repertorio).
  const alt = G0.startChoices(376).find(id => id !== G0.startMoveOf(376));
  const r2 = runOne({ dex: 376, seed: 1, maxTime: 0.1, bot: bot(), upgrades: { moves: 1, start2: 1 }, start2: alt });
  ok(r2.moves.some(m => m.startsWith(alt + ':')), `Segundo movimiento inicial: empieza con ${alt}`);
}

console.log(`\n${fails ? fails + ' FALLOS' : 'Todo bien'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
