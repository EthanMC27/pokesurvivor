#!/usr/bin/env node
/* ============ sim/xpaudit.js — ¿cuánta experiencia se deja el bot en el suelo? ============
 *
 * Uso: node sim/xpaudit.js --bot pa-f --dex 94,4,68,9 --seeds 1-10 [--max 1800] [--jobs 4]
 *        [--opts '{...}'] [--ban auto] [--json f]
 *
 * Envuelve al bot (sin cambiar nada del juego ni del bot) y mide por minuto:
 *   drop     experiencia soltada (G.Pickups.dropXp: enemigos, jefes, rocas, cofres)
 *   got      experiencia recogida (orbes 'xp'/'xpBig' que llegan al jugador)
 *   ground   experiencia en el suelo al cerrar el minuto (y la que está a > 420 px)
 *   magnets  imanes soltados / cogidos;  heal: bayas soltadas / cogidas
 *   altars   altares vistos (a < 450 px alguna vez) / usados (poder)
 *   chests   cofres con candado vistos / abiertos
 * Los orbes no caducan (al pasar de 420 objetos se fusionan los más viejos, sin perder
 * valor): lo que no se recoge es experiencia aplazada, no perdida... salvo al morir.
 */
const { Worker, isMainThread, parentPort } = require('worker_threads');
const path = require('path'), fs = require('fs');
const BOTS = path.join(__dirname, 'bots');

function wrapBot(bot) {
  const A = { drop: 0, dropEnemy: 0, got: 0, mags: [0, 0], heals: [0, 0], bombs: [0, 0], items: [0, 0],
              altarSeen: new Set(), altarUsed: 0, chestSeen: new Set(), chestOpen: 0, springSeen: new Set(),
              min: [], maxId: 0, powers: {} };
  let G = null, pl = null, nextMin = 60;
  const init0 = bot.init, move0 = bot.move;
  bot.init = api => {
    G = api.G; pl = api.pl;
    const dx0 = G.Pickups.dropXp;
    G.Pickups.dropXp = function (x, y, v, boss) { if (boss) A.drop += Math.ceil(v / 14) * 14; else A.drop += v; return dx0.apply(this, arguments); };
    const up0 = G.Pickups.update;
    G.Pickups.update = function (dt, ps, cb) {
      return up0.call(this, dt, ps, (p, who) => {
        if (p.kind === 'xp' || p.kind === 'xpBig') A.got += p.value;
        else if (p.kind === 'magnet') A.mags[1]++;
        else if (p.kind === 'heal') A.heals[1]++;
        else if (p.kind === 'bomb') A.bombs[1]++;
        else if (p.kind === 'item') A.items[1]++;
        return cb(p, who);
      });
    };
    const ap0 = pl.addPower;
    pl.addPower = function (pw) { A.altarUsed++; A.powers[pw.id] = (A.powers[pw.id] || 0) + 1; return ap0.apply(this, arguments); };
    const bp0 = G.World.breakProp;
    G.World.breakProp = function (p) { if (p && p.type === 'bigchest') A.chestOpen++; return bp0.apply(this, arguments); };
    if (init0) init0.call(bot, api);
  };
  bot.move = api => {
    const t = api.time;
    for (const p of G.Pickups.all()) if (p.id > A.maxId) {
      A.maxId = p.id;
      if (p.kind === 'magnet') A.mags[0]++; else if (p.kind === 'heal') A.heals[0]++; else if (p.kind === 'bomb') A.bombs[0]++; else if (p.kind === 'item') A.items[0]++;
    }
    for (const s of G.World.specialsNear(pl.x, pl.y, 450)) {
      if (s.type === 'altar') A.altarSeen.add(s.id || (s.x + ',' + s.y));
      else if (s.type === 'bigchest') A.chestSeen.add(s.id || (s.x + ',' + s.y));
      else if (s.type === 'spring') A.springSeen.add(s.id || (s.x + ',' + s.y));
    }
    if (t >= nextMin) {
      nextMin += 60;
      let ground = 0, far = 0;
      for (const p of G.Pickups.all()) if (p.kind === 'xp' || p.kind === 'xpBig') {
        ground += p.value;
        if (Math.hypot(p.x - pl.x, p.y - pl.y) > 420) far += p.value;
      }
      A.min.push({ m: A.min.length + 1, drop: Math.round(A.drop), got: Math.round(A.got), ground: Math.round(ground), far: Math.round(far),
                   lv: pl.level, kills: pl.kills, mag: A.mags.slice(), altars: [A.altarSeen.size, A.altarUsed], chests: [A.chestSeen.size, A.chestOpen] });
    }
    return move0.call(bot, api);
  };
  bot.audit = () => ({ drop: Math.round(A.drop), got: Math.round(A.got), mags: A.mags, heals: A.heals, bombs: A.bombs, items: A.items,
    altars: [A.altarSeen.size, A.altarUsed], powers: A.powers, chests: [A.chestSeen.size, A.chestOpen], springs: A.springSeen.size, min: A.min });
  return bot;
}

