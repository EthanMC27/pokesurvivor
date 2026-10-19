/* ============ sim/engine.js — una partida en solitario sin pantalla ============
 *
 * Repite el bucle de js/game.js (update) con el código real de los sistemas,
 * a paso fijo (1/30 s por defecto; o.dt para otro). Lo que en el juego decide
 * el jugador lo decide un BOT:
 *
 *   bot.init?(api)                          al empezar
 *   bot.move(api) -> [ax, ay]               cada fotograma (vector de -1 a 1)
 *   bot.card(cards, api) -> índice          al subir de nivel (cartas de G.LevelUp.offer);
 *                                           también puede devolver 'reroll' (cambiar las cartas)
 *   bot.reroll?(cards, api) -> bool         (opcional) ¿cambiar estas cartas? (si quedan cambios)
 *   bot.item(curId, nextId, api) -> id      objeto nuevo con uno ya puesto
 *   bot.bond(opt, api) -> [moves]           vínculo: movimientos a fusionar (ver Player.bondOptions).
 *                                           En el juego no se puede rechazar: si la respuesta no
 *                                           vale, se fusiona lo de por defecto.
 *   bot.active?(api) -> índice de hueco     (opcional) cambiar de movimiento activo
 *   bot.secondMove?(pool, api) -> id        (opcional) con Repertorio, el 2.º movimiento inicial
 *   bot.startMove?(choices, api) -> id      (opcional) con la mejora Movimiento inicial, con cuál empezar
 *
 * `api` = { G, pl, time, sense(), rerollsLeft() } — sense() da lo que ve el jugador
 * (enemigos, disparos, zonas avisadas, objetos del mapa, grieta, evento, clima,
 * Arceus...) ya preparado.
 *
 * Igual que el juego (ver sim/FIDELITY.md):
 *   - una tanda de cartas por fotograma (con varios niveles pendientes, entre
 *     tanda y tanda pasa un fotograma de juego, como al cerrar la pantalla);
 *   - el vínculo se elige cuando no hay cartas pendientes de ese fotograma;
 *   - 1 cambio de cartas gratis + los de la mejora "Cambio de cartas";
 *   - Veto (o.ban) y Atajos (o.bind) como en startRun.
 *
 * runOne(opts) -> métricas de la partida.
 */
const { load, hole } = require('./load');

const DT = 1 / 30;

function setup(G, ctx, state) {
  const H = hole();
  G.UI = H; G.RunUI = H; G.HUD = H; G.Icons = H; G.Flow = H;
  G.Social = { me: null, room: null, setPlaying() {}, publishProfile() {} };
  G.Ranking = H;
  // Una cuenta "nueva": ningún legendario vencido (todos igual de probables en
  // las grietas) y la Sentencia nunca vista (su animación no se puede saltar;
  // da igual: el reloj no corre durante ella).
  G.DB = {
    save: { coins: 0, stats: { runs: 0, totalKills: 0, bestTime: 0, bestLevel: 0, coinsEarned: 0, shinies: 0, judged: 0 }, tickets: { t1: 0, t10: 0 },
            owned: {}, shinies: {}, legends: {} },
    commit() {}, owns: () => true, grant() {}, grantShiny: () => false, ownsShiny: () => false, fb: null,
    upgradesOf: () => ({})
  };
  for (const k in G.Progress) if (typeof G.Progress[k] === 'function') G.Progress[k] = () => {};
  // Progress.kill no es sólo de logros: en la Sentencia es quien cuenta los legendarios
  // vencidos (G.Judgment.bossDown). Sin esto, judge.bosses salía siempre 0.
  G.Progress.kill = e => {
    if (G.Judgment.active && e.boss) { G.Judgment.bossDown(); if (state.onJudgeKill) state.onJudgeKill(e); }
  };
  G.Game = {
    get player() { return state.pl; }, everyone: () => [state.pl], st: { get time() { return state.time; } },
    get state() { return 'playing'; },
    flash() {}, offerBond() { state.bondAsk = true; }, levelXp: () => Math.ceil((state.pl.xpNext - state.pl.xp + 1) / (state.pl.xpMul || 1))
  };
  G.onShinyCaught = () => {}; G.onRescue = () => {};
  // 1280×720: la vista del mundo es 768×432, la misma en cualquier pantalla 16:9.
  G.Camera.resize(1280, 720, 1);
}

