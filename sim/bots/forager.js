/* ============ sim/bots/forager.js — bot oportunista que aprovecha el mapa ============
 *
 * Movimiento por MUESTREO de direcciones: cada fotograma prueba 16 direcciones
 * (y quedarse quieto) y puntúa dónde estaría en los próximos instantes:
 *
 *   peligro   contacto con enemigos (con su embestida si la están apuntando),
 *             disparos enemigos (trayectoria recta), zonas avisadas que van a
 *             estallar (G.Hazards), Arceus en la Sentencia, charcos que queman,
 *             trampas, paredes (quedarse atascado) y verse rodeado.
 *   codicia   ir hacia un OBJETIVO elegido por utilidad (valor / distancia,
 *             frenado por el peligro y la vida que queda):
 *               grieta (siempre: perder en la arena no acaba la partida y los
 *               enemigos del mapa se guardan), altar de poder, manantial si
 *               falta vida, cofre con candado (quedarse al lado 3,5 s), bayas,
 *               imán, objetos, racimos de experiencia, duende del tesoro,
 *               Pokémon perdido (tocarlo y llevarlo a la marca).
 *   sin objetivo  mantenerse a la distancia de su ataque, rodeando a la horda
 *             (en círculo: huir en línea recta hace que los rezagados vuelvan
 *             a salir por delante).
 *
 * Cartas, objetos y vínculos: si existe sim/bots/cards.js (otro bot que sólo
 * elige), se le delega; si no, una regla sencilla (ver fallbackCards).
 *
 * Opciones (--opts '{...}'):
 *   cards: 'fallback'   no usar cards.js (regla propia, determinista y estable)
 *   cardsPath           otro módulo de cartas (p. ej. una copia fija para comparar)
 *   debug: true         apunta el origen de cada golpe (bot.dmgLog, bot.lastWords())
 *   dumpAt: s           vuelca la puntuación de cada dirección en ese segundo
 *   pesos: wantMax (200), crowdW (0.6), keep (130), kiteK (1), orbitW (1.2),
 *          bossW (1.5), densW (0), altarK (1), xpK (1), noMem
 * (Barridos con 12 semillas: los valores por defecto son los mejores probados.)
 *
 * Nota: guarda en cada enemigo cercano _spd, _tk y keep (campos propios del bot,
 * el juego no los lee).
 */
'use strict';

const DIRS = 16;
const TAU = Math.PI * 2;
const DCOS = [], DSIN = [];
for (let i = 0; i < DIRS; i++) { DCOS.push(Math.cos(i / DIRS * TAU)); DSIN.push(Math.sin(i / DIRS * TAU)); }

// --------------------------------------------------------------- cartas (respaldo)

function moveScore(m) {
  // Valor aproximado de un movimiento: nivel y evolución mandan.
  return (m.lvl || 1) + (m.evolved ? 3 : 0);
}

function groupScore(g) {
  let s = 0;
  for (const m of g) if (m.kind !== 'buff') s += moveScore(m);
  return s + (g.length - 1) * 2;
}

/** Hueco "foco": el del primer movimiento (el inicial), o el vínculo más grande. */
function focusGroup(pl) {
  let g = pl.slots.find(x => x.includes(pl.moves[0])) || pl.slots[0] || [];
  for (const x of pl.slots) if (x.length > g.length) g = x;
  return g;
}

