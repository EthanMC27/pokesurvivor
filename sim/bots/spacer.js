/* ============ sim/bots/spacer.js — bot de control de distancia ============
 *
 * Movimiento por MUESTREO: cada fotograma prueba 16 direcciones (y quedarse
 * quieto), predice dónde estarás a 0,2 / 0,45 / 0,8 s y puntúa cada una:
 *
 *   peligro   contacto con enemigos (posición prevista: van a por ti; los que
 *             embisten, en línea recta), disparos enemigos en vuelo, zonas
 *             avisadas (G.Hazards) en el momento en que estallan, charcos que
 *             dañan, trampas y Arceus en la Sentencia
 *   distancia la banda ideal según el movimiento ACTIVO (ver band()):
 *             cuerpo a cuerpo / aura / órbita pegado al borde de la horda,
 *             proyectil / rayo / cadena a media distancia, rastro dando
 *             vueltas para que te sigan por los charcos, torretas y minas
 *             rodeando lo que has dejado en el suelo
 *   rodeo     prefiere moverse de lado respecto a la horda (orbitar) en vez
 *             de huir en línea recta (los rezagados vuelven a salir delante)
 *   objetivo  experiencia (racimos seguros), curas, objetos, grieta,
 *             altares, manantiales (con poca vida) y cofres con candado
 *
 * También cambia de hueco (bot.active): usa el que más daño hace y, si tiene
 * un potenciador (Danza Espada...), lo va recargando a ratos.
 *
 * Cartas, objetos y vínculos: si existe sim/bots/cards.js (otro módulo) se le
 * delega; si no, una prioridad sencilla (ver fallbackCards).
 *
 * Opciones (--opts '{...}'): band (multiplica la distancia ideal), open (peso
 * del hueco), xpW, crowdK, noRift, noBuffCycle, main (id del movimiento
 * principal para la lógica propia), ownCards (no usar cards.js), ownFocus
 * (el hueco activo lo elige este bot aunque haya cards.js). El resto de
 * opciones pasa a cards.js.
 */

const TAU = Math.PI * 2;
const NDIR = 16;
const HORIZONS = [0.2, 0.45, 0.8];
const HW = [1.0, 0.8, 0.55];          // peso de cada horizonte

// ---------------- estimación del daño de un movimiento ----------------

/** Daño por segundo aproximado (sin atk ni tipos): sólo para comparar huecos y cartas. */
function dpsOf(m) {
  if (!m) return 0;
  const cd = Math.max(0.12, m.cd || 1), dmg = m.dmg || 0, n = Math.max(1, m.count | 0);
  switch (m.kind) {
    case 'projectile': return dmg * n / cd * (1 + (m.pierce | 0) * 0.35) * (m.homing ? 1.15 : 1);
    case 'melee':      return dmg / cd * (1 + Math.min(m.arc || 1.7, 6.3) / 3) * 1.1;
    case 'beam':       return dmg / cd * 2.4;
    case 'orbit':      return dmg * n / Math.max(0.3, cd) * 0.45;
    case 'nova':       return dmg * n / cd * 0.33 * (1 + (m.pierce | 0) * 0.3);
    case 'aura':       return dmg / cd * 2.2;
    case 'boomerang':  return dmg * n * 2 / cd;
    case 'chain':      return dmg * n * 0.8 / cd * (m.hex ? 1.3 : 1);
    case 'mine':       return dmg * n / cd * 1.4;
    case 'meteor':     return dmg * n / cd * 1.5;
    case 'turret':     return dmg / (m.rate || 0.6) * Math.min(n, (m.dur || 6) / cd) * 1.2;
    case 'dash':       return dmg / cd * 1.3;
    case 'trail':      return dmg / 0.5 * Math.min(18, (m.dur || 3) / cd) * 0.18;
    case 'cone':       return dmg * n * 0.55 / cd * (1 + (m.pierce | 0) * 0.3);
    case 'buff':       return 0;
  }
  return dmg / cd;
}
const groupDps = g => g.reduce((a, m) => a + dpsOf(m), 0);
// Valor de un movimiento para elegir el PRINCIPAL: manda el nivel (comprometerse
// con uno compensa: mejoras y evolución); a igual nivel, el inicial.
// El principal es el inicial (o opts.main) salvo que otro le saque 2 niveles.
let MAIN_ID = null;
const isMain = (pl, m) => m.id === MAIN_ID || (!MAIN_ID && pl.moves[0] === m) || (MAIN_ID && !pl.hasMove(MAIN_ID) && pl.moves[0] === m);
const mv = (pl, m) => m.kind === 'buff' ? 0 : m.lvl * 1000 + (m.evolved ? 3000 : 0) + (isMain(pl, m) ? 1500 : 0) + dpsOf(m);
const gv = (pl, g) => g.reduce((a, m) => a + mv(pl, m), 0);

