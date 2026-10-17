/* ============ sim/bots/dodger.js — bot que prioriza SOBREVIVIR ============
 *
 * Movimiento por direcciones muestreadas: cada fotograma prueba DIRS
 * direcciones (y quedarse quieto) y simula ~1,2 s hacia delante:
 *
 *   - el jugador va recto a su velocidad (parando en paredes/charcos dañinos)
 *   - cada enemigo cercano le persigue (embestidas, saltos y tiradores aparte)
 *   - los disparos enemigos siguen recto (vx, vy)
 *   - los avisos del suelo (G.Hazards) se comprueban en el instante en que estallan
 *   - durante la Sentencia, Arceus (posición en G.Judgment.netState()) persigue
 *
 * El coste de cada dirección está en "fracción de la vida actual que se
 * perdería" (lo letal pesa mucho más), más términos de estrategia: espacio
 * libre (densidad de enemigos y paredes más allá del horizonte), mantener un
 * blanco a tiro del movimiento activo, recoger experiencia y objetivos del
 * mapa (grietas, manantiales, altares, cofres con candado, curas, objetos), y
 * algo de inercia para no temblar.
 *
 * Cartas, objetos y vínculos: si existe sim/bots/cards.js (fábrica), se le
 * delega; si no, una regla sencilla (ver fallbackCard).
 *
 * Opciones (--opts '{"...":...}'): dirs, steps, step, rifts (entrar en
 * grietas, por defecto sí), chests, ownCards (no delegar en cards.js),
 * trace (función de depuración).
 */