function fallbackCards() {
  const ITEM_RANK = ['leftovers', 'assaultvest', 'choiceband', 'quickclaw', 'shellbell', 'focussash',
                     'choicescarf', 'luckyegg', 'rockyhelmet', 'amuletcoin', 'lifeorb'];
  return {
    card(cards, { G, pl }) {
      const act = pl.activeGroup();
      const waiting = {};
      for (const m of pl.moves) { const ev = G.Moves.evoInfo(m, pl.statsTaken); if (ev && !ev.ready) waiting[ev.needs] = true; }
      let best = 0, bs = -Infinity;
      cards.forEach((c, i) => {
        let s = 0;
        const [type, id] = c.key.split(':');
        if (type === 'evo') s = 1000;
        else if (type === 'stat' && waiting[id]) s = 900;
        else if (type === 'up') {
          const m = pl.moves.find(x => x.id === id);
          if (m && m.kind === 'buff') s = 5;
          else if (m && focusGroup(pl).includes(m)) s = 800 - m.lvl;
          else s = 300;
        } else if (type === 'new') {
          // Un segundo movimiento de daño (para los vínculos), no más.
          const d = G.Moves.BY_ID[id];
          // (Llenar los huecos quita las cartas de movimiento nuevo de las ofertas: así salen más mejoras.)
          s = d.kind === 'buff' ? 1 : 520;
        } else if (type === 'stat') {
          s = { atk: 600, cd: 590, hp: 560, def: 450, rgn: 400, heal: pl.hp < pl.maxHp * 0.5 ? 650 : 100,
                spd: 350, mag: 200, xp: 250 }[id] || 50;
        }
        if (s > bs) { bs = s; best = i; }
      });
      return best;
    },
    item(cur, next) {
      const r = id => { const i = ITEM_RANK.indexOf(id); return i < 0 ? 99 : i; };
      return r(next) < r(cur) ? next : cur;
    },
    bond(opt) {
      const loose = opt.loose.filter(m => m.kind !== 'buff').sort((a, b) => moveScore(b) - moveScore(a));
      if (opt.mode === 'add') return loose.length ? [loose[0]] : [opt.loose[0]];
      const l2 = loose.length >= 2 ? loose : opt.loose;
      return l2.slice(0, 2);
    }
  };
}

function loadCards(opts) {
  try {
    const mk = require(opts.cardsPath || './cards.js');
    const c = typeof mk === 'function' ? mk(opts) : mk;
    if (c && typeof c.card === 'function') return c;
  } catch (e) { /* aún no existe o falla: regla propia */ }
  return null;
}

// --------------------------------------------------------------- ayudas

function reachOf(m) {
  // Copia de reach() en js/systems/combat.js (no se exporta).
  if (!m) return 0;
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
    default: return 160;   // nova, minas, torretas, rastro: cerca pero sin pegarse
  }
}

// --------------------------------------------------------------- el bot

