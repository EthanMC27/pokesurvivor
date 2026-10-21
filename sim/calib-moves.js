#!/usr/bin/env node
/* ============ sim/calib-moves.js — daño real de cada movimiento por nivel ============
 *
 * Mide, con el código real de combate, el daño DIRECTO por segundo de cada
 * movimiento a cada nivel (1..máx y evolucionado), por unidad de ataque:
 *   - jugador invulnerable y enemigos inmortales (se mide el ritmo, sin "sobredaño")
 *   - siempre N enemigos alrededor (se rellena con G.Spawner.burst)
 *   - tabla de tipos y clima neutros (×1) y, desde el 19-10-2026, también las defensas de
 *     los enemigos (G.Stats.taken = 1) y el ataque del movimiento (Player.atkFor: físico o
 *     especial y el +20 % de monotipo; Ditto es Normal puro): la tabla es por unidad del
 *     ataque con el que pega ESE movimiento. cards.js pone la categoría, el monotipo y la
 *     defensa media de los enemigos aparte.
 *   - el jugador se mueve rodeando a la horda a la distancia que pide el ataque
 * El veneno y la quemadura NO se cuentan (cards.js los modela aparte: el veneno
 * quita un % de la vida y vale más cuanto más dura la partida).
 *
 * Uso: node sim/calib-moves.js [--n 30] [--secs 40] [--seeds 1-2] [--jobs 3] [--only id,id] [--out f.json]
 * Escribe sim/bots/move-dps.json (o --out): { id: { kind, lv: [dps nv1, nv2, ..., evolucionado|null] } }
 * Con --n 1: daño a un solo enemigo (para comparar área frente a uno solo; sim/movecards.js).
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs');

const WARM = 6;     // segundos de llenado antes de medir

if (!isMainThread) {
  const { runOne } = require('./engine');
  const { id, lvl, evo, n, secs, seed } = workerData;
  let t0 = null, d0 = 0, atk = 1, res = null;
  const bot = {
    name: 'calib',
    init({ G, pl }) {
      G.Types.mult = () => 1;
      G.Weather.mult = () => 1;
      G.Stats.taken = () => 1;
      const proto = G.Enemy.prototype, hurt0 = proto.hurt;
      proto.hurt = function (...a) { hurt0.apply(this, a); if (this.dead && !this.boss) { this.dead = false; this.fade = 0; } this.hp = this.maxHp; };
      pl.hurt = () => {};
      const m = pl.moves[0];
      for (let i = 1; i < lvl; i++) G.Moves.levelUp(m);
      if (evo) G.Moves.evolve(m);
      atk = pl.atkFor(m);           // (sin danzas: Ditto no tiene ninguna activa)
    },
    move({ G, pl, time }) {
      if (G.EnemyMgr.count < n) G.Spawner.burst(Math.min(6, n - G.EnemyMgr.count));
      if (time >= WARM && t0 == null) { t0 = time; d0 = pl.dmgDealt; }
      if (t0 != null) res = { dps: (pl.dmgDealt - d0) / Math.max(1e-6, time - t0) / atk };
      // Distancia buscada al enemigo más cercano según el ataque.
      const m = pl.moves[0];
      const want = { melee: m.radius * 0.6, dash: m.radius * 0.7, beam: m.radius * 0.6, cone: m.speed * m.life * 0.6,
                     boomerang: m.radius * 0.6, chain: 150, meteor: 160, projectile: 170, nova: 90,
                     aura: m.radius * 0.5, orbit: m.radius * 0.8, trail: 60, mine: 70, turret: 120,
                     // formas nuevas (19-10-2026)
                     homing: 170, bounce: 150, charge: m.radius * 0.6, spin: m.radius * 0.6, shove: m.radius * 0.5,
                     quake: (m.count | 0) * 34 * 0.5, vortex: 150, stun: 150 }[m.kind] || 120;
      let near = null, nd = Infinity, cx = 0, cy = 0, k = 0;
      for (const e of G.EnemyMgr.all()) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - pl.x, e.y - pl.y);
        if (d < nd) { nd = d; near = e; }
        if (d < 400) { cx += e.x; cy += e.y; k++; }
      }
      if (!near) return [0, 0];
      cx /= k; cy /= k;
      const ux = (cx - pl.x) / (Math.hypot(cx - pl.x, cy - pl.y) || 1), uy = (cy - pl.y) / (Math.hypot(cx - pl.x, cy - pl.y) || 1);
      const r = Math.max(-1, Math.min(1, (nd - want) / 40));
      return [ux * r - uy * 0.7, uy * r + ux * 0.7];
    },
    card(cards) {
      const ok = ['stat:mag', 'stat:heal', 'stat:hp', 'stat:rgn', 'stat:def', 'stat:xp'];
      let i = cards.findIndex(c => ok.includes(c.key));
      if (i < 0) i = cards.findIndex(c => c.type === 'new');
      if (i < 0) i = cards.findIndex(c => c.type === 'stat' && c.key !== 'stat:atk' && c.key !== 'stat:cd');
      return Math.max(0, i);
    },
    active: () => 0,
    item: cur => cur
  };
  runOne({ dex: 132, seed, bot, start: id, forceStart: true, abil: 'none', maxTime: WARM + secs });   // sin habilidad (21-10-2026)
  parentPort.postMessage({ id, lvl, evo, seed, dps: res ? res.dps : 0 });
  return;
}

function parseArgs(a) {
  const o = {};
  for (let i = 2; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
  return o;
}
function range(s) { const out = []; for (const part of String(s).split(',')) { const [a, b] = part.split('-').map(Number); for (let i = a; i <= (b || a); i++) out.push(i); } return out; }

(async () => {
  const a = parseArgs(process.argv);
  const { load } = require('./load');
  const { G } = load(1);
  const n = +a.n || 30, secs = +a.secs || 40, seeds = range(a.seeds || '1-2'), jobsN = +a.jobs || 3;
  const only = a.only ? String(a.only).split(',') : null;
  const jobs = [];
  for (const m of G.Moves.ALL) {
    if (m.kind === 'buff' || (only && !only.includes(m.id))) continue;
    const max = G.Moves.BY_ID[m.id].maxLvl;
    for (let lvl = 1; lvl <= max; lvl++) for (const seed of seeds) jobs.push({ id: m.id, lvl, evo: false, n, secs, seed });
    if (G.Moves.EVO[m.id]) for (const seed of seeds) jobs.push({ id: m.id, lvl: max, evo: true, n, secs, seed });
  }
  const out = {};
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: jobsN }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      const r = await new Promise(res => {
        const w = new Worker(__filename, { workerData: j });
        w.once('message', res); w.once('error', e => res({ id: j.id, lvl: j.lvl, evo: j.evo, dps: NaN, err: String(e) }));
      });
      if (r.err) console.error(r.id, r.lvl, r.err.split('\n')[0]);
      const e = out[r.id] = out[r.id] || { kind: G.Moves.BY_ID[r.id].kind, acc: {} };
      const k = r.evo ? 'evo' : r.lvl;
      (e.acc[k] = e.acc[k] || []).push(r.dps);
      if (++done % 20 === 0) console.log(`${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
  }));
  const file = a.out ? path.resolve(a.out) : path.join(__dirname, 'bots', 'move-dps.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const mean = v => v.reduce((x, y) => x + y, 0) / v.length;
  for (const id in out) {
    const e = out[id], max = G.Moves.BY_ID[id].maxLvl, lv = [];
    for (let l = 1; l <= max; l++) lv.push(+mean(e.acc[l]).toFixed(2));
    lv.push(e.acc.evo ? +mean(e.acc.evo).toFixed(2) : null);
    prev[id] = { kind: e.kind, lv };
  }
  prev._meta = { n, secs, seeds, note: 'daño directo/s por unidad de ataque, enemigos inmortales, tipos neutros' };
  fs.writeFileSync(file, JSON.stringify(prev, null, 1));
  for (const id in out) console.log(id.padEnd(16), prev[id].kind.padEnd(10), prev[id].lv.join('  '));
})();