module.exports = (opts = {}) => {
  const P = Object.assign({
    dirs: 24, steps: 8, step: 0.15,
    rifts: true, chests: true,
    wCrowd: 0.03, wWall: 0.06, wReach: 0.05, wXp: 0.06, wGoal: 0.10, wInertia: 0.012, wWater: 0.03, wHit: 2, crowdScale: 130, crowdAhead: 0, wCrowd2: 0
  }, opts);

  // ---- cartas: delega en cards.js si está ----
  let cardBot = null;
  try {
    if (P.ownCards) throw 0;
    const mk = require('./cards');
    if (typeof mk === 'function') cardBot = mk(opts);
    else if (mk && typeof mk.card === 'function') cardBot = mk;
  } catch (e) { cardBot = null; }

  const DIRS = [];
  for (let i = 0; i < P.dirs; i++) { const a = i / P.dirs * Math.PI * 2; DIRS.push([Math.cos(a), Math.sin(a)]); }
  DIRS.push([0, 0]);

  let prev = [0, 0];
  let goal = null, goalT = 0;
  let arceusR = 40;
  const aimDir = new WeakMap();   // embestida apuntada: dirección fijada al empezar a apuntar
  let G = null;

  // ---------------- utilidades ----------------
  const isBuff = m => m.kind === 'buff';
  const TARGETED = ['melee', 'beam', 'projectile', 'boomerang', 'chain', 'meteor', 'dash', 'cone'];
  function reach(m) {
    if (!m) return 0;
    if (m.kind === 'melee') return m.radius + 30;
    if (m.kind === 'beam') return m.radius + 20;
    if (m.kind === 'boomerang') return m.radius + 40;
    if (m.kind === 'chain') return 280;
    if (m.kind === 'meteor') return 340;
    if (m.kind === 'dash') return m.radius + 60;
    if (m.kind === 'cone') return m.speed * m.life + 30;
    if (m.kind === 'aura' || m.kind === 'orbit') return (m.radius || 80) * 0.9;
    if (m.kind === 'nova') return 200;
    if (m.kind === 'trail' || m.kind === 'mine') return 120;
    if (m.kind === 'turret') return 260;
    return 520;
  }
  /** Alcance "útil" del grupo activo (el mayor de los que hacen daño). */
  function activeReach(pl) {
    let r = 0, targeted = false;
    for (const m of pl.activeGroup()) {
      if (isBuff(m)) continue;
      r = Math.max(r, reach(m));
      if (TARGETED.includes(m.kind)) targeted = true;
    }
    return { r, targeted };
  }

  /** Distancia mínima al origen del segmento (ax,ay)-(bx,by): choque continuo entre pasos. */
  function segMin(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? -(ax * dx + ay * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(ax + dx * t, ay + dy * t);
  }

  /** Daño (en fracción de la vida actual) con lo letal muy penalizado. */
  function frac(pl, d) {
    const f = d / Math.max(1, pl.hp);
    return P.wHit * (f >= 0.98 ? 6 + f : f);
  }

  // ¿Se puede pisar? (paredes, objetos sólidos y charcos que dañan)
  let liquidBad = false, liquidSlow = 1;
  let traps = [];
  function free(x, y, r) {
    if (!G.World.isFree(x, y, r, true)) return false;
    if (liquidBad && G.World.isLiquid(x, y)) return false;
    for (const t of traps) if ((x - t.x) ** 2 + (y - t.y + 8) ** 2 < 30 * 30) return false;
    return true;
  }

  // ---------------- objetivo del mapa ----------------
  function pickGoal(api, s, calm) {
    const { pl } = api;
    const hpK = pl.hp / pl.maxHp;
    let best = null, bv = 0;
    const consider = (x, y, inR, value, kind) => {
      const d = Math.hypot(x - pl.x, y - pl.y);
      const v = value / (1 + d / 250);
      if (v > bv) { bv = v; best = { x, y, inR, kind }; }
    };
    if (s.rift && P.rifts && !s.inArena && !s.judge) consider(s.rift.x, s.rift.y - 10, 26, 3.0, 'rift');
    if (!s.inArena && !s.judge) {
      for (const p of G.World.specialsNear(pl.x, pl.y, 650)) {
        if (p.type === 'spring' && p.charge > 0.25 && hpK < 0.7) consider(p.x, p.y - 8, 20, 1.5 + (1 - hpK) * 3, 'spring');
        else if (p.type === 'altar' && !p.used) consider(p.x, p.y, Math.max(30, p.r + pl.r + 14) - 6, 1.6, 'altar');
        else if (p.type === 'bigchest' && P.chests && calm) consider(p.x, p.y, Math.max(46, p.r + pl.r + 24) - 8, 1.2, 'chest');
      }
    }
    for (const p of s.pickups) {
      if (p.kind === 'heal' && hpK < 0.8) consider(p.x, p.y, 10, 1.0 + (1 - hpK) * 2.5, 'heal');
      else if (p.kind === 'item' && !pl.item) consider(p.x, p.y, 10, 1.4, 'item');
      else if (p.kind === 'magnet' || p.kind === 'xpBig') consider(p.x, p.y, 10, 0.9, 'pick');
      else if (p.kind === 'bomb') consider(p.x, p.y, 10, 0.5, 'pick');
    }
    return best;
  }

  // ---------------- movimiento ----------------
  function move(api) {
    G = api.G;
    const pl = api.pl, s = api.sense();
    const le = G.World.liquidEffect(pl.mon.types);
    liquidBad = !!le.dmg; liquidSlow = le.slow || 1;
    const leAny = G.World.liquidEffect(null);
    const enemySlowLiquid = !leAny.dmg && !!leAny.slow;
    const spd = pl.spd / (pl.inLiquid ? (le.slow || 1) : 1);
    const H = P.steps * P.step;
    const prX = Math.max(6, pl.r * 0.7);

    // --- amenazas relevantes ---
    const R = spd * H + 260;
    const threats = [];
    for (const e of s.enemies) {
      if (e.behavior === 'thief') continue;
      const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy);
      if (d > R) continue;
      threats.push(e);
    }
    let arceus = null;
    if (s.judge) {
      const ns = G.Judgment.netState();
      if (ns) {
        if (G.Sprites && G.Sprites.bodyRadius) arceusR = G.Sprites.bodyRadius(493, 1.5) * 0.9;
        arceus = { x: ns[0], y: ns[1], r: arceusR, spd: Math.max(70, spd * 1.22), dmg: pl.maxHp * 0.4 };
      }
    }
    traps = G.World.specialsNear(pl.x, pl.y, 400).filter(p => p.type === 'trap');
    const shots = s.shots.filter(p => Math.hypot(p.x - pl.x, p.y - pl.y) < 520);
    const hazards = s.hazards.filter(h => !h.hit);

    // Calma: nadie cerca y nada avisado.
    let nearest = Infinity;
    for (const e of threats) nearest = Math.min(nearest, Math.hypot(e.x - pl.x, e.y - pl.y) - e.r);
    const calm = nearest > 220 && !hazards.length && !shots.length && !arceus;

    goalT -= 1;
    if (goalT <= 0 || (goal && goal.kind === 'chest' && !calm && nearest < 120)) { goal = pickGoal(api, s, calm); goalT = 15; }

    const ar = activeReach(pl);
    const hpK = pl.hp / pl.maxHp;
    const xps = s.pickups.filter(p => (p.kind === 'xp' || p.kind === 'xpBig' || p.kind === 'coin') && Math.hypot(p.x - pl.x, p.y - pl.y) < 420);

    let best = null, bestC = Infinity;
    for (const dir of DIRS) {
      let c = 0;
      // Trayectoria del jugador.
      const path = [], vel = [];
      let svx = pl._vx || 0, svy = pl._vy || 0;
      let x = pl.x, y = pl.y, blocked = false;
      for (let k = 1; k <= P.steps; k++) {
        if (!blocked) {
          // En agua/pantano se va más lento (y los corredores te alcanzan).
          const sk = liquidSlow < 1 && G.World.isLiquid(x, y) ? liquidSlow : 1;
          if (sk < 1) c += P.wWater;
          const nx = x + dir[0] * spd * sk * P.step, ny = y + dir[1] * spd * sk * P.step;
          if (free(nx, ny, prX)) { x = nx; y = ny; }
          else {
            // Desliza por un eje si se puede (como World.collide).
            if (free(nx, y, prX)) x = nx; else if (free(x, ny, prX)) y = ny; else blocked = true;
          }
        }
        path.push(x, y);
        // Velocidad suavizada que ven los corredores (EnemyMgr: k = dt·5 por fotograma).
        const vk = 1 - Math.exp(-5 * P.step);
        svx += (dir[0] * spd - svx) * vk; svy += (dir[1] * spd - svy) * vk;
        vel.push(svx, svy);
      }
      if (blocked && (dir[0] || dir[1])) c += 0.02;

      // Enemigos (contacto: una vez por enemigo, en el primer paso que toca).
      for (const e of threats) {
        let ex = e.x, ey = e.y;
        let espd = e.spd * (1 - (e.slow || 0));
        if (!e.flying && enemySlowLiquid && G.World.isLiquid(e.x, e.y)) espd *= 0.55;
        const runner = e.behavior === 'runner';
        // Jefes: alternan cerca/lejos, se enfurecen y lanzan ataques (quietos mientras cargan).
        const ai = e.boss ? e.ai : null;
        const cast = ai && ai.cast;
        if (ai && !cast) espd *= (ai.fury ? 1.25 : 1) * 1.1;
        const bossFar = ai && !cast && ai.mode === 'far';
        const keep = e.keepsDistance && e.keepsDistance();
        const dashing = e.phase === 'dash';
        const aiming = e.phase === 'aim';
        const jumping = !!e.jump;
        const rr = e.r + pl.r + 4;
        const dmg = e.dmg * (1 - pl.reduction);
        let hit = -1, minD = Infinity;
        let opx = pl.x, opy = pl.y;
        for (let k = 0; k < P.steps; k++) {
          const t = (k + 1) * P.step;
          const px = path[2 * k], py = path[2 * k + 1];
          const oex = ex, oey = ey;
          if (jumping) { /* cae donde avisa el peligro: lo cubre G.Hazards */ }
          else if (cast) {
            if (cast.id === 'dash' && t + cast.t > cast.wind && t + cast.t < cast.wind + cast.dur + P.step) {
              const sp = cast.len / cast.dur;
              ex += Math.cos(cast.ang) * sp * P.step; ey += Math.sin(cast.ang) * sp * P.step;
            }
          }
          else if (bossFar && Math.hypot(px - ex, py - ey) < 300) { /* se aparta o te rodea */ }
          else if (dashing) { ex += e.dx * espd * 3.4 * P.step; ey += e.dy * espd * 3.4 * P.step; }
          else if (aiming && t > e.pt) {
            let b = aimDir.get(e); if (!b) { const n = Math.hypot(pl.x - e.x, pl.y - e.y) || 1; b = [(pl.x - e.x) / n, (pl.y - e.y) / n]; aimDir.set(e, b); }
            ex += b[0] * espd * 3.4 * P.step; ey += b[1] * espd * 3.4 * P.step;
          } else if (!keep || Math.hypot(px - ex, py - ey) > (e.def.range || 200) * 0.82) {
            let tx = px, ty = py;
            if (runner) {
              // Corredor: apunta a donde vas a estar.
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
          // Tras tocarte, el enemigo espera touchCd; y con invulnerabilidad no hace nada.
          if (d < 0 && hit < 0 && !jumping && t > Math.max(e.touchCd || 0, pl.invuln || 0)) hit = k;
        }
        if (!aiming) aimDir.delete(e);
        if (hit >= 0) c += frac(pl, dmg) * (1 - hit * 0.05);
        else if (minD < 22) c += frac(pl, dmg) * 0.25 * (1 - minD / 22);
      }
      if (arceus) {
        let axx = arceus.x, ayy = arceus.y;
        for (let k = 0; k < P.steps; k++) {
          const px = path[2 * k], py = path[2 * k + 1];
          const dx = px - axx, dy = py - ayy, d = Math.hypot(dx, dy) || 1;
          const st = Math.min(d, arceus.spd * P.step);
          axx += dx / d * st; ayy += dy / d * st;
          if (Math.hypot(px - axx, py - ayy) < arceus.r + pl.r + 12) { c += frac(pl, arceus.dmg) * (1 - k * 0.04); break; }
        }
        // Además, lejos de Arceus en general.
        const ex = path[path.length - 2], ey = path[path.length - 1];
        c += 0.15 * Math.exp(-Math.hypot(ex - arceus.x, ey - arceus.y) / 160);
      }

      // Disparos enemigos (rectos).
      for (const p of shots) {
        const left = p.life - p.t;
        const rr = p.r + pl.r + 4;
        let opx = pl.x, opy = pl.y, osx = p.x, osy = p.y;
        for (let k = 0; k < P.steps; k++) {
          const t = (k + 1) * P.step;
          if (t - P.step > left) break;
          const sx = p.x + p.vx * t, sy = p.y + p.vy * t;
          const px = path[2 * k], py = path[2 * k + 1];
          const md = segMin(opx - osx, opy - osy, px - sx, py - sy);
          opx = px; opy = py; osx = sx; osy = sy;
          if (md < rr && t > (pl.invuln || 0)) {
            c += frac(pl, p.dmg * (1 - pl.reduction)) * (1 - k * 0.04); break;
          }
        }
      }

      // Avisos del suelo: dónde estarás cuando estallen.
      for (const h of hazards) {
        const left = h.delay - h.t;
        let k = Math.round(left / P.step) - 1;
        let w = 1;
        if (k >= P.steps) { k = P.steps - 1; w = 0.7; }
        if (k < 0) k = 0;
        if (G.Hazards.inside(h, path[2 * k], path[2 * k + 1], pl.r + 5)) {
          const dmg = h.pct ? Math.max(h.dmg, pl.maxHp * h.pct) : h.dmg * (h.pure ? 1 : 1 - pl.reduction);
          c += frac(pl, dmg) * w;
        }
      }

      // ---- estrategia (posición final y algo más allá) ----
      const fx = path[path.length - 2], fy = path[path.length - 1];
      let crowd = 0, nearE = Infinity, nearInReach = false;
      // Más allá del horizonte: dónde estarías si siguieras (para no meterte en un cerco).
      const lx = fx + dir[0] * spd * P.crowdAhead, ly = fy + dir[1] * spd * P.crowdAhead;
      let crowd2 = 0;
      for (const e of s.enemies) {
        const d = Math.hypot(e.x - fx, e.y - fy);
        if (P.wCrowd2) crowd2 += (e.boss ? 3 : 1) * Math.exp(-Math.hypot(e.x - lx, e.y - ly) / 260);
        if (d > 520) continue;
        const w = e.boss ? 3 : 1;
        crowd += w * Math.exp(-d / P.crowdScale);
        if (d - e.r < nearE) nearE = d - e.r;
      }
      c += P.wCrowd * Math.min(crowd, 12) * (0.6 + 0.4 * (1 - hpK));
      if (P.wCrowd2) c += P.wCrowd2 * Math.min(crowd2, 30) / 10;
      if (dir[0] || dir[1]) {
        // Paredes: rayo hacia delante.
        for (let k = 1; k <= 4; k++) {
          const dd = H * spd + k * 60;
          if (!free(pl.x + dir[0] * dd, pl.y + dir[1] * dd, prX)) { c += P.wWall * (1 - (k - 1) / 4); break; }
        }
      }
      // Mantener un blanco a tiro (sólo si no corre peligro).
      if (ar.r > 0 && nearE < Infinity) {
        const want = ar.r * 0.8;
        if (nearE > want) c += P.wReach * Math.min(1, (nearE - want) / 200) * hpK * (ar.targeted ? 1.5 : 1);
      }
      // Lo más cerca que pasa la trayectoria de un punto (no sólo el final: si no, se pasa de largo).
      const closest = (qx, qy) => {
        let m = Infinity;
        for (let k = 0; k < path.length; k += 2) { const d = (path[k] - qx) ** 2 + (path[k + 1] - qy) ** 2; if (d < m) m = d; }
        return Math.sqrt(m);
      };
      // Experiencia: acercarse (lo que entra en el imán cuenta entero).
      if (xps.length && dir !== DIRS[DIRS.length - 1]) {
        let g = 0;
        for (const p of xps) {
          const d0 = Math.hypot(p.x - pl.x, p.y - pl.y);
          if (d0 < pl.magnet) continue;
          const d1 = Math.max(pl.magnet * 0.8, closest(p.x, p.y));
          const v = p.kind === 'coin' ? 0.3 : Math.min(3, Math.sqrt(p.value / 10));
          g += v * Math.max(-1, Math.min(1, (d0 - d1) / (spd * H))) / (1 + d0 / 150);
        }
        c -= P.wXp * Math.min(4, g) * (0.4 + 0.6 * hpK);
      }
      // Objetivo del mapa.
      if (goal) {
        const d0 = Math.hypot(goal.x - pl.x, goal.y - pl.y);
        const d1 = goal.kind === 'chest' || goal.kind === 'spring' ? Math.hypot(goal.x - fx, goal.y - fy) : closest(goal.x, goal.y);
        if (d1 <= goal.inR) c -= P.wGoal * 1.5;
        else c -= P.wGoal * Math.max(-1, Math.min(1, (d0 - d1) / (spd * H)));
      }
      // Inercia.
      c -= P.wInertia * (dir[0] * prev[0] + dir[1] * prev[1]);
      if (!dir[0] && !dir[1]) c += 0.004;

      if (c < bestC) { bestC = c; best = dir; }
    }
    prev = best;
    if (P.trace) P.trace(api, best, bestC);
    return best;
  }

  // ---------------- cartas (regla sencilla) ----------------
  function power(g) {
    let v = 0;
    for (const m of g) if (!isBuff(m)) v += m.lvl + (m.evolved ? 4 : 0);
    return v * (g.length > 1 ? 1.2 : 1);
  }
  // Foco: el grupo con vínculo más fuerte; si no hay, el del movimiento inicial.
  function bestSlot(pl) {
    let bi = -1, bv = -1;
    pl.slots.forEach((g, i) => { if (g.length > 1) { const v = power(g); if (v > bv) { bv = v; bi = i; } } });
    if (bi >= 0) return bi;
    const i0 = pl.slots.findIndex(g => g.includes(pl.moves[0]));
    return i0 >= 0 ? i0 : pl.active;
  }
  function fallbackCard(cards, api) {
    const pl = api.pl;
    const main = pl.slots[bestSlot(pl)] || [];
    const mainIds = new Set(main.map(m => m.id));
    const score = c => {
      const k = c.key;
      if (c.type === 'evo') return 100;
      if (c.type === 'stat' && c.color === '#ffd23f') return 90;      // pide una evolución
      if (c.type === 'up') {
        const id = k.slice(3);
        const m = pl.moves.find(x => x.id === id);
        if (m && isBuff(m)) return 5;
        return mainIds.has(id) ? 80 : 30;
      }
      if (c.type === 'new') {
        const d = G.Moves.BY_ID[k.slice(4)];
        if (!d || d.kind === 'buff') return 0;
        return pl.slots.length < 3 ? 45 : 25;
      }
      if (c.type === 'stat') {
        const id = k.slice(5);
        const hpK = pl.hp / pl.maxHp;
        return ({ atk: 60, cd: 58, def: 50, hp: 40, rgn: 38, spd: 35, heal: hpK < 0.4 ? 70 : 10, mag: 20, xp: 22 })[id] || 10;
      }
      return 1;
    };
    let bi = 0, bv = -Infinity;
    cards.forEach((c, i) => { const v = score(c); if (v > bv) { bv = v; bi = i; } });
    return bi;
  }

  const bot = {
    name: 'dodger',
    init(api) { G = api.G; if (cardBot && cardBot.init) cardBot.init(api); },
    move,
    card(cards, api) {
      G = api.G;
      if (cardBot && cardBot.card) { try { const i = cardBot.card(cards, api); if (i >= 0 && i < cards.length) return i; } catch (e) {} }
      return fallbackCard(cards, api);
    },
    item(cur, next, api) {
      if (cardBot && cardBot.item) { try { return cardBot.item(cur, next, api); } catch (e) {} }
      return cur;
    },
    bond(opt, api) {
      if (cardBot && cardBot.bond) { try { return cardBot.bond(opt, api); } catch (e) {} }
      const loose = opt.loose.filter(m => !isBuff(m)).sort((a, b) => b.lvl - a.lvl);
      const pool = loose.length >= (opt.mode === 'add' ? 1 : 2) ? loose : opt.loose.slice().sort((a, b) => b.lvl - a.lvl);
      return opt.mode === 'add' ? [pool[0]] : pool.slice(0, 2);
    },
    active(api) {
      if (cardBot && cardBot.active) { try { const i = cardBot.active(api); if (i != null) return i; } catch (e) {} }
      return bestSlot(api.pl);
    },
    secondMove(pool, api) {
      if (cardBot && cardBot.secondMove) { try { return cardBot.secondMove(pool, api); } catch (e) {} }
      return pool.find(id => api.G.Moves.BY_ID[id].kind !== 'buff') || pool[0];
    }
  };
  return bot;
};
