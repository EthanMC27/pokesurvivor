/* ============ sim/party.js — una partida en COOPERATIVO (2-4 jugadores) sin pantalla ============
 *
 * Como sim/engine.js, pero con varios Pokémon a la vez, cada uno con su bot. No hay red: todos los
 * jugadores son "del anfitrión" (G.Coop sigue inactivo), así que no hay copias remotas ni disparos
 * fantasma; cada uno hace su daño, sus estados y sus remolinos de verdad, que es lo que hace el juego
 * desde el 19-10-2026 (Infortunio y remolinos de un invitado ya funcionan). Lo de game.js para el grupo
 * se repite aquí (ver sim/FIDELITY.md, "Cooperativo"):
 *   - experiencia del equipo: la gana el anfitrión con G.Coop.xpFactor (media de Aprendizaje / (1 + 0,6·(n−1)))
 *     y el nivel es el mismo para todos; cada nivel, una tanda de cartas para CADA jugador;
 *   - escalado con n (G.Coop.scaleRate / scaleHp, lo hace el código del juego con players.length);
 *   - caído: un compañero vivo a menos de 56 px te levanta en 3 s (sin nadie, el contador baja a la mitad)
 *     con el 50 % de vida; la partida acaba si caéis todos más de 1,6 s (fuera de la grieta);
 *   - grieta: entra cualquiera y vais todos; al vencer, un vínculo para cada uno; al volver, los caídos con 30 %;
 *   - recogidas: experiencia, monedas, imán y bomba para el equipo; curación y objeto, para quien lo coge;
 *   - cámara: una por jugador (G.Camera.sees = "lo ve alguno"), como cada ordenador con la suya.
 * Necesita los atajos 'coop-*' de load.js (golpes al dueño del disparo, zonas y toque de Arceus para todos).
 *
 * Diferencias que quedan: el clima de arena/nieve y la cura del Pokémon perdido sólo cuentan para el
 * anfitrión; los altares se gastan para todos al usarlos uno (en el juego cada uno tiene el suyo); el
 * toque de Arceus tiene una sola recarga para todos; las curas y escudos de enemigos, igual que en solitario.
 *
 * runParty({ members: [{ dex, bot, start?, ban?, item? }, ...], seed, upgrades, maxTime, dt, leash })
 *   bot: objeto bot (la misma API que engine.js; api.mates = los demás jugadores).
 *   leash: distancia a partir de la que un bot se acerca a su compañero (por defecto 0 = nada: con 320 caían mucho más).
 *   reviveRun: false = el vivo no va a por el caído. why: apunta de qué cae cada uno (últimos 15 s).
 * Con un solo miembro da la MISMA partida que engine.runOne (sin el cambio de cámara): node sim/party.js --check
 */
const { load, hole } = require(process.env.SIM_LOADER ? './' + process.env.SIM_LOADER : './load');   // (SIM_LOADER: pruebas)

const DT = 1 / 30;

function setup(G, state) {
  const H = hole();
  G.UI = H; G.RunUI = H; G.HUD = H; G.Icons = H; G.Flow = H;
  G.Social = { me: null, room: null, setPlaying() {}, publishProfile() {} };
  G.Ranking = H;
  G.DB = {
    save: { coins: 0, stats: { runs: 0, totalKills: 0, bestTime: 0, bestLevel: 0, coinsEarned: 0, shinies: 0, judged: 0 }, tickets: { t1: 0, t10: 0 },
            owned: {}, shinies: {}, legends: {} },
    commit() {}, owns: () => true, grant() {}, grantShiny: () => false, ownsShiny: () => false, fb: null,
    upgradesOf: () => ({})
  };
  for (const k in G.Progress) if (typeof G.Progress[k] === 'function') G.Progress[k] = () => {};
  G.Progress.kill = e => { if (G.Judgment.active && e.boss) G.Judgment.bossDown(); };
  G.Game = {
    get player() { return state.players[0]; }, everyone: () => state.players, st: { get time() { return state.time; } },
    get state() { return 'playing'; },
    flash() {}, offerBond() {}, levelXp: () => { const h = state.players[0]; return Math.ceil((h.xpNext - h.xp + 1) / ((state.players.length > 1 ? xpFactor(state.players) : 1) * (h.xpMul || 1))); }
  };
  G.onShinyCaught = () => {}; G.onRescue = () => {};
  G.Camera.resize(1280, 720, 1);
}

