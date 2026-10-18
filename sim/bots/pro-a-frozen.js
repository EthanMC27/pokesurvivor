/* ============ sim/bots/pro-a-frozen.js — copia CONGELADA de pro-a.js (commit c8f3101) ============
 * Para los experimentos de cartas (cards-v3): movimiento fijo; opts.cardsFile = política
 * de cartas ('cards-v2' por defecto, 'cards-v3', 'cards'...). Vetos (--ban auto): los de v2.
 *
 * --- cabecera original ---
 * sim/bots/pro-a.js — bot de supervivencia unificado
 *
 * Parte de spacer.js (banda de distancia según el ataque activo, rodeo,
 * recarga de potenciadores) con lo mejor de dodger.js (trayectorias simuladas
 * con el modelo de cada enemigo: corredores que te cortan el paso, embestidas,
 * jefes) y de forager.js (objetivos del mapa, grietas, Sentencia, colisiones).
 *
 * Movimiento: cada fotograma prueba DIRS direcciones (y quedarse quieto),
 * simula ~1,25 s y suma:
 *
 *   daño      cada golpe previsto (contacto, disparo, zona avisada) con su
 *             instante; los golpes se ordenan y se aplica la invulnerabilidad
 *             de 0,45 s tras cada uno (como Player.hurt): en una multitud no se
 *             recibe más de un golpe cada 0,45 s, y eso cambia qué salida es mejor.
 *             Las zonas avisadas no respetan la invulnerabilidad (como el juego).
 *             En unidades de "vida máxima"; lo letal pesa mucho más.
 *   cerco     enemigos alrededor de donde acabas (por sectores: estar rodeado
 *             por varios lados es peor que tener a todos detrás), callejones
 *             y rincones.
 *   banda     distancia ideal al más cercano según el ataque activo, y rodeo
 *             (de lado respecto a la horda).
 *   objetivo  grieta (al entrar se acaba el peligro: lo que pasaría después
 *             no cuenta), curas, objetos, altares, manantiales, cofres,
 *             experiencia.
 *
 * Más cosas que cuentan:
 *   - la embestida propia (Ataque Rápido...) te lleva hasta el blanco: se simula
 *     dentro de la trayectoria; un hueco que sólo embiste no se usa de foco; si la
 *     embestida mete en algo grave y hay otro hueco de daño, se cambia un rato; y
 *     no se coge la Cinta Elección teniendo una embestida (no dejaría cambiar);
 *   - histéresis: se sigue con la dirección anterior salvo que otra sea claramente
 *     mejor (sin ella cambia de idea cada fotograma y en la práctica se queda quieto);
 *   - se replanea cada 2 fotogramas salvo peligro inmediato (CPU);
 *   - jefe del mapa vivo y ataque a distancia: se queda a tiro de él (apuntan
 *     primero al jefe a < 330 y mientras vive no se abren grietas);
 *   - jefes a punto de elegir ataque: fuera del radio del pisotón antes del aviso.
 *
 * Grietas: siempre se entra. La arena es tiempo de partida casi sin peligro
 * (la horda se guarda) y caer dentro no acaba la partida. Si el legendario se
 * puede vencer (su vida / el daño a un enemigo que mide el propio juego al
 * entrar) se pelea a la distancia del ataque (sin miedo al "cerco", sólo está
 * él); si no, se esquiva hasta que se acaba el tiempo.
 *
 * Sentencia (minuto 30): lejos de Arceus (su avance se simula, parado mientras
 * lanza), dando vueltas a la arena con él al otro lado, lejos de los
 * legendarios y del borde, esquivando pilares, cruces y ondas.
 *
 * Cartas, objetos, vínculos y hueco activo: cards.js (v2) o cards-v1.js.
 * bot.stats: { rifts, won, lost, judgeKills } (para los bancos de pruebas).
 *
 * Opciones (--opts '{...}'):
 *   cards: 'v1' | 'v2'   política de decisiones (v2 = cards.js; por defecto v2 y,
 *                        si no carga, v1)
 *   dirs (24), noRift, swap (cambio de hueco rápido para acortar recargas: ver
 *   nota en slotChoice; por defecto no), stall (alargar la grieta; no), dbg
 *   ([t0, t1]: vuelca la puntuación de cada dirección), y los pesos de P (abajo).
 *   Ronda 3 (apagadas, sin mejora clara): lowHpK/lowBand (vida baja), bandPick 'dmg'
 *   (banda del movimiento que más daño hace en un grupo), escW/escR (salidas de los rincones).
 *   meleeMul (0,3) sí: ver best.js.
 *   El resto pasa a la política de cartas.
 */
'use strict';

const TAU = Math.PI * 2;

// ---------------- política de decisiones ----------------

function loadCards(opts) {
  const tryLoad = name => {
    try {
      const mk = require('./' + name);
      const c = typeof mk === 'function' ? mk(opts) : mk;
      if (c && typeof c.card === 'function') return c;
    } catch (e) { /* no existe o no carga */ }
    return null;
  };
  // Por defecto la v2 (cards.js); si no carga, la v1 congelada. opts.cards: 'v1' | 'v2'.
  if (opts.cards === 'v1') return tryLoad('cards-v1');
  // Copia congelada (17-10-2026) para los experimentos de cartas: opts.cardsFile elige la política.
  return tryLoad(opts.cardsFile || 'cards-v2');
}

// ---------------- banda de distancia (de spacer.js) ----------------

function bandFor(m) {
  switch (m.kind) {
    case 'melee':      return { d: Math.max(24, m.radius * 0.45), orbit: 0.25, pull: 2.5, open: 0.5, melee: true };
    case 'aura':       return { d: Math.max(24, m.radius * 0.55), orbit: 0.35, pull: 2, open: 0.6 };
    case 'orbit':      return { d: Math.max(30, m.radius * 0.85), orbit: 0.45, pull: 1.6, open: 0.7 };
    case 'dash':       return { d: Math.max(60, m.radius * 0.75), orbit: 0.35, pull: 1.3, open: 0.8 };
    case 'trail':      return { d: 70, orbit: 0.9 };
    case 'mine':       return { d: 90, orbit: 0.7 };
    case 'cone':       return { d: Math.max(70, (m.speed * m.life) * 0.55), orbit: 0.45 };
    case 'nova':       return { d: Math.max(80, (m.speed * m.life) * 0.4), orbit: 0.5 };
    case 'boomerang':  return { d: Math.max(90, m.radius * 0.6), orbit: 0.5 };
    case 'beam':       return { d: Math.max(90, m.radius * 0.6), orbit: 0.45 };
    case 'chain':      return { d: 200, orbit: 0.5 };
    case 'meteor':     return { d: 190, orbit: 0.5 };
    case 'turret':     return { d: 150, orbit: 0.65 };
    case 'projectile': return { d: 215, orbit: 0.5 };
  }
  return { d: 150, orbit: 0.5 };
}
function bandOfGroup(g) {
  let best = null;
  for (const m of g) {
    if (m.kind === 'buff') continue;
    const b = bandFor(m);
    if (!best || b.d < best.d) best = b;
  }
  return best || { d: 160, orbit: 0.5 };
}
/** Alcance de lanzamiento (copia de reach() de combat.js). */
function reachOf(m) {
  switch (m.kind) {
    case 'melee': return m.radius + 30;
    case 'beam': return m.radius + 20;
    case 'boomerang': return m.radius + 40;
    case 'chain': return 280;
    case 'meteor': return 340;
    case 'dash': return m.radius + 60;
    case 'cone': return m.speed * m.life + 30;
    case 'projectile': return 520;
    case 'aura': case 'orbit': return (m.radius || 60) + 10;
  }
  return 200;
}

function norm(x, y) { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; }

/** Distancia mínima al origen del segmento (ax,ay)-(bx,by). */
function segMin(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? -(ax * dx + ay * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + dx * t, ay + dy * t);
}