/**
 * Banda de distancia (centro a centro con el enemigo más cercano) y cómo
 * moverse según el movimiento: { d, margin, orbit, contactW }.
 *   d        distancia ideal al enemigo más cercano
 *   margin   holgura de contacto que ya cuenta como peligro
 *   orbit    cuánto premia moverse de lado (rodear)
 *   contactW peso del contacto (con cuerpo a cuerpo se recibe un 25 % menos)
 */
function bandFor(m) {
  switch (m.kind) {
    case 'melee':      return { d: Math.max(24, m.radius * 0.45), margin: 4, orbit: 0.25, contactW: 0.45, pull: 2.5, open: 0.4 };
    case 'aura':       return { d: Math.max(24, m.radius * 0.55), margin: 6, orbit: 0.35, contactW: 0.7, pull: 2, open: 0.5 };
    case 'orbit':      return { d: Math.max(30, m.radius * 0.85), margin: 8, orbit: 0.45, contactW: 0.8, pull: 1.6, open: 0.6 };
    case 'dash':       return { d: Math.max(60, m.radius * 0.75), margin: 14, orbit: 0.35, contactW: 0.9, pull: 1.3, open: 0.8 };
    case 'trail':      return { d: 70, margin: 14, orbit: 0.9, contactW: 1 };
    case 'mine':       return { d: 90, margin: 18, orbit: 0.7, contactW: 1 };
    case 'cone':       return { d: Math.max(70, (m.speed * m.life) * 0.55), margin: 18, orbit: 0.45, contactW: 1 };
    case 'nova':       return { d: Math.max(80, (m.speed * m.life) * 0.4), margin: 22, orbit: 0.5, contactW: 1 };
    case 'boomerang':  return { d: Math.max(90, m.radius * 0.6), margin: 24, orbit: 0.5, contactW: 1 };
    case 'beam':       return { d: Math.max(90, m.radius * 0.6), margin: 26, orbit: 0.45, contactW: 1 };
    case 'chain':      return { d: 200, margin: 30, orbit: 0.5, contactW: 1 };
    case 'meteor':     return { d: 190, margin: 30, orbit: 0.5, contactW: 1 };
    case 'turret':     return { d: 150, margin: 28, orbit: 0.65, contactW: 1 };
    case 'projectile': return { d: 215, margin: 30, orbit: 0.5, contactW: 1 };
  }
  return { d: 150, margin: 28, orbit: 0.5, contactW: 1 };
}

/** Banda de un hueco (un vínculo lanza varios): manda el de menor distancia. */
function bandOfGroup(g) {
  let best = null;
  for (const m of g) {
    if (m.kind === 'buff') continue;
    const b = bandFor(m);
    if (!best || b.d < best.d) best = b;
  }
  const melee = g.some(m => m.kind === 'melee');
  best = best || { d: 160, margin: 30, orbit: 0.5, contactW: 1 };
  if (melee) best = Object.assign({}, best, { contactW: Math.min(best.contactW, 0.6) });
  return best;
}

// ---------------- cartas, objetos y vínculos (por si no hay cards.js) ----------------

const ITEM_RANK = { leftovers: 10, assaultvest: 9, quickclaw: 8, choiceband: 7.5, shellbell: 7, focussash: 6.5,
                    choicescarf: 6, lifeorb: 5, rockyhelmet: 4, luckyegg: 3, amuletcoin: 1 };
const STAT_RANK = { atk: 200, cd: 190, def: 205, hp: 180, spd: 160, rgn: 150, xp: 95, mag: 85, heal: 0 };