/** G.Coop.xpFactor sin red: (media de xpMul) / xpMul del anfitrión / (1 + 0,6·(n−1)). */
function xpFactor(players) {
  const n = players.length, s = players.reduce((a, p) => a + (p.xpMul || 1), 0);
  return (s / n) / (players[0].xpMul || 1) / (1 + 0.6 * (n - 1));
}

function runParty(o) {
  const seed = o.seed == null ? 1 : o.seed;
  const dt = o.dt > 0 && o.dt <= 1 / 30 ? o.dt : DT;
  const { ctx, G } = load(seed);
  const state = { players: [], time: 0 };
  setup(G, state);
  const M = o.members;
  const N = M.length;
  if (!N) throw new Error('runParty: sin miembros');

  let levels = o.upgrades || {};
  if (levels === 'max') { levels = {}; for (const u of G.Upgrades.LIST) levels[u.id] = u.max; }
  const perks = G.Upgrades.perks(levels);

  // Cada jugador mueve con su eje: G.Input.axis devuelve el del que se está actualizando.
  let cur = 0;
  const axes = M.map(() => [0, 0]);
  G.Input.axis = () => axes[cur];

  // --- como startRun() ---
  G.FX.clear(); G.Projectiles.clear(); G.Combat.clearFields(); G.EnemyMgr.clear(); G.Pickups.clear();
  G.Spawner.reset(); G.Rift.reset(); G.Judgment.reset(); G.Events.reset(); G.Weather.reset(); G.Path.clear(); G.Hazards.clear();
  G.World.reset(Math.floor(ctx.Math.random() * 1e6));
  G.World.setBiome(0, true);

  const pls = state.players;
  const apis = [];
  for (let k = 0; k < N; k++) {
    const m = M[k], mon = G.DEX_BY[m.dex];
    if (!mon) throw new Error('No existe el Pokémon ' + m.dex);
    const pl = new G.Player(mon, perks, false);
    pl.x += (k - (N - 1) / 2) * 34;                         // en fila, como al entrar a una arena
    pls.push(pl);
  }
  const sense = pl => () => ({
    enemies: G.EnemyMgr.all().filter(e => !e.dead), shots: G.Projectiles.all().filter(p => !p.friendly),
    hazards: G.Hazards.all, pickups: G.Pickups.all(), rift: G.Rift.rift, arena: G.Rift.arena,
    inArena: G.Rift.inArena, judge: G.Judgment.active, props: G.World.propsInCircle(pl.x, pl.y, 420),
    event: G.Events.current, lost: G.Events._dbg ? G.Events._dbg() : null, weather: G.Weather.current,
    arceus: (a => a ? { x: a[0], y: a[1], r: arceusR } : null)(G.Judgment.netState && G.Judgment.netState())
  });
  const arceusR = G.Sprites.bodyRadius(493, 1.5) * 0.9;
  for (let k = 0; k < N; k++) {
    const pl = pls[k];
    apis.push({ G, get pl() { return pl; }, get time() { return state.time; }, sense: sense(pl), dt,
                rerollsLeft: () => Math.max(0, 1 + (pl.rerollBonus || 0) - (pl.rerolls || 0)), mates: pls.filter(x => x !== pl) });
  }
  // Movimiento inicial, vetos y Repertorio de cada uno (Repertorio al azar, como en el juego).
  for (let k = 0; k < N; k++) {
    const m = M[k], pl = pls[k], bot = m.bot, api = apis[k], dex = pl.mon.dex;
    pl.banned = new Set((m.ban || []).slice(0, perks.bans));
    const ok = id => !!id && (levels.start || 0) >= 1 && G.startChoices(dex).includes(id);
    let st = m.start;
    if (!st && bot.startMove && (levels.start || 0) >= 1) st = bot.startMove(G.startChoices(dex).slice(), api);
    pl.addMove(ok(st) ? st : G.startMoveOf(dex));
  }
  for (let k = 0; k < N; k++) {
    const pl = pls[k], mon = pl.mon;
    if (perks.startMoves >= 2) {
      const pool = G.Moves.poolFor(mon).filter(id => !pl.hasMove(id) && !pl.banned.has(id) && G.Moves.BY_ID[id].kind !== 'buff');
      const pick = pool.length ? G.U.pick(pool) : null;
      if (pick) pl.addMove(pick);
      pl.setActive(0);
    }
    if (M[k].item && G.Items.BY[M[k].item]) pl.equip(M[k].item);
  }
  G.Camera.x = pls[0].x; G.Camera.y = pls[0].y; G.Camera.shake = 0;

  // Cámara: con varios, "se ve" si lo ve alguno (cada ordenador tiene la suya, centrada en su Pokémon).
  if (N > 1) {
    const sees0 = G.Camera.sees.bind(G.Camera);
    G.Camera.sees = (x, y, m = 0) => {
      const hw = G.Camera.w / 2 + m, hh = G.Camera.h / 2 + m;
      for (const p of pls) if (Math.abs(x - p.x) < hw && Math.abs(y - (p.y - G.LIFT * 0.5)) < hh) return true;
      return sees0(x, y, m);
    };
  }

  const stats = pls.map(() => ({ cards: [], items: [], bonds: 0, hits: 0, dmgTaken: 0, downs: 0, revives: 0 }));
  for (let k = 0; k < N; k++) {
    const pl = pls[k], hurt0 = pl.hurt.bind(pl), S = stats[k];
    S.log = [];
    pl.hurt = function (amount, type, pure, cat) {
      const before = this.hp, was = this.dead;
      hurt0(amount, type, pure, cat);
      const d = before - this.hp;
      if (d > 0) {
        S.hits++; S.dmgTaken += d;
        if (o.why) {     // de dónde viene el golpe (fichero:línea del juego), para ver de qué se cae
          const st = (new Error().stack || '').split('\n').slice(2).find(l => /js[\\/](systems|entities)/.test(l)) || '';
          const m = st.match(/([\w-]+\.js):(\d+)/);
          S.log.push({ t: state.time, d, src: m ? m[1] + ':' + m[2] : '?', near: G.EnemyMgr.queryCircle(this.x, this.y, 120).filter(e => !e.dead).length });
        }
      }
      if (!was && this.dead) {
        S.downs++;
        if (o.why) {
          const by = {};
          for (const h of S.log) if (h.t > state.time - 15) { const k = h.src + (h.near >= 10 ? ' 10+' : h.near >= 4 ? ' 4-9' : ' 1-3'); by[k] = (by[k] || 0) + Math.round(h.d); }
          (S.why = S.why || []).push({ t: Math.round(state.time), lv: this.level, by, mate: pls.filter(q => q !== this).map(q => ({ dead: q.dead, d: Math.round(Math.hypot(q.x - this.x, q.y - this.y)) })) });
          S.log = [];
        }
      }
    };
  }
  for (let k = 0; k < N; k++) if (M[k].bot.init) M[k].bot.init(apis[k]);

  let pending = 0, biome = 0;
  const host = pls[0];
  const syncTeam = () => { for (const p of pls) if (p !== host) { p.level = host.level; p.xp = host.xp; p.xpNext = host.xpNext; } };

  // --- como onCollect(p, who) de game.js en el anfitrión ---
  const onCollect = (p, who = host) => {
    const k = pls.indexOf(who), api = apis[k], bot = M[k].bot;
    switch (p.kind) {
      case 'xp': case 'xpBig': pending += host.gainXp(p.value * xpFactor(pls)); syncTeam(); break;
      case 'coin': host.coins += p.value; break;
      case 'heal': who.heal(who.maxHp * 0.3); break;
      case 'magnet': G.Pickups.pullAll(); break;
      case 'bomb': {
        // game.js: el que la coge daña lo que ve en su pantalla; la de un compañero, en un radio.
        if (G.U.dist2(who.x, who.y, host.x, host.y) < 500 * 500) G.Camera.kick(0.8);
        const R = G.Camera.outerRadius(), mine = who === host;
        for (const e of G.EnemyMgr.all()) {
          if (mine ? !G.Camera.sees(e.x, e.y, 0) : G.U.dist2(e.x, e.y, who.x, who.y) > R * R) continue;
          e.hurt(60 + host.level * 14, '#ff7b3d', e.x - who.x, e.y - who.y, 160);
        }
        break;
      }
      case 'ticket': host.t1++; break;
      case 'ticket10': host.t10++; break;
      case 'item': {
        const id = p.value;
        if (!G.Items.BY[id]) break;
        if (!who.item) { who.equip(id); stats[k].items.push({ t: Math.round(state.time), id }); }
        else if (who.item !== id) {
          let keep = bot.item ? bot.item(who.item, id, api) : who.item;
          if (keep !== id) keep = who.item;
          if (keep !== who.item) { who.equip(keep); stats[k].items.push({ t: Math.round(state.time), id: keep }); }
        }
        break;
      }
    }
  };

  function levelUp(k, time) {
    const pl = pls[k], bot = M[k].bot, api = apis[k];
    let cards = G.LevelUp.offer(pl);
    for (let guard = 0; guard < 20; guard++) {
      if (!cards.length) return;
      let i = bot.card ? bot.card(cards, api) : 0;
      const wantRr = i === 'reroll' || (bot.reroll && bot.reroll(cards, api));
      if (wantRr && api.rerollsLeft() > 0) { pl.rerolls = (pl.rerolls || 0) + 1; cards = G.LevelUp.offer(pl); continue; }
      if (wantRr && i === 'reroll') i = 0;
      if (!(i >= 0 && i < cards.length)) i = 0;
      cards[i].apply(pl);
      stats[k].cards.push({ t: Math.round(time), lv: pl.level, key: cards[i].key });
      return;
    }
  }
  function bond(k) {
    const pl = pls[k], bot = M[k].bot;
    const opt = pl.bondOptions();
    if (!opt) return;
    const need = opt.mode === 'add' ? 1 : 2;
    let pick = bot.bond ? bot.bond(opt, apis[k]) : null;
    pick = Array.isArray(pick) ? pick.filter((m, j, a) => opt.loose.includes(m) && a.indexOf(m) === j) : [];
    if (pick.length !== need) pick = opt.loose.slice(0, need);
    pl.fuse(pick, opt.group);
    stats[k].bonds++;
  }

  // El bot de cada uno, con correa: si el compañero se aleja más de `leash`, tira hacia él; si está
  // caído y cerca, va a levantarlo (en el juego el que está vivo suele ir a por el caído).
  const leash = o.leash == null ? 0 : o.leash;     // (20-10-2026: con 320 los bots se metían en la horda; ver FIDELITY)
  function steer(k, v) {
    if (N < 2 || !leash) return v;
    const pl = pls[k];
    let near = null, nd = Infinity;
    for (const p of pls) { if (p === pl) continue; const d = Math.hypot(p.x - pl.x, p.y - pl.y); if (d < nd) { nd = d; near = p; } }
    if (!near) return v;
    const [ux, uy] = G.U.norm(near.x - pl.x, near.y - pl.y);
    if (o.reviveRun !== false && near.dead && nd < 600 && pl.hp > pl.maxHp * 0.35) return nd < 30 ? [0, 0] : [ux, uy];
    if (nd > leash) { const w = Math.min(1, (nd - leash) / 200); return [v[0] * (1 - w) + ux * w, v[1] * (1 - w) + uy * w]; }
    return v;
  }

  const maxTime = o.maxTime || 45 * 60;
  let deathT = 0, frames = 0, arenaWas = null, arenaPhase = null;
  while (state.time < maxTime) {
    frames++;
    ctx.__now += dt * 1000;
    if (G.Judgment.cinematic) { G.Judgment.cineTick(dt); for (const p of pls) p.anim.update(dt); G.World.update(dt, G.Camera); G.FX.update(dt); continue; }
    // Todos caídos (fuera de la grieta): se acaba tras 1,6 s (en solitario, 1,3 s de animación).
    if (pls.every(p => p.dead) && !G.Rift.inArena) {
      deathT += dt;
      if (deathT > (N > 1 ? 1.6 : 1.3)) break;
      if (N === 1) continue;
    } else deathT = 0;
    const time = state.time += dt;
    const b = Math.floor(time / 240);
    if (b !== biome && !G.Rift.inArena && !G.Judgment.active) { biome = b; G.World.setBiome(b); }

    for (let k = 0; k < N; k++) {
      const v = steer(k, M[k].bot.move(apis[k]) || [0, 0]);
      const n = Math.hypot(v[0], v[1]);
      axes[k] = [n > 1 ? v[0] / n : v[0] || 0, n > 1 ? v[1] / n : v[1] || 0];
      if (M[k].bot.active) { const i = M[k].bot.active(apis[k]); if (i != null && i !== pls[k].active) pls[k].setActive(i); }
    }
    for (let k = 0; k < N; k++) { cur = k; pls[k].frozen = false; pls[k].update(dt); }
    cur = 0;
    G.Camera.follow(host.x, host.y, dt);
    G.World.update(dt, G.Camera);
    G.Path.update(dt, pls); G.Spawner.update(dt, pls, time);
    G.EnemyMgr.update(dt, pls); G.EnemyMgr.rebuildGrid();
    for (const p of pls) G.Combat.tick(dt, p, time);
    G.Projectiles.update(dt, host, G.EnemyMgr.all());
    for (const p of pls) G.Combat.resolve(dt, p, time);
    G.Combat.updateFields(dt);
    G.Pickups.update(dt, pls, onCollect);
    G.Hazards.update(dt);
    for (const p of pls) G.Interact.update(dt, p);
    // Grieta: entra cualquiera (Rift.update sólo mira al anfitrión).
    if (G.Rift.rift && !G.Rift.inArena) {
      for (const p of pls) if (p !== host && !p.dead && G.U.dist2(p.x, p.y, G.Rift.rift.x, G.Rift.rift.y - 10) < 30 * 30) G.Rift.enterRequest();
    }
    G.Rift.update(dt, host, time);
    const ar = G.Rift.arena;
    if (ar && ar.phase === 'won' && arenaPhase !== 'won') for (const p of pls) if (p !== host) p.bonds++;   // un vínculo para cada uno
    if (arenaWas && !ar) for (const p of pls) if (p !== host && p.dead) p.revive(0.3);                     // al volver, con el 30 %
    arenaWas = ar; arenaPhase = ar ? ar.phase : null;
    G.Judgment.update(dt, host, time);
    G.Events.update(dt, pls, time);
    G.Weather.update(dt, time, host);
    G.FX.update(dt);

    // Revivir (game.js reviveTick, en cada ordenador para su Pokémon).
    if (N > 1 && !G.Rift.inArena) for (let k = 0; k < N; k++) {
      const p = pls[k];
      if (!p.dead) continue;
      const helper = pls.some(q => q !== p && !q.dead && G.U.dist2(q.x, q.y, p.x, p.y) < 56 * 56);
      p.reviveT = helper ? (p.reviveT || 0) + dt : Math.max(0, (p.reviveT || 0) - dt * 0.5);
      if (p.reviveT >= G.Player.REVIVE_TIME) { p.revive(0.5); stats[k].revives++; }
    }

    // Subida de nivel: una tanda por fotograma, para cada jugador (el juego espera a que elijan todos).
    let carded = false;
    if (pending > 0 && !(N === 1 && host.dead)) { pending--; for (let k = 0; k < N; k++) levelUp(k, time); carded = true; }
    if (!carded && !G.Rift.inArena) for (let k = 0; k < N; k++) if (pls[k].bonds > 0 && !pls[k].dead) bond(k);
  }

  const judge = G.Judgment.summary ? G.Judgment.summary() : null;
  return {
    seed, n: N, time: Math.round(state.time), timeExact: +state.time.toFixed(3), level: host.level, kills: host.kills, bosses: host.bosses,
    judge: judge ? { time: judge.time, bosses: judge.bosses } : null, frames, pendingLevels: pending,
    members: pls.map((pl, k) => ({
      dex: pl.mon.dex, name: pl.mon.name, dead: pl.dead, dmg: Math.round(pl.dmgDealt), item: pl.item,
      moves: pl.slots.map(g => g.map(m => m.id + ':' + m.lvl + (m.evolved ? '*' : '')).join('+')),
      atkMul: +pl.atkMul.toFixed(2), reduce: +pl.reduction.toFixed(2), hits: stats[k].hits, dmgTaken: Math.round(stats[k].dmgTaken),
      downs: stats[k].downs, revives: stats[k].revives, why: stats[k].why, bonds: stats[k].bonds, cards: stats[k].cards, items: stats[k].items
    }))
  };
}

module.exports = { runParty, xpFactor };

// node sim/party.js --check  → una party de 1 = la partida de engine.runOne (misma semilla, mismo bot)
if (require.main === module && process.argv.includes('--check')) {
  const { runOne } = require('./engine');
  const mk = () => require('./bots/best')({});
  const { G } = load(1);
  for (const [dex, seed] of [[448, 3], [94, 5]]) {
    const ban = require('./bots/best').bans(dex, G, {});
    const a = runOne({ dex, seed, bot: mk(), upgrades: 'max', maxTime: 300, ban });
    const b = runParty({ members: [{ dex, bot: mk(), ban }], seed, upgrades: 'max', maxTime: 300 });
    const same = a.timeExact === b.timeExact && a.level === b.level && a.kills === b.kills && JSON.stringify(a.moves) === JSON.stringify(b.members[0].moves);
    console.log((same ? 'ok    ' : 'FALLO ') + `${a.name} semilla ${seed}: motor ${a.timeExact}s nv${a.level} ${a.kills} / party ${b.timeExact}s nv${b.level} ${b.kills}`);
  }
}
