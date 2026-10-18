/* ============ sim/bots/cards-v2-frozen.js — copia CONGELADA de cards.js v2 (17-10-2026), con su move-dps-frozen.json, para medir el movimiento (pro-a) sin que cambien las cartas ============
 *
 * Elige cartas de nivel (y cuándo cambiarlas), objetos, vínculos, el 2.º
 * movimiento inicial y el hueco activo. Los bots de movimiento la mezclan:
 *   Object.assign(mover, require('./cards')(opts))
 * La v1 (congelada) está en cards-v1.js; con opts.cards = 'v1' se usa ésa.
 *
 * Idea de la v2: la partida se decide por el GRUPO FUSIONADO (vínculos). El plan es
 *   1. un movimiento principal (el "foco"), subido al máximo y evolucionado cuanto antes
 *      (la stat de su evolución se coge pronto: basta una vez);
 *   2. 2-3 compañeros que valgan la pena DENTRO del grupo (el que más sume al foco),
 *      aprendidos y subidos a tiempo para que, al llegar el vínculo, fusionarlos rinda;
 *      un potenciador fusionado (Danza Espada...) queda siempre al máximo;
 *   3. no diluir: las mejoras fuera del plan valen poco y, si nada de lo que sale
 *      ayuda, se cambian las cartas (1 gratis + los de la mejora).
 *
 * Todo se mide con un modelo de dos ejes y se compara en logaritmos:
 *   K  "derribos por segundo" del hueco: daño directo / vida de los enemigos
 *      + veneno (un % de la vida por acumulación, no depende de la vida del enemigo:
 *      por eso pesa más cuanto más avanza la partida) + quemadura.
 *   T  aguante: vida efectiva = (vida + regen·20 s) / (1 − reducción)
 *   V(grupo) = wD·ln K + wT·ln T
 * La vida de los enemigos y cuántos hay cerca se miran en la partida (api.G.EnemyMgr).
 * Ver README.md para las opciones.
 */