/**
 * @param o.dex       Pokémon (nº de la Pokédex)
 * @param o.seed      semilla
 * @param o.bot       objeto bot (ver arriba)
 * @param o.upgrades  niveles de la tienda de Mejoras, p. ej. { atk: 10, hp: 10 } o 'max'
 * @param o.maxTime   segundos como mucho (por defecto 45 min: la Sentencia empieza en el 30)
 * @param o.start     id del movimiento inicial (mejora Movimiento inicial; por defecto el de serie)
 * @param o.item      objeto puesto desde el principio (para pruebas)
 * @param o.ban       ids de movimientos vetados (Mejoras → Veto; como mucho los niveles de 'ban')
 * @param o.bind      { idMovimiento: hueco 0-3 } (Mejoras → Atajos)
 * @param o.dt        paso del reloj (1/30 por defecto; el juego a 60 FPS va a 1/60)
 * @param o.immortal  no se muere: el daño se apunta en `lives` (vidas máximas que habría perdido)
 * @param o.mortalRifts  (con immortal) dentro de la grieta el daño es real: se puede perder la grieta
 * @param o.mortalJudge  (con immortal) en la Sentencia el daño es real: la partida acaba al caer
 * @param o.trace     función(tick) llamada cada segundo de juego con un resumen
 */