module.exports = (opts = {}) => {
  const ext = opts.cards === 'fallback' ? null : loadCards(opts);
  const fb = fallbackCards();
  const debug = !!opts.debug;

  const known = new Map();
  let goal = null, goalT = 0, lastHp = 0, chestLock = null;
  let curDir = null, orbitSide = 1, sideT = 0;
  let stuckT = 0, lastX = 0, lastY = 0;
  const dmgLog = {}, lastHits = [], histBest = [], hitStats = [];
  let activeT = 0;

  // ---------- objetivo (utilidad) ----------
  function pickGoal(api, S, threat) {
    const { G, pl, time } = api;
    const hpF = pl.hp / pl.maxHp;
    const spd = Math.max(40, pl.spd);
    const greed = Math.max(0.15, Math.min(1, (hpF - 0.15) / 0.6)) * (1 - Math.min(0.7, threat));
    const cand = [];
    const add = (kind, x, y, value, ref) => {
      const d = Math.hypot(x - pl.x, y - pl.y);
      // Coste: tiempo de viaje en segundos.
      cand.push({ kind, x, y, ref, d, u: value / (1 + d / spd / 2.5) });
    };

    // Sentencia de Arceus: nada más que sobrevivir.
    if (S.judge) return null;

    if (S.inArena) {
      // Tras ganar: recoger lo que suelta (lo atrae solo); nada más que hacer.
      return null;
    }

    // Grieta: siempre que se llegue a tiempo.
    if (S.rift) {
      const d = Math.hypot(S.rift.x - pl.x, S.rift.y - 10 - pl.y);
      if (d / spd < S.rift.ttl - 0.5) cand.push({ kind: 'rift', x: S.rift.x, y: S.rift.y - 10, d, u: 1000 });
    }

    // Interactivos del mapa: los que se ven y los que se recuerdan (manantiales
    // y altares vistos antes, hasta ~1600 px: se vuelve a ellos si hace falta).
    for (const p of G.World.specialsNear(pl.x, pl.y, 700)) if (p.type === 'spring' && !opts.noMem) known.set(p.id, p);
    const specials = new Set(G.World.specialsNear(pl.x, pl.y, 700));
    for (const p of known.values()) {
      if (p.type === 'altar' && p.used) { known.delete(p.id); continue; }
      if (Math.hypot(p.x - pl.x, p.y - pl.y) < 1600) specials.add(p);
    }
    for (const p of specials) {
      if (p.type === 'altar' && !p.used) add('altar', p.x, p.y + p.r + pl.r + 2, 70 * (0.5 + greed) * (opts.altarK != null ? opts.altarK : 1));
      else if (p.type === 'spring' && p.charge > 0.15 && hpF < 0.75) add('spring', p.x, p.y - 8, 180 * (1 - hpF));
      else if (p.type === 'bigchest' && greed > 0.35) {
        // Abrirlo son 3,5 s quieto: sólo si no hay nadie que llegue antes.
        let calm = true;
        for (const e of S.enemies) {
          if (e.behavior === 'thief') continue;
          const de = Math.hypot(e.x - p.x, e.y - p.y);
          if (de < 120 + (e._spd || e.spd) * 3) { calm = false; break; }
        }
        if (calm || p.open > 2.6) add('bigchest', p.x, p.y + p.r + pl.r + 8, 60 * greed, p);
      }
    }

    // Recogibles.
    let bestXp = null;
    const pk = S.pickups;
    const xpNext = pl.xpNext || 100;
    for (const o of pk) {
      if (o.pulled) continue;
      const d = Math.hypot(o.x - pl.x, o.y - pl.y);
      if (d > 520) continue;
      switch (o.kind) {
        case 'heal': if (hpF < 0.85) add('heal', o.x, o.y, 160 * (1 - hpF) + 10); break;
        case 'magnet': add('magnet', o.x, o.y, 60); break;
        case 'bomb': add('bomb', o.x, o.y, 25); break;
        case 'item': add('item', o.x, o.y, pl.item ? 15 : 50); break;
        case 'ticket': case 'ticket10': case 'coin': add('coin', o.x, o.y, 1.5); break;
        case 'xp': case 'xpBig': {
          if (d < pl.magnet) break;
          // Racimo: suma lo que hay alrededor de este orbe.
          let v = 0;
          for (const q of pk) {
            if ((q.kind === 'xp' || q.kind === 'xpBig') && !q.pulled && Math.abs(q.x - o.x) < 70 && Math.abs(q.y - o.y) < 70) v += q.value || 1;
          }
          const val = Math.min(45, 4 + 120 * v / xpNext) * greed * (opts.xpK != null ? opts.xpK : 1);
          const u = val / (1 + d / spd / 2.5);
          if (!bestXp || u > bestXp.u) bestXp = { kind: 'xp', x: o.x, y: o.y, d, u };
        }
      }
    }
    if (bestXp) cand.push(bestXp);

    // Duende del tesoro (sólo monedas, poco valor para aguantar).
    for (const e of S.enemies) {
      if (e.behavior === 'thief') {
        const d = Math.hypot(e.x - pl.x, e.y - pl.y);
        if (d < 450) add('thief', e.x, e.y, 12 * greed);
      }
    }

    // Pokémon perdido.
    const L = G.Events._dbg && G.Events._dbg();
    if (L) {
      if (L.state === 'wait') add('lost', L.x, L.y, 30 * greed);
      else add('escort', L.tx, L.ty, 45 * greed);
    }

    let best = null;
    for (const c of cand) if (!best || c.u > best.u) best = c;
    return best && best.u > 2 ? best : null;
  }

  // ---------- amenaza general (0..1) ----------
  function threatLevel(api, S) {
    const { pl } = api;
    let t = 0;
    for (const e of S.enemies) {
      const d = Math.hypot(e.x - pl.x, e.y - pl.y);
      if (d < 160) t += (e.boss ? 3 : 1) * e.dmg / pl.maxHp * (160 - d) / 160;
    }
    for (const h of S.hazards) if (!h.hit) t += 0.05;
    return Math.min(1, t * 1.5);
  }

  // ---------- puntuación de una dirección ----------
  function scoreDir(api, S, ctx, dx, dy) {
    const { G, pl } = api;
    const spd = ctx.spd;
    const W = G.World;
    let pen = 0;

    // Posiciones futuras: paso a paso, parando en paredes y frenando en el agua.
    const T = ctx.T;
    const px = new Array(T.length), py = new Array(T.length);
    let bx = pl.x, by = pl.y, blocked = false, prevT = 0, wet = 0;
    const le = ctx.liq;
    for (let k = 0; k < T.length; k++) {
      const dt = T[k] - prevT; prevT = T[k];
      if (!blocked && (dx || dy)) {
        const inL = W.isLiquid(bx, by);
        const f = inL && le.slow ? le.slow : 1;
        const want = spd * f * dt;
        // Choque real (desliza por las paredes como el jugador), en pasos
        // cortos para no atravesar esquinas.
        const o = ctx.probe; o.x = bx; o.y = by;
        const n = Math.max(1, Math.ceil(want / 9)), st = want / n;
        for (let j = 0; j < n; j++) { o.x += dx * st; o.y += dy * st; W.collide(o); }
        const got = (o.x - bx) * dx + (o.y - by) * dy;
        if (got < want * 0.3) { blocked = true; pen += (T.length - k) * 4; }
        else {
          bx = o.x; by = o.y;
          if (W.isLiquid(bx, by)) {
            if (le.dmg) pen += (k < 3 ? 40 : 15) + pl.maxHp * le.dmg * 2;
            else if (le.slow) { pen += 6 * ctx.TW[k]; wet++; }
          }
        }
      }
      px[k] = bx; py[k] = by;
    }
    const fx = px[T.length - 1], fy = py[T.length - 1];

    // Rincones: paredes alrededor de donde acabo (sin salidas, te encierran).
    let walls = 0;
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4;
      if (!W.isFree(fx + Math.cos(a) * 44, fy + Math.sin(a) * 44, pl.r * 0.6, true)) walls++;
    }
    pen += walls * walls * ctx.cornerW;

    // Callejones: paredes más allá del horizonte en esa dirección.
    if ((dx || dy) && !blocked) {
      for (const far of ctx.rays) {
        const rx = fx + dx * far, ry = fy + dy * far;
        if (W.isWall(rx, ry) || !W.isFree(rx, ry, pl.r * 0.7, true)) { pen += ctx.rayW * 60 / far; break; }
      }
    }

    // Daño esperado (en vida) de cada peligro; un golpe que te deja a cero cuenta mucho más.
    const hurtK = (1 - pl.reduction) * ctx.closeK;
    const lethal = d => d * (1 + 2.5 * Math.min(1.5, d / Math.max(1, pl.hp)));

    // Enemigos: cada uno cuenta UNA vez (el peor instante), con menos peso cuanto más lejos en el tiempo.
    for (const e of ctx.near) {
      const dmg = lethal(e.dmg * hurtK * (e._tk || 1));
      const rr = e.r + pl.r;
      const es = e._spd;
      let risk = 0;
      for (let k = 0; k < T.length; k++) {
        const t = T[k];
        let ex, ey;
        if (e.behavior === 'charger' && e.phase === 'dash') {
          ex = e.x + e.dx * es * 3.4 * Math.min(t, e.pt); ey = e.y + e.dy * es * 3.4 * Math.min(t, e.pt);
        } else if (e.behavior === 'charger' && e.phase === 'aim') {
          // Embestida hacia donde estás ahora: 0,42 s a 3,4× su velocidad.
          const [ax, ay] = G.U.norm(pl.x - e.x, pl.y - e.y);
          const go = Math.max(0, Math.min(t - e.pt, 0.42));
          ex = e.x + ax * es * 3.4 * go; ey = e.y + ay * es * 3.4 * go;
        } else if (e.jump) {
          ex = e.jump.tx; ey = e.jump.ty;
        } else {
          // Se acerca a ti (a su velocidad).
          const ddx = px[k] - e.x, ddy = py[k] - e.y, d = Math.hypot(ddx, ddy) || 1;
          const step = Math.min(d, (e.keep ? 0 : 1) * es * t);
          ex = e.x + ddx / d * step; ey = e.y + ddy / d * step;
        }
        const d = Math.hypot(px[k] - ex, py[k] - ey);
        const margin = 6 + 14 * t;
        if (d < rr + margin) {
          const w = Math.min(1, 0.5 + 0.5 * (rr + margin - d) / margin);
          const r = w * ctx.TW[k] * (e.touchCd > t + 0.1 ? 0.3 : 1);
          if (r > risk) risk = r;
        }
      }
      pen += dmg * risk * 3;
      // Jefes (y legendarios): fuera del alcance de su pisotón (96 + su radio).
      if (e.boss) {
        const safe = 96 + e.r + pl.r + 30;
        for (const k of [2, T.length - 1]) {
          const d = Math.hypot(px[k] - e.x, py[k] - e.y);
          if (d < safe) { const q = 1 - d / safe; pen += ctx.bossW * dmg * q * q; }
        }
      }
      if (ctx.dbg && risk > 0) ctx.dbg.push(e.name + ':' + Math.round(dmg * risk * 3));
      // Agobio: estar cerca de muchos al final del horizonte (posición actual del enemigo).
      const d2 = Math.hypot(fx - e.x, fy - e.y);
      if (d2 < ctx.keep) { const q = 1 - d2 / ctx.keep; pen += ctx.crowdW * dmg * q * q; }
    }

    // Disparos enemigos (trayectoria recta).
    for (const p of ctx.shots) {
      const rr = p.r + pl.r + 5;
      const dmg = lethal(p.dmg * hurtK * (p.mtype ? G.Types.mult(p.mtype, pl.mon.types) : 1));
      for (let k = 0; k < T.length; k++) {
        const t = T[k];
        if (t > p.life + 0.05) break;
        const sx = p.x + p.vx * t, sy = p.y + p.vy * t;
        const d = Math.hypot(px[k] - sx, py[k] - sy);
        if (d < rr) { pen += dmg * 3 * Math.min(1, ctx.TW[k] + 0.2); break; }
      }
    }

    // Zonas avisadas: ¿estaré dentro cuando estallen?
    for (const h of ctx.haz) {
      const left = h.delay - h.t;
      // Posición en ese instante (más allá del horizonte, la última).
      let hx = fx, hy = fy;
      for (let k = 0; k < T.length; k++) if (T[k] >= left) { hx = px[k]; hy = py[k]; break; }
      const pad = 7;
      const raw = h.pct ? Math.max(h.dmg, pl.maxHp * h.pct) : h.dmg * (h.pure ? 1 : hurtK * (h.type ? G.Types.mult(h.type, pl.mon.types) : 1));
      const dmg = lethal(raw);
      if (G.Hazards.inside(h, hx, hy, pl.r + pad)) {
        pen += dmg * 3 * (left < 0.6 ? 1.2 : 0.9);
      } else if (G.Hazards.inside(h, fx, fy, pl.r + pad)) {
        pen += dmg * 0.5;
      }
    }

    // Arceus (invencible: tocarle quita el 40 %).
    if (ctx.arceus) {
      const A = ctx.arceus;
      for (let k = 0; k < T.length; k++) {
        const t = T[k];
        const ddx = px[k] - A.x, ddy = py[k] - A.y, d = Math.hypot(ddx, ddy) || 1;
        const ad = Math.max(0, d - A.spd * t);
        const safe = A.r + pl.r + 60;
        if (ad < safe) pen += pl.maxHp * 0.4 * (1 + 2 * (safe - ad) / safe) * ctx.TW[k];
      }
      const dd = Math.hypot(fx - A.x, fy - A.y);
      if (dd < 240) pen += pl.maxHp * 0.15 * (240 - dd) / 240;
    }

    // Trampas en el camino.
    for (const tp of ctx.traps) {
      for (let k = 0; k < 3; k++) if (Math.hypot(px[k] - tp.x, py[k] - tp.y + 8) < 18) { pen += 25 + pl.maxHp * 0.1; break; }
    }

    // Arena: no pegarse al borde.
    if (ctx.ring) {
      const R = ctx.ring;
      const d = Math.hypot(fx - R.x, fy - R.y);
      if (d > R.r * 0.7) { const q = (d - R.r * 0.7) / (R.r * 0.3); pen += q * q * pl.maxHp * 0.5 * ctx.edgeW; }
    }

    // Objetivo.
    let gain = 0;
    if (ctx.goal) {
      const g = ctx.goal;
      const d0 = Math.hypot(g.x - pl.x, g.y - pl.y);
      const d1 = Math.hypot(g.x - fx, g.y - fy);
      const maxStep = spd * T[T.length - 1];
      gain += ctx.goalW * (d0 - d1) / maxStep;
    }

    // Sin objetivo: distancia de combate y rodeo.
    if (ctx.kite) {
      const K = ctx.kite;
      const d = Math.hypot(fx - K.x, fy - K.y);
      // Dentro del alcance del ataque, pero no encima.
      const want = ctx.want;
      gain -= ctx.kiteW * Math.abs(d - want) / Math.max(60, want);
      // Rodear: componente tangencial respecto al centro de la horda.
      const rx = pl.x - K.cx, ry = pl.y - K.cy, rn = Math.hypot(rx, ry) || 1;
      const tx = -ry / rn * orbitSide, ty = rx / rn * orbitSide;
      gain += ctx.orbitW * (dx * tx + dy * ty);
    }

    // Seguir la dirección que llevaba (evita temblar).
    if (curDir && (dx || dy)) gain += 0.6 * (dx * curDir[0] + dy * curDir[1]);

    if (opts.dumpAt != null) ctx.rec = { who: ctx.dbg ? ctx.dbg.join(' ') : '', pen: Math.round(pen), gain: +gain.toFixed(1), blocked, fx: Math.round(fx - pl.x), fy: Math.round(fy - pl.y) };
    return gain - pen * ctx.penK;
  }

  function move(api) {
    const { G, pl, time } = api;
    const S = api.sense();
    const hpF = pl.hp / pl.maxHp;


    // Velocidad sin el freno del agua (lo aplica la simulación paso a paso).
    const le0 = G.World.liquidEffect(pl.mon.types);
    const spd = Math.max(30, pl.inLiquid && le0.slow ? pl.spd / le0.slow : pl.spd);
    const act = pl.activeMove();
    const reach = reachOf(act);

    // Contexto para puntuar.
    const near = [];
    const dens = new Float64Array(DIRS);
    let cx = 0, cy = 0, cw = 0, nearestE = null, nd = Infinity;
    for (const e of S.enemies) {
      if (e.behavior === 'thief') continue;
      const d = Math.hypot(e.x - pl.x, e.y - pl.y);
      if (d < 320) {
        near.push(e);
        e._spd = e.spd * (1 - (e.slow || 0)) * G.Weather.speedFor(e.types);
        e._tk = G.Types.mult(e.atkType, pl.mon.types);
        e.keep = !e.boss && ['ranged', 'fan', 'beamer', 'zoner', 'healer', 'summoner'].includes(e.behavior) && d < (e.def.range || 200) * 0.82;
      }
      if (d < 400) { const w = e.boss ? 4 : 1; cx += e.x * w; cy += e.y * w; cw += w; }
      if (d < nd) { nd = d; nearestE = e; }
      // Densidad por direcciones (a dónde NO ir a medio plazo).
      if (d < 460 && d > 1) {
        const w = e.dmg * G.Types.mult(e.atkType, pl.mon.types) * (e.boss ? 3 : 1) * Math.exp(-d / 170);
        const ux = (e.x - pl.x) / d, uy = (e.y - pl.y) / d;
        for (let i = 0; i < DIRS; i++) {
          const c = ux * DCOS[i] + uy * DSIN[i];
          if (c > 0) dens[i] += w * c * c;
        }
      }
    }
    const shots = S.shots.filter(p => Math.abs(p.x - pl.x) < 260 && Math.abs(p.y - pl.y) < 260);
    const haz = S.hazards.filter(h => !h.hit);
    const threat = threatLevel(api, S);

    // Objetivo (cada 0,25 s, o al desaparecer).
    goalT -= 1 / 30;
    if (goalT <= 0 || (goal && goal.done)) { goal = pickGoal(api, S, threat); goalT = 0.25; }
    // Cofre con candado: si ya estoy al lado, me quedo.
    let goalHold = false;
    if (goal && goal.kind === 'bigchest' && goal.ref) {
      const p = goal.ref;
      if (Math.hypot(p.x - pl.x, p.y - pl.y) < Math.max(46, p.r + pl.r + 24) - 4 && p.open > 0) goalHold = true;
    }
    if (goal && goal.kind === 'spring') {
      if (Math.hypot(goal.x - pl.x, goal.y - pl.y) < 18) goalHold = true;
    }

    // Arceus.
    let arceus = null;
    if (S.judge) {
      const st = G.Judgment.netState && G.Judgment.netState();
      if (st) {
        // Su velocidad crece con el tiempo de pelea (ver arceusTick en judgment.js).
        const sm = G.Judgment.summary && G.Judgment.summary();
        const k = Math.min(1.22, 0.74 + (sm ? sm.time : 0) * 0.013);
        arceus = { x: st[0], y: st[1], r: G.Sprites.bodyRadius(493, 1.5) * 0.9, spd: Math.max(70, pl.spd * k) };
      }
    }

    // Arena (grieta o Sentencia): centro y radio para no pegarse al borde.
    let ring = null;
    if (S.inArena && S.arena) ring = { x: S.arena.x, y: S.arena.y, r: (S.arena.r - 1.4) * 32 };
    else if (S.judge) {
      // Centro de la arena de la Sentencia (World.arena, en casillas de 32 px).
      const a = G.World.arena;
      if (a) ring = { x: a.tx * 32 + 16, y: a.ty * 32 + 16, r: (a.r - 1.4) * 32 };
    }

    const ctx = {
      spd, near, shots, haz, T: [0.1, 0.25, 0.45, 0.7, 1.0, 1.4], TW: [1.5, 1.3, 1.0, 0.7, 0.45, 0.3],
      liq: G.World.liquidEffect(pl.mon.types),
      traps: G.World.specialsNear(pl.x, pl.y, 120).filter(p => p.type === 'trap'),
      probe: { x: 0, y: 0, r: pl.r }, closeK: pl.activeGroup().some(m => m.kind === 'melee') ? 0.75 : 1, keep: opts.keep || 130, crowdW: opts.crowdW != null ? opts.crowdW : 0.6, rays: [40, 90, 150], rayW: 3, cornerW: 1.2, densW: opts.densW || 0, bossW: opts.bossW != null ? opts.bossW : 1.5, penK: 1, arceus, ring, edgeW: S.judge ? 3 : 1,
      goal: null, goalW: 0, kite: null, kiteW: 0, orbitW: 0, want: 0
    };

    if (goal && !goalHold) {
      ctx.goal = goal;
      ctx.goalW = goal.kind === 'rift' ? 40 : 3 + Math.min(12, goal.u / 6);
    }
    if (!goalHold) {
      if (S.judge && arceus && ring) {
        // Rodear la arena con Arceus al otro lado.
        const ax = arceus.x - ring.x, ay = arceus.y - ring.y;
        const a = Math.atan2(pl.y - ring.y, pl.x - ring.x);
        const aa = Math.atan2(ay, ax);
        let diff = a - aa; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
        const side = diff >= 0 ? 1 : -1;
        const ta = a + side * 0.4;
        const R = ring.r * 0.55;
        ctx.goal = { x: ring.x + Math.cos(ta) * R, y: ring.y + Math.sin(ta) * R };
        ctx.goalW = 20;
      } else if (cw && nearestE && !(goal && goal.kind === 'rift')) {
        ctx.kite = { x: nearestE.x, y: nearestE.y, cx: cx / cw, cy: cy / cw };
        // Distancia deseada: dentro del alcance; con cuerpo a cuerpo hay que arrimarse.
        ctx.want = Math.max(nearestE.r + pl.r + 18, Math.min(reach * 0.75, opts.wantMax || 200));
        ctx.kiteW = (goal ? 1 : 3) * (opts.kiteK != null ? opts.kiteK : 1);
        ctx.orbitW = opts.orbitW != null ? opts.orbitW : 1.2;
      }
    }

    // Cambiar el sentido del rodeo si lleva rato atascado.
    const moved = Math.hypot(pl.x - lastX, pl.y - lastY);
    lastX = pl.x; lastY = pl.y;
    if (curDir && moved < spd / 30 * 0.3) stuckT += 1 / 30; else stuckT = Math.max(0, stuckT - 1 / 30);
    sideT -= 1 / 30;
    if (stuckT > 0.5 && sideT <= 0) { orbitSide = -orbitSide; sideT = 2; stuckT = 0; }

    const dump = opts.dumpAt != null && time >= opts.dumpAt && time < opts.dumpAt + 0.5;
    let best = [0, 0], bs = scoreDir(api, S, ctx, 0, 0);
    if (dump) console.log('t', time.toFixed(2), 'stay', bs.toFixed(1), 'goal', goal && goal.kind, 'hold', goalHold, 'want', ctx.want);
    let dmean = 0;
    for (let i = 0; i < DIRS; i++) dmean += dens[i] / DIRS;
    for (let i = 0; i < DIRS; i++) {
      const dx = DCOS[i], dy = DSIN[i];
      if (dump) ctx.dbg = [];
      const s = scoreDir(api, S, ctx, dx, dy) - ctx.densW * (dens[i] - dmean);
      if (dump) console.log('  dir', i, s.toFixed(1), JSON.stringify(ctx.rec));
      if (s > bs) { bs = s; best = [dx, dy]; }
    }
    curDir = best[0] || best[1] ? best : null;
    if (debug) { histBest.push(bs); if (histBest.length > 30) histBest.shift(); }
    return best;
  }


  // Para depurar: ¿qué ha hecho daño?
  function blame(api, S) {
    const { G, pl } = api;
    for (const h of S.hazards) if (h.hit && h.t - h.delay < 0.05 && G.Hazards.inside(h, pl.x, pl.y, pl.r)) return 'hazard' + (h.pct ? ':arceus' : '');
    if (pl.inLiquid) return 'liquid';
    for (const e of S.enemies) if (Math.hypot(e.x - pl.x, e.y - pl.y) < e.r + pl.r + 4) return e.boss ? 'touch:boss' : 'touch';
    return 'shot/other';
  }

  // Movimiento activo: el grupo más fuerte (cada 1 s).
  function active(api) {
    activeT -= 1 / 30;
    if (activeT > 0) return null;
    activeT = 1;
    const { pl } = api;
    const i = pl.slots.indexOf(focusGroup(pl));
    return i >= 0 ? i : null;
  }

  const C = ext || fb;
  return {
    name: 'forager',
    init(api) {
      lastHp = api.pl.hp;
      if (debug) {
        // Origen de cada golpe según quién llama a hurt (pila de llamadas).
        const pl = api.pl, h0 = pl.hurt;
        pl.hurt = function (amount, type, pure) {
          const before = this.hp;
          h0.call(this, amount, type, pure);
          const d = before - this.hp;
          if (d <= 0) return;
          const st = new Error().stack;
          let why = 'other';
          const m = st.match(/combat\.js:(\d+)/);
          if (/hazards\.js/.test(st)) why = pure ? 'hz-arceus' : 'hazard';
          else if (/judgment\.js/.test(st)) why = 'arceus';
          else if (/interact\.js/.test(st)) why = 'trap';
          else if (m) why = +m[1] >= 600 ? 'touch' : 'shot';
          else if (/player\.js/.test(st)) why = 'liquid';
          if (why === 'touch' || why === 'shot') {
            const S = api.sense();
            if (S.enemies.some(e => e.boss && Math.hypot(e.x - pl.x, e.y - pl.y) < 300)) why += ':boss';
          }
          if (api.G.Rift.inArena) why = 'arena:' + why;
          dmgLog[why] = (dmgLog[why] || 0) + d;
          lastHits.push(Math.round(api.time * 10) / 10 + ' ' + why + ' ' + Math.round(d));
          // ¿Había salida? (mejor puntuación en el último segundo) y cuántos cerca.
          const S2 = api.sense();
          const n80 = S2.enemies.filter(e => Math.hypot(e.x - pl.x, e.y - pl.y) < 90).length;
          const n160 = S2.enemies.filter(e => Math.hypot(e.x - pl.x, e.y - pl.y) < 160).length;
          const mb = Math.max(...histBest);
          hitStats.push({ why, n80, n160, best: mb, t: Math.round(api.time * 10) / 10 });
          if (lastHits.length > 6) lastHits.shift();
        };
      }
    },
    lastWords: () => lastHits.join(', '),
    get hitStats() { return hitStats; },
    move,
    active: C.active ? api => C.active(api) : active,
    card: (cards, api) => C.card(cards, api),
    item: (a, b, api) => (C.item ? C.item(a, b, api) : fb.item(a, b, api)),
    bond: (opt, api) => (C.bond ? C.bond(opt, api) : fb.bond(opt, api)),
    secondMove: C.secondMove ? (pool, api) => C.secondMove(pool, api) : undefined,
    get dmgLog() { return dmgLog; }
  };
};