// Tiempos de la simulación y peso de cada uno (lo lejano es más incierto).
const T = [0.1, 0.2, 0.3, 0.42, 0.56, 0.72, 0.9, 1.1, 1.3];
const NT = T.length;
const BAND_K = [4, 6, NT - 1], BAND_END = [NT - 1];
const TW = T.map(t => t < 0.35 ? 1 : Math.max(0.45, 1 - (t - 0.35) * 0.55));

module.exports = (opts = {}) => {
  const P = Object.assign({
    dirs: 24,
    // --- pesos del coste (en "vidas máximas") ---
    wDmg: 1,          // daño previsto
    lethal: 3,        // extra si el daño previsto te deja a cero
    wCrowd: 0.05,     // gente alrededor del final
    crowdCap: 14,     //   (tope de esa suma)
    wSect: 0.05,      // sectores ocupados alrededor del final (cerco)
    wDens: 0.07,      // gente en la dirección (más allá del horizonte)
    wBand: 0.05,      // banda de distancia
    bandPath: false,  //   medida en varios instantes del camino (si no, al final; con el legendario, siempre)
    wOrbit: 0.03,     // rodeo
    wWall: 0.04,      // paredes delante / rincones
    escW: 0,          // salidas: desde el final, rayos (8) libres hasta escR px; pocos = callejón (con la horda cerca)
    escR: 150,
    wGoal: 0.08,      // objetivo
    wRift: 0.35,      // grieta
    wXp: 0.05,        // experiencia
    wInertia: 0.012,
    margin0: 3, marginT: 12,  // holgura de contacto (px) = margin0 + marginT·t
    lowHpK: 1.2,              // con poca vida el daño previsto pesa hasta 1 + esto (por debajo del 60 %)
    bandPick: 'min',          // banda de un grupo: 'min' (la más corta) | 'dmg' (la del movimiento que más daño hace, según cards)
    lowBand: 0,               // con poca vida (< 50 %) la banda se aleja hasta ×(1 + esto) (no cuerpo a cuerpo)
    invul: 0.45,              // invulnerabilidad tras un golpe (Player.hurt)
    runnerK: 1, runnerNear: 0,   // miedo extra a los corredores (probado: sin efecto claro)
    // --- decisión ---
    every: 2,                 // replanear cada N fotogramas (salvo peligro inmediato)
    hyst: 0.03, hystK: 0.1,   // histéresis de la dirección
    // --- cuerpo a cuerpo / embestidas ---
    meleeFear: 1, meleePull: 1, meleeCrowd: 1,  // con cuerpo a cuerpo: miedo al contacto, tirón de la banda, peso del cerco (probados 0,5-0,7 / 2-3 / 0,4: nada mejor)
    noLoneDash: true,         // un hueco que sólo embiste no es foco
    dashEscape: true,         // si la embestida lleva a algo grave, cambiar de hueco un rato
    dashSafe: false,          // no usar el hueco con embestida si hay zonas avisadas o un jefe cerca
    noBandDash: true,         // no coger la Cinta Elección teniendo una embestida
    dashMul: 0.25,            // kindMul.dash que se pasa a la política de cartas
    meleeMul: 0.3,            // kindMul.melee que se pasa a la política de cartas (cards.js: 0,6). Ronda 3
                              //   (17-10-2026): 0,3 → ×1,13 de tiempo en 160 partidas (Machamp ×1,5): el foco
                              //   deja de ser un golpe de cerca que te mete en la horda
    // --- jefes y grieta ---
    bossBand: true,           // con ataque a distancia, quedarse a tiro del jefe del mapa
    preSlam: 0.6,             // peso del pisotón aún no avisado
    arenaPull: 3,             // en la grieta, si se pelea, la banda tira más (sólo está el legendario)
    ringW: 0.08,              // borde de la arena de la grieta
    stall: false,             // alargar la grieta (ver legendPlan; probado: no mejora)
    // --- Sentencia ---
    jLegW: 0.06, jLegR: 220,  // lejos de los legendarios
    jArc: 0.9, jArcR: 300,    // lejos de Arceus (al final del horizonte)
    jGoal: 0.12, jAhead: 0.5, jR: 0.55,   // punto de la vuelta a la arena
    jEdge0: 0.72, jEdgeW: 0.5             // borde
  }, opts);

  // La embestida propia vale poco para un bot que quiere sobrevivir (te mete en la
  // horda): que la política de cartas tampoco la haga foco (salvo que se diga otra cosa).
  const cards = loadCards(Object.assign({}, opts, { kindMul: Object.assign({ dash: P.dashMul, melee: P.meleeMul }, opts.kindMul || {}) }));
  const NDIR = P.dirs;
  const DX = [], DY = [];
  for (let i = 0; i < NDIR; i++) { DX.push(Math.cos(i / NDIR * TAU)); DY.push(Math.sin(i / NDIR * TAU)); }
  DX.push(0); DY.push(0);
  const NC = NDIR + 1;

  let G = null;
  let prevI = NDIR;
  let goal = null, goalT = 0;
  let orbitSign = 1, orbitT = 0, stuckT = 0, lastX = 0, lastY = 0;
  let buffMode = null, buffT = 0;
  const known = new Map();      // manantiales y altares vistos
  const aimDir = new WeakMap(); // embestida apuntada: dirección al empezar
  let freeCache = new Map(), freeCacheT = 0, freeR = 0;
  let lastFrame = -1, cacheMove = [0, 0];
  let swapT = 0, frameN = 0;
  /** ¿Algo a punto de pasar? (zona que estalla, disparo o enemigo muy cerca) */
  function urgent(pl) {
    for (const h of G.Hazards.all) if (!h.hit && h.delay - h.t < 0.25) return true;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, pl.r + 60)) if (!e.dead) return true;
    for (const p of G.Projectiles.all()) if (!p.friendly && Math.abs(p.x - pl.x) < 70 && Math.abs(p.y - pl.y) < 70) return true;
    return false;
  }
  // Estadísticas propias (para el banco de pruebas): grietas, vencidas, perdidas,
  // legendarios de la Sentencia derrotados (el simulador no los cuenta: G.Progress está vacío).
  const stats = { rifts: 0, won: 0, lost: 0, judgeKills: 0, fightPlan: 0 };
  let arenaPhase = null, judgeIds = new Set();
  function track() {
    const a = G.Rift.arena;
    const ph = a ? a.phase : null;
    if (ph !== arenaPhase) {
      if (ph === 'fight') stats.rifts++;
      else if (ph === 'won') stats.won++;
      else if (ph === 'lost') stats.lost++;
      arenaPhase = ph;
    }
    if (G.Judgment.active) {
      const alive = new Set();
      for (const e of G.EnemyMgr.all()) if (e.judge && !e.dead) alive.add(e.id);
      for (const id of judgeIds) if (!alive.has(id)) stats.judgeKills++;
      judgeIds = alive;
    }
  }

  const freeAt = (x, y, r) => {
    const qx = Math.round(x / 6), qy = Math.round(y / 6), k = qx * 1048576 + qy;
    let v = freeCache.get(k);
    if (v === undefined) { v = G.World.isFree(qx * 6, qy * 6, r, true); freeCache.set(k, v); }
    return v;
  };

  // ---------------- hueco activo (de spacer.js) ----------------

  function danger(pl) {
    let d = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 70)) {
      if (e.dead) continue;
      const gap = Math.hypot(e.x - pl.x, e.y - pl.y) - e.r - pl.r;
      if (gap < 30) d += e.boss ? 2 : 1;
    }
    return d;
  }
  function clearAround(pl, r) {
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, r)) if (!e.dead) return false;
    return true;
  }

  let noDashUntil = -1;
  /** Mejor hueco de daño sin embestida (o -1). */
  function altSlotNoDash(pl) {
    let alt = -1, av = -1;
    pl.slots.forEach((g, i) => {
      if (g.some(m => m.kind === 'dash') || !g.some(m => m.kind !== 'buff')) return;
      const v = g.reduce((a, m) => a + (m.kind === 'buff' ? 0 : m.lvl + (m.evolved ? 3 : 0)), 0) + (g.length - 1) * 4;
      if (v > av) { av = v; alt = i; }
    });
    return pl.hasItem && pl.hasItem('choiceband') ? -1 : alt;
  }
  function slotChoice(api) {
    const { pl } = api;
    G = api.G;
    if (pl.hasItem && pl.hasItem('choiceband')) return null;
    if (!pl.slots.length) return null;
    let dmgSlot = null;
    if (cards && cards.active) {
      const i = cards.active(api);
      if (i != null && pl.slots[i] && pl.slots[i].some(m => m.kind !== 'buff')) dmgSlot = i;
    }
    if (dmgSlot == null) {
      let bv = -1;
      pl.slots.forEach((g, i) => { const v = g.reduce((a, m) => a + (m.kind === 'buff' ? 0 : m.lvl + (m.evolved ? 3 : 0)), 0); if (v > bv) { bv = v; dmgSlot = i; } });
    }
    if (api.time < noDashUntil && pl.slots[dmgSlot] && pl.slots[dmgSlot].some(m => m.kind === 'dash')) {
      const alt = altSlotNoDash(pl);
      if (alt >= 0) return alt;
    }
    // Un hueco que sólo embiste (Ataque Rápido suelto) no sirve de foco a un bot que
    // quiere sobrevivir: te mete en la horda a cada recarga. Otro hueco de daño si lo hay.
    const lvOf = g => g.reduce((a, m) => a + (m.kind === 'buff' ? 0 : m.lvl + (m.evolved ? 3 : 0)), 0);
    if (P.noLoneDash && pl.slots[dmgSlot] && pl.slots[dmgSlot].every(m => m.kind === 'dash' || m.kind === 'buff')) {
      let alt = -1, av = -1;
      pl.slots.forEach((g, i) => { if (i !== dmgSlot && g.some(m => m.kind !== 'buff' && m.kind !== 'dash') && lvOf(g) > av) { av = lvOf(g); alt = i; } });
      if (alt >= 0) dmgSlot = alt;
    }
    // Embestida propia: te lleva hasta el blanco (el jefe, si está a 330). Con
    // zonas avisadas cerca o un jefe al lado, mejor otro hueco de daño si lo hay.
    if (P.dashSafe && pl.slots[dmgSlot] && pl.slots[dmgSlot].some(m => m.kind === 'dash')) {
      let risky = false;
      for (const h of G.Hazards.all) if (!h.hit && Math.hypot(h.x - pl.x, h.y - pl.y) < 400) { risky = true; break; }
      if (!risky) for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 340)) if (e.boss && !e.dead) { risky = true; break; }
      if (risky) {
        let alt = -1, av = -1;
        pl.slots.forEach((g, i) => {
          if (i === dmgSlot || g.some(m => m.kind === 'dash') || !g.some(m => m.kind !== 'buff')) return;
          const v = g.reduce((a, m) => a + (m.kind === 'buff' ? 0 : m.lvl + (m.evolved ? 3 : 0)), 0);
          if (v > av) { av = v; alt = i; }
        });
        if (alt >= 0) dmgSlot = alt;
      }
    }
    // Potenciadores sueltos: se recargan a ratos y se vuelve al de daño.
    const buffSlots = pl.slots.map((g, i) => ({ g, i })).filter(o => o.g.length === 1 && o.g[0].kind === 'buff');
    if (buffMode != null) {
      const g0 = pl.slots[buffMode];
      const m = g0 && g0.length === 1 && g0[0].kind === 'buff' ? g0[0] : null;
      const b = m && pl.buffs[m.stat];
      buffT += api.dt || 1 / 30;
      const full = b && b.n >= Math.max(1, m.stacks | 0) && b.t > m.dur - 0.12;
      if (!m || !b || full || buffT > 5 || danger(pl) > 0.5 || (b.n < m.stacks && !clearAround(pl, 150))) buffMode = null;
      else return buffMode;
    }
    for (const { g, i } of buffSlots) {
      const m = g[0], b = pl.buffs[m.stat];
      if (!b) continue;
      const max = Math.max(1, m.stacks | 0);
      const keep = b.n >= max && b.t < 1.0 && danger(pl) < 1.2;
      const build = b.n < max && clearAround(pl, 220);
      if (keep || build) { buffMode = i; buffT = 0; return i; }
    }
    // (Opcional) Player.setActive deja la recarga pendiente en un 35 % de la base:
    // cambiar de hueco un fotograma y volver casi duplica la cadencia. Es un
    // abuso del juego, por eso va desactivado (opts.swap).
    if (P.swap && pl.slots.length > 1 && !G.Judgment.cinematic) {
      swapT = 1 - swapT;
      if (swapT) return (dmgSlot + 1) % pl.slots.length;
    }
    return dmgSlot;
  }

  // ---------------- objetivos ----------------

  let xpOnGround = 0;
  function pickGoal(api, enemies) {
    const { pl } = api;
    const hpK = pl.hp / pl.maxHp;
    const spd = Math.max(40, pl.spd);
    let best = null, bs = 0;
    const crowdAt = (x, y, r) => {
      let n = 0;
      for (const e of enemies) if (Math.abs(e.x - x) < r + e.r && Math.abs(e.y - y) < r + e.r && Math.hypot(e.x - x, e.y - y) < r + e.r) n += e.boss ? 3 : 1;
      return n;
    };
    const consider = (x, y, v, tag, radius = 70, ref = null) => {
      if (v <= 0) return;
      const d = Math.hypot(x - pl.x, y - pl.y);
      const s = v / Math.pow(d + 90, 1.25) / (1 + crowdAt(x, y, radius) * 0.35);
      if (s > bs) { bs = s; best = { x, y, tag, ref }; }
    };
    const rift = G.Rift.rift;
    if (rift && !P.noRift && !G.Rift.inArena) {
      const d = Math.hypot(rift.x - pl.x, rift.y - 10 - pl.y);
      if (d / spd < rift.ttl - 0.3) return { x: rift.x, y: rift.y - 10, tag: 'rift' };
    }
    const pk = G.Pickups.all();
    xpOnGround = 0;
    for (const p of pk) if (p.kind === 'xp' || p.kind === 'xpBig') xpOnGround += p.value;
    for (const p of pk) {
      if (Math.abs(p.x - pl.x) > 600 || Math.abs(p.y - pl.y) > 600) continue;
      let v = 0;
      switch (p.kind) {
        case 'heal': v = hpK < 0.85 ? 60 + (1 - hpK) * 260 : 0; break;
        case 'magnet': v = 60 + xpOnGround * 0.6; break;
        case 'bomb': v = 30; break;
        case 'item': v = pl.item ? 40 : 150; break;
        case 'xpBig': v = p.value * 1.1; break;
      }
      if (v > 0) consider(p.x, p.y, v, p.kind);
    }
    for (const s of G.World.specialsNear(pl.x, pl.y, 650)) if (s.type === 'spring' || s.type === 'altar') known.set(s.id, s);
    const specials = new Set(G.World.specialsNear(pl.x, pl.y, 600));
    for (const s of known.values()) {
      if (s.type === 'altar' && s.used) { known.delete(s.id); continue; }
      if (Math.hypot(s.x - pl.x, s.y - pl.y) < 1400) specials.add(s);
    }
    for (const s of specials) {
      if (s.type === 'altar' && !s.used) consider(s.x, s.y, 170, 'altar', 60, s);
      else if (s.type === 'spring' && s.charge > 0.15 && hpK < 0.6) consider(s.x, s.y - 8, 150 + (1 - hpK) * 700, 'spring', 60, s);
      else if (s.type === 'bigchest' && hpK > 0.5) consider(s.x, s.y, 60 + pl.xpNext * 0.4, 'chest', 100, s);
    }
    return best;
  }

  /** Punto intermedio hacia el objetivo rodeando paredes (campo de G.Path). false = sin camino. */
  function waypoint(pl, g) {
    const lineFree = (ax, ay, bx, by) => {
      const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 12);
      for (let i = 1; i <= n; i++) { const t = i / n; if (!G.World.isFree(ax + (bx - ax) * t, ay + (by - ay) * t, pl.r * 0.7, true)) return false; }
      return true;
    };
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

  // ---------------- el legendario de la grieta: ¿se puede vencer? ----------------

  let arenaSingle = null, arcLast = null, arcStillT = 0;
  function legendPlan(pl) {
    const a = G.Rift.arena;
    if (!a) { arenaSingle = null; return null; }
    const boss = G.EnemyMgr.get(a.bossId);
    if (!boss || boss.dead) return { boss: null, fight: false };
    const left = G.Rift.timeLeft;
    // Daño a UN enemigo por segundo, medido por el propio juego (Judgment.sampleDps).
    // (Se toma al entrar: dentro, si no le das, la media de 30 s baja y dejarías de pelear.)
    if (arenaSingle == null) { try { arenaSingle = G.Judgment.debug.single || 0; } catch (e) { arenaSingle = 0; } }
    const single = arenaSingle;
    const need = boss.hp / Math.max(1, single);
    // Se pelea si se puede vencer a tiempo (con margen: no siempre está a tiro),
    // o si queda poco y aún se puede.
    let fight = single > 0 && need < left * 0.8;
    // (opts.stall) Alargar la arena: la horda está guardada y el reloj corre, así que
    // cada segundo aquí es tiempo de partida casi gratis. Se esquiva y sólo se pelea
    // cuando queda el tiempo justo para vencerle (con margen). Va desactivado: es
    // jugar al cronómetro, no jugar mejor.
    if (fight && P.stall && left > need * 2.2 + 15 && pl.hp > pl.maxHp * 0.35) fight = false;
    return { boss, fight, need, left };
  }

  // ---------------- movimiento ----------------

  const PX = new Float64Array(NT), PY = new Float64Array(NT), VX = new Float64Array(NT), VY = new Float64Array(NT);
  const events = [];

  function move(api) {
    G = api.G;
    const pl = api.pl;
    if (api.time === lastFrame) return cacheMove;
    lastFrame = api.time;
    track();
    // Se replanea cada P.every fotogramas (salvo con peligro inmediato).
    if (P.every > 1 && ++frameN % P.every && !urgent(pl)) return cacheMove;

    const W = G.World;
    const hpK = pl.hp / pl.maxHp;
    const inArena = G.Rift.inArena, judge = G.Judgment.active;
    const le = W.liquidEffect(pl.mon.types);
    const liqDmg = !!le.dmg, liqSlow = le.slow || 1;
    const spd = Math.max(30, pl.inLiquid && le.slow ? pl.spd / le.slow : pl.spd);
    const leAny = W.liquidEffect(null);
    const enemySlowLiquid = !leAny.dmg && !!leAny.slow;
    const wr = pl.r * 0.72;
    if ((freeCacheT -= 1 / 30) <= 0 || wr !== freeR || freeCache.size > 150000) { freeCache = new Map(); freeCacheT = 3; freeR = wr; }

    const grp = pl.activeGroup();
    let band = bandOfGroup(grp);
    // Grupo fusionado con un golpe de cerca y ataques a distancia: con 'dmg' manda el que
    // más daño hace (si no, Lengüetazo en el grupo te pega a la horda aunque lo fuerte sea Bola Sombra).
    if (P.bandPick === 'dmg' && grp.length > 1 && cards && cards._model) {
      let bm = null, bv = -1;
      const PP = { atk: pl.baseAtk * pl.atkMul, cdMul: pl.cdMul };
      for (const m of grp) { if (m.kind === 'buff') continue; let v = 0; try { v = cards._model.direct(m, PP); } catch (e) {} if (v > bv) { bv = v; bm = m; } }
      if (bm) band = bandFor(bm);
    }
    const meleeK = grp.some(m => m.kind === 'melee') ? 0.75 : 1;
    let reach = 0;
    for (const m of grp) if (m.kind !== 'buff') reach = Math.max(reach, reachOf(m));

    // --- amenazas ---
    const all = G.EnemyMgr.all();
    const enemies = [];
    const near = [];
    let cx = 0, cy = 0, cw = 0, nearest = Infinity;
    const Rnear = spd * T[NT - 1] + 300;
    for (const e of all) {
      if (e.dead || e.remote) continue;
      enemies.push(e);
      if (e.behavior === 'thief') continue;
      const dx = e.x - pl.x, dy = e.y - pl.y;
      if (Math.abs(dx) > 600 || Math.abs(dy) > 600) continue;
      const d = Math.hypot(dx, dy);
      if (d < 520) { const w = (e.boss ? 3 : 1) / (d + 40); cx += dx * w; cy += dy * w; cw += w; }
      if (d - e.r < nearest) nearest = d - e.r;
      if (d > Rnear) continue;
      let es = e.spd * (1 - (e.slow || 0)) * G.Weather.speedFor(e.types);
      if (!e.flying && enemySlowLiquid && !e.legend && !e.judge && W.isLiquid(e.x, e.y)) es *= 0.55;
      const tk = e.atkType ? G.Types.mult(e.atkType, pl.mon.types) * G.Weather.mult(e.atkType) : 1;
      // ¿Puede llegar a tocarte en el horizonte? (si no, sólo cuenta para el cerco)
      const fast = e.boss ? 330 / 0.32 * 0.4 : e.behavior === 'charger' ? es * 3.4 * 0.42 / T[NT - 1] + es : es;
      const can = d - e.r - pl.r < (fast + spd) * T[NT - 1] + 30;
      e._p = { spd: es, dmg: e.dmg * tk * (1 - pl.reduction) * meleeK, d, can };
      near.push(e);
    }
    const bosses = near.filter(e => e.boss && e._p.can);
    const hordeA = cw > 0 ? Math.atan2(cy / cw, cx / cw) : null;
    const shots = [];
    for (const p of G.Projectiles.all()) {
      if (p.friendly) continue;
      if (Math.abs(p.x - pl.x) > 420 || Math.abs(p.y - pl.y) > 420) continue;
      const tk = p.mtype ? G.Types.mult(p.mtype, pl.mon.types) * G.Weather.mult(p.mtype) : 1;
      shots.push({ p, dmg: p.dmg * tk * (1 - pl.reduction) * meleeK, left: p.life - p.t });
    }
    const hazards = G.Hazards.all.filter(h => !h.hit);
    const traps = W.specialsNear(pl.x, pl.y, 260).filter(s => s.type === 'trap' && !s.broken);

    // Arceus.
    let arceus = null, ring = null;
    if (judge) {
      const st = G.Judgment.netState && G.Judgment.netState();
      const sm = G.Judgment.summary && G.Judgment.summary();
      if (st) {
        const k = Math.min(1.22, 0.74 + (sm ? sm.time : 0) * 0.013);
        arceus = { x: st[0], y: st[1], r: G.Sprites.bodyRadius(493, 1.5) * 0.9, spd: Math.max(70, pl.spd * k) };
        // Mientras lanza un ataque no se mueve (0,85-1,45 s): si está quieto, cuenta un rato parado.
        const still = arcLast && Math.hypot(st[0] - arcLast[0], st[1] - arcLast[1]) < 0.5;
        arcStillT = still ? arcStillT + 1 / 30 : 0;
        arcLast = [st[0], st[1]];
        arceus.wait = arcStillT > 0 ? Math.max(0, 0.6 - arcStillT) : 0;
      }
      const a = W.arena;
      if (a) ring = { x: a.tx * 32 + 16, y: a.ty * 32 + 16, r: (a.r - 1.4) * 32 };
    } else if (inArena && G.Rift.arena) {
      const a = G.Rift.arena;
      ring = { x: a.x, y: a.y, r: (a.r - 1.4) * 32 };
    }
    const plan = inArena ? legendPlan(pl) : null;

    // --- objetivo ---
    if (--goalT <= 0 || (goal && Math.hypot(goal.x - pl.x, goal.y - pl.y) < 14 && goal.tag !== 'chest' && goal.tag !== 'spring')) {
      goal = (inArena || judge) ? null : pickGoal(api, enemies);
      goalT = 9;
      if (goal) { goal.wp = waypoint(pl, goal); if (goal.wp === false) goal = null; }
    }
    if (inArena || judge) goal = null;
    let hold = false;
    if (goal && (goal.tag === 'chest' || goal.tag === 'spring') && goal.ref) {
      const s = goal.ref;
      if (goal.tag === 'spring' && Math.hypot(goal.x - pl.x, goal.y - pl.y) < 18) hold = true;
      if (goal.tag === 'chest' && Math.hypot(s.x - pl.x, s.y - pl.y) < Math.max(46, s.r + pl.r + 24) - 4) hold = true;
    }
    const rift = G.Rift.rift && !inArena && !judge && !P.noRift ? G.Rift.rift : null;

    // Experiencia en el suelo (fuera del imán).
    const xps = [];
    if (!inArena && !judge) {
      for (const p of G.Pickups.all()) {
        if (p.kind !== 'xp' && p.kind !== 'xpBig') continue;
        const d = Math.hypot(p.x - pl.x, p.y - pl.y);
        if (d < pl.magnet || d > 420) continue;
        xps.push({ x: p.x, y: p.y, v: Math.min(3, Math.sqrt(p.value / 10)), d });
      }
    }

    // Rodeo: cambia de sentido si se atasca.
    const moved = Math.hypot(pl.x - lastX, pl.y - lastY);
    lastX = pl.x; lastY = pl.y;
    if (prevI < NDIR && moved < spd / 30 * 0.3) stuckT += 1 / 30; else stuckT = Math.max(0, stuckT - 1 / 30);
    orbitT -= 1 / 30;
    if (stuckT > 0.5 && orbitT <= 0) { orbitSign = -orbitSign; orbitT = 2; stuckT = 0; }

    // Banda: con el legendario de la grieta, según si se pelea; en la Sentencia, lejos.
    let bandD = band.d * (P.band || 1), bandPull = band.pull || 1;
    if (P.lowBand && !band.melee && hpK < 0.5) bandD *= 1 + P.lowBand * (0.5 - hpK) / 0.5;
    let bandTarget = null;     // enemigo de referencia (por defecto, el más cercano)
    // Jefe del mapa vivo: con ataques a distancia apuntan primero al jefe si está
    // a menos de 330 (Player.update): quedarse a esa distancia lo tumba antes, y
    // mientras vive no se abren grietas.
    if (!inArena && !judge && P.bossBand) {
      const ranged = grp.some(m => m.kind === 'projectile' || m.kind === 'beam');
      let boss = null, bd = Infinity;
      for (const e of near) if (e.boss && e._p.d < bd) { bd = e._p.d; boss = e; }
      if (boss && ranged) {
        bandTarget = boss;
        bandD = Math.max(96 + pl.r + 30, Math.min(330 - boss.r - 40, reach * 0.6));
        bandPull = 0.8;
      }
    }
    if (plan && plan.boss) {
      bandTarget = plan.boss;
      const slamR = 96 + plan.boss.r + pl.r;
      if (plan.fight) {
        bandPull *= P.arenaPull;
        bandD = Math.max(bandD, Math.min(reach * 0.7, 230));
        if (!band.melee && bandD < slamR + 20) bandD = slamR + 20;
      } else { bandD = 260; bandPull = 0.5; }
    }

    // Embestida propia (Ataque Rápido...): al lanzarse te lleva hacia el blanco
    // (el más cercano) hasta m.radius y da 0,3 s de invulnerabilidad. Hay que
    // contarla: si no, el bot esquiva una zona y la embestida le mete dentro.
    let dashM = null;
    for (const m of grp) if (m.kind === 'dash') dashM = m;
    const dashT0 = dashM ? Math.max(0, dashM.t || 0) : Infinity;
    const dashCd = dashM ? Math.max(0.05, dashM.cd * pl.cdMul) : 0;
    const dashTarget = (x, y) => {
      let b = null, bd = Infinity;
      for (const e of near) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; b = e; } }
      return b && bd <= dashM.radius + 60 ? b : null;
    };
    const dashEv = [];
    // Cuerpo a cuerpo: hay que estar encima (y el golpe empuja a los enemigos, cosa que
    // el modelo no ve): el contacto asusta menos y la banda tira más.
    const contactK = band.melee ? P.meleeFear : 1;
    const crowdK = band.melee ? P.meleeCrowd : 1;
    if (band.melee) bandPull *= P.meleePull;
    // Duelo con el legendario: sólo está él; el cerco y la densidad no sirven (te alejarían).
    const duel = !!(plan && plan.boss && plan.fight);
    const invul0 = Math.max(0, pl.invuln || 0);
    const v0x = pl._vx || 0, v0y = pl._vy || 0;
    const hurtLethal = Math.max(1, pl.hp);
    const lowHp = 1 + P.lowHpK * Math.max(0, 0.6 - hpK) / 0.6;

    let bestI = NDIR, bestC = Infinity, prevC = Infinity;
    const dbgC = [];
    let dbgRows = null;
    let useDash = !!dashM;
    const evalAll = () => {
    bestI = NDIR; bestC = Infinity; prevC = Infinity;
    dbgRows = P.dbg && api.time > P.dbg[0] && api.time < P.dbg[1] ? [] : null;
    for (let ci = 0; ci < NC; ci++) {
      const ux = DX[ci], uy = DY[ci];
      const still = ci === NDIR;
      let c = 0;

      // --- trayectoria (con paredes y charcos) ---
      let x = pl.x, y = pl.y, blocked = false, tPrev = 0;
      let vx = v0x, vy = v0y, wet = 0, riftT = Infinity;
      let dashAt = dashT0;
      dashEv.length = 0;
      for (let k = 0; k < NT; k++) {
        const dt = T[k] - tPrev; tPrev = T[k];
        if (!still && !blocked) {
          const sk = liqSlow < 1 && W.isLiquid(x, y) ? liqSlow : 1;
          const want = spd * sk * dt;
          const n = Math.max(1, Math.ceil(want / 10)), st = want / n;
          let got = 0;
          for (let j = 0; j < n; j++) {
            const nx = x + ux * st, ny = y + uy * st;
            if (freeAt(nx, ny, wr)) { x = nx; y = ny; got += st; }
            else if (freeAt(nx, y, wr)) { x = nx; got += st * Math.abs(ux); }
            else if (freeAt(x, ny, wr)) { y = ny; got += st * Math.abs(uy); }
          }
          if (got < want * 0.25) { blocked = true; c += P.wWall * (NT - k) / NT * 2; }
          if (sk < 1) wet++;
          if (liqDmg && W.isLiquid(x, y)) c += (k < 3 ? 0.25 : 0.1) + le.dmg * 2;
        }
        if (useDash && T[k] >= dashAt) {
          const tg = dashTarget(x, y);
          if (tg) {
            const [ca, sa] = norm(tg.x - x, tg.y - y);
            let len = 0;
            for (let d = 8; d <= dashM.radius; d += 8) { if (!freeAt(x + ca * d, y + sa * d, pl.r * 0.8)) break; len = d; }
            x += ca * len; y += sa * len;
            dashEv.push(T[k]);
            dashAt = T[k] + dashCd;
          } else dashAt = T[k] + 0.05;
        }
        PX[k] = x; PY[k] = y;
        // Velocidad suavizada que ven los corredores (EnemyMgr: k = dt·5).
        const vk = 1 - Math.exp(-5 * dt);
        const tvx = still ? 0 : (PX[k] - (k ? PX[k - 1] : pl.x)) / dt, tvy = still ? 0 : (PY[k] - (k ? PY[k - 1] : pl.y)) / dt;
        vx += (tvx - vx) * vk; vy += (tvy - vy) * vk;
        VX[k] = vx; VY[k] = vy;
        if (rift && riftT === Infinity && Math.hypot(x - rift.x, y - rift.y + 10) < 28) riftT = T[k];
      }
      if (wet) c += 0.02 * wet;
      for (const tp of traps) for (let k = 0; k < 4; k++) if (Math.hypot(PX[k] - tp.x, PY[k] - tp.y + 8) < 22) { c += 0.12; break; }

      // --- golpes previstos ---
      events.length = 0;
      for (const e of near) {
        const ep = e._p;
        if (!ep.can || e.jump) continue;                          // cae donde avisa la zona
        if (e.behavior === 'bomber' && e.phase === 'fuse') continue;
        const ai = e.boss ? e.ai : null;
        const cast = ai && ai.cast;
        let es = ep.spd;
        if (ai && !cast) es *= (ai.fury ? 1.25 : 1) * 1.1;
        const keep = !e.boss && e.keepsDistance && e.keepsDistance();
        const keepD = keep ? (e.def.range || 200) * 0.82 : 0;
        const runner = e.behavior === 'runner';
        const charger = !e.boss && e.behavior === 'charger';
        let phase = e.phase, pt = e.pt || 0, ddx = e.dx || 0, ddy = e.dy || 0;
        if (charger && phase === 'aim') { const b = aimDir.get(e); if (b) { ddx = b[0]; ddy = b[1]; } }
        const rr = e.r + pl.r;
        let ex = e.x, ey = e.y, ox = pl.x, oy = pl.y, oex = ex, oey = ey;
        let hitT = -1, minGap = Infinity;
        let tp = 0;
        for (let k = 0; k < NT; k++) {
          const t = T[k], dt = t - tp; tp = t;
          const px = PX[k], py = PY[k];
          oex = ex; oey = ey;
          if (cast) {
            if (cast.id === 'dash' && t + cast.t > cast.wind && t + cast.t - dt < cast.wind + cast.dur) {
              const sp = cast.len / cast.dur;
              ex += Math.cos(cast.ang) * sp * dt; ey += Math.sin(cast.ang) * sp * dt;
            }
          } else if (ai && ai.mode === 'far' && Math.hypot(px - ex, py - ey) < 300) {
            /* se aparta o rodea */
          } else if (charger && phase !== 'walk') {
            if (phase === 'aim') {
              pt -= dt;
              if (pt <= 0) { phase = 'dash'; pt = 0.42 + pt; const [nx, ny] = norm(px - ex, py - ey); ddx = nx; ddy = ny; }
            } else if (phase === 'dash') {
              const go = Math.min(dt, Math.max(0, pt));
              ex += ddx * es * 3.4 * go; ey += ddy * es * 3.4 * go;
              pt -= dt;
              if (pt <= 0) { phase = 'walk'; pt = 1.1; }
            }
          } else if (!keep || Math.hypot(px - ex, py - ey) > keepD) {
            let tx = px, ty = py;
            if (runner) {
              const dd = Math.hypot(px - ex, py - ey);
              const lead = Math.min(1.4, dd / Math.max(60, es));
              tx += VX[k] * lead; ty += VY[k] * lead;
            }
            const dx = tx - ex, dy = ty - ey, d = Math.hypot(dx, dy) || 1;
            const st = Math.min(d, es * dt);
            ex += dx / d * st; ey += dy / d * st;
            if (charger) {
              pt -= dt;
              if (pt <= 0 && Math.hypot(px - ex, py - ey) < 200) { phase = 'aim'; pt = 0.55; }
            }
          }
          // (Rápido: si al final del paso está lejos de sobra, no hace falta el segmento.)
          const qx = px - ex, qy = py - ey, dEnd2 = qx * qx + qy * qy;
          const mv = Math.abs(px - ox - ex + oex) + Math.abs(py - oy - ey + oey);
          const lim = rr + 24 + mv;
          const gap = dEnd2 > lim * lim ? Math.sqrt(dEnd2) - rr : segMin(ox - oex, oy - oey, qx, qy) - rr;
          ox = px; oy = py;
          if (gap < minGap) minGap = gap;
          if (hitT < 0 && gap < P.margin0 + P.marginT * t && t > (e.touchCd || 0)) {
            hitT = t;
            const w = gap < 0 ? 1 : 1 - gap / (P.margin0 + P.marginT * t) * 0.6;
            events.push(t, ep.dmg * w * TW[k] * contactK * (runner ? P.runnerK : 1), 0);
            break;
          }
        }
        // Rozar sin tocar también es mala señal.
        if (hitT < 0 && minGap < 20) events.push(1.3, ep.dmg * 0.15 * (1 - minGap / 20), 0);
        // Corredor cerca al final: aunque no toque en el horizonte, se pegará (es tan rápido como tú).
        if (runner && P.runnerNear && hitT < 0 && minGap < 90) c += P.runnerNear * ep.dmg / pl.maxHp * (1 - minGap / 90);
      }
      // Disparos (rectos; una pared en medio los para).
      for (const s of shots) {
        const p = s.p, rr = p.r + pl.r + 3;
        let ox = pl.x, oy = pl.y, osx = p.x, osy = p.y, tp = 0;
        for (let k = 0; k < NT; k++) {
          const t = T[k];
          if (tp > s.left) break;
          const tt = Math.min(t, s.left);
          const sx = p.x + p.vx * tt, sy = p.y + p.vy * tt;
          const md = segMin(ox - osx, oy - osy, PX[k] - sx, PY[k] - sy);
          ox = PX[k]; oy = PY[k]; osx = sx; osy = sy; tp = t;
          if (md < rr) {
            // ¿Hay pared entre el disparo y ese punto?
            const mx = (p.x + sx) / 2, my = (p.y + sy) / 2;
            if (W.isWall && W.isWall(mx, my)) break;
            events.push(t, s.dmg * TW[k], 0);
            break;
          }
        }
      }
      // Zonas avisadas: ¿dentro cuando estallen? (ignoran la invulnerabilidad)
      for (const h of hazards) {
        const left = h.delay - h.t;
        let hx = PX[NT - 1], hy = PY[NT - 1], kk = NT - 1;
        for (let k = 0; k < NT; k++) if (T[k] >= left) { kk = k; break; }
        if (left < T[NT - 1]) {
          // Interpolado entre pasos.
          const k1 = kk, k0 = k1 - 1;
          if (k0 < 0) { const f = Math.max(0, left / T[0]); hx = pl.x + (PX[0] - pl.x) * f; hy = pl.y + (PY[0] - pl.y) * f; }
          else { const f = (left - T[k0]) / (T[k1] - T[k0]); hx = PX[k0] + (PX[k1] - PX[k0]) * f; hy = PY[k0] + (PY[k1] - PY[k0]) * f; }
        }
        const raw = h.pct ? Math.max(h.dmg, pl.maxHp * h.pct) : h.dmg * (h.pure ? 1 : (1 - pl.reduction) * meleeK * (h.type ? G.Types.mult(h.type, pl.mon.types) * G.Weather.mult(h.type) : 1));
        const dep = depth(h, hx, hy, pl.r);
        if (dep > -8) {
          const w = dep > 0 ? 1 + Math.min(1, dep / 30) * 0.3 : 0.35 * (8 + dep) / 8;
          events.push(Math.max(0.01, left), raw * w * (left > T[NT - 1] ? 0.7 : 1), 1);
        }
      }
      // Jefes a punto de elegir ataque: si estás a su alcance, un pisotón (onda de
      // 96 + su radio, 0,85 s de aviso) es probable. Se sale antes de que lo avise.
      if (P.preSlam) for (const e of bosses) {
        const ai = e.ai;
        if (!ai || ai.cast || ai.cd > 0.7) continue;
        const f = ai.fury ? 0.8 : 1;
        const tt = Math.max(0, ai.cd / (ai.fury ? 1.25 : 1)) + 0.85 * f;
        let k = 0; while (k < NT - 1 && T[k] < tt) k++;
        const dep = 96 + e.r + pl.r * 0.6 - Math.hypot(PX[k] - e.x, PY[k] - e.y);
        if (dep > -10) {
          const dmgS = e._p.dmg / meleeK * 1.3 * meleeK;
          const pr = ai.mode === 'close' ? 0.5 : 0.8;
          events.push(tt, dmgS * pr * P.preSlam * (dep > 0 ? 1 : (10 + dep) / 10), 1);
        }
      }
      // Arceus: tocarle quita el 40 % (sin invulnerabilidad).
      if (arceus) {
        let ax = arceus.x, ay = arceus.y, tp = 0;
        for (let k = 0; k < NT; k++) {
          const dt = Math.max(0, T[k] - Math.max(tp, arceus.wait)); tp = T[k];
          const dx = PX[k] - ax, dy = PY[k] - ay, d = Math.hypot(dx, dy) || 1;
          const st = Math.min(d, arceus.spd * dt);
          ax += dx / d * st; ay += dy / d * st;
          const gap = Math.hypot(PX[k] - ax, PY[k] - ay) - arceus.r - pl.r;
          if (gap < 10 + 20 * T[k]) { events.push(T[k], pl.maxHp * 0.4 * TW[k] * (gap < 0 ? 1 : 0.7), 1); break; }
        }
        const fd = Math.hypot(PX[NT - 1] - arceus.x, PY[NT - 1] - arceus.y);
        c += P.jArc * Math.exp(-fd / P.jArcR);
      }

      for (const t of dashEv) events.push(t, 0, 2);
      // Suma con la invulnerabilidad (0,45 s tras cada golpe que no sea de zona).
      let dmg = 0, raw = 0;
      if (events.length) {
        const n = events.length / 3;
        const idx = [];
        for (let i = 0; i < n; i++) if (events[i * 3] < riftT) idx.push(i);
        idx.sort((a, b) => events[a * 3] - events[b * 3]);
        let invUntil = invul0;
        for (const i of idx) {
          const t = events[i * 3], d = events[i * 3 + 1], pure = events[i * 3 + 2];
          if (pure === 2) { invUntil = Math.max(invUntil, t + 0.3); continue; }
          if (!pure) {
            if (t < invUntil) continue;
            invUntil = t + P.invul;
          } else invUntil = t + P.invul;
          dmg += d; raw += d;
        }
      }
      c += P.wDmg * lowHp * dmg / pl.maxHp;
      if (raw >= hurtLethal * 0.95) c += P.lethal * (1 + raw / pl.maxHp);

      if (dbgRows) dbgC.push('a' + c.toFixed(2));
      // --- estrategia: dónde acabas ---
      const fx = PX[NT - 1], fy = PY[NT - 1];
      const afterRift = riftT < Infinity;
      if (!afterRift) {
        // Cerco: gente cerca del final y por cuántos lados.
        let crowd = 0, sect = 0, nearF = Infinity;
        for (const e of enemies) {
          if (e.behavior === 'thief') continue;
          const dx = e.x - fx, dy = e.y - fy;
          if (Math.abs(dx) > 260 || Math.abs(dy) > 260) continue;
          const d = Math.hypot(dx, dy);
          if (d > 260) continue;
          const w = (e.boss ? 3 : 1);
          crowd += w * Math.exp(-d / 110);
          if (d < 170) sect |= 1 << (((Math.atan2(dy, dx) + Math.PI) / TAU * 12) | 0) % 12;
          if (d - e.r < nearF) nearF = d - e.r;
        }
        let ns = 0; for (let s = sect; s; s &= s - 1) ns++;
        if (duel) { crowd = 0; ns = 0; }
        c += P.wCrowd * crowdK * Math.min(crowd, P.crowdCap) * (0.7 + 0.6 * (1 - hpK)) * (band.open || 1);
        // Muchos sectores ocupados = cerco (ns de 12); sin salida si casi todos.
        c += P.wSect * (ns > 6 ? (ns - 6) * (ns - 6) / 6 : 0) * (0.7 + 0.6 * (1 - hpK));
        // Gente en la dirección (más allá del horizonte).
        if (!still && !duel) {
          let dens = 0;
          for (const e of near) {
            const dx = e.x - pl.x, dy = e.y - pl.y, d = e._p.d || 1;
            const cc = (dx * ux + dy * uy) / d;
            if (cc > 0.3) dens += (cc - 0.3) * (e.boss ? 2 : 1) * 60 / (d + 30);
          }
          c += P.wDens * crowdK * dens * (band.open || 1);
        }
        // Banda: distancia al más cercano (o al legendario).
        // Se mira en varios instantes del camino y vale el mejor (si no, acercarse
        // y pasarse de largo al final del horizonte cuenta como malo).
        if (!judge) {
          let best = Infinity;
          for (const k of (P.bandPath || bandTarget ? BAND_K : BAND_END)) {
            const bx = PX[k], by = PY[k];
            let bd;
            if (bandTarget) bd = Math.hypot(bandTarget.x - bx, bandTarget.y - by) - bandTarget.r;
            else if (k === NT - 1) bd = nearF;
            else { bd = Infinity; for (const e of near) { const d = Math.hypot(e.x - bx, e.y - by) - e.r; if (d < bd) bd = d; } }
            if (bd >= 480) continue;
            const err = (bd - bandD) / Math.max(60, bandD);
            const bc = P.wBand * bandPull * (err > 0 ? Math.min(err, 2.5) * 0.7 : err * err * 1.4 / bandPull) * (k === NT - 1 ? 1 : 1.1);
            if (bc < best) best = bc;
          }
          if (best < Infinity) c += best;
        }
        // Rodeo.
        if (hordeA != null && !still && nearest < 260 && !judge) {
          const rel = Math.cos(Math.atan2(uy, ux) - (hordeA + orbitSign * Math.PI / 2));
          c -= P.wOrbit * (band.orbit || 0.5) * rel;
        }
      }
      if (dbgRows) dbgC.push('s' + c.toFixed(2));
      // Paredes: callejón delante, rincón al final.
      if (!still && !blocked) {
        for (let k = 1; k <= 3; k++) {
          const dd = k * 50;
          if (!freeAt(fx + ux * dd, fy + uy * dd, wr)) { c += P.wWall * (1 - (k - 1) / 3); break; }
        }
      }
      let walls = 0;
      for (let j = 0; j < 8; j++) if (!freeAt(fx + Math.cos(j * Math.PI / 4) * 44, fy + Math.sin(j * Math.PI / 4) * 44, wr)) walls++;
      c += P.wWall * 0.25 * walls * walls / 4;
      // Salidas: un rincón con la horda delante es una trampa (no se puede huir hacia ningún lado).
      if (P.escW && !judge && !inArena && nearest < 320) {
        let open = 0;
        for (let j = 0; j < 8; j++) {
          const ca = Math.cos(j * Math.PI / 4), sa = Math.sin(j * Math.PI / 4);
          let ok = true;
          for (let d = 50; d <= P.escR; d += 50) if (!freeAt(fx + ca * d, fy + sa * d, wr)) { ok = false; break; }
          if (ok) open++;
        }
        if (open < 5) c += P.escW * (5 - open) * (5 - open) / 25;
      }
      if (dbgRows) dbgC.push('w' + c.toFixed(2));
      // Borde de la arena.
      if (ring) {
        // (En la grieta, a medio camino y flojo: la arena es pequeña y el legendario
        //  se va al borde en su modo "lejos".)
        const ex = judge ? fx : PX[4], ey = judge ? fy : PY[4];
        const d = Math.hypot(ex - ring.x, ey - ring.y);
        const r0 = judge ? P.jEdge0 : 0.72;
        if (d > ring.r * r0) { const q = (d - ring.r * r0) / (ring.r * (1 - r0)); c += q * q * (judge ? P.jEdgeW : P.ringW); }
      }

      if (dbgRows) dbgC.push('r' + c.toFixed(2));
      // --- objetivo ---
      if (rift) {
        const rx = rift.x, ry = rift.y - 10;
        const d0 = Math.hypot(rx - pl.x, ry - pl.y);
        let d1 = Infinity;
        for (let k = 0; k < NT; k++) d1 = Math.min(d1, Math.hypot(rx - PX[k], ry - PY[k]));
        if (afterRift) c -= P.wRift * 2;
        else c -= P.wRift * Math.max(-1, Math.min(1, (d0 - d1) / (spd * T[NT - 1])));
      } else if (goal && !hold) {
        const tx = goal.wp ? goal.wp.x : goal.x, ty = goal.wp ? goal.wp.y : goal.y;
        const d0 = Math.hypot(tx - pl.x, ty - pl.y), d1 = Math.hypot(tx - PX[4], ty - PY[4]);
        const gw = goal.tag === 'spring' ? 1.6 : goal.tag === 'heal' ? 1.2 + (1 - hpK) : goal.tag === 'chest' ? 0.8 : 1;
        c -= P.wGoal * gw * Math.max(-1, Math.min(1, (d0 - d1) / (spd * T[4]))) * (hpK < 0.3 && goal.tag !== 'spring' && goal.tag !== 'heal' ? 0.4 : 1);
      } else if (hold && still) c -= P.wGoal * 1.2;
      // Experiencia.
      if (xps.length && !still) {
        let g = 0;
        for (const p of xps) {
          let d1 = Infinity;
          for (let k = 0; k < NT; k += 2) { const d = Math.hypot(p.x - PX[k], p.y - PY[k]); if (d < d1) d1 = d; }
          d1 = Math.max(pl.magnet * 0.8, d1);
          g += p.v * Math.max(-1, Math.min(1, (p.d - d1) / (spd * T[NT - 1]))) / (1 + p.d / 150);
        }
        c -= P.wXp * Math.min(4, g) * (0.4 + 0.6 * hpK);
      }
      // Sentencia: rodear la arena con Arceus al otro lado.
      if (judge && arceus && ring) {
        const a = Math.atan2(pl.y - ring.y, pl.x - ring.x);
        const aa = Math.atan2(arceus.y - ring.y, arceus.x - ring.x);
        let diff = a - aa; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
        const side = diff >= 0 ? 1 : -1;
        const ta = a + side * P.jAhead, R = ring.r * P.jR;
        const gx = ring.x + Math.cos(ta) * R, gy = ring.y + Math.sin(ta) * R;
        const d0 = Math.hypot(gx - pl.x, gy - pl.y), d1 = Math.hypot(gx - fx, gy - fy);
        c -= P.jGoal * Math.max(-1, Math.min(1, (d0 - d1) / (spd * T[NT - 1])));
        // Lejos de los legendarios.
        // (Cada legendario pega el doble que el anterior: pronto un toque es letal.)
        for (const e of near) {
          const d = Math.hypot(e.x - fx, e.y - fy) - e.r;
          if (d < P.jLegR) c += P.jLegW * (P.jLegR - d) / P.jLegR * Math.min(3, Math.max(0.3, e._p.dmg / pl.maxHp));
        }
      }

      if (dbgRows) dbgC.push('g' + c.toFixed(2));
      // Inercia.
      if (prevI < NDIR && !still) c -= P.wInertia * (ux * DX[prevI] + uy * DY[prevI]);
      else if ((prevI === NDIR) !== still) c += 0.004;
      if (still && !hold && !near.length) c += 0.01;

      if (dbgRows) dbgRows.push(ci + ':' + c.toFixed(2) + '/' + (dmg / pl.maxHp).toFixed(2) + (blocked ? 'B' : '') + (P.dbgC ? '[' + dbgC.join(' ') + ']' : ''));
      if (dbgRows) dbgC.length = 0;
      if (ci === prevI) prevC = c;
      if (c < bestC) { bestC = c; bestI = ci; }
    }
    };
    evalAll();
    // Si la embestida propia nos mete en algo grave, se mira sin ella: si así se
    // sale y hay otro hueco de daño sin embestida, se cambia a él un rato.
    if (dashM && P.dashEscape && bestC > 0.5) {
      const alt = altSlotNoDash(pl);
      if (alt >= 0) {
        const withC = bestC, withI = bestI;
        useDash = false;
        evalAll();
        if (bestC < withC - 0.25) noDashUntil = api.time + 0.6;
        else { useDash = true; evalAll(); }
      }
    }
    // Histéresis: seguir con el plan anterior salvo que otro sea claramente mejor
    // (si no, cambia de idea a cada fotograma y en la práctica se queda quieto).
    if (prevC < Infinity && bestI !== prevI && prevC <= bestC + P.hyst + P.hystK * Math.abs(bestC)) bestI = prevI;
    if (dbgRows) console.log('t' + api.time.toFixed(2), 'hp' + Math.round(pl.hp), 'best', bestI, dbgRows.join(' '), 'hz', hazards.map(h => h.kind + ' ' + Math.round(h.x - pl.x) + ',' + Math.round(h.y - pl.y) + ' r' + h.r + ' left' + (h.delay - h.t).toFixed(2)).join('; '));
    // Embestidas apuntadas: recuerda la dirección al empezar.
    for (const e of near) { if (e.phase === 'aim') { if (!aimDir.has(e)) aimDir.set(e, norm(pl.x - e.x, pl.y - e.y)); } else aimDir.delete(e); }

    prevI = bestI;
    cacheMove = bestI === NDIR ? [0, 0] : [DX[bestI], DY[bestI]];
    return cacheMove;
  }

  const bot = {
    name: 'pro-a',
    stats,
    init(api) {
      G = api.G; prevI = NDIR; goal = null; buffMode = null; known.clear();
      if (cards && cards.init) cards.init(api);
    },
    move,
    active: slotChoice,
    card: (c, api) => cards.card(c, api),
    item: (a, b, api) => {
      let r = cards.item ? cards.item(a, b, api) : a;
      // Cinta Elección con una embestida en el grupo: no se podría cambiar de hueco
      // para no embestir contra un jefe o una zona avisada.
      if (r === 'choiceband' && P.noBandDash && api.pl.moves.some(m => m.kind === 'dash')) r = a === 'choiceband' ? b : a;
      return r;
    },
    bond: (o, api) => (cards.bond ? cards.bond(o, api) : []),
    secondMove: cards && cards.secondMove ? (pool, api) => cards.secondMove(pool, api) : undefined
  };
  return bot;
};

/** Cuánto dentro de una zona avisada está un círculo (positivo = dentro), como G.Hazards.inside. */
function depth(h, x, y, r) {
  if (h.kind === 'zone') return h.r + r * 0.6 - Math.hypot(x - h.x, y - h.y);
  const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
  const px = x - h.x, py = y - h.y;
  const along = px * ca + py * sa;
  const side = h.w / 2 + r * 0.6 - Math.abs(-px * sa + py * ca);
  const end = Math.min(along + r, h.len + r - along);
  return Math.min(side, end);
}
// SIM_BANOPTS='{"priority":["substitute"]}' (nunca vetarlo) o '{"avoid":["substitute"]}' (vetarlo primero): opciones de bans() de v2.
module.exports.bans = (dex, G) => require('./cards-v2').bans(dex, G, process.env.SIM_BANOPTS ? JSON.parse(process.env.SIM_BANOPTS) : {});