function runOne(o) {
  const seed = o.seed == null ? 1 : o.seed;
  const dt = o.dt > 0 && o.dt <= 1 / 30 ? o.dt : DT;
  const { ctx, G } = load(seed);
  const state = { pl: null, time: 0, bondAsk: false };
  setup(G, ctx, state);
  const bot = o.bot;
  const mon = G.DEX_BY[o.dex];
  if (!mon) throw new Error('No existe el Pokémon ' + o.dex);

  let levels = o.upgrades || {};
  if (levels === 'max') { levels = {}; for (const u of G.Upgrades.LIST) levels[u.id] = u.max; }
  const perks = G.Upgrades.perks(levels);

  let ax = 0, ay = 0;
  G.Input.axis = () => [ax, ay];

  // --- como startRun() ---
  G.FX.clear(); G.Projectiles.clear(); G.Combat.clearFields(); G.EnemyMgr.clear(); G.Pickups.clear();
  G.Spawner.reset(); G.Rift.reset(); G.Judgment.reset(); G.Events.reset(); G.Weather.reset(); G.Path.clear(); G.Hazards.clear();
  G.World.reset(Math.floor(ctx.Math.random() * 1e6));
  G.World.setBiome(0, true);

  const pl = state.pl = new G.Player(mon, perks, false);
  if (o.bind) for (const id in o.bind) if (o.bind[id] != null) pl.bind[id] = o.bind[id];
  // Movimiento inicial (mejora 'start', 19-10-2026): con ella se elige cualquiera de
  // G.startChoices (los suyos sin potenciadores, y el de serie). o.start manda; si no,
  // bot.startMove(choices, api). Sin la mejora, el de serie (o.start se ignora con aviso).
  // o.forceStart (herramientas como calib-moves.js): cualquier movimiento, sin la mejora.
  const startOk = id => !!id && (o.forceStart ? !!G.Moves.BY_ID[id] : (levels.start || 0) >= 1 && G.startChoices(mon.dex).includes(id));
  let startId = o.start;
  if (!startId && bot.startMove && (levels.start || 0) >= 1) {
    // (el bot ve los vetos: pl.banned ya puesto, como si los hubiera elegido a la vez)
    pl.banned = new Set((o.ban || []).slice(0, perks.bans));
    startId = bot.startMove(G.startChoices(mon.dex).slice(), { G, pl, time: 0, dt });
  }
  if (startId && !startOk(startId)) {
    if (o.start) console.warn(`[sim] movimiento inicial "${startId}" no válido para ${mon.name} (¿sin la mejora 'start'?): el de serie`);
    startId = null;
  }
  pl.addMove(startId || G.startMoveOf(mon.dex));
  pl.banned = new Set((o.ban || []).slice(0, perks.bans));

  const sense = () => {
    const enemies = G.EnemyMgr.all().filter(e => !e.dead);
    const shots = G.Projectiles.all().filter(p => !p.friendly);
    const a = G.Judgment.netState && G.Judgment.netState();
    return {
      enemies, shots,
      hazards: G.Hazards.all,
      pickups: G.Pickups.all(),
      rift: G.Rift.rift, arena: G.Rift.arena,
      inArena: G.Rift.inArena, judge: G.Judgment.active,
      props: G.World.propsInCircle(pl.x, pl.y, 420),
      // (añadidos) evento en curso ('horde' | 'gold' | 'lost' | null), el Pokémon
      // perdido { x, y, tx, ty, state, hp }, el clima y Arceus en la Sentencia.
      event: G.Events.current, lost: G.Events._dbg ? G.Events._dbg() : null,
      weather: G.Weather.current,
      arceus: a ? { x: a[0], y: a[1], r: arceusR } : null
    };
  };
  const arceusR = G.Sprites.bodyRadius(493, 1.5) * 0.9;
  const rerollsLeft = () => Math.max(0, 1 + (pl.rerollBonus || 0) - (pl.rerolls || 0));
  const api = { G, get pl() { return pl; }, get time() { return state.time; }, sense, rerollsLeft, dt };

  if (perks.startMoves >= 2) {
    const pool = G.Moves.poolFor(mon).filter(id => !pl.hasMove(id) && !pl.banned.has(id) && G.Moves.BY_ID[id].kind !== 'buff');
    let pick = bot.secondMove ? bot.secondMove(pool.slice(), api) : null;
    if (!pool.includes(pick)) pick = pool.length ? G.U.pick(pool) : null;
    if (pick) pl.addMove(pick);
    pl.setActive(0);
  }
  if (o.item && G.Items.BY[o.item]) pl.equip(o.item);
  G.Camera.x = pl.x; G.Camera.y = pl.y; G.Camera.shake = 0;

  // Legendarios de la Sentencia: cuándo salen (segundos de pelea), su vida y cuándo caen.
  const judgeLog = [];
  const add0 = G.EnemyMgr.add;
  G.EnemyMgr.add = function (e) {
    if (e && e.judge) { const s = G.Judgment.summary(); judgeLog.push({ dex: e.dex, hp: e.maxHp, at: s ? +s.time.toFixed(1) : 0, down: null }); e.__jn = judgeLog.length - 1; }
    return add0.apply(this, arguments);
  };
  state.onJudgeKill = e => { const s = G.Judgment.summary(); if (e.__jn != null) judgeLog[e.__jn].down = s ? +s.time.toFixed(1) : 0; };

  let pending = 0, biome = 0;
  const stats = { cards: [], items: [], bonds: 0, riftsSeen: 0, rerolls: 0, hits: 0, dmgTaken: 0, lives: 0, curve: [] };

  // --- como onCollect() de game.js (en solitario) ---
  const onCollect = p => {
    switch (p.kind) {
      case 'xp': case 'xpBig': pending += pl.gainXp(p.value); break;
      case 'coin': pl.coins += p.value; break;
      case 'heal': pl.heal(pl.maxHp * 0.3); break;
      case 'magnet': G.Pickups.pullAll(); break;
      case 'bomb':
        G.Camera.kick(0.8);
        for (const e of G.EnemyMgr.all()) {
          if (!G.Camera.sees(e.x, e.y, 0)) continue;
          e.hurt(60 + pl.level * 14, '#ff7b3d', e.x - pl.x, e.y - pl.y, 160);
        }
        break;
      case 'ticket': pl.t1++; break;
      case 'ticket10': pl.t10++; break;
      case 'item': {
        // offerItem(): sin objeto, se pone; si es el mismo, nada; si no, elige (el juego se para).
        const id = p.value;
        if (!G.Items.BY[id]) break;
        if (!pl.item) { pl.equip(id); stats.items.push({ t: Math.round(state.time), id }); }
        else if (pl.item !== id) {
          let keep = bot.item ? bot.item(pl.item, id, api) : pl.item;
          if (keep !== id) keep = pl.item;
          if (keep !== pl.item) { pl.equip(keep); stats.items.push({ t: Math.round(state.time), id: keep }); }
        }
        break;
      }
    }
  };

  if (bot.init) bot.init(api);

  // Envolvemos hurt para medir (el daño se calcula igual).
  // Modo inmortal (o.immortal): el golpe se calcula con el código real pero no se aplica; se
  // apunta en `lives` (vidas máximas de ese momento). Para que el golpe "letal" no tenga efectos
  // secundarios, se le da a hurt una vida enorme: así no salta la Banda Focus (ni su recarga ni
  // su 1,2 s de invulnerabilidad) ni se cae (antes se borraban las órbitas al "caer").
  // o.mortalRifts: dentro de la grieta el daño es real (se puede perder: vuelves con 30 %).
  // o.mortalJudge: en la Sentencia el daño es real (la partida acaba al caer, como en el juego).
  const hurt0 = pl.hurt.bind(pl);
  const CUSHION = 1e12;
  const immortalNow = () => o.immortal && !(o.mortalRifts && G.Rift.inArena) && !(o.mortalJudge && G.Judgment.active);
  // (19-10-2026) hurt tiene un 4.º argumento: la categoría del golpe (físico/especial, ver G.Stats).
  pl.hurt = function (amount, type, pure, cat) {
    const before = this.hp;
    if (immortalNow()) {
      if (this.dead) return;
      this.hp = before + CUSHION;
      hurt0(amount, type, pure, cat);
      const d = before + CUSHION - this.hp;
      this.hp = before;
      if (d > 0) { stats.hits++; stats.dmgTaken += d; stats.lives += d / this.maxHp; }
      return;
    }
    hurt0(amount, type, pure, cat);
    const d = before - this.hp;
    if (d > 0) { stats.hits++; stats.dmgTaken += d; if (o.immortal) stats.lives += d / this.maxHp; }
  };

  // Una tanda de cartas (maybeLevelUp): con cambios de cartas si el bot quiere.
  function levelUp(time) {
    let cards = G.LevelUp.offer(pl);
    for (let guard = 0; guard < 20; guard++) {
      if (!cards.length) return;
      let i = bot.card ? bot.card(cards, api) : 0;
      const wantRr = i === 'reroll' || (bot.reroll && bot.reroll(cards, api));
      if (wantRr && rerollsLeft() > 0) {
        pl.rerolls = (pl.rerolls || 0) + 1; stats.rerolls++;
        cards = G.LevelUp.offer(pl);
        continue;
      }
      if (wantRr && i === 'reroll') i = 0;
      if (!(i >= 0 && i < cards.length)) i = 0;
      cards[i].apply(pl);
      // of: las cartas que había (para medir qué se ofrece; añadido 17-10-2026)
      stats.cards.push({ t: Math.round(time), lv: pl.level, key: cards[i].key, of: cards.map(c => c.key) });
      return;
    }
  }

  // Vínculo (offerBond): no se puede rechazar.
  function bond() {
    const opt = pl.bondOptions();
    if (!opt) return;                       // se guarda hasta tener dos sueltos
    const need = opt.mode === 'add' ? 1 : 2;
    let pick = bot.bond ? bot.bond(opt, api) : null;
    pick = Array.isArray(pick) ? pick.filter((m, k, a) => opt.loose.includes(m) && a.indexOf(m) === k) : [];
    if (pick.length !== need) pick = opt.loose.slice(0, need);
    pl.fuse(pick, opt.group);
    stats.bonds++;
  }

  const maxTime = o.maxTime || 45 * 60;
  let deathT = 0, frames = 0, nextTrace = 1;
  while (state.time < maxTime) {
    frames++;
    ctx.__now += dt * 1000;
    // La Sentencia de Arceus: durante la animación todo lo demás se para (también el reloj).
    if (G.Judgment.cinematic) { G.Judgment.cineTick(dt); pl.anim.update(dt); G.World.update(dt, G.Camera); G.FX.update(dt); continue; }
    // Caído (fuera de la grieta): la partida acaba tras la animación (1,3 s sin reloj).
    if (pl.dead && !G.Rift.inArena) {
      deathT += dt;
      if (deathT > 1.3) break;
      continue;
    }
    const time = state.time += dt;
    const b = Math.floor(time / 240);
    if (b !== biome && !G.Rift.inArena && !G.Judgment.active) { biome = b; G.World.setBiome(b); }

    const v = bot.move(api) || [0, 0];
    const n = Math.hypot(v[0], v[1]);
    ax = n > 1 ? v[0] / n : v[0] || 0; ay = n > 1 ? v[1] / n : v[1] || 0;
    if (bot.active) { const i = bot.active(api); if (i != null && i !== pl.active) pl.setActive(i); }

    pl.frozen = false;
    pl.update(dt);
    G.Camera.follow(pl.x, pl.y, dt);
    G.World.update(dt, G.Camera);
    G.Path.update(dt, [pl]); G.Spawner.update(dt, [pl], time);
    G.EnemyMgr.update(dt, [pl]); G.EnemyMgr.rebuildGrid();
    G.Combat.tick(dt, pl, time);
    G.Projectiles.update(dt, pl, G.EnemyMgr.all());
    G.Combat.resolve(dt, pl, time);
    G.Combat.updateFields(dt);
    G.Pickups.update(dt, [pl], onCollect);
    G.Hazards.update(dt);
    G.Interact.update(dt, pl);
    const wasArena = G.Rift.inArena;
    G.Rift.update(dt, pl, time);
    G.Judgment.update(dt, pl, time);
    G.Events.update(dt, [pl], time);
    G.Weather.update(dt, time, pl);
    G.FX.update(dt);
    if (!wasArena && G.Rift.inArena) stats.riftsSeen++;
    if (stats.lives30 == null && G.Judgment.active) { stats.lives30 = stats.lives; stats.judgeAt = time; }

    // maybeLevelUp(): una tanda por fotograma, nunca con el Pokémon caído.
    let carded = false;
    if (pending > 0 && !pl.dead) { pending--; levelUp(time); carded = true; }
    // offerBond(): sólo si no se acaban de abrir cartas (el juego no estaría en 'playing').
    if (!carded && pl.bonds > 0 && !pl.dead && !G.Rift.inArena) bond();

    // Curva por minuto (para medir la potencia de una build en el tiempo).
    if (time >= (stats.curve.length + 1) * 60) {
      stats.curve.push({ m: stats.curve.length + 1, lv: pl.level, kills: pl.kills, n: G.EnemyMgr.count, lives: +stats.lives.toFixed(2),
                         hp: Math.round(pl.hp), atk: +pl.atk.toFixed(2), dmg: Math.round(pl.dmgDealt) });
    }
    if (o.trace && time >= nextTrace) { nextTrace += 1; o.trace({ t: time, hp: pl.hp, max: pl.maxHp, lv: pl.level, n: G.EnemyMgr.count, kills: pl.kills }); }
  }

  let judge = G.Judgment.summary ? G.Judgment.summary() : null;
  if (judge) {
    const d = G.Judgment.debug || {};
    // base: vida del 1.er legendario (máx. de un suelo y 3 s del daño a un enemigo medido antes);
    // single: ese daño por segundo; spawned/log: los que salieron (vida, segundo de salida y de caída).
    judge = { time: judge.time, bosses: judge.bosses, base: Math.round(d.base || 0), single: Math.round(d.single || 0),
              spawned: judgeLog.length, log: judgeLog };
  }
  return {
    dex: mon.dex, name: mon.name, seed, bot: bot.name || '?',
    time: Math.round(state.time), dead: pl.dead, level: pl.level, kills: pl.kills, bosses: pl.bosses,
    dmg: Math.round(pl.dmgDealt), item: pl.item, coins: pl.coins,
    moves: pl.slots.map(g => g.map(m => m.id + ':' + m.lvl + (m.evolved ? '*' : '')).join('+')),
    atkMul: +pl.atkMul.toFixed(2), cdMul: +pl.cdMul.toFixed(3), reduce: +pl.reduction.toFixed(2),
    judge, hits: stats.hits, dmgTaken: Math.round(stats.dmgTaken), riftsSeen: stats.riftsSeen, bonds: stats.bonds,
    cards: stats.cards, items: stats.items,
    // (añadidos)
    timeExact: +state.time.toFixed(3), rerolls: stats.rerolls, pendingLevels: pending, frames,
    immortal: !!o.immortal, lives: +stats.lives.toFixed(2), curve: stats.curve,
    // vidas perdidas ANTES de la Sentencia (en inmortal, las de la Sentencia se disparan: cada legendario pega el doble)
    lives30: stats.lives30 == null ? null : +stats.lives30.toFixed(2), judgeAt: stats.judgeAt == null ? null : Math.round(stats.judgeAt)
  };
}

module.exports = { runOne, DT };