function fallbackCards() {
  /** Hueco principal: el de más daño. */
  // (el más subido de nivel: comprometerse con uno compensa, las mejoras y la evolución se acumulan)
  const mainGroup = pl => pl.slots.reduce((b, g) => (!b || gv(pl, g) > gv(pl, b) ? g : b), null) || [];
  return {
    card(cards, { G, pl }) {
      const main = mainGroup(pl);
      const mainMove = main.filter(m => m.kind !== 'buff').sort((a, b) => mv(pl, b) - mv(pl, a))[0];
      const dmgMoves = pl.moves.filter(m => m.kind !== 'buff').length;
      const hasAtkBuff = pl.moves.some(m => m.kind === 'buff' && m.stat === 'atk');
      const score = c => {
        const [type, id] = c.key.split(':');
        if (type === 'evo') return 1000 + (main.some(m => m.id === id) ? 50 : 0);
        if (type === 'up') {
          const m = pl.moves.find(x => x.id === id);
          if (!m) return 0;
          if (main.includes(m)) return m === mainMove ? 520 : 470;
          if (m.kind === 'buff') return 140;
          return 40;
        }
        if (type === 'new') {
          const d = G.Moves.BY_ID[id];
          if (d.kind === 'buff') {
            if (d.stat === 'atk' && !hasAtkBuff) return 360;
            if (d.stat === 'def' && pl.moves.filter(m => m.kind === 'buff').length < 1) return 260;
            return 60;
          }
          // Más movimientos de daño = material para los vínculos de las grietas.
          return dmgMoves < 2 ? 175 : 90;
        }
        if (type === 'stat') {
          if (id === 'heal') return pl.hp < pl.maxHp * 0.45 ? 600 : 10;
          // La que hace falta para evolucionar el principal (basta una vez).
          if (mainMove && G.Moves.EVO[mainMove.id] && G.Moves.EVO[mainMove.id][1] === id && !(pl.statsTaken[id] > 0))
            return mainMove.lvl >= mainMove.def.maxLvl ? 900 : 400;
          return STAT_RANK[id] || 50;
        }
        return 0;
      };
      let bi = 0, bs = -Infinity;
      cards.forEach((c, i) => { const s = score(c); if (s > bs) { bs = s; bi = i; } });
      return bi;
    },
    item(cur, next, { pl }) {
      const r = id => (ITEM_RANK[id] || 0) - (id === 'choiceband' && pl.moves.some(m => m.kind === 'buff') ? 3 : 0);
      return r(next) > r(cur) ? next : cur;
    },
    bond(opt, { pl }) {
      const val = m => m.kind === 'buff' ? (m.stat === 'atk' ? 1e4 : m.stat === 'def' ? 50 : 20) : dpsOf(m) * (m.lvl || 1);
      const loose = opt.loose.slice().sort((a, b) => val(b) - val(a));
      if (opt.mode === 'add') return [loose[0]];
      // Par: el de más daño primero (el grupo nace en su hueco) y el mejor compañero.
      const dmg = loose.filter(m => m.kind !== 'buff').sort((a, b) => dpsOf(b) - dpsOf(a));
      const first = dmg[0] || loose[0];
      const second = loose.find(m => m !== first);
      return second ? [first, second] : [];
    }
  };
}

let shared = null;
function cardLogic(opts) {
  if (opts.ownCards) return fallbackCards();
  try {
    const mk = require('./cards');
    if (typeof mk === 'function') { const o = mk(opts); if (o && o.card) return o; }
  } catch (e) { /* aún no existe o no carga */ }
  return shared || (shared = fallbackCards());
}

// ---------------- el bot ----------------

