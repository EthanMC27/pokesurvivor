/* ============ sim/bots/pro-b.js — bot unificado para AGUANTAR ============
 *
 * Dos capas:
 *
 * 1. ESTRATÉGICA (cada 0,1 s): un mapa de "margen" en una rejilla de casillas
 *    (32 px, las del terreno) alrededor del jugador, de 1 s a 3 s vista:
 *      Tp(c)  cuándo llego yo (Dijkstra desde mi casilla, con paredes y agua)
 *      Te(c)  cuándo llega el primer enemigo (Dijkstra multifuente: los de a pie
 *             rodean las paredes como en el juego; los voladores y jefes, en línea
 *             recta; las embestidas suman su alcance)
 *      M(c) = Te − Tp   (margen: >0, llego antes que nadie)
 *      W(c)   el mejor "cuello de botella" de margen de un camino hasta c (camino
 *             más ancho): si W es alto, hay una salida por ese lado aunque el cerco
 *             se esté cerrando. Es lo que evita verse rodeado (muerte típica).
 *    Las paredes y rocas son cobertura: detrás de ellas los de a pie tardan más.
 *    También da el camino (rodeando paredes) hacia los objetivos.
 *
 * 2. TÁCTICA (cada fotograma): 24 direcciones + quieto, 1,2 s vista (como
 *    dodger.js): contacto (corredores que apuntan a donde vas, embestidas, saltos,
 *    ataques de jefe), disparos, zonas avisadas, Arceus. A eso se suma el valor
 *    estratégico de donde acabas (M y W de esa casilla), ir hacia la salida más
 *    ancha, los objetivos del mapa (grieta, altares, manantiales, cofres, bayas,
 *    experiencia; de forager.js) y la distancia de combate (spacer.js).
 *
 * Grietas: siempre que se llegue (la arena no acaba la partida y es tiempo que
 * cuenta; ganar da un vínculo, que es lo que escala). En la arena, más agresivo
 * con vida de sobra (arenaHitK, arenaEngage), más prudente con poca (caer = perder).
 * Sentencia (min 30): el mapa de margen cuenta a Arceus (más rápido que tú pasados
 * ~35 s) y a los legendarios; además rodea la arena con Arceus al otro lado.
 *
 * Combate (lo que más pesa además de esquivar):
 *   - de lejos: el más cercano a tiro (wantMax) y con línea de tiro (el juego
 *     apunta al más cercano aunque haya una pared: los disparos se pierden);
 *   - cuerpo a cuerpo / aura / órbita / embestida: premio por tener enemigos a tiro
 *     (wEngage) y media velocidad para retroceder al paso de los que te siguen;
 *   - minas y rastros: que te sigan de cerca (wTrail);
 *   - embestida (Ataque Rápido...): el desplazamiento involuntario se simula para las
 *     zonas avisadas y, con avisos cerca, se usa otro hueco (te metía dentro).
 *
 * Cartas, objetos, vínculos y foco: cards.js (v2) por defecto; si no carga,
 * cards-v1.js. opts.cards = 'v1' | 'v2'. El ciclo de potenciadores (Danza Espada...)
 * es de spacer.js.
 *
 * Opciones (--opts '{...}'): pesos de la tabla P (abajo); cards; debug (registro
 * de golpes en bot.dmgLog / bot.lastWords(), grietas en bot.arenas); probe: [s]
 * (vuelca la rejilla de margen en esos segundos); noRift; noStrat (sólo táctica);
 * switch (pasar a un hueco que apunta con un corredor encima); noDashSwitch.
 *
 * Nota: guarda en cada enemigo cercano _sp (campo propio del bot; el juego no lo lee).
 */
'use strict';

const TAU = Math.PI * 2;
const KEEPERS = new Set(['ranged', 'fan', 'beamer', 'zoner', 'healer', 'summoner']);
const TARGETED = new Set(['melee', 'beam', 'projectile', 'boomerang', 'chain', 'meteor', 'dash', 'cone']);

function reachOf(m) {
  // Copia de reach() de js/systems/combat.js (no se exporta), con las familias sin blanco.
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
    case 'aura': case 'orbit': return (m.radius || 60) + 6;
    case 'turret': return 260;
    case 'nova': return Math.max(120, (m.speed || 200) * (m.life || 1) * 0.8);
    case 'mine': case 'trail': return 90;
  }
  return 160;
}

/** Distancia mínima al origen del segmento (ax,ay)-(bx,by). */
function segMin(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? -(ax * dx + ay * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + dx * t, ay + dy * t);
}

// ---------------- montículo binario (Dijkstra) ----------------
function Heap(n) {
  const k = new Float64Array(n), v = new Int32Array(n);
  let size = 0;
  return {
    clear() { size = 0; }, get size() { return size; },
    push(key, val) {
      let i = size++;
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    },
    pop() {
      const top = v[0], key = k[--size], val = v[size];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= size) break;
        if (c + 1 < size && k[c + 1] < k[c]) c++;
        if (k[c] >= key) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = key; v[i] = val;
      return top;
    },
    topKey() { return k[0]; }
  };
}

function loadCards(opts) {
  const tryLoad = p => { try { const mk = require(p); const c = typeof mk === 'function' ? mk(opts) : mk; return c && typeof c.card === 'function' ? c : null; } catch (e) { return null; } };
  if (opts.cards === 'v1') return tryLoad('./cards-v1');
  return tryLoad('./cards') || tryLoad('./cards-v1');
}