if (!isMainThread) {
  parentPort.on('message', job => {
    try {
      const { runOne } = require('./engine');
      for (const k of Object.keys(require.cache)) if (k.startsWith(BOTS)) delete require.cache[k];
      const bot = wrapBot(require(path.join(BOTS, job.bot))(job.botOpts || {}));
      const r = runOne({ dex: job.dex, seed: job.seed, bot, upgrades: 'max', maxTime: job.maxTime, ban: job.ban });
      r.audit = bot.audit(); r.botStats = bot.stats || null;
      delete r.cards;
      parentPort.postMessage(r);
    } catch (e) { parentPort.postMessage({ error: String(e && e.stack || e), job }); }
  });
  return;
}

const { runJobs: _unused, range } = require('./run');
const a = {}; for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) { const k = process.argv[i].slice(2); a[k] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const bot = a.bot || 'pa-f';
const dexs = String(a.dex || '94,4,68,9').split(',').map(Number);
const seeds = range(a.seeds || '1-8');
const botMod = require(path.join(BOTS, bot));
const jobs = [];
for (const dex of dexs) {
  let ban;
  if (a.ban !== 'none' && botMod.bans) { const { load } = require('./load'); ban = typeof botMod.bans === 'function' ? botMod.bans(dex, load(1).G) : botMod.bans; }
  for (const seed of seeds) jobs.push({ dex, seed, bot, botOpts: a.opts ? JSON.parse(a.opts) : {}, maxTime: +a.max || 1800, ban });
}
const out = [];
let next = 0;
const lane = () => new Promise(res => {
  const w = new Worker(__filename);
  const go = () => { if (next >= jobs.length) { w.terminate(); return res(); } w.postMessage(jobs[next++]); };
  w.on('message', r => { out.push(r); if (!a.quiet) process.stderr.write('.'); go(); });
  go();
});
Promise.all(Array.from({ length: +a.jobs || 4 }, lane)).then(() => {
  if (a.json) fs.writeFileSync(a.json, JSON.stringify(out));
  const ok = out.filter(r => !r.error);
  for (const r of out.filter(r => r.error)) console.log('ERROR', r.error.split('\n')[0]);
  console.log('\nPor minuto (todas las partidas vivas en ese minuto): drop/got = experiencia soltada/recogida en el minuto; suelo = en el suelo al cerrar (lejos = a > 420 px)');
  console.log('min  n  drop/min  got/min  got%  suelo  lejos  nivel  derrot.');
  for (const m of [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30]) {
    const rs = ok.filter(r => r.audit.min.length >= m);
    if (!rs.length) continue;
    const mean = f => rs.reduce((s, r) => s + f(r), 0) / rs.length;
    const cur = r => r.audit.min[m - 1], prev = r => r.audit.min[m - 2] || { drop: 0, got: 0 };
    const d = mean(r => cur(r).drop - prev(r).drop), g = mean(r => cur(r).got - prev(r).got);
    console.log([m, rs.length, Math.round(d), Math.round(g), (100 * mean(r => cur(r).got) / Math.max(1, mean(r => cur(r).drop))).toFixed(1),
      Math.round(mean(r => cur(r).ground)), Math.round(mean(r => cur(r).far)), mean(r => cur(r).lv).toFixed(1), Math.round(mean(r => cur(r).kills))].join('\t'));
  }
  const sum = f => ok.reduce((s, r) => s + f(r), 0);
  console.log('\nTotal: experiencia soltada', sum(r => r.audit.drop), 'recogida', sum(r => r.audit.got), '(' + (100 * sum(r => r.audit.got) / sum(r => r.audit.drop)).toFixed(1) + ' %)');
  console.log('Imanes soltados/cogidos', sum(r => r.audit.mags[0]), '/', sum(r => r.audit.mags[1]), '· bayas', sum(r => r.audit.heals[0]), '/', sum(r => r.audit.heals[1]),
    '· bombas', sum(r => r.audit.bombs[0]), '/', sum(r => r.audit.bombs[1]), '· objetos', sum(r => r.audit.items[0]), '/', sum(r => r.audit.items[1]));
  const mins = sum(r => r.time) / 60;
  console.log('Altares vistos/usados', sum(r => r.audit.altars[0]), '/', sum(r => r.audit.altars[1]), '· cofres con candado vistos/abiertos', sum(r => r.audit.chests[0]), '/', sum(r => r.audit.chests[1]),
    '· manantiales vistos', sum(r => r.audit.springs), '· en', Math.round(mins), 'min de partida');
  const pw = {}; for (const r of ok) for (const k in r.audit.powers) pw[k] = (pw[k] || 0) + r.audit.powers[k];
  console.log('Poderes de altar:', JSON.stringify(pw));
});