module.exports = (opts = {}) => {
  if (opts.cards === 'v1') return require('./cards-v1')(opts);
  const o = Object.assign({
    wD: 1.0,               // peso del daño (derribos/s)
    wT: 1.0,               // peso del aguante
    priority: [],          // movimientos preferidos (en orden): se aprenden/mejoran antes; el 1.º que tengas es el foco
    avoid: [],             // movimientos que nunca se cogen (ni en vínculos, si se puede)
    statWeights: {},       // multiplicador por carta de stat: { hp, atk, spd, cd, def, rgn, mag, xp, heal }
    statBonus: {},         // suma fija por carta de stat
    maxMoves: 16,          // tope de movimientos aprendidos en total (fusionados incluidos)
    focus: 'best',         // 'best' | 'active' (hueco 0) | id de movimiento
    switchK: 1.8,          // el foco cambia sólo si otro hueco rinde switchK veces más
    startBias: 2,          // niveles "de regalo" del movimiento inicial al elegir el foco
    kindMul: {},           // multiplicador por familia sobre la tabla medida
    defCap: 0.6,           // a partir de esta reducción la Coraza vale la mitad
    bondK: 0.5,            // cuánto vale hoy lo que sólo rinde tras un vínculo (0-1)
    poisonK: 0.7,          // peso del veneno frente al daño directo (mata despacio)
    hpAhead: 1.5,          // la vida enemiga de referencia = la de ahora × esto (las cartas son para siempre)
    fillBonus: 0.03,       // extra por llenar el último hueco (dejan de salir movimientos nuevos)
    aheadK: 0.4,           // peso de lo que una mejora abre más adelante (niveles siguientes, evolución)
    sideUp: 0.05,          // fracción de la mejora de un movimiento suelto que no entra en el plan
    evoBonus: 0.15,        // peso de coger la stat de una evolución ANTES de llegar al máximo
    rerollGain: 0.08,      // cambia las cartas si una tanda nueva vale de media esto más que la mejor de ahora
    rerollBelow: 0.02,     // ... o si la mejor no llega a esto (y una tanda nueva sí)
    rerollUntil: 80,       // ... hasta este nivel
    itemRank: null,        // lista de objetos de mejor a peor (si no, el modelo)
    ban: null,             // vetos (sólo para bans()): si se da, manda
    table: true,           // usar sim/bots/move-dps.json
    log: false
  }, opts);
  const KM = Object.assign({ melee: 0.6, dash: 0.6, aura: 0.6, trail: 0.5, orbit: 0.8, nova: 0.7 }, o.kindMul);
  const prio = id => { const i = o.priority.indexOf(id); return i < 0 ? 0 : o.priority.length - i; };
  const L = x => Math.log(Math.max(1e-9, x));
  let G = null, curTime = 0;

  // ---------------- daño directo (fórmula + tabla medida) ----------------
  const geo = x => x || 0;
  const HITS = {
    projectile: m => m.count ** 0.8 * (1 + 0.3 * Math.min(geo(m.pierce), 4)) * (m.homing ? 1 : 0.8),
    melee:      m => 1 + 1.5 * (Math.min(m.arc || 1.5, 6.28) / 6.28) ** 0.7 * (m.radius / 60) ** 2,
    beam:       m => 1 + 1.2 * (m.radius / 220) * ((m.width || 30) / 30),
    nova:       m => 1 + m.count * 0.18 * (1 + 0.5 * geo(m.pierce)) * (m.homing ? 1.5 : 1),
    aura:       m => 2 * (m.radius / 70) ** 2,
    boomerang:  m => m.count * 1.6 * (m.radius / 220) * (m.size / 8) ** 0.5,
    chain:      m => { let s = 0, k = 1; for (let i = 0; i < Math.min(m.count, 8); i++) { s += k; k *= 0.85; } return s; },
    mine:       m => m.count * 0.7 * (1 + 1.5 * (m.radius / 56) ** 2),
    meteor:     m => m.count * 0.8 * (1 + 1.2 * (m.radius / 46) ** 2),
    cone:       m => 1 + m.count * 0.2 * (1 + 0.6 * geo(m.pierce)) * ((m.life || 0.42) / 0.42),
    dash:       m => 1 + 1.5 * (m.radius / 110) * ((m.width || 34) / 34)
  };
  function formula(m, P) {
    if (m.kind === 'buff') return 0;
    const atk = P.atk;
    if (m.kind === 'orbit') return m.dmg * atk * m.count * 0.5 * (m.speed / 2.4) * (m.radius / 62) * Math.min(1, 0.3 / Math.max(0.12, m.cd));
    const cdE = Math.max(0.05, m.cd * P.cdMul);
    if (m.kind === 'turret') {
      // La recarga sólo cuenta para poner torretas; su ritmo de disparo es `rate`.
      const up = Math.min(Math.max(1, m.count | 0), (m.dur || 6) / cdE);
      return m.dmg * atk * up / (m.rate || 0.6) * (1 + 0.5 * geo(m.pierce));
    }
    if (m.kind === 'trail') return m.dmg * atk * 2 * 1.5 * (m.radius / 26) ** 2 * Math.sqrt((m.dur || 3) / 3) * Math.min(1.3, 0.3 / cdE) ** 0.3;
    return m.dmg * atk * HITS[m.kind](m) / cdE;
  }
  let TABLE = null, FSCALE = 1, scaled = false;
  const FACT = {};
  if (o.table !== false) { try { TABLE = require('./move-dps-frozen.json'); } catch (e) { TABLE = null; } }
  const ONE = { atk: 1, cdMul: 1 };
  function calibrate() {
    scaled = true;
    const all = [];
    for (const id in TABLE) {
      const def = G.Moves.BY_ID[id];
      if (!def || !TABLE[id].lv) continue;
      let s = 0, k = 0;
      TABLE[id].lv.forEach((v, i) => {
        if (!(v > 0)) return;
        const evo = i === TABLE[id].lv.length - 1;
        const m = G.Moves.instance(id, evo ? def.maxLvl : i + 1);
        if (evo) { if (!G.Moves.EVO[id]) return; G.Moves.evolve(m); }
        const f = formula(m, ONE);
        if (f > 0) { s += Math.log(v / f); k++; }
      });
      if (k) { FACT[id] = Math.exp(s / k); all.push(FACT[id]); }
    }
    all.sort((x, y) => x - y);
    if (all.length) FSCALE = all[all.length >> 1];
  }
  /** Daño directo/s (ya con el ajuste por familia). */
  function direct(m, P) {
    if (m.kind === 'buff') return 0;
    if (TABLE && !scaled && G) calibrate();
    return formula(m, P) * (FACT[m.id] || FSCALE) * (KM[m.kind] || 1);
  }

  // ---------------- K: derribos por segundo de un grupo ----------------
  /**
   * P = { atk, cdMul, maxHp, red, regen, level, min, crit } (stats del jugador)
   * E = { hp, C } (vida de referencia de los enemigos y cuántos hay a tiro)
   */
  function atkBuff(g, P) {
    let k = 1;
    for (const m of g) if (m.kind === 'buff' && m.stat === 'atk' && m.cd * P.cdMul < m.dur) k += (m.stacks | 0) * m.amount;
    return k;
  }
  function parts(g, P) {
    let dir = 0, pois = 0, burn = 0, slow = 0;
    const atkK = g.length > 1 ? atkBuff(g, P) : 1;      // suelto, un potenciador no está siempre arriba
    for (const m of g) {
      if (m.kind === 'buff') continue;
      const d = direct(m, P);
      const hits = d / Math.max(1e-6, m.dmg * P.atk);    // golpes (enemigo·golpe) por segundo
      if (m.poison) pois += hits * m.poison;
      if (m.burn) burn += hits * m.burn;
      slow = Math.max(slow, m.slow || 0);
    }
    const statused = pois > 0 || burn > 0 || slow > 0;
    for (const m of g) {
      if (m.kind === 'buff') continue;
      let x = direct(m, P);
      if (m.hex) x *= statused ? 1 + (m.hex - 1) * 0.8 : 1 + (m.hex - 1) * 0.25;
      dir += x;
    }
    return { dir: dir * atkK * (1 + 0.5 * (P.crit || 0)), pois, burn, slow };
  }
  function kill(g, P, E) {
    if (!g || !g.length) return 1e-6;
    const p = parts(g, P);
    const C = E.C;
    // Veneno: cada acumulación quita un 2 %/s de la vida (máx. 8 por enemigo; dura 4 s y se renueva).
    const poisonU = Math.min(8 * C, p.pois * 4.5);
    // Quemadura: 3,2·(1 + 0,06·nivel) de daño/s por acumulación (máx. 8; dura 3 s).
    const burnU = Math.min(8 * C, p.burn * 3);
    const burnDps = 3.2 * (1 + 0.06 * (P.level || 1)) * burnU;
    const k = (p.dir + burnDps) / E.hp + o.poisonK * 0.02 * poisonU;
    return Math.max(1e-6, k * (1 + 0.15 * p.slow));
  }
  function tough(g, P) {
    let red = P.red, regen = P.regen;
    for (const m of (g && g.length > 1 ? g : [])) {
      if (m.kind !== 'buff' || m.cd * P.cdMul >= m.dur) continue;
      if (m.stat === 'def') red += (m.stacks | 0) * m.amount;
      if (m.stat === 'regen') regen += (m.stacks | 0) * m.amount;
    }
    red = Math.min(0.8, red);
    let k = 1 / (1 - red);
    if (g && g.some(m => m.kind === 'melee')) k /= 0.75;
    return (P.maxHp + Math.max(-P.maxHp * 0.5, regen) * 20) * k;
  }
  const V = (g, P, E) => o.wD * L(kill(g, P, E)) + o.wT * L(tough(g, P));

  // ---------------- lo que se sabe de la partida ----------------
  function snap(pl, time) {
    return {
      atk: pl.baseAtk * pl.atkMul, cdMul: pl.cdMul, maxHp: pl.maxHp, hp: pl.hp, red: pl.dmgReduce,
      regen: pl.regenFlat + (pl.item === 'shellbell' ? 3 : 0) - (pl.item === 'lifeorb' ? lifeOrbDrain(pl, pl.activeGroup()) : 0),
      level: pl.level, min: (time || 0) / 60, crit: pl.critChance || 0
    };
  }
  function lifeOrbDrain(pl, g) {
    let casts = 0;
    for (const m of g) if (m.kind !== 'orbit' && m.kind !== 'trail') casts += 1 / Math.max(0.12, m.cd * pl.cdMul);
    return pl.maxHp * 0.01 * casts;
  }
  let env = { t: -99, hp: 200, C: 10 };
  function senseEnv(pl, time) {
    if (time - env.t < 3 && env.t >= 0) return env;
    let s = 0, n = 0, near = 0;
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || e.boss) continue;
      s += e.maxHp; n++;
      if (Math.abs(e.x - pl.x) < 320 && Math.abs(e.y - pl.y) < 320) near++;
    }
    // Sin enemigos a la vista: una estimación por el tiempo (sólo al principio).
    const hpNow = n ? s / n : 120 + time * 12;
    env = { t: time, hp: Math.max(60, hpNow * o.hpAhead), C: Math.max(6, Math.min(30, near || 10)) };
    return env;
  }

  // ---------------- foco y plan ----------------
  let focusId = null;
  const leadOf = g => g.find(m => m.kind !== 'buff');
  function focusSlot(pl, P, E) {
    const S = pl.slots;
    if (!S.length) return 0;
    if (pl.hasItem && pl.hasItem('choiceband')) return pl.active;
    if (o.focus === 'active') return 0;
    const want = typeof o.focus === 'string' && o.focus !== 'best' ? [o.focus].concat(o.priority) : o.priority;
    for (const id of want) {
      const i = S.findIndex(g => g.some(m => m.id === id && m.kind !== 'buff'));
      if (i >= 0) return i;
    }
    const val = g => {
      if (!leadOf(g)) return -1;
      const inv = g.reduce((a, m) => a + (m.lvl - 1) + (m.evolved ? 3 : 0) + (m === pl.moves[0] ? o.startBias : 0), 0);
      return kill(g, P, E) * (1 + 0.08 * inv);
    };
    let best = 0, bv = -1;
    S.forEach((g, i) => { const v = val(g); if (v > bv) { bv = v; best = i; } });
    const cur = S.findIndex(g => g.some(m => m.id === focusId));
    if (cur >= 0 && cur !== best && bv < o.switchK * val(S[cur])) best = cur;
    const lead = leadOf(S[best]);
    if (lead) focusId = lead.id;
    return best;
  }

  /** ¿Cuánto vale hoy algo que sólo rinde fusionado? */
  function beta(pl, time) {
    if (pl.bonds > 0) return 1;
    if (time > 27.5 * 60) return 0.05;               // ya no se abren grietas
    return o.bondK;
  }

  /** Máximo + evolución de un movimiento (instancia nueva). */
  function maxed(id) {
    const m = G.Moves.instance(id, G.Moves.BY_ID[id].maxLvl);
    if (G.Moves.EVO[id] && m.kind !== 'buff') G.Moves.evolve(m);
    return m;
  }

  /**
   * Contexto de una decisión: foco F, lo que vale, y los candidatos a vínculo
   * (movimientos sueltos que no son el foco), ordenados por lo que suman al foco.
   */
  function context(pl, time) {
    const P = snap(pl, time), E = senseEnv(pl, time);
    const fi = focusSlot(pl, P, E);
    const F = pl.slots[fi] || [];
    const room = F.length >= 4 ? 0 : 4 - F.length;
    const VF = V(F, P, E);
    const bvOf = m => room ? V(F.concat([m]), P, E) - VF : 0;
    const cands = pl.slots.filter((g, i) => i !== fi && g.length === 1).map(g => g[0])
      .filter(m => !o.avoid.includes(m.id))
      .map(m => ({ m, bv: bvOf(m), bvP: bvOf(m.evolved || m.lvl >= m.def.maxLvl ? m : maxedFrom(m)) }))
      .sort((a, b) => b.bvP - a.bvP);
    return { P, E, fi, F, room, VF, bvOf, cands, beta: beta(pl, time) };
  }
  function maxedFrom(m) { return maxed(m.id); }
  /** Peso de un candidato según su puesto (sólo `room` caben en el grupo). */
  function candW(ctx, id) {
    const k = ctx.cands.findIndex(c => c.m.id === id);
    return k >= 0 && k < ctx.room ? 1 : 0.25;
  }

  /**
   * Valor por carta de mejorar `m` mirando adelante: max sobre k de fn(nivel+k)/k,
   * y fn(máximo evolucionado)/(cartas que faltan + la de evolución + la stat si falta).
   * Lo que se gana con el primer paso cuenta entero; lo de más adelante, `aheadK`.
   */
  function ahead(m, fn, pl) {
    let c = Object.assign({}, m);
    G.Moves.levelUp(c);
    const v1 = fn(c);
    let best = v1, k = 1;
    while (c.lvl < c.def.maxLvl) {
      c = Object.assign({}, c); G.Moves.levelUp(c); k++;
      best = Math.max(best, o.aheadK * fn(c) / k);
    }
    if (G.Moves.EVO[m.id] && m.kind !== 'buff' && !m.evolved) {
      const e = Object.assign({}, c); G.Moves.evolve(e);
      const need = pl.statsTaken[G.Moves.EVO[m.id][1]] ? 0 : 1;
      best = Math.max(best, o.aheadK * fn(e) / (k + 1 + need));
    }
    return best;
  }

  // ---------------- valor de una carta ----------------
  function score(card, pl, time, ctx) {
    const { P, E, fi, F, VF } = ctx;
    const [type, id] = card.key.split(':');
    const hpFrac = pl.hp / pl.maxHp;
    const urgent = hpFrac < 0.35 ? 2 : hpFrac < 0.6 ? 1.3 : 1;

    if (type === 'evo') {
      const m = pl.moves.find(x => x.id === id);
      const inPlan = m && (F.includes(m) || candW(ctx, id) === 1 || prio(id));
      return inPlan ? 10 : 0.3;
    }

    if (type === 'up') {
      const m = pl.moves.find(x => x.id === id);
      if (!m) return 0;
      if (o.avoid.includes(id)) return -0.5;
      const slot = pl.slots.findIndex(g => g.includes(m));
      const S = pl.slots[slot];
      const swap = c => S.map(x => x === m ? c : x);
      // Una mejora se mide con lo que abre: el mejor "valor por carta" entre subir 1,
      // 2... niveles hasta el máximo y evolucionar (Danza Espada nv3→4 sólo da duración,
      // pero abre el nv5; muchos movimientos ganan casi todo al evolucionar).
      const fn = slot === fi ? c => V(swap(c), P, E) - VF
        : S.length === 1 && ctx.room ? c => ctx.beta * candW(ctx, id) * (ctx.bvOf(c) - ctx.bvOf(m)) + o.sideUp * (V([c], P, E) - V(S, P, E))
        : c => o.sideUp * (V(swap(c), P, E) - V(S, P, E));
      let v = ahead(m, fn, pl);
      if (slot !== fi) {
        const c = Object.assign({}, m); G.Moves.levelUp(c);
        const g2 = swap(c);
        if (kill(g2, P, E) > o.switchK * kill(F, P, E)) v = Math.max(v, V(g2, P, E) - VF);   // pasaría a ser el foco
      }
      return v + 0.3 * prio(id);
    }

    if (type === 'new') {
      if (o.avoid.includes(id)) return -9;
      if (pl.moves.length >= o.maxMoves && !prio(id)) return -1;
      const m1 = G.Moves.instance(id, 1), mP = maxed(id);
      let v = 0;
      // ¿Pasaría a ser el foco ya? (al principio, con poco invertido)
      const K1 = kill([m1], P, E), KF = kill(F, P, E);
      if (K1 > o.switchK * KF) v = Math.max(v, V([m1], P, E) - VF);
      // Como candidato a vínculo: lo que sumaría al foco, a nivel 1 y a su techo.
      if (ctx.room) {
        const bv1 = ctx.bvOf(m1), bvP = ctx.bvOf(mP);
        // Sólo caben `room` en el grupo: si ya hay de sobra mejores, vale poco.
        const better = ctx.cands.filter(c => c.bvP >= bvP).length;
        const w = better < ctx.room ? 1 : 0.25;
        v = Math.max(v, ctx.beta * w * (0.6 * Math.max(0, bv1) + 0.4 * Math.max(0, bvP)) * 0.6);
      }
      if (pl.slots.length + 1 >= pl.maxMoves) v += o.fillBonus;
      return v + 1.0 * prio(id);
    }

    if (type === 'stat') {
      const P2 = Object.assign({}, P);
      let v = 0;
      const taken = pl.statsTaken[id] || 0;
      switch (id) {
        case 'atk': P2.atk *= 1.10; break;
        case 'cd':  P2.cdMul *= 0.92; break;
        case 'hp':  P2.maxHp += 20; v += 0.4 * Math.min(20, pl.maxHp - pl.hp) / pl.maxHp * urgent; break;
        case 'def': P2.red = Math.min(0.7, P.red + 0.06); break;
        case 'rgn': P2.regen += 0.9; break;
        case 'spd': v += 0.035 * Math.pow(0.85, taken); break;
        case 'mag': v += 0.012 * Math.pow(0.7, taken); break;
        case 'xp':  v += 0.06 * Math.exp(-pl.level / 30) * Math.pow(0.9, taken); break;
        case 'heal': v += 0.6 * Math.max(0, Math.min(0.45, 1 - hpFrac) - 0.15) * urgent - 0.01; break;
      }
      // Lo que mejora el foco (y, a medias, el grupo que se espera).
      let dv = o.wD * L(kill(F, P2, E) / kill(F, P, E));
      let tv = o.wT * L(tough(F, P2) / tough(F, P)) * (id === 'heal' ? 0 : urgent);
      if (id === 'def' && P.red >= o.defCap) tv *= 0.5;
      v += dv + tv;
      // Preparar evoluciones: la stat que pide el foco o un candidato del plan (basta una vez).
      if (!taken) {
        for (const m of pl.moves) {
          const e = G.Moves.EVO[m.id];
          if (!e || e[1] !== id || m.evolved || m.kind === 'buff') continue;
          const inF = F.includes(m);
          const w = inF ? 1 : prio(m.id) ? 1 : candW(ctx, m.id) === 1 && ctx.room ? ctx.beta : 0;
          if (!w) continue;
          const c = G.Moves.instance(m.id, m.def.maxLvl), c2 = Object.assign({}, c); G.Moves.evolve(c2);
          let gain;
          if (inF) { const gA = F.map(x => x === m ? c : x), gB = F.map(x => x === m ? c2 : x); gain = V(gB, P, E) - V(gA, P, E); }
          else gain = ctx.bvOf(c2) - ctx.bvOf(c);
          // Al máximo, la carta de evolución sale justo después: vale entera. Antes sólo
          // adelanta un par de niveles (en cuanto llega al máximo la stat sale siempre).
          const f = m.lvl >= m.def.maxLvl ? 1 : o.evoBonus * (0.35 + 0.65 * (m.lvl - 1) / (m.def.maxLvl - 1));
          v += w * Math.max(0, gain) * f;
        }
      }
      v *= o.statWeights[id] == null ? 1 : o.statWeights[id];
      v += o.statBonus[id] || 0;
      return v;
    }
    return 0;
  }

  // ---------------- objetos ----------------
  function itemScore(id, pl) {
    if (o.itemRank) { const i = o.itemRank.indexOf(id); return i < 0 ? -99 : -i; }
    const P = snap(pl, curTime), E = senseEnv(pl, curTime);
    const cur = pl.item;
    if (cur === 'choiceband') P.atk /= 1.4;
    if (cur === 'lifeorb') { P.atk /= 1.3; P.regen += lifeOrbDrain(pl, pl.activeGroup()); }
    if (cur === 'quickclaw') P.cdMul /= 0.8;
    if (cur === 'assaultvest') P.red -= 0.2;
    if (cur === 'leftovers') P.regen -= pl._itemRegen || pl.maxHp * 0.015;
    if (cur === 'shellbell') P.regen -= 3;
    const F = pl.slots[focusSlot(pl, P, E)] || [];
    const P2 = Object.assign({}, P);
    let v = 0;
    switch (id) {
      case 'leftovers':   P2.regen += pl.maxHp * 0.015; break;
      case 'choiceband':  P2.atk *= 1.4; v -= pl.bonds > 0 || F.length < 2 ? 0.08 : 0.02; break;  // no deja cambiar de hueco
      case 'quickclaw':   P2.cdMul *= 0.8; break;
      case 'focussash':   v += 0.08; break;
      case 'shellbell':   P2.regen += 3; break;
      case 'amuletcoin':  v -= 0.05; break;
      case 'luckyegg':    v += 0.08 * Math.exp(-pl.level / 25); break;
      case 'lifeorb':     P2.atk *= 1.3; P2.regen -= 2 * lifeOrbDrain(pl, F); break;   // deja la vida baja: pesa el doble
      case 'choicescarf': v += 0.07; break;
      case 'rockyhelmet': v += 0.04; break;
      case 'assaultvest': P2.red = P.red + 0.2; break;
    }
    return v + V(F, P2, E) - V(F, P, E);
  }

  // ---------------- vínculos ----------------
  /** Valor de quedarse con estos huecos: el mejor de ellos (sólo dispara uno). */
  function bestSlotValue(slots, P, E) {
    let b = -Infinity;
    for (const g of slots) if (leadOf(g)) b = Math.max(b, V(g, P, E));
    return b;
  }

  // ---------------- ¿cambiar las cartas? ----------------
  /**
   * Valor esperado de la mejor de 3 cartas de una tanda nueva, con los mismos pesos
   * que G.LevelUp.offer (movimiento nuevo 10, mejora 8, stat 4/7, stat de evolución 14).
   * Se sortea con un generador propio (no gasta números del juego).
   */
  let seedRR = 12345;
  const rnd = () => { seedRR = (seedRR * 1103515245 + 12345) & 0x7fffffff; return seedRR / 0x80000000; };
  function expectedBest(pl, time, ctx) {
    const pool = [];
    const add = (key, w) => pool.push({ key, w, v: score({ key }, pl, time, ctx) });
    if (pl.slots.length < pl.maxMoves) {
      const buffs = pl.moves.filter(m => m.kind === 'buff').length;
      const ids = G.Moves.poolFor(pl.mon).filter(id => !pl.hasMove(id) && !(pl.banned && pl.banned.has(id)) && !(buffs >= 2 && G.Moves.BY_ID[id].kind === 'buff'));
      for (const id of ids) add('new:' + id, 10 * Math.min(1, 6 / ids.length));
    }
    const waiting = {};
    for (const m of pl.moves) { const ev = G.Moves.evoInfo(m, pl.statsTaken); if (ev && !ev.ready) waiting[ev.needs] = 1; }
    for (const m of pl.moves) if (m.lvl < m.def.maxLvl) add('up:' + m.id, 8);
    const sts = G.LevelUp.STATS.filter(s => !waiting[s.id] && (!s.max || (pl.statsTaken[s.id] || 0) < s.max));
    const ws = pl.slots.length < pl.maxMoves ? 4 : 7;
    for (const s of sts) add('stat:' + s.id, ws * Math.min(1, 5 / sts.length));
    for (const id in waiting) add('stat:' + id, 14);
    if (pool.length < 3) return -Infinity;
    seedRR = (pl.level * 7919 + 17) & 0x7fffffff;
    let sum = 0;
    const N = 40;
    for (let k = 0; k < N; k++) {
      const left = pool.slice();
      let best = -Infinity;
      for (let j = 0; j < 3 && left.length; j++) {
        const tot = left.reduce((a, c) => a + c.w, 0);
        let r = rnd() * tot, idx = 0;
        for (let i = 0; i < left.length; i++) { r -= left[i].w; if (r <= 0) { idx = i; break; } }
        best = Math.max(best, left.splice(idx, 1)[0].v);
      }
      sum += best;
    }
    return sum / N;
  }

  const bot = {
    name: 'cards2',

    card(cards, api) {
      G = api.G; curTime = api.time;
      const pl = api.pl, ctx = context(pl, api.time);
      const vals = cards.map(c => score(c, pl, api.time, ctx));
      let bi = 0;
      vals.forEach((v, i) => { if (v > vals[bi]) bi = i; });
      // Cambiar las cartas si lo que sale es claramente peor que una tanda normal.
      let rr = false, exp = 0;
      if (api.rerollsLeft && api.rerollsLeft() > 0 && pl.level <= o.rerollUntil && !cards.some(c => c.type === 'evo')) {
        exp = expectedBest(pl, api.time, ctx);
        rr = exp - vals[bi] > o.rerollGain || vals[bi] < o.rerollBelow && exp > 2 * o.rerollBelow;
      }
      if (o.log) console.log(`[${Math.round(api.time)}s nv${pl.level} foco ${(leadOf(ctx.F) || {}).id} β${ctx.beta}] ` +
        cards.map((c, i) => (i === bi ? '*' : '') + c.key + '=' + vals[i].toFixed(3)).join('  ') + (rr ? `  → CAMBIO (esperado ${exp.toFixed(3)})` : ''));
      return rr ? 'reroll' : bi;
    },

    item(curId, nextId, api) {
      G = api.G; curTime = api.time;
      return itemScore(nextId, api.pl) > itemScore(curId, api.pl) + 0.01 ? nextId : curId;
    },

    bond(opt, api) {
      G = api.G; curTime = api.time;
      const pl = api.pl, P = snap(pl, api.time), E = senseEnv(pl, api.time);
      let loose = opt.loose.filter(m => !o.avoid.includes(m.id));
      if (loose.length < (opt.mode === 'add' ? 1 : 2)) loose = opt.loose;
      // Con la Cinta Elección el hueco activo no cambia: el vínculo tiene que incluirlo.
      const band = pl.hasItem && pl.hasItem('choiceband');
      const act = pl.slots[pl.active];
      const mustM = band && act && act.length === 1 ? act[0] : null;
      const after = pick => pl.slots.filter(g => !(g.length === 1 && pick.includes(g[0]) && g !== opt.group)).map(g => g === opt.group ? g.concat(pick) : g)
        .concat(opt.mode === 'pair' ? [pick] : []);
      let best = null, bv = -Infinity;
      const tryPick = pick => {
        if (mustM && opt.mode === 'pair' && !pick.includes(mustM)) return;
        if (mustM && opt.mode === 'add' && act !== opt.group && !pick.includes(mustM)) return;
        if (pick.every(m => m.kind === 'buff') && opt.mode === 'pair') return;
        const v = bestSlotValue(after(pick), P, E);
        if (v > bv) { bv = v; best = pick; }
      };
      if (opt.mode === 'add') for (const m of loose) tryPick([m]);
      else for (let i = 0; i < loose.length; i++) for (let j = i + 1; j < loose.length; j++) tryPick([loose[i], loose[j]]);
      if (best && opt.mode === 'pair') best = best.slice().sort((a, b) => direct(b, P) - direct(a, P));
      if (o.log) console.log(`[${Math.round(api.time)}s] vínculo ${opt.mode}: ${(best || []).map(m => m.id).join('+')}`);
      return best || [];
    },

    secondMove(pool, api) {
      G = api.G; curTime = 0;
      const pl = api.pl, P = snap(pl, 0), E = { hp: 150, C: 10 };
      const ok = pool.filter(id => !o.avoid.includes(id));
      for (const id of o.priority) if (ok.includes(id)) return id;
      // Que sirva ya (nivel 1, por si pasa a ser el foco) y que sume en el grupo con el inicial.
      const F = pl.slots[0] || [];
      let best = ok[0], bv = -Infinity;
      for (const id of ok) {
        const m1 = G.Moves.instance(id, 1), mP = maxed(id);
        const v = 0.5 * L(kill([m1], P, E)) + 0.5 * (V(F.concat([mP]), P, { hp: 2000, C: 15 }));
        if (v > bv) { bv = v; best = id; }
      }
      return best;
    },

    /** Hueco activo: el foco (se recalcula cada 0,5 s o si cambian los huecos). */
    active(api) {
      G = api.G; curTime = api.time;
      const pl = api.pl;
      if (api.time - focusCache.t > 0.5 || focusCache.n !== pl.slots.length || focusCache.k !== pl.moves.length) {
        const P = snap(pl, api.time), E = senseEnv(pl, api.time);
        focusCache = { t: api.time, i: focusSlot(pl, P, E), n: pl.slots.length, k: pl.moves.length };
      }
      return focusCache.i;
    },

    _model: { kill, tough, direct, parts, snap, V, env: () => env, focusSlot: pl => focusSlot(pl, snap(pl, curTime), senseEnv(pl, curTime)) }
  };
  let focusCache = { t: -1, i: 0, n: -1, k: -1 };

  // Vetos recomendados para este Pokémon (ver bans() abajo).
  Object.defineProperty(bot, 'bans', { value: (mon, g) => module.exports.bans(mon, g, o), enumerable: false });
  let mover = null;
  const mv = () => mover || (mover = require('./' + (o.mover || 'flee'))(Object.assign({}, o, { mover: undefined })));
  Object.defineProperty(bot, 'move', { value: a => mv().move(a), enumerable: false });
  Object.defineProperty(bot, 'init', { value: a => { if (mv().init) mover.init(a); }, enumerable: false });
  return bot;
};