module.exports = (opts = {}) => {
  MAIN_ID = opts.main || null;
  const cards = cardLogic(opts);
  const fb = fallbackCards();
  let prevA = null;            // dirección elegida en el fotograma anterior (ángulo o null = quieto)
  let orbitSign = 1, orbitT = 0;
  let goal = null, goalT = 0;
  let buffMode = null, buffT = 0;
  let lastFrame = -1, cacheMove = [0, 0];
  let arceus = null;
  // Caché de paredes (isFree es caro): por puntos de una rejilla de 8 px; se vacía cada 4 s.
  let freeCache = new Map(), freeCacheT = 0, freeR = 0;
  let traps = [], trapsT = 0;
  const freeAt = (G, x, y, r) => {
    const qx = Math.round(x / 8), qy = Math.round(y / 8), k = qx * 1048576 + qy;
    let v = freeCache.get(k);
    if (v === undefined) { v = G.World.isFree(qx * 8, qy * 8, r, true); freeCache.set(k, v); }
    return v;
  };

  function slotChoice(api) {
    const { pl, G } = api;
    if (pl.hasItem && pl.hasItem('choiceband')) return null;
    if (!pl.slots.length) return null;
    // Mejor hueco de daño.
    let best = 0, bv = -1;
    pl.slots.forEach((g, i) => { const v = gv(pl, g); if (v > bv) { bv = v; best = i; } });
    let dmgSlot = best;
    // Si cards.js elige el foco, manda ella (así mejora lo que se usa).
    if (cards.active && !opts.ownFocus) {
      const i = cards.active(api);
      if (i != null && pl.slots[i] && pl.slots[i].some(m => m.kind !== 'buff')) dmgSlot = i;
    }

    // Potenciadores sueltos: se recargan a ratos y se vuelve al de daño.
    if (!opts.noBuffCycle) {
      const buffSlots = pl.slots.map((g, i) => ({ g, i })).filter(o => o.g.length === 1 && o.g[0].kind === 'buff');
      if (buffMode != null) {
        const g0 = pl.slots[buffMode];
        const m = g0 && g0.length === 1 && g0[0].kind === 'buff' ? g0[0] : null;
        const b = m && pl.buffs[m.stat];
        buffT += 1 / 30;
        // Sale cuando acaba de lanzarlo y está al máximo, o si tarda demasiado.
        const full = b && b.n >= Math.max(1, m.stacks | 0) && b.t > m.dur - 0.12;
        if (!m || !b || full || buffT > 5 || danger(api) > 0.5 || (b.n < m.stacks && !clearAround(api, 150))) { buffMode = null; }
        else return buffMode;
      }
      for (const { g, i } of buffSlots) {
        const m = g[0], b = pl.buffs[m.stat];
        if (!b) continue;
        // Mantener (al máximo y a punto de caducar) siempre que no haya nadie
        // pegado; acumular desde cero sólo con el camino despejado.
        const max = Math.max(1, m.stacks | 0);
        const keep = b.n >= max && b.t < 1.0 && danger(api) < 1.2;
        const build = b.n < max && clearAround(api, 220);
        if (keep || build) { buffMode = i; buffT = 0; return i; }
      }
    }
    return dmgSlot;
  }

  /** Peligro inmediato (cuántos enemigos pegados ahora mismo, más o menos). */
  function danger({ pl, G }) {
    let d = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 70)) {
      const gap = Math.hypot(e.x - pl.x, e.y - pl.y) - e.r - pl.r;
      if (gap < 30) d += e.boss ? 2 : 1;
    }
    return d;
  }

  function clearAround({ pl, G }, r) {
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, r)) if (!e.dead) return false;
    return true;
  }

  function arceusPos(G) {
    if (!G.Judgment.active) return null;
    try { const s = G.Judgment.netState(); if (s) return { x: s[0], y: s[1], r: 46 }; } catch (e) { /* nada */ }
    return null;
  }

  // Valor de un objeto del suelo.
  let xpOnGround = 0;
  function pickupValue(p, pl) {
    switch (p.kind) {
      case 'xp': return p.value;
      case 'xpBig': return p.value * 1.1;
      case 'heal': return pl.hp < pl.maxHp * 0.85 ? 60 + (1 - pl.hp / pl.maxHp) * 200 : 0;
      case 'magnet': return 60 + xpOnGround * 0.8;
      case 'bomb': return 25;
      case 'item': return 150;
      case 'ticket': case 'ticket10': case 'coin': return 3;
    }
    return 0;
  }

  /** Elige un sitio al que ir (o null): experiencia, curas, grieta, altares... */
  function pickGoal(api, enemies, band) {
    const { G, pl } = api;
    const hpK = pl.hp / pl.maxHp;
    let best = null, bs = 0;
    const nearEnemies = (x, y, r) => {
      let n = 0;
      for (const e of enemies) if (Math.abs(e.x - x) < r + e.r && Math.abs(e.y - y) < r + e.r && Math.hypot(e.x - x, e.y - y) < r + e.r) n += e.boss ? 3 : 1;
      return n;
    };
    const consider = (x, y, v, tag, radius = 70) => {
      if (v <= 0) return;
      const d = Math.hypot(x - pl.x, y - pl.y);
      const crowd = nearEnemies(x, y, radius);
      const s = v / Math.pow(d + 90, 1.25) / (1 + crowd * (opts.crowdK == null ? 0.35 : opts.crowdK));
      if (s > bs) { bs = s; best = { x, y, tag }; }
    };
    // Grieta: siempre (la arena no deja morir: si caes, vuelves con algo de vida).
    const rift = G.Rift.rift;
    if (rift && !opts.noRift && !G.Rift.inArena) consider(rift.x, rift.y - 10, 4000, 'rift', 40);
    // Objetos del suelo (agrupa la experiencia cercana).
    const pk = G.Pickups.all();
    xpOnGround = 0;
    for (const p of pk) if (p.kind === 'xp' || p.kind === 'xpBig') xpOnGround += p.value;
    if (pk.length) {
      const R = 650;
      for (const p of pk) {
        if (Math.abs(p.x - pl.x) > R || Math.abs(p.y - pl.y) > R) continue;
        let v = pickupValue(p, pl);
        if (v <= 0) continue;
        if (p.kind === 'xp' || p.kind === 'xpBig') {
          for (const q of pk) if (q !== p && (q.kind === 'xp' || q.kind === 'xpBig') && Math.abs(q.x - p.x) < 70 && Math.abs(q.y - p.y) < 70) v += q.value * 0.7;
        }
        consider(p.x, p.y, v, p.kind);
      }
    }
    // Altares, manantiales, cofres con candado.
    for (const s of G.World.specialsNear(pl.x, pl.y, 600)) {
      if (s.type === 'altar' && !s.used) consider(s.x, s.y, 160, 'altar', 60);
      else if (s.type === 'spring' && s.charge > 0.15 && hpK < 0.6) consider(s.x, s.y - 8, 150 + (1 - hpK) * 600, 'spring', 60);
      else if (s.type === 'bigchest' && hpK > 0.5) consider(s.x, s.y, 60 + pl.xpNext * 0.5, 'chest', 90);
    }
    return best;
  }

  /**
   * Punto intermedio hacia el objetivo usando el campo de distancias de los
   * enemigos (G.Path, centrado en ti): desde el objetivo se baja por el camino
   * hasta un punto que ya se ve en línea recta. false = sin camino.
   */
  function waypoint(G, pl, g) {
    const lineFree = (ax, ay, bx, by) => {
      const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 12);
      for (let i = 1; i <= n; i++) { const t = i / n; if (!G.World.isFree(ax + (bx - ax) * t, ay + (by - ay) * t, pl.r * 0.7, true)) return false; }
      return true;
    };
    // A los sólidos (cofre, altar) se llega a su lado, no al centro.
    let x = g.x, y = g.y;
    if (g.tag === 'chest' || g.tag === 'altar') {
      const [nx, ny] = norm(pl.x - g.x, pl.y - g.y);
      x += nx * 26; y += ny * 26;
    }
    if (lineFree(pl.x, pl.y, x, y)) return null;
    const TS = G.World.TS || 32;
    for (let i = 0; i < 80; i++) {
      const d = G.Path.dirFor({ x, y, r: pl.r }, pl);
      if (!d) return i === 0 ? false : { x, y };
      x += d[0] * TS * 0.7; y += d[1] * TS * 0.7;
      if (Math.hypot(x - pl.x, y - pl.y) < TS * 1.5) return { x, y };
    }
    return { x, y };
  }

  function move(api) {
    const { G, pl } = api;
    if (api.time === lastFrame) return cacheMove;
    lastFrame = api.time;

    const enemies = G.EnemyMgr.all().filter(e => !e.dead && !e.remote);
    const shots = G.Projectiles.all().filter(p => !p.friendly);
    const hazards = G.Hazards.all.filter(h => !h.hit);
    const spd = Math.max(40, pl.spd);
    const g = pl.activeGroup();
    const band = bandOfGroup(g);
    const bandD = band.d * (opts.band || 1);
    arceus = arceusPos(G);
    const hpK = pl.hp / pl.maxHp;
    // Con poca vida, más prudente: más holgura y menos cuerpo a cuerpo.
    const caution = hpK < 0.35 ? 1.6 : hpK < 0.6 ? 1.25 : 1;
    const contactW = Math.min(1, band.contactW * caution);
    const margin = band.margin * caution * (opts.margin || 1);

    // Enemigos relevantes (cerca) y centro ponderado de la horda.
    const near = [];
    let cx = 0, cy = 0, cw = 0, nearest = Infinity;
    for (const e of enemies) {
      const dx = e.x - pl.x, dy = e.y - pl.y;
      if (Math.abs(dx) > 520 || Math.abs(dy) > 520) continue;
      const d = Math.hypot(dx, dy);
      if (d > 520) continue;
      near.push(e);
      const w = 1 / (d + 40);
      cx += dx * w; cy += dy * w; cw += w;
      if (d - e.r < nearest) nearest = d - e.r;
    }
    if (arceus) near.push({ x: arceus.x, y: arceus.y, r: arceus.r, spd: spd * 1.2, dmg: pl.maxHp * 0.4, boss: true, arceus: true });
    const opennessW = opts.open == null ? 1 : opts.open;
    const hordeA = cw > 0 ? Math.atan2(cy / cw, cx / cw) : null;

    // Objetivo (experiencia, grieta...), recalculado cada 0,3 s.
    if (--goalT <= 0 || (goal && Math.hypot(goal.x - pl.x, goal.y - pl.y) < 14 && goal.tag !== 'chest' && goal.tag !== 'spring')) {
      goal = pickGoal(api, enemies, band); goalT = 9;
    }
    if (G.Judgment.active) goal = null;
    // Camino al objetivo rodeando paredes: se va a un punto intermedio a la vista.
    if (goal && goalT === 9) {
      goal.wp = waypoint(G, pl, goal);
      if (goal.wp === false) { goal = null; }
    }
    api.__goal = goal;

    // Cambia el sentido del rodeo de vez en cuando o si se atasca.
    orbitT -= 1 / 30;

    const eDmgW = e => (e.arceus ? 8 : Math.max(0.5, Math.min(5, (e.dmg || 10) / Math.max(20, pl.maxHp * 0.12)))) * (e.boss && !e.arceus ? 1.6 : 1);

    // Predicción de un enemigo a h segundos, yendo hacia el punto P.
    const predict = (e, h, px, py) => {
      if (e.phase === 'dash' && e.dx != null && !e.boss) {
        const t = Math.min(h, Math.max(0, e.pt)), s = e.spd * 3.4;
        const x = e.x + e.dx * s * t, y = e.y + e.dy * s * t;
        const rest = h - t;
        const [nx, ny] = norm(px - x, py - y);
        return [x + nx * e.spd * rest * 0.3, y + ny * e.spd * rest * 0.3];
      }
      if (e.phase === 'aim' && !e.boss) {
        // Apuntando: al acabar sale disparado hacia donde estés.
        const t0 = Math.max(0, e.pt);
        if (h <= t0) return [e.x, e.y];
        const [nx, ny] = norm(pl.x - e.x, pl.y - e.y);
        const s = e.spd * 3.4, t = Math.min(h - t0, 0.42);
        return [e.x + nx * s * t, e.y + ny * s * t];
      }
      if (e.jump || (e.behavior === 'bomber' && e.phase === 'fuse')) return [e.x, e.y];
      if (e.keepsDistance && !e.boss && e.keepsDistance()) {
        const d = Math.hypot(px - e.x, py - e.y), keep = (e.def.range || 200) * 0.82;
        if (d < keep) return [e.x, e.y];
      }
      const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
      const s = (e.spd || 60) * (1 - (e.slow || 0)) * h;
      const k = Math.min(1, s / d);
      return [e.x + dx * k, e.y + dy * k];
    };

    const liquidBad = (() => { const le = G.World.liquidEffect(pl.mon.types); return le.dmg ? 4 : le.slow ? 1.2 + Math.min(2, near.length * 0.15) : le.slide ? 0.5 : 0; })();
    if (--trapsT <= 0) { trapsT = 8; traps = G.World.specialsNear(pl.x, pl.y, 200).filter(s => s.type === 'trap' && !s.broken); }
    const wr = pl.r * 0.75;
    if ((freeCacheT -= 1 / 30) <= 0 || wr !== freeR || freeCache.size > 200000) { freeCache = new Map(); freeCacheT = 4; freeR = wr; }

    let bestA = null, bestC = Infinity;
    const cands = [];
    for (let i = 0; i < NDIR; i++) cands.push(i / NDIR * TAU);
    cands.push(null);

    for (const a of cands) {
      const ux = a == null ? 0 : Math.cos(a), uy = a == null ? 0 : Math.sin(a);
      let cost = 0;
      // Trayectoria con paredes: avanza a pasos hasta chocar.
      const maxH = HORIZONS[HORIZONS.length - 1];
      const step = 8, total = spd * maxH;
      let free = total;
      if (a != null) {
        for (let d = step; d <= total; d += step) {
          if (!freeAt(G, pl.x + ux * d, pl.y + uy * d, wr)) { free = d - step; break; }
        }
      }
      const posAt = t => { const d = Math.min(free, spd * t); return [pl.x + ux * d, pl.y + uy * d]; };
      if (a != null && free < total) cost += 0.6 * (1 - free / total);
      // Trampas: no pisarlas (saltan a menos de 13 px).
      for (const t of traps) {
        for (const tt of [0.05, 0.12, 0.2, 0.3]) {
          const [px, py] = posAt(tt);
          if (Math.hypot(px - t.x, py - (t.y - 8)) < 22) { cost += 3; break; }
        }
      }

      for (let hi = 0; hi < HORIZONS.length; hi++) {
        const h = HORIZONS[hi], w = HW[hi];
        const [px, py] = posAt(h);
        let nearD = Infinity, crowd = 0;
        for (const e of near) {
          const [ex, ey] = predict(e, h, px, py);
          const gap = Math.hypot(px - ex, py - ey) - e.r - pl.r;
          const m = (e.arceus ? 70 : margin) * (e.boss ? 1.5 : 1);
          if (gap < m) {
            const k = gap < 0 ? 1 + Math.min(3, -gap / 12) : (m - gap) / m;
            cost += w * k * k * 3 * eDmgW(e) * (e.arceus || e.boss ? 1 : contactW);
          }
          if (!e.arceus) {
            const cd = Math.hypot(px - ex, py - ey) - e.r;
            if (cd < nearD) nearD = cd;
            if (cd < 110) crowd += (110 - cd) / 110;
          }
        }
        // Encerrado: mucha gente alrededor (aunque no toquen) es mala señal.
        cost += w * 0.12 * crowd * crowd * (band.open || 1);
        // Banda de distancia (sólo con enemigos a la vista).
        if (nearD < 480 && hi === HORIZONS.length - 1) {
          const err = (nearD - bandD) / Math.max(60, bandD);
          cost += 0.9 * (band.pull || 1) * (err > 0 ? Math.min(err, 2.5) * 0.7 : err * err * 1.4 / (band.pull || 1));
        }
        // Charcos que hacen daño.
        if (liquidBad && G.World.isLiquid(px, py)) cost += w * liquidBad;
      }

      // Disparos enemigos: distancia en cada instante hasta 0,7 s.
      for (const s of shots) {
        const rr = (s.r || 6) + pl.r + 5;
        if (Math.abs(s.x - pl.x) > 300 || Math.abs(s.y - pl.y) > 300) continue;
        for (let t = 0.05; t <= 0.7; t += 0.08) {
          const [px, py] = posAt(t);
          const sx = s.x + (s.vx || 0) * t, sy = s.y + (s.vy || 0) * t;
          if ((px - sx) ** 2 + (py - sy) ** 2 < rr * rr) {
            cost += 2.2 * Math.max(0.5, Math.min(4, (s.dmg || 10) / Math.max(15, pl.maxHp * 0.1))) * (1 - t);
            break;
          }
        }
      }

      // Zonas avisadas: ¿estarás dentro cuando estallen?
      for (const hz of hazards) {
        const left = hz.delay - hz.t;
        if (left < 0) continue;
        const tt = Math.min(Math.max(left, 0.05), 1.1);
        const [px, py] = posAt(tt);
        const harm = hz.pct ? hz.pct * 10 : Math.max(1, Math.min(6, hz.dmg / Math.max(15, pl.hp * 0.12)));
        // Graduado por lo hondo que quedas: salir hacia el borde siempre mejora.
        const dep = hazardDepth(hz, px, py, pl.r);
        if (opts.oldHz) { if (dep > 0) cost += 3.5 * harm * (left < 0.5 ? 1.5 : 1); }
        else if (dep > -14) cost += harm * (dep > 0 ? 3 + dep / 12 : 0.6 * (14 + dep) / 14) * (left < 0.5 ? 1.4 : 1);
      }

      // En el agua (o entrando): mejor la dirección con la orilla más cerca.
      if (liquidBad && a != null) {
        const [ex, ey] = posAt(0.8);
        if (pl.inLiquid || G.World.isLiquid(ex, ey)) {
          let shore = 240;
          for (let d = 0; d <= 240; d += 24) if (!G.World.isLiquid(pl.x + ux * d, pl.y + uy * d)) { shore = d; break; }
          cost += liquidBad * 0.5 * shore / 240;
        }
      }

      // Hacia dónde hay hueco: enemigos en esa dirección (más cuanto más cerca).
      if (a != null) {
        let dens = 0;
        for (const e of near) {
          const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy) || 1;
          if (d > 320) continue;
          const c = (dx * ux + dy * uy) / d;
          if (c > 0.3) dens += (c - 0.3) * (e.arceus ? 6 : e.boss ? 2 : 1) * 60 / (d + 30);
        }
        cost += 0.35 * opennessW * (band.open || 1) * dens;
      } else {
        // Quedarse quieto con gente cerca: te rodean.
        let close = 0;
        for (const e of near) if (Math.hypot(e.x - pl.x, e.y - pl.y) - e.r < 140) close++;
        cost += 0.25 * close * opennessW;
      }

      // Jefes a punto de dar un pisotón (onda de 96 + su radio alrededor, 0,85 s de aviso).
      for (const e of near) {
        if (!e.boss || !e.ai || e.ai.cast || e.ai.cd > 0.9 || opts.noSlam) continue;
        const tt = Math.max(0, e.ai.cd) + 0.6;
        const [px, py] = posAt(tt);
        const dep = (96 + e.r) + pl.r * 0.6 - Math.hypot(px - e.x, py - e.y);
        if (dep > -10) {
          const harm = Math.max(1, Math.min(6, e.dmg * 1.3 / Math.max(15, pl.hp * 0.12)));
          cost += 0.6 * harm * (dep > 0 ? 1 + dep / 20 : (10 + dep) / 10 * 0.3);
        }
      }

      // Rodear: mejor de lado que de frente o de espaldas a la horda.
      if (hordeA != null && a != null && nearest < 260) {
        const rel = Math.cos(a - (hordeA + orbitSign * Math.PI / 2));
        cost -= band.orbit * 0.35 * rel;
      }

      // Objetivo (experiencia, grieta...): premia acercarse.
      if (goal) {
        const [px, py] = posAt(0.45);
        const tx = goal.wp ? goal.wp.x : goal.x, ty = goal.wp ? goal.wp.y : goal.y;
        const d0 = Math.hypot(tx - pl.x, ty - pl.y), d1 = Math.hypot(tx - px, ty - py);
        const gw = goal.tag === 'rift' ? 1.6 : goal.tag === 'spring' ? 1.2 : goal.tag === 'chest' ? 0.8 : goal.tag === 'item' || goal.tag === 'altar' || goal.tag === 'magnet' ? 1.0 : (opts.xpW || 0.9);
        const dd = Math.max(1, spd * 0.45);
        cost -= gw * Math.max(-1, Math.min(1, (d0 - d1) / dd)) * (hpK < 0.3 && goal.tag !== 'spring' && goal.tag !== 'heal' ? 0.4 : 1);
        // En el cofre o el manantial, quedarse quieto también vale.
        if (a == null && !goal.wp && d0 < 40 && (goal.tag === 'chest' || goal.tag === 'spring')) cost -= gw * 0.9;
      } else if (!near.length && a == null) cost += 0.15;    // sin nada que hacer, mejor moverse

      // Inercia: no cambiar de idea a cada fotograma.
      if (prevA != null && a != null) cost += 0.08 * (1 - Math.cos(a - prevA));
      else if ((prevA == null) !== (a == null)) cost += 0.05;

      if (cost < bestC) { bestC = cost; bestA = a; }
    }

    // Si el mejor movimiento casi no avanza (pared), cambia el sentido del rodeo.
    if (orbitT <= 0 && bestA != null && hordeA != null) {
      const rel = Math.cos(bestA - (hordeA + orbitSign * Math.PI / 2));
      if (rel < -0.3) { orbitSign = -orbitSign; orbitT = 2.5; }
    }
    prevA = bestA;
    cacheMove = bestA == null ? [0, 0] : [Math.cos(bestA), Math.sin(bestA)];
    return cacheMove;
  }

  return {
    name: 'spacer',
    init() { prevA = null; goal = null; buffMode = null; },
    move,
    active: slotChoice,
    card: (c, api) => (cards.card || fb.card)(c, api),
    item: (a, b, api) => (cards.item || fb.item)(a, b, api),
    bond: (o, api) => (cards.bond || fb.bond)(o, api),
    secondMove: cards.secondMove ? (pool, api) => cards.secondMove(pool, api) : undefined
  };
};

/** Cuánto dentro de una zona avisada está un círculo (positivo = dentro), como G.Hazards.inside. */
function hazardDepth(h, x, y, r) {
  if (h.kind === 'zone') return h.r + r * 0.6 - Math.hypot(x - h.x, y - h.y);
  const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
  const px = x - h.x, py = y - h.y;
  const along = px * ca + py * sa;
  const side = h.w / 2 + r * 0.6 - Math.abs(-px * sa + py * ca);
  const end = Math.min(along + r, h.len + r - along);
  return Math.min(side, end);
}

function norm(x, y) { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; }