module.exports = (opts = {}) => {
  const P = Object.assign({
    // táctica
    dirs: 24, steps: 8, step: 0.15, wHit: 2, wWall: 0.06, wInertia: 0.012, wWater: 0.03,
    wCrowd: 0.02, crowdScale: 130,
    // estrategia
    R: 16,             // radio de la rejilla en casillas (32 px)
    wM: 0.10,          // valor del margen en la casilla donde acabo
    wW: 0.12,          // valor del camino más ancho hasta ella
    wFlow: 0.10,       // ir hacia la salida más ancha (con peligro)
    mCap: 2.5,         // margen a partir del cual "ya es seguro"
    // objetivos y combate
    wGoal: 0.12, wXp: 0.05, wReach: 0.06, greedHp: 0.35,
    wantMax: 210,      // distancia de combate máxima para los de lejos
    defD: -1, defHold: 1.0,  // cambio defensivo de hueco: holgura de contacto que lo dispara (-1 = sólo corredores)
    wEngage: 0.3, nearMissMelee: 8,
    arenaHp: 0.35, arenaHitK: 0.5, arenaEngage: 2, arenaStrat: 0.4,
    hzPad: 5, calmSkip: 2,
    wTrail: 0.2, trailR: 110,   // minas y rastros: que te sigan de cerca
    wOpen: 0.06,       // casillas con muchas paredes alrededor (bolsas, pasillos)
    wLos: 0.06         // el más cercano tras una pared (los disparos se pierden)
  }, opts);
  const cards = opts.cards === 'fallback' ? null : loadCards(opts);
  const debug = !!opts.debug;

  let G = null;
  const NDIR = P.dirs;
  const DIRS = [];
  for (let i = 0; i < NDIR; i++) { const a = i / NDIR * TAU; DIRS.push([Math.cos(a), Math.sin(a)]); }
  DIRS.push([0, 0]);
  // Con media velocidad (cuerpo a cuerpo: retroceder al paso de los que te siguen).
  const DIRS2 = DIRS.slice(0, NDIR);
  for (let i = 0; i < NDIR; i++) DIRS2.push([DIRS[i][0] * 0.5, DIRS[i][1] * 0.5]);
  DIRS2.push([0, 0]);

  // ---------------- rejilla ----------------
  const CS = 32, R = P.R, N = 2 * R + 1, NN = N * N;
  const Tp = new Float64Array(NN), Te = new Float64Array(NN), Ws = new Float64Array(NN), Ms = new Float64Array(NN);
  const parP = new Int32Array(NN), parW = new Int32Array(NN), freeG = new Uint8Array(NN), slowG = new Float64Array(NN);
  const eSp = new Float64Array(NN), doneW = new Uint8Array(NN), openG = new Float64Array(NN), pre = new Float64Array((N + 1) * (N + 1));
  const heap = Heap(NN * 8);
  let gx0 = 0, gy0 = 0, gridT = -1, gridOk = false;
  let flow = null, flowW = 0, danger = 0, bestW = 0;
  const freeCache = new Map(); let freeCacheT = 0, freeCacheKey = '';
  const cellOf = (x, y) => {
    const ix = Math.floor(x / CS) - gx0, iy = Math.floor(y / CS) - gy0;
    return ix < 0 || iy < 0 || ix >= N || iy >= N ? -1 : iy * N + ix;
  };
  const cxOf = i => (gx0 + (i % N)) * CS + CS / 2, cyOf = i => (gy0 + ((i / N) | 0)) * CS + CS / 2;

  function cellFree(tx, ty, r) {
    const k = tx * 131072 + ty;
    let v = freeCache.get(k);
    if (v === undefined) {
      const x = tx * CS + CS / 2, y = ty * CS + CS / 2;
      v = G.World.isFree(x, y, r, true) ? 1 : 0;
      if (v && liqDmg && G.World.isLiquid(x, y)) v = 0;
      if (v && liqSlow < 1 && G.World.isLiquid(x, y)) v = 2;
      freeCache.set(k, v);
    }
    return v;
  }

  let liqDmg = false, liqSlow = 1, enemyLiqSlow = false;
  let traps = [];

  /** Rejilla de margen. threats: [{x, y, sp, reach, ground}] */
  function buildGrid(api, threats, spd) {
    const pl = api.pl;
    // Caché de casillas libres: se vacía cada 4 s, al cambiar de mundo (arena) o de bioma.
    const key = (G.Rift.inArena ? 'a' : '') + (G.Judgment.active ? 'j' : '') + G.World.biome;
    freeCacheT -= 0.1;
    if (freeCacheT <= 0 || key !== freeCacheKey || freeCache.size > 60000) { freeCache.clear(); freeCacheT = 4; freeCacheKey = key; }

    const ptx = Math.floor(pl.x / CS), pty = Math.floor(pl.y / CS);
    gx0 = ptx - R; gy0 = pty - R;
    const rr = Math.max(6, pl.r * 0.6);
    for (let i = 0; i < NN; i++) {
      const f = cellFree(gx0 + (i % N), gy0 + ((i / N) | 0), rr);
      freeG[i] = f ? 1 : 0; slowG[i] = f === 2 ? liqSlow : 1;
      Tp[i] = Infinity; Te[i] = Infinity; Ws[i] = -Infinity; parP[i] = -1; parW[i] = -1; doneW[i] = 0;
    }
    for (const t of traps) { const c = cellOf(t.x, t.y - 8); if (c >= 0) freeG[c] = 0; }
    const start = R * N + R;
    freeG[start] = 1;

    // Apertura: fracción libre en una ventana de 7×7 casillas (callejones y bolsas = poca).
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      pre[(y + 1) * (N + 1) + x + 1] = freeG[i] + pre[y * (N + 1) + x + 1] + pre[(y + 1) * (N + 1) + x] - pre[y * (N + 1) + x];
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const x0 = Math.max(0, x - 3), x1 = Math.min(N, x + 4), y0 = Math.max(0, y - 3), y1 = Math.min(N, y + 4);
      const s = pre[y1 * (N + 1) + x1] - pre[y0 * (N + 1) + x1] - pre[y1 * (N + 1) + x0] + pre[y0 * (N + 1) + x0];
      openG[y * N + x] = s / ((x1 - x0) * (y1 - y0));
    }

    // --- yo: Dijkstra ---
    heap.clear();
    Tp[start] = 0; heap.push(0, start);
    const cost1 = CS / spd, cost2 = CS * Math.SQRT2 / spd;
    while (heap.size) {
      const tk = heap.topKey(), c = heap.pop();
      if (tk > Tp[c]) continue;
      if (tk > 3.2) break;
      const x = c % N, y = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const n = ny * N + nx;
        if (!freeG[n]) continue;
        if (dx && dy && (!freeG[y * N + nx] || !freeG[ny * N + x])) continue;
        const t = tk + (dx && dy ? cost2 : cost1) / Math.min(slowG[c], slowG[n]);
        if (t < Tp[n]) { Tp[n] = t; parP[n] = c; heap.push(t, n); }
      }
    }

    // --- enemigos: los de a pie con paredes (multifuente), el resto en línea recta ---
    heap.clear();
    const straight = [];
    for (const e of threats) {
      if (!e.ground) { straight.push(e); continue; }
      let c = cellOf(e.x, e.y);
      let t0 = -e.reach / e.sp;
      if (c < 0) {
        // Fuera de la rejilla: entra por el borde, en la recta hacia mí.
        const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy) || 1;
        const k = (R - 0.5) * CS / d;
        const bx = pl.x + dx * k, by = pl.y + dy * k;
        c = cellOf(bx, by);
        if (c < 0) continue;
        t0 = (Math.hypot(e.x - bx, e.y - by) - e.reach) / e.sp;
      }
      if (!freeG[c]) {
        // Dentro de una pared (borde de casilla): la libre más cercana.
        const x = c % N, y = (c / N) | 0;
        let found = -1;
        for (let dy = -1; dy <= 1 && found < 0; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < N && ny < N && freeG[ny * N + nx]) { found = ny * N + nx; break; }
        }
        if (found < 0) { straight.push(e); continue; }
        c = found;
      }
      if (t0 < Te[c]) { Te[c] = t0; eSp[c] = e.sp; heap.push(t0, c); }
    }
    while (heap.size) {
      const tk = heap.topKey(), c = heap.pop();
      if (tk > Te[c]) continue;
      if (tk > 4) break;
      const sp = eSp[c];
      const x = c % N, y = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const n = ny * N + nx;
        if (!freeG[n]) continue;
        if (dx && dy && (!freeG[y * N + nx] || !freeG[ny * N + x])) continue;
        const t = tk + (dx && dy ? CS * Math.SQRT2 : CS) / sp / (enemyLiqSlow && slowG[n] < 1 ? 0.55 : 1);
        if (t < Te[n]) { Te[n] = t; eSp[n] = sp; heap.push(t, n); }
      }
    }
    for (const e of straight) {
      // Sólo las casillas a las que puedo llegar.
      for (let i = 0; i < NN; i++) {
        if (Tp[i] > 3.2) continue;
        const d = Math.hypot(cxOf(i) - e.x, cyOf(i) - e.y);
        const t = (d - e.reach) / e.sp;
        if (t < Te[i]) Te[i] = t;
      }
    }

    // --- margen y camino más ancho ---
    for (let i = 0; i < NN; i++) Ms[i] = Tp[i] <= 3.2 ? Math.min(P.mCap + 1, Math.max(-2, Te[i]) - Tp[i]) : -Infinity;
    heap.clear();
    Ws[start] = P.mCap + 1;
    heap.push(-(P.mCap + 1) * 1000, start);
    while (heap.size) {
      const c = heap.pop();
      if (doneW[c]) continue;
      doneW[c] = 1;
      const w = Ws[c];
      const x = c % N, y = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const n = ny * N + nx;
        if (doneW[n] || Tp[n] > 3.2) continue;
        if (dx && dy && (!freeG[y * N + nx] || !freeG[ny * N + x])) continue;
        const nw = Math.min(w, Math.min(P.mCap, Ms[n]));
        if (nw > Ws[n] || (nw === Ws[n] && parW[n] >= 0 && Tp[c] < Tp[parW[n]])) {
          Ws[n] = nw; parW[n] = c;
          // A igual anchura, el más cercano primero.
          heap.push(-nw * 1000 + Tp[n], n);
        }
      }
    }
    Ws[start] = Math.min(P.mCap, Ms[start]);

    // --- salida: la casilla a 0,6-2,6 s con mejor anchura y margen ---
    let best = -1, bs = -Infinity;
    for (let i = 0; i < NN; i++) {
      const t = Tp[i];
      if (t < 0.6 || t > 2.6 || Ws[i] === -Infinity) continue;
      const s = Ws[i] + 0.4 * Math.min(P.mCap, Ms[i]) + 0.15 * Math.min(1, t);
      if (s > bs) { bs = s; best = i; }
    }
    flow = null; bestW = best >= 0 ? Ws[best] : -1;
    if (best >= 0) {
      // Bajar por el camino hasta la casilla a ~2 de mí.
      let c = best, prev = best, guard = 0;
      while (parW[c] >= 0 && parW[c] !== start && guard++ < 200) { prev = c; c = parW[c]; if (Tp[c] < 0.35) break; }
      const tx = cxOf(c), ty = cyOf(c);
      const dx = tx - pl.x, dy = ty - pl.y, d = Math.hypot(dx, dy);
      if (d > 4) flow = [dx / d, dy / d];
      else { const d2 = Math.hypot(cxOf(prev) - pl.x, cyOf(prev) - pl.y) || 1; flow = [(cxOf(prev) - pl.x) / d2, (cyOf(prev) - pl.y) / d2]; }
    }
    gridOk = true;
  }

  /** Dirección (rodeando paredes) hacia un punto de la rejilla; null si no hay camino. */
  function pathDir(pl, x, y) {
    let c = cellOf(x, y);
    if (c < 0 || Tp[c] === Infinity) return null;
    const start = R * N + R;
    let guard = 0;
    while (parP[c] >= 0 && parP[c] !== start && guard++ < 200) {
      const p = parP[c];
      // Si ya se ve en línea recta desde aquí (pocos pasos), basta.
      if (Tp[p] < 0.3) break;
      c = p;
    }
    const dx = cxOf(c) - pl.x, dy = cyOf(c) - pl.y, d = Math.hypot(dx, dy);
    if (d < 6) { const d2 = Math.hypot(x - pl.x, y - pl.y) || 1; return [(x - pl.x) / d2, (y - pl.y) / d2]; }
    return [dx / d, dy / d];
  }

  /** Margen de un punto (para valorar objetivos): Infinity fuera de la rejilla. */
  function safetyAt(x, y) {
    const c = cellOf(x, y);
    if (c < 0 || !gridOk) return { w: 0.8, m: 0.8, tp: Infinity };
    return { w: Ws[c], m: Ms[c], tp: Tp[c] };
  }

  // ---------------- objetivos del mapa ----------------
  const known = new Map();
  let goal = null, goalT = 0;

  function pickGoal(api, S) {
    const { pl } = api;
    const hpF = pl.hp / pl.maxHp;
    const spd = Math.max(40, pl.spd);
    if (S.judge || S.inArena) return null;
    const greed = Math.max(0.15, Math.min(1, (hpF - 0.15) / 0.6)) * (1 - 0.6 * danger);
    const cand = [];
    const add = (kind, x, y, value, ref, safe = true) => {
      const s = safetyAt(x, y);
      const d = Math.hypot(x - pl.x, y - pl.y);
      if (s.tp === Infinity && d < R * CS * 0.8) return;          // sin camino
      let k = 1;
      if (safe) k = s.tp === Infinity ? 0.6 : Math.max(0.05, Math.min(1, (s.w + 0.3) / 1.2));
      const tt = s.tp === Infinity ? d / spd * 1.2 : s.tp;
      cand.push({ kind, x, y, ref, d, u: value * k / (1 + tt / 2.5) });
    };

    // Grieta: siempre que se llegue a tiempo (es también una salida).
    if (S.rift && !opts.noRift) {
      const d = Math.hypot(S.rift.x - pl.x, S.rift.y - 10 - pl.y);
      if (d / spd < S.rift.ttl - 0.5) cand.push({ kind: 'rift', x: S.rift.x, y: S.rift.y - 10, d, u: 1000 });
    }
    for (const p of G.World.specialsNear(pl.x, pl.y, 700)) if (p.type === 'spring') known.set(p.id, p);
    const specials = new Set(G.World.specialsNear(pl.x, pl.y, 700));
    for (const p of known.values()) if (Math.hypot(p.x - pl.x, p.y - pl.y) < 1400) specials.add(p);
    for (const p of specials) {
      if (p.type === 'altar' && !p.used) add('altar', p.x, p.y + p.r + pl.r + 2, 70 * (0.5 + greed));
      else if (p.type === 'spring' && p.charge > 0.15 && hpF < 0.75) add('spring', p.x, p.y - 8, 200 * (1 - hpF), null, hpF > 0.3);
      else if (p.type === 'bigchest' && greed > 0.4) {
        let calm = true;
        for (const e of S.enemies) {
          if (e.behavior === 'thief') continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 120 + (e._sp || e.spd) * 3) { calm = false; break; }
        }
        if (calm || p.open > 2.6) add('bigchest', p.x, p.y + p.r + pl.r + 8, 50 * greed, p);
      }
    }
    let bestXp = null;
    const pk = S.pickups;
    const xpNext = pl.xpNext || 100;
    for (const o of pk) {
      if (o.pulled) continue;
      const d = Math.hypot(o.x - pl.x, o.y - pl.y);
      if (d > 520) continue;
      switch (o.kind) {
        case 'heal': if (hpF < 0.85) add('heal', o.x, o.y, 170 * (1 - hpF) + 10, null, hpF > 0.3); break;
        case 'magnet': add('magnet', o.x, o.y, 60); break;
        case 'bomb': add('bomb', o.x, o.y, 25 + 30 * danger); break;
        case 'item': add('item', o.x, o.y, pl.item ? 15 : 50); break;
        case 'ticket': case 'ticket10': case 'coin': add('coin', o.x, o.y, 1); break;
        case 'xp': case 'xpBig': {
          if (d < pl.magnet) break;
          let v = 0;
          for (const q of pk) if ((q.kind === 'xp' || q.kind === 'xpBig') && !q.pulled && Math.abs(q.x - o.x) < 70 && Math.abs(q.y - o.y) < 70) v += q.value || 1;
          const val = Math.min(45, 4 + 120 * v / xpNext) * greed;
          const s = safetyAt(o.x, o.y);
          const k = s.tp === Infinity ? 0.5 : Math.max(0.05, Math.min(1, (s.w + 0.3) / 1.2));
          const tt = s.tp === Infinity ? d / spd : s.tp;
          const u = val * k / (1 + tt / 2.5);
          if (!bestXp || u > bestXp.u) bestXp = { kind: 'xp', x: o.x, y: o.y, d, u };
        }
      }
    }
    if (bestXp) cand.push(bestXp);
    for (const e of S.enemies) if (e.behavior === 'thief' && Math.hypot(e.x - pl.x, e.y - pl.y) < 450) add('thief', e.x, e.y, 10 * greed);
    const L = S.lost;
    if (L) { if (L.state === 'wait') add('lost', L.x, L.y, 30 * greed); else add('escort', L.tx, L.ty, 45 * greed); }
    let best = null;
    for (const c of cand) if (!best || c.u > best.u) best = c;
    return best && best.u > 2 ? best : null;
  }

  // ---------------- movimiento ----------------
  let prev = [0, 0], skipN = 0;
  const aimDir = new WeakMap();
  let lastS = null;
  const arenas = []; let curArena = null;
  let orbitSide = 1;

  let hitK = 1;
  function frac(pl, d) {
    const f = d / Math.max(1, pl.hp);
    return P.wHit * hitK * (f >= 0.98 ? 6 + f : f);
  }

  function freeAt(x, y, r) {
    // Caché por casillas de 8 px (isFree es caro).
    const k = Math.round(x / 8) * 1048576 + Math.round(y / 8);
    let v = freeSmall.get(k);
    if (v === undefined) {
      v = G.World.isFree(Math.round(x / 8) * 8, Math.round(y / 8) * 8, r, true) ? 1 : 0;
      if (v && liqDmg && G.World.isLiquid(x, y)) v = 0;
      freeSmall.set(k, v);
    }
    if (!v) return false;
    for (const t of traps) if ((x - t.x) ** 2 + (y - t.y + 8) ** 2 < 26 * 26) return false;
    return true;
  }
  const freeSmall = new Map(); let freeSmallT = 0, freeSmallKey = '';
  const losCache = new Map();
  /** ¿Pasa un disparo de (ax,ay) a (bx,by)? (paredes y sólidos que no se rompen) */
  function los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      const k = Math.round(x / 8) * 1048576 + Math.round(y / 8);
      let v = losCache.get(k);
      if (v === undefined) {
        const b = G.World.projectileBlock(Math.round(x / 8) * 8, Math.round(y / 8) * 8, 4);
        v = b === 'wall' || (b && !b.destructible) ? 1 : 0;
        losCache.set(k, v);
      }
      if (v) return false;
    }
    return true;
  }

  function move(api) {
    G = api.G;
    const pl = api.pl, S = api.sense();
    lastS = S;
    // Registro de grietas (para medir): legendario, duración, resultado.
    if (S.inArena && !curArena) {
      const L = S.enemies.find(e => e.legend);
      curArena = { t: Math.round(api.time), dex: L ? L.dex : 0, hp: L ? L.maxHp : 0, hp0: +(pl.hp / pl.maxHp).toFixed(2), lv: pl.level };
    } else if (S.inArena && curArena && !curArena.end) {
      const L = S.enemies.find(e => e.legend);
      if (L) curArena.left = +(L.hp / L.maxHp).toFixed(2);
      if (S.arena && S.arena.phase !== 'fight') { curArena.end = +(api.time - curArena.t).toFixed(1); curArena.won = S.arena.phase === 'won'; curArena.hp1 = +(pl.hp / pl.maxHp).toFixed(2); curArena.dead = pl.dead; }
    } else if (!S.inArena && curArena) { arenas.push(curArena); curArena = null; }
    const le = G.World.liquidEffect(pl.mon.types);
    liqDmg = !!le.dmg; liqSlow = le.slow || 1;
    const leAny = G.World.liquidEffect(null);
    enemyLiqSlow = !leAny.dmg && !!leAny.slow;
    const spd = Math.max(30, pl.spd / (pl.inLiquid ? (le.slow || 1) : 1));
    const H = P.steps * P.step;
    const prX = Math.max(6, pl.r * 0.7);
    const key = (S.inArena ? 'a' : '') + (S.judge ? 'j' : '') + G.World.biome;
    freeSmallT -= api.dt || 1 / 30;
    if (freeSmallT <= 0 || key !== freeSmallKey || freeSmall.size > 150000) { freeSmall.clear(); losCache.clear(); freeSmallT = 3; freeSmallKey = key; }
    traps = G.World.specialsNear(pl.x, pl.y, 600).filter(p => p.type === 'trap' && !p.broken);

    // --- amenazas ---
    const near = [], gthreats = [];
    let nearest = Infinity, cx = 0, cy = 0, cw = 0;
    for (const e of S.enemies) {
      if (e.behavior === 'thief') continue;
      const d = Math.hypot(e.x - pl.x, e.y - pl.y);
      let sp = e.spd * (1 - (e.slow || 0)) * G.Weather.speedFor(e.types);
      if (e.boss && e.ai) sp *= (e.ai.fury ? 1.25 : 1) * 1.1;
      e._sp = sp;
      if (d < spd * H + 300) near.push(e);
      if (d - e.r < nearest) nearest = d - e.r;
      if (d < 420) { const w = e.boss ? 4 : 1; cx += e.x * w; cy += e.y * w; cw += w; }
      if (d > 950) continue;
      // Los que pelean de lejos se apartan, pero pegados también tocan.
      const keep = !e.boss && KEEPERS.has(e.behavior);
      if (keep) sp *= 0.35;
      let reach = e.r + pl.r + 4;
      if (e.behavior === 'charger') reach += e.phase === 'dash' ? sp * 3.4 * Math.max(0, e.pt) : sp * 3.4 * 0.42 * 0.8;
      if (e.boss) reach += 40;
      gthreats.push({ x: e.x, y: e.y, sp: Math.max(25, sp), reach, ground: !e.flying && !e.boss && !e.jump });
    }
    let arceus = null;
    if (S.judge) {
      const ns = G.Judgment.netState && G.Judgment.netState();
      if (ns) {
        const sm = G.Judgment.summary && G.Judgment.summary();
        const k = Math.min(1.22, 0.74 + (sm ? sm.time : 0) * 0.013);
        const r = S.arceus ? S.arceus.r : 40;
        arceus = { x: ns[0], y: ns[1], r, spd: Math.max(70, pl.spd * k), dmg: pl.maxHp * 0.4 };
        gthreats.push({ x: arceus.x, y: arceus.y, sp: arceus.spd, reach: r + pl.r + 30, ground: false });
      }
    }
    const shots = S.shots.filter(p => Math.abs(p.x - pl.x) < 520 && Math.abs(p.y - pl.y) < 520);
    const hazards = S.hazards.filter(h => !h.hit);

    // --- estrategia (cada 0,1 s) ---
    if (!opts.noStrat && (api.time - gridT >= 0.099 || gridT < 0 || api.time < gridT)) { gridT = api.time; buildGrid(api, gthreats, spd); }
    // Peligro: lo poco que queda de margen alrededor.
    danger = gridOk ? Math.max(0, Math.min(1, 1 - bestW / P.mCap)) : 0.5;
    if (opts.probe && opts.probe.some(t => api.time >= t && api.time - (api.dt || 1 / 30) < t)) dumpGrid(api, S);

    // --- objetivo ---
    goalT -= 1;
    if (goalT <= 0 || (goal && goal.kind !== 'rift' && danger > 0.8)) { goal = pickGoal(api, S); goalT = 8; }
    let goalHold = false;
    if (goal && goal.kind === 'bigchest' && goal.ref) {
      const p = goal.ref;
      if (Math.hypot(p.x - pl.x, p.y - pl.y) < Math.max(46, p.r + pl.r + 24) - 4 && p.open > 0) goalHold = true;
    }
    if (goal && goal.kind === 'spring' && Math.hypot(goal.x - pl.x, goal.y - pl.y) < 18) goalHold = true;
    let goalDir = null;
    if (goal && !goalHold) goalDir = (gridOk && pathDir(pl, goal.x, goal.y)) || (() => { const d = Math.hypot(goal.x - pl.x, goal.y - pl.y) || 1; return [(goal.x - pl.x) / d, (goal.y - pl.y) / d]; })();

    // Arena de la Sentencia: rodear con Arceus al otro lado.
    let ring = null;
    if (S.inArena && S.arena) ring = { x: S.arena.x, y: S.arena.y, r: (S.arena.r - 1.4) * 32 };
    else if (S.judge && G.World.arena) { const a = G.World.arena; ring = { x: a.tx * 32 + 16, y: a.ty * 32 + 16, r: (a.r - 1.4) * 32 }; }
    let judgeDir = null;
    if (S.judge && arceus && ring) {
      const a = Math.atan2(pl.y - ring.y, pl.x - ring.x), aa = Math.atan2(arceus.y - ring.y, arceus.x - ring.x);
      let diff = a - aa; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
      const ta = a + (diff >= 0 ? 1 : -1) * 0.45;
      const Rr = ring.r * 0.6;
      const tx = ring.x + Math.cos(ta) * Rr - pl.x, ty = ring.y + Math.sin(ta) * Rr - pl.y, d = Math.hypot(tx, ty) || 1;
      judgeDir = [tx / d, ty / d];
    }

    // --- combate: distancia según el ataque activo ---
    const grp = pl.activeGroup();
    let reach = 0, targeted = false, melee = false;
    for (const m of grp) {
      if (m.kind === 'buff') continue;
      reach = Math.max(reach, reachOf(m));
      if (TARGETED.has(m.kind)) targeted = true;
      if (m.kind === 'melee' || m.kind === 'aura' || m.kind === 'orbit' || m.kind === 'dash') melee = true;
    }
    const hpK = pl.hp / pl.maxHp;
    const losNeed = grp.some(m => m.kind === 'projectile' || m.kind === 'beam' || m.kind === 'cone' || m.kind === 'boomerang' || m.kind === 'dash');
    const nearEnt = near.length > 0;
    const xps = S.pickups.filter(p => (p.kind === 'xp' || p.kind === 'xpBig') && !p.pulled && Math.abs(p.x - pl.x) < 400 && Math.abs(p.y - pl.y) < 400);

    // En la arena caer no acaba la partida (vuelves con el 30 %): más agresivo con vida.
    const inArena = S.inArena;
    // (con mucha vida se aceptan golpes; con poca, más cuidado que fuera: caer = perder la grieta)
    hitK = !inArena ? 1 : hpK > P.arenaHp + 0.2 ? P.arenaHitK : hpK > P.arenaHp ? (1 + P.arenaHitK) / 2 : 1.4;
    const engK = inArena ? P.arenaEngage : 1, stratK = inArena ? P.arenaStrat : 1;
    // Datos de cada enemigo cercano (una vez por fotograma).
    const red = pl.reduction, closeK = grp.some(m => m.kind === 'melee') ? 0.75 : 1;
    // (sólo los que pueden llegar a tocar algún recorrido en el horizonte)
    const einfo = near.filter(e => {
      if (e.boss) return true;
      const d = Math.hypot(e.x - pl.x, e.y - pl.y) - e.r - pl.r - 26;
      const sp = e._sp * (e.behavior === 'charger' ? 1 + 3.4 * 0.42 / H : 1) + (e.phase === 'dash' ? e._sp * 3.4 : 0);
      return d < (spd + sp) * H + (e.jump ? 200 : 0);
    }).map(e => {
      const ai = e.boss ? e.ai : null, cast = ai && ai.cast;
      const aiming = e.phase === 'aim';
      if (!aiming) aimDir.delete(e);
      return {
        e, espd: e._sp * (!e.flying && enemyLiqSlow && G.World.isLiquid(e.x, e.y) ? 0.55 : 1),
        runner: e.behavior === 'runner', cast, bossFar: ai && !cast && ai.mode === 'far',
        keep: !e.boss && KEEPERS.has(e.behavior), keepD: (e.def.range || 200) * 0.82,
        dashing: e.phase === 'dash', aiming, jumping: !!e.jump, fuse: e.behavior === 'bomber' && e.phase === 'fuse',
        rr: e.r + pl.r + 4,
        hitC: frac(pl, e.dmg * (1 - red) * closeK * G.Types.mult(e.atkType, pl.mon.types))
      };
    });
    const shotInfo = shots.map(p => ({ p, rr: p.r + pl.r + 4, left: p.life - (p.t || 0),
      hitC: frac(pl, p.dmg * (1 - red) * (p.mtype ? G.Types.mult(p.mtype, pl.mon.types) : 1)) }));
    const hzInfo = hazards.map(h => ({ h, left: h.delay - h.t,
      hitC: frac(pl, h.pct ? Math.max(h.dmg, pl.maxHp * h.pct) : h.dmg * (h.pure ? 1 : 1 - red) * (h.type ? G.Types.mult(h.type, pl.mon.types) : 1)) }));
    const liqHere = liqSlow < 1;

    // Minas y rastros: que te sigan de cerca (pisan lo que dejas).
    const trailish = !melee && !targeted && grp.some(m => m.kind === 'mine' || m.kind === 'trail');
    const engW = melee ? P.wEngage : trailish ? P.wTrail : 0;
    const dashes = opts.noDashModel ? null : grp.filter(m => m.kind === 'dash').map(m => ({ t0: Math.max(0, m.t), cd: Math.max(0.05, m.cd * pl.cdMul), len: m.radius, reach: reachOf(m), next: 0 }));
    // Con calma (nadie cerca, nada avisado ni disparado) se decide cada 3 fotogramas.
    const calm = !hazards.length && !shots.length && !arceus && !inArena && danger < 0.3 && nearest > 150 && !goalHold;
    if (calm && skipN > 0 && prev) { skipN--; return prev; }
    skipN = calm ? (P.calmSkip | 0) : 0;
    let best = null, bestC = Infinity;
    const pathH = new Float64Array(P.steps * 2);
    const npath = new Float64Array(P.steps * 2), nvel = new Float64Array(P.steps * 2);
    const DL = melee && !opts.noHalf ? DIRS2 : DIRS;
    const nearMiss = melee ? P.nearMissMelee : 22;
    for (let di = 0; di < DL.length; di++) {
      const dir = DL[di];
      let c = 0;
      const path = npath, vel = nvel;
      let svx = pl._vx || 0, svy = pl._vy || 0;
      let x = pl.x, y = pl.y, blocked = false;
      if (dashes) for (const D of dashes) D.next = D.t0;
      let ox = 0, oy = 0;   // desplazamiento por las embestidas (sólo para las zonas avisadas)
      for (let k = 0; k < P.steps; k++) {
        if (!blocked && (dir[0] || dir[1])) {
          const sk = liqHere && G.World.isLiquid(x, y) ? liqSlow : 1;
          if (sk < 1) c += P.wWater;
          const nx = x + dir[0] * spd * sk * P.step, ny = y + dir[1] * spd * sk * P.step;
          if (freeAt(nx, ny, prX)) { x = nx; y = ny; }
          else if (freeAt(nx, y, prX)) x = nx; else if (freeAt(x, ny, prX)) y = ny; else blocked = true;
        }
        // Embestida del hueco activo (Ataque Rápido...): te lleva hasta su largo hacia el blanco.
        if (dashes) for (const D of dashes) {
          if ((k + 1) * P.step < D.next) continue;
          let tg = null, td = Infinity, boss = null;
          for (const q of einfo) {
            const e = q.e, d = Math.hypot(e.x - x - ox, e.y - y - oy);
            if (d < pl.r + 24 + e.r && d < td) { tg = e; td = d; }
            if (e.boss && d < 330) boss = e;
          }
          if (!tg) tg = boss;
          if (!tg) for (const q of einfo) { const d = Math.hypot(q.e.x - x - ox, q.e.y - y - oy); if (d < td) { td = d; tg = q.e; } }
          if (!tg) continue;
          const d0 = Math.hypot(tg.x - x - ox, tg.y - y - oy) || 1;
          if (d0 > D.reach) continue;
          const ca = (tg.x - x - ox) / d0, sa = (tg.y - y - oy) / d0;
          let len = 0;
          for (let dd = 8; dd <= D.len; dd += 8) { if (!freeAt(x + ox + ca * dd, y + oy + sa * dd, pl.r * 0.8)) break; len = dd; }
          ox += ca * len; oy += sa * len;
          D.next = (k + 1) * P.step + D.cd;
        }
        path[2 * k] = x; path[2 * k + 1] = y;
        pathH[2 * k] = x + ox; pathH[2 * k + 1] = y + oy;
        const vk = 1 - Math.exp(-5 * P.step);
        svx += (dir[0] * spd - svx) * vk; svy += (dir[1] * spd - svy) * vk;
        vel[2 * k] = svx; vel[2 * k + 1] = svy;
      }
      if (blocked && (dir[0] || dir[1])) c += 0.02;

      // Contacto con enemigos.
      for (const q of einfo) {
        const e = q.e;
        let ex = e.x, ey = e.y;
        const { espd, runner, cast, bossFar, keep, dashing, aiming, jumping, fuse, rr, hitC, keepD } = q;
        let hit = -1, minD = Infinity;
        let opx = pl.x, opy = pl.y;
        for (let k = 0; k < P.steps; k++) {
          const t = (k + 1) * P.step;
          const px = path[2 * k], py = path[2 * k + 1];
          const oex = ex, oey = ey;
          if (jumping || fuse) { /* cae / estalla donde avisa el suelo (zonas) */ }
          else if (cast) {
            if (cast.id === 'dash' && t + cast.t > cast.wind && t + cast.t < cast.wind + cast.dur + P.step) {
              const sp = cast.len / cast.dur;
              ex += Math.cos(cast.ang) * sp * P.step; ey += Math.sin(cast.ang) * sp * P.step;
            }
          } else if (bossFar && Math.hypot(px - ex, py - ey) < 300) { /* se aparta o te rodea */ }
          else if (dashing) { ex += e.dx * espd * 3.4 * P.step; ey += e.dy * espd * 3.4 * P.step; }
          else if (aiming) {
            if (t > e.pt) {
              let b = aimDir.get(e); if (!b) { const n = Math.hypot(pl.x - e.x, pl.y - e.y) || 1; b = [(pl.x - e.x) / n, (pl.y - e.y) / n]; aimDir.set(e, b); }
              if (t - e.pt < 0.42 + P.step) { ex += b[0] * espd * 3.4 * P.step; ey += b[1] * espd * 3.4 * P.step; }
            }
          } else if (!keep || Math.hypot(px - ex, py - ey) > keepD) {
            let tx = px, ty = py;
            if (runner) {
              const lead = Math.min(1.4, Math.hypot(px - ex, py - ey) / Math.max(60, espd));
              tx += vel[2 * k] * lead; ty += vel[2 * k + 1] * lead;
            }
            const dx = tx - ex, dy = ty - ey, d = Math.hypot(dx, dy) || 1;
            const st = Math.min(d, espd * P.step);
            ex += dx / d * st; ey += dy / d * st;
          }
          const d = segMin(opx - oex, opy - oey, px - ex, py - ey) - rr;
          opx = px; opy = py;
          if (d < minD) minD = d;
          if (d < 0 && hit < 0 && !jumping && !fuse && t > Math.max(e.touchCd || 0, pl.invuln || 0)) hit = k;
        }
        if (hit >= 0) c += hitC * (1 - hit * 0.05);
        else if (minD < nearMiss) c += hitC * 0.25 * (1 - minD / nearMiss);
      }

      // Arceus.
      if (arceus) {
        let axx = arceus.x, ayy = arceus.y;
        for (let k = 0; k < P.steps; k++) {
          const px = path[2 * k], py = path[2 * k + 1];
          const dx = px - axx, dy = py - ayy, d = Math.hypot(dx, dy) || 1;
          const st = Math.min(d, arceus.spd * P.step);
          axx += dx / d * st; ayy += dy / d * st;
          if (Math.hypot(px - axx, py - ayy) < arceus.r + pl.r + 12) { c += frac(pl, arceus.dmg) * (1 - k * 0.04); break; }
        }
        const ex = path[2 * P.steps - 2], ey = path[2 * P.steps - 1];
        c += 0.15 * Math.exp(-Math.hypot(ex - arceus.x, ey - arceus.y) / 160);
      }

      // Disparos enemigos.
      for (const q of shotInfo) {
        const { p, left, rr, hitC } = q;
        let opx = pl.x, opy = pl.y, osx = p.x, osy = p.y;
        for (let k = 0; k < P.steps; k++) {
          const t = (k + 1) * P.step;
          if (t - P.step > left) break;
          const sx = p.x + p.vx * t, sy = p.y + p.vy * t;
          const px = path[2 * k], py = path[2 * k + 1];
          const md = segMin(opx - osx, opy - osy, px - sx, py - sy);
          opx = px; opy = py; osx = sx; osy = sy;
          if (md < rr && t > (pl.invuln || 0)) { c += hitC * (1 - k * 0.04); break; }
        }
      }

      // Zonas avisadas.
      // (posición interpolada en el instante en que estalla: un aviso a punto de estallar
      //  se mira donde estarás de verdad, no 0,15 s después)
      const P2 = dashes && dashes.length ? pathH : path;
      for (const q of hzInfo) {
        let w = 1, hx, hy;
        const u = Math.max(0, q.left) / P.step;          // en pasos
        if (u >= P.steps) { hx = P2[2 * P.steps - 2]; hy = P2[2 * P.steps - 1]; w = 0.7; }
        else {
          const k = Math.floor(u), f = u - k;
          const ax = k === 0 ? pl.x : P2[2 * k - 2], ay = k === 0 ? pl.y : P2[2 * k - 1];
          hx = ax + (P2[2 * k] - ax) * f; hy = ay + (P2[2 * k + 1] - ay) * f;
        }
        if (G.Hazards.inside(q.h, hx, hy, pl.r + P.hzPad)) c += q.hitC * w;
      }

      // ---- estrategia ----
      const fx = path[2 * P.steps - 2], fy = path[2 * P.steps - 1];
      if (gridOk && !opts.noStrat) {
        const ci = cellOf(fx, fy);
        if (ci >= 0 && Tp[ci] <= 3.2) {
          c -= stratK * P.wM * Math.max(-1.5, Math.min(P.mCap, Ms[ci])) / P.mCap;
          c -= stratK * P.wW * Math.max(-1.5, Math.min(P.mCap, Ws[ci])) / P.mCap;
          c += P.wOpen * (1 - openG[ci]);
        }
        if (flow && (dir[0] || dir[1])) c -= stratK * P.wFlow * danger * (dir[0] * flow[0] + dir[1] * flow[1]);
      }
      // Agobio (posición final).
      let crowd = 0, nearE = Infinity;
      for (const e of near) {
        const d = Math.hypot(e.x - fx, e.y - fy);
        crowd += (e.boss ? 3 : 1) * Math.exp(-d / P.crowdScale);
        if (d - e.r < nearE) nearE = d - e.r;
      }
      c += P.wCrowd * Math.min(crowd, 12) * (0.6 + 0.4 * (1 - hpK));
      // Paredes delante (no meterse en callejones).
      if (dir[0] || dir[1]) {
        for (let k = 1; k <= 4; k++) {
          const dd = H * spd + k * 60;
          if (!freeAt(pl.x + dir[0] * dd, pl.y + dir[1] * dd, prX)) { c += P.wWall * (1 - (k - 1) / 4); break; }
        }
      }
      // Combate: tener un blanco a tiro (cuerpo a cuerpo: arrimarse si hay vida).
      if (reach > 0 && nearE < Infinity && !S.judge) {
        const want = melee ? Math.max(8, reach * 0.55 - 10) : Math.min(reach * 0.75, P.wantMax);
        if (nearE > want) c += P.wReach * Math.min(1, (nearE - want) / 200) * (melee ? 2 * Math.max(0.2, hpK - 0.25) : hpK) * (targeted ? 1.5 : 1);
      }
      // Cuerpo a cuerpo: premio por tener enemigos a tiro en mitad y al final del recorrido.
      if (engW && !S.judge) {
        const mx = path[P.steps - 2], my = path[P.steps - 1];
        let n1 = 0, n2 = 0;
        const rq = melee ? reach - 6 : P.trailR;
        for (const e of near) {
          if (e.boss && !e.legend) continue;
          const d1 = Math.hypot(e.x - fx, e.y - fy), d2 = Math.hypot(e.x - mx, e.y - my);
          if (d1 < rq) n1++;
          if (d2 < rq) n2++;
        }
        c -= engK * engW * (Math.min(3, n1) + Math.min(3, n2)) / 6 * Math.max(0, (hpK - 0.2) / 0.8);
      }
      // Línea de tiro: el juego apunta al más cercano aunque haya una pared en medio.
      if (losNeed && nearEnt && (dir[0] || dir[1] || di === DL.length - 1)) {
        let ne = null, nd = Infinity;
        for (const e of near) { const d = (e.x - fx) ** 2 + (e.y - fy) ** 2; if (d < nd) { nd = d; ne = e; } }
        if (ne && nd < 520 * 520 && !los(fx, fy, ne.x, ne.y)) c += P.wLos * (0.4 + 0.6 * hpK);
      }
      // Experiencia cercana.
      if (xps.length && (dir[0] || dir[1])) {
        let g = 0;
        for (const p of xps) {
          const d0 = Math.hypot(p.x - pl.x, p.y - pl.y);
          if (d0 < pl.magnet) continue;
          let m = Infinity;
          for (let k = 0; k < P.steps; k++) { const d = (path[2 * k] - p.x) ** 2 + (path[2 * k + 1] - p.y) ** 2; if (d < m) m = d; }
          const d1 = Math.max(pl.magnet * 0.8, Math.sqrt(m));
          g += Math.min(3, Math.sqrt(p.value / 10)) * Math.max(-1, Math.min(1, (d0 - d1) / (spd * H))) / (1 + d0 / 150);
        }
        c -= P.wXp * Math.min(4, g) * (0.4 + 0.6 * hpK) * (1 - 0.7 * danger);
      }
      // Objetivo.
      if (goal) {
        const gw = goal.kind === 'rift' ? 3 : 1;
        if (goalHold) { if (!dir[0] && !dir[1]) c -= P.wGoal * 1.5; else c += P.wGoal * 0.3; }
        else if (goalDir && (dir[0] || dir[1])) c -= P.wGoal * gw * (dir[0] * goalDir[0] + dir[1] * goalDir[1]);
      }
      if (judgeDir && (dir[0] || dir[1])) c -= 0.08 * (dir[0] * judgeDir[0] + dir[1] * judgeDir[1]);
      // Arena: no pegarse al borde.
      if (ring) {
        const d = Math.hypot(fx - ring.x, fy - ring.y);
        if (d > ring.r * 0.75) { const q = (d - ring.r * 0.75) / (ring.r * 0.25); c += 0.15 * q * q; }
      }
      // Inercia.
      c -= P.wInertia * (dir[0] * prev[0] + dir[1] * prev[1]);
      if (!dir[0] && !dir[1]) c += 0.004;

      if (c < bestC) { bestC = c; best = dir; }
    }
    prev = best;
    return best;
  }

  // ---------------- hueco activo (de spacer.js: el foco de cards + ciclo de potenciadores) ----------------
  let buffMode = null, buffT = 0, activeT = 0, focusSlot = 0, defT = 0, dashT = 0;
  function pressure(pl) {
    let d = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 90)) {
      const gap = Math.hypot(e.x - pl.x, e.y - pl.y) - e.r - pl.r;
      if (gap < 40) d += e.boss ? 2 : 1;
    }
    return d;
  }
  function active(api) {
    G = api.G;
    const pl = api.pl;
    if (!pl.slots.length || (pl.hasItem && pl.hasItem('choiceband'))) return null;
    activeT -= 1;
    if (activeT <= 0) {
      activeT = 15;
      let i = cards && cards.active ? cards.active(api) : null;
      if (i == null || !pl.slots[i] || !pl.slots[i].some(m => m.kind !== 'buff')) {
        // El hueco con más niveles.
        let bv = -1; i = 0;
        pl.slots.forEach((g, k) => { const v = g.reduce((a, m) => a + (m.kind === 'buff' ? 0 : m.lvl + (m.evolved ? 3 : 0)), 0); if (v > bv) { bv = v; i = k; } });
      }
      focusSlot = i;
    }
    // Embestida (Ataque Rápido...) con avisos en el suelo cerca: te puede meter dentro.
    // Mientras duren, el mejor hueco sin embestida.
    if (!opts.noDashSwitch) {
      const fg = pl.slots[focusSlot] || [];
      if (fg.some(m => m.kind === 'dash')) {
        const hz = G.Hazards.all.some(h => !h.hit && (h.kind === 'zone' ? Math.hypot(h.x - pl.x, h.y - pl.y) < h.r + 200
          : segMin(h.x - pl.x, h.y - pl.y, h.x + Math.cos(h.angle) * h.len - pl.x, h.y + Math.sin(h.angle) * h.len - pl.y) < h.w / 2 + 200));
        if (hz) dashT = 0.4; else dashT -= api.dt || 1 / 30;
        if (dashT > 0) {
          let bi = -1, bv = 0;
          pl.slots.forEach((g, k) => {
            if (g.some(m => m.kind === 'dash')) return;
            let v = 0;
            for (const m of g) if (m.kind !== 'buff') v += m.lvl + (m.evolved ? 3 : 0);
            if (v > bv) { bv = v; bi = k; }
          });
          if (bi >= 0) { buffMode = null; return bi; }
        }
      }
    }
    // Defensa: con un corredor (o alguien) encima y un foco que no apunta (minas,
    // rastro, torreta...), se pasa un rato al hueco que dispara al más cercano.
    if (opts.switch) {
      const fg = pl.slots[focusSlot] || [];
      if (!fg.some(m => TARGETED.has(m.kind))) {
        let need = false;
        for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 230)) {
          const d = Math.hypot(e.x - pl.x, e.y - pl.y) - e.r - pl.r;
          if ((e.behavior === 'runner' && d < 200) || d < P.defD) { need = true; break; }
        }
        if (need) defT = P.defHold;
        else defT -= api.dt || 1 / 30;
        if (defT > 0) {
          let bi = -1, bv = 0;
          pl.slots.forEach((g, k) => {
            let v = 0;
            for (const m of g) if (TARGETED.has(m.kind) && reachOf(m) > 120) v += m.lvl + (m.evolved ? 3 : 0);
            if (v > bv) { bv = v; bi = k; }
          });
          if (bi >= 0) { buffMode = null; return bi; }
        }
      }
    }
    if (opts.noBuffCycle) return focusSlot;
    const buffSlots = [];
    pl.slots.forEach((g, i) => { if (g.length === 1 && g[0].kind === 'buff') buffSlots.push(i); });
    if (buffMode != null) {
      const g0 = pl.slots[buffMode];
      const m = g0 && g0.length === 1 && g0[0].kind === 'buff' ? g0[0] : null;
      const b = m && pl.buffs[m.stat];
      buffT += api.dt || 1 / 30;
      const full = b && b.n >= Math.max(1, m.stacks | 0) && b.t > m.dur - 0.12;
      if (!m || !b || full || buffT > 4 || pressure(pl) > 0 || danger > 0.7) buffMode = null;
      else return buffMode;
    }
    if (danger < 0.5 && pressure(pl) === 0) {
      for (const i of buffSlots) {
        const m = pl.slots[i][0], b = pl.buffs[m.stat];
        if (!b) continue;
        const max = Math.max(1, m.stacks | 0);
        // Mantener (al máximo y a punto de caducar) o acumular con calma.
        if ((b.n >= max && b.t < 1.0) || (b.n < max && danger < 0.25)) { buffMode = i; buffT = 0; return i; }
      }
    }
    return focusSlot;
  }

  // ---------------- depuración ----------------
  function dumpGrid(api, S) {
    const pl = api.pl;
    const ech = new Map();
    for (const e of S.enemies) { const c = cellOf(e.x, e.y); if (c >= 0) ech.set(c, e.boss ? 'B' : e.behavior === 'runner' ? 'R' : KEEPERS.has(e.behavior) ? 'K' : 'E'); }
    console.log(`t=${api.time.toFixed(1)} hp ${Math.round(pl.hp)}/${pl.maxHp} spd ${pl.spd.toFixed(0)} n=${S.enemies.length} bestW=${bestW.toFixed(2)} danger=${danger.toFixed(2)} flow=${flow ? flow.map(v => v.toFixed(2)) : '-'} goal=${goal ? goal.kind : "-"} act=${pl.activeGroup().map(m => m.id).join("+")}`);
    for (let y = 0; y < N; y++) {
      let s = '';
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (i === R * N + R) { s += '@'; continue; }
        if (ech.has(i)) { s += ech.get(i); continue; }
        if (!freeG[i]) { s += '#'; continue; }
        const m = Ms[i];
        s += m === -Infinity ? ' ' : m < -0.5 ? '-' : m < 0 ? '.' : m < 0.5 ? ':' : m < 1.5 ? 'o' : 'O';
      }
      console.log(s);
    }
  }
  const dmgLog = {}, lastHits = [];
  function hookDebug(api) {
    const pl = api.pl, h0 = pl.hurt;
    pl.hurt = function (amount, type, pure) {
      const before = this.hp;
      h0.call(this, amount, type, pure);
      const d = before - this.hp;
      if (d <= 0) return;
      const st = new Error().stack;
      let why = 'other';
      const m = st.match(/combat\.js:(\d+)/);
      if (/hazards\.js/.test(st)) {
        why = pure ? 'hz-arceus' : 'hazard';
        const h = api.G.Hazards.all.find(h => h.hit && h.t - h.delay < 0.04 && api.G.Hazards.inside(h, pl.x, pl.y, pl.r));
        if (h && !pure) why += ':' + (h.kind === 'beam' ? 'beam' + h.w : 'z' + Math.round(h.r));
      }
      else if (/judgment\.js/.test(st)) why = 'arceus';
      else if (/interact\.js/.test(st)) why = 'trap';
      else if (m) {
        why = +m[1] >= 600 ? 'touch' : 'shot';
        if (why === 'touch') {
          const e = api.sense().enemies.filter(e => Math.hypot(e.x - pl.x, e.y - pl.y) < e.r + pl.r + 2).sort((a, b) => b.dmg - a.dmg)[0];
          if (e) why += ':' + (e.boss ? 'boss' : e.behavior);
        }
      } else if (/player\.js/.test(st)) why = 'liquid';
      if (api.G.Rift.inArena) why = 'arena:' + why;
      if (api.G.Judgment.active) why = 'judge:' + why;
      dmgLog[why] = (dmgLog[why] || 0) + d;
      const n100 = api.sense().enemies.filter(e => Math.hypot(e.x - pl.x, e.y - pl.y) < 100).length;
      lastHits.push(Math.round(api.time * 10) / 10 + ' ' + why + ' ' + Math.round(d) + ' n' + n100 + ' W' + bestW.toFixed(2) + (why.startsWith('hazard') ? ' ' + pl.activeGroup().map(m => m.kind).join('+') : ''));
      if (lastHits.length > 10) lastHits.shift();
    };
  }

  const C = cards || {};
  return {
    name: 'pro-b',
    init(api) { G = api.G; if (debug) hookDebug(api); if (C.init && Object.prototype.propertyIsEnumerable.call(C, 'init')) C.init(api); },
    move,
    active,
    card: (cs, api) => (C.card ? C.card(cs, api) : 0),
    item: (a, b, api) => (C.item ? C.item(a, b, api) : a),
    bond: (o, api) => (C.bond ? C.bond(o, api) : null),
    secondMove: C.secondMove ? (pool, api) => C.secondMove(pool, api) : undefined,
    get dmgLog() { return dmgLog; },
    get arenas() { return arenas.concat(curArena ? [curArena] : []); },
    lastWords: () => lastHits.join(' | ')
  };
};