/**
 * Los 3 movimientos que conviene vetar (Mejoras → Veto) para este Pokémon: los
 * que menos suman al grupo que se espera (los 2 mejores de su lista, al máximo
 * y evolucionados), con potenciadores que no hacen nada en el modelo (Agilidad)
 * los primeros. Nunca el inicial ni los de opts.priority. opts.ban manda.
 * @param mon  entrada de G.DEX (o nº de la Pokédex)
 * @param G    el juego cargado (sim/load.js)
 */
module.exports.bans = (mon, G, opts = {}) => {
  if (Array.isArray(opts.ban)) return opts.ban.slice(0, 3);
  if (typeof mon === 'number') mon = G.DEX_BY[mon];
  const pol = module.exports(Object.assign({}, opts, { cards: undefined }));
  const md = pol._model;
  // Inicializa el modelo con este G (la calibración lo necesita).
  pol.secondMove([], { G, pl: { slots: [], moves: [], baseAtk: mon.atk, atkMul: 1.4, cdMul: 0.76, maxHp: mon.hp + 80, hp: mon.hp + 80, dmgReduce: 0.16,
    regenFlat: 1, level: 1, critChance: 0.3, item: null, activeGroup: () => [] } });
  const P = { atk: mon.atk * 1.4 * 1.5, cdMul: 0.7, maxHp: mon.hp + 200, red: 0.4, regen: 3, level: 40, crit: 0.3 };
  const E = { hp: 6000, C: 15 };
  const start = G.startMoveOf(mon.dex);
  const pool = G.Moves.poolFor(mon);
  const prio = new Set(opts.priority || []);
  const mx = id => { const m = G.Moves.instance(id, G.Moves.BY_ID[id].maxLvl); if (G.Moves.EVO[id] && m.kind !== 'buff') G.Moves.evolve(m); return m; };
  // Grupo de referencia: los 3 mejores movimientos de daño por su techo.
  const dmg = pool.filter(id => G.Moves.BY_ID[id].kind !== 'buff')
    .map(id => ({ id, v: md.V([mx(id)], P, E) })).sort((a, b) => b.v - a.v);
  const worth = id => {
    const base = dmg.filter(d => d.id !== id).slice(0, 3).map(d => mx(d.id));
    return md.V(base.concat([mx(id)]), P, E) - md.V(base, P, E);
  };
  const avoid = new Set(opts.avoid || []);
  return pool.filter(id => id !== start && !prio.has(id))
    .map(id => ({ id, v: avoid.has(id) ? -99 : worth(id) }))
    .sort((a, b) => a.v - b.v).slice(0, 3).map(x => x.id);
};

// node sim/bots/cards.js 94 4 68  → vetos recomendados
if (require.main === module) {
  const { load } = require('../load');
  const { G } = load(1);
  for (const a of process.argv.slice(2)) {
    const mon = G.DEX_BY[+a];
    console.log(mon.dex, mon.name, module.exports.bans(mon, G).join(','));
  }
}
