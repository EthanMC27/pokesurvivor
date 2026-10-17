/* ============ sim/bots/cards.js — política de DECISIONES (no de movimiento) ============
 *
 * Elige cartas de nivel, objetos, vínculos, el 2º movimiento inicial y el hueco
 * activo. Los bots de movimiento la mezclan:  Object.assign(mover, cards(opts)).
 *
 * Idea: todo se mide en dos ejes con el modelo de abajo y se compara en log:
 *   D  daño por segundo estimado del hueco que se usa (el "foco")
 *   T  aguante: vida efectiva = (vida + regen·20 s) / (1 - reducción)
 *   valor(carta) = wD·ln(D'/D) + wT·ln(T'/T) + extras (evolución, experiencia...)
 * Con los números reales de los movimientos (G.Moves.instance / levelUp / evolve),
 * así una carta de Reflejos no vale nada a un movimiento de órbita, etc.
 *
 * En el juego sólo dispara el hueco ACTIVO (salvo vínculos): aprender muchos
 * movimientos sólo sirve como opción (vínculos, cambiar de foco); las mejoras de
 * movimientos fuera del foco valen poco. Ver README.md para las opciones.
 */
module.exports = (opts = {}) => {
  const o = Object.assign({
    wD: 1.0,               // peso del daño
    wT: 1.0,               // peso del aguante
    priority: [],          // movimientos preferidos (en orden) para aprender/mejorar/foco
    avoid: [],             // movimientos que nunca se cogen
    statWeights: {},       // multiplicador por carta de stat: { hp, atk, spd, cd, def, rgn, mag, xp, heal }
    statBonus: {},         // suma fija por carta de stat (para forzar hipótesis)
    maxMoves: 4,           // deja de aprender movimientos con N
    focus: 'best',         // 'best' (el de más daño estimado) | 'active' (siempre el del hueco 0) | id de movimiento
    switchK: 2.0,          // el foco cambia a otro hueco sólo si éste rinde switchK veces más
    startBias: 2,          // niveles "de regalo" del movimiento inicial al elegir el foco
    defCap: 0.6,           // a partir de esta reducción la Coraza vale la mitad
    kindMul: {},           // multiplicador de daño estimado por familia (p. ej. { melee: 0.5 } si el bot no se acerca)
    newMoveValue: 0.05,    // valor base de aprender un movimiento (opción de vínculo / llenar huecos)
    fillBonus: 0.05,       // extra por el movimiento que llena el último hueco
    sideUp: 0.15,          // fracción del valor de mejorar un movimiento que no es el foco
    evoBonus: 1.0,         // peso de "preparar" la evolución del foco (coger su stat pronto)
    itemRank: null,        // lista de objetos de mejor a peor (si no, se valoran con el modelo)
    table: true,           // usar sim/bots/move-dps.json (medido) si existe; false = sólo la fórmula
    log: false
  }, opts);
  // Lo que no es un número de peso queda fuera de la comparación.
  // La tabla se midió con la horda pegada al jugador: lo que obliga a estar cerca
  // (cuerpo a cuerpo, auras, rastros, embestidas) sale inflado y además cuesta vida.
  const KM = Object.assign({ melee: 0.6, dash: 0.6, aura: 0.6, trail: 0.5, orbit: 0.8, nova: 0.7 }, o.kindMul);
  const prio = id => { const i = o.priority.indexOf(id); return i < 0 ? 0 : o.priority.length - i; };

  // ---------------- modelo de daño ----------------

  // Enemigos tocados por lanzamiento, según la forma del ataque.
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

  /** Daño/s DIRECTO estimado con la fórmula (sin estados ni ajustes por familia). */
  function formula(m, P) {
    if (m.kind === 'buff') return 0;
    const atk = P.atk;
    if (m.kind === 'orbit') {
      // Los orbes no usan la recarga del jugador (rehit = cd del movimiento).
      return m.dmg * atk * m.count * 0.5 * (m.speed / 2.4) * (m.radius / 62) * Math.min(1, 0.3 / Math.max(0.12, m.cd));
    }
    const cdE = Math.max(0.05, m.cd * P.cdMul);
    if (m.kind === 'turret') {
      const up = Math.min(Math.max(1, m.count | 0), (m.dur || 6) / cdE);
      return m.dmg * atk * up / (m.rate || 0.6) * (1 + 0.5 * geo(m.pierce));
    }
    if (m.kind === 'trail') {
      // Cada charco pega cada 0,5 s a lo que lo pisa; hay más cuanto más duran.
      return m.dmg * atk * 2 * 1.5 * (m.radius / 26) ** 2 * Math.sqrt((m.dur || 3) / 3) * Math.min(1.3, 0.3 / cdE) ** 0.3;
    }
    return m.dmg * atk * HITS[m.kind](m) / cdE;
  }

  // Tabla medida con sim/calib-moves.js (daño directo/s por unidad de ataque, por nivel).
  // Si está, manda ella; la fórmula sólo pone cómo cambia con Potencia/Reflejos.
  let TABLE = null, FSCALE = 1;
  if (o.table !== false) {
    try { TABLE = require('./move-dps.json'); } catch (e) { TABLE = null; }
  }
  const ONE = { atk: 1, cdMul: 1 };
  // La tabla sale ruidosa nivel a nivel (una semilla, 30 s): sólo se usa para
  // ajustar la ESCALA de cada movimiento (media geométrica tabla/fórmula de todos
  // sus niveles); cómo crece de nivel a nivel lo pone la fórmula.
  const FACT = {};
  let scaled = false;
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
  function core(m, P) {
    if (TABLE && !scaled && G) calibrate();
    return formula(m, P) * (FACT[m.id] || FSCALE);
  }

  /** Daño/s de una instancia `m` con las stats `P` ({ atk, cdMul, min, level }). */
  function rawDps(m, P) {
    if (m.kind === 'buff') return 0;
    let d = core(m, P);
    // Estados: el veneno quita un % de la vida (crece con la partida), la quemadura sube con el nivel.
    const min = P.min || 0;
    if (m.poison) d *= 1 + Math.min(2, m.poison * (0.35 + 0.04 * min));
    if (m.burn) d *= 1 + Math.min(1.5, m.burn * (0.2 + 0.02 * (P.level || 1)));
    if (m.slow) d *= 1 + 0.25 * m.slow;     // frena = menos golpes recibidos y más tiempo en área
    return d * (KM[m.kind] || 1);
  }

  /** Daño/s de un grupo (hueco). Los potenciadores fusionados se quedan siempre al máximo. */
  function groupDps(g, P) {
    let atkK = 1;
    const status = g.some(m => m.poison || m.burn || m.slow);
    for (const m of g) if (m.kind === 'buff' && m.stat === 'atk' && m.cd * P.cdMul < m.dur) atkK += (m.stacks | 0) * m.amount;
    let d = 0;
    for (const m of g) {
      let x = rawDps(m, P);
      if (m.hex) x *= status ? 1 + (m.hex - 1) * 0.8 : 1 + (m.hex - 1) * 0.25;
      d += x;
    }
    // Si el grupo sólo es un potenciador, no hace daño.
    return d * atkK;
  }

  /** Aguante del grupo activo `g` con las stats `P`. */
  function tough(g, P) {
    let red = P.red, regen = P.regen, hp = P.maxHp;
    for (const m of g || []) {
      if (m.kind !== 'buff' || m.cd * P.cdMul >= m.dur) continue;
      if (m.stat === 'def') red += (m.stacks | 0) * m.amount;
      if (m.stat === 'regen') regen += (m.stacks | 0) * m.amount;
    }
    red = Math.min(0.8, red);
    let k = 1 / (1 - red);
    if (g && g.some(m => m.kind === 'melee')) k /= 0.75;
    return (hp + Math.max(-hp * 0.5, regen) * 20) * k * (P.spdK || 1);
  }

  function snap(pl, time) {
    return {
      atk: pl.baseAtk * pl.atkMul, cdMul: pl.cdMul, maxHp: pl.maxHp, hp: pl.hp, red: pl.dmgReduce,
      regen: pl.regenFlat + (pl.item === 'shellbell' ? 3 : 0) - (pl.item === 'lifeorb' ? lifeOrbDrain(pl) : 0),
      level: pl.level, min: (time || 0) / 60, spdK: 1
    };
  }
  function lifeOrbDrain(pl) {
    let casts = 0;
    for (const m of pl.activeGroup()) if (m.kind !== 'orbit' && m.kind !== 'trail') casts += 1 / Math.max(0.12, m.cd * pl.cdMul);
    return pl.maxHp * 0.01 * casts;
  }

  // ---------------- foco: el hueco que se usa ----------------

  let focusCache = { t: -1, i: 0, n: -1 };
  let focusId = null;            // movimiento que lleva el foco (para no cambiar a cada rato)
  function focusSlot(pl, P) {
    const S = pl.slots;
    if (!S.length) return 0;
    if (o.focus === 'active') return 0;
    // Un movimiento elegido (prioridad u opción focus): su hueco.
    const want = typeof o.focus === 'string' && o.focus !== 'best' ? [o.focus].concat(o.priority) : o.priority;
    for (const id of want) {
      const i = S.findIndex(g => g.some(m => m.id === id && m.kind !== 'buff'));
      if (i >= 0) return i;
    }
    P = P || snap(pl, curTime);
    const val = g => {
      // Un vínculo vale por todo el grupo; se suma algo de "lo invertido" para no saltar de foco.
      // El movimiento inicial cuenta como 2 niveles invertidos (es el pensado para ese Pokémon).
      const inv = g.reduce((a, m) => a + (m.lvl - 1) + (m.evolved ? 3 : 0) + (m === pl.moves[0] ? o.startBias : 0), 0);
      return groupDps(g, P) * (1 + 0.08 * inv);
    };
    let best = 0, bv = -1;
    S.forEach((g, i) => { const v = val(g); if (v > bv) { bv = v; best = i; } });
    // Histéresis: sólo se cambia de foco si el otro es claramente mejor.
    const cur = S.findIndex(g => g.some(m => m.id === focusId));
    if (cur >= 0 && cur !== best && bv < o.switchK * val(S[cur])) best = cur;
    const lead = S[best].find(m => m.kind !== 'buff');
    if (lead) focusId = lead.id;
    return best;
  }

  // Lo mejor que puede llegar a ser un movimiento (nivel máximo y evolucionado).
  function potential(id, P) {
    const m = G.Moves.instance(id, G.Moves.BY_ID[id].maxLvl);
    if (G.Moves.EVO[id]) G.Moves.evolve(m);
    return rawDps(m, P);
  }

  // ---------------- valor de una carta ----------------

  let G = null, curTime = 0;
  const L = x => Math.log(Math.max(1e-9, x));

  function score(card, pl, time) {
    const P = snap(pl, time);
    const fi = focusSlot(pl, P);
    const F = pl.slots[fi] || [];
    const D0 = Math.max(1e-6, groupDps(F, P));
    const T0 = tough(F, P);
    const [type, id] = card.key.split(':');
    const hpFrac = pl.hp / pl.maxHp;
    const urgent = hpFrac < 0.35 ? 2 : hpFrac < 0.6 ? 1.3 : 1;

    if (type === 'evo') return 10;     // siempre

    if (type === 'up') {
      const m = pl.moves.find(x => x.id === id);
      if (!m) return 0;
      const c = Object.assign({}, m); G.Moves.levelUp(c);
      const slot = pl.slots.findIndex(g => g.includes(m));
      const g2 = pl.slots[slot].map(x => x === m ? c : x);
      let v;
      if (slot === fi) v = o.wD * L(groupDps(g2, P) / D0) + o.wT * L(tough(g2, P) / T0);
      else {
        // Fuera del foco: vale si lo adelanta, si no un poco (vínculos, cambio de foco).
        const D2 = groupDps(g2, P);
        v = D2 > o.switchK * D0 ? o.wD * L(D2 / D0) : o.sideUp * o.wD * L(D2 / Math.max(1e-6, groupDps(pl.slots[slot], P)));
      }
      // Acercarse al máximo abre la evolución: un empujón al foco.
      if (slot === fi && G.Moves.EVO[id] && c.lvl === c.def.maxLvl) v += 0.05;
      return v + 0.3 * prio(id);
    }

    if (type === 'new') {
      if (o.avoid.includes(id)) return -9;
      if (pl.moves.length >= o.maxMoves && !prio(id)) return -1;
      const def = G.Moves.BY_ID[id];
      const m = G.Moves.instance(id, 1);
      let v = o.newMoveValue;
      if (def.kind === 'buff') v = o.newMoveValue * 0.3;   // sólo útil en un vínculo
      // Con los huecos llenos dejan de salir cartas de movimiento nuevo: salen más
      // mejoras y stats (en el reparto de cartas pesan 7 en vez de 4).
      if (pl.slots.length + 1 >= pl.maxMoves) v += o.fillBonus;
      else {
        const d1 = rawDps(m, P);
        if (d1 > o.switchK * D0) v += o.wD * L(d1 / D0);
        // Al principio, un movimiento con más techo puede pasar a ser el foco.
        const pot = potential(id, P), potF = F.length ? Math.max(...F.map(x => x.kind === 'buff' ? 0 : potential(x.id, P))) : 0;
        const invested = F.reduce((a, x) => a + x.lvl - 1 + (x.evolved ? 3 : 0), 0);
        if (pot > potF * 1.5 && invested <= 1) v += 0.2 * o.wD * L(pot / potF) * (1 - invested / 2);
      }
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
      let dv = o.wD * L(groupDps(F, P2) / D0);
      let tv = o.wT * L(tough(F, P2) / T0) * (id === 'heal' ? 0 : urgent);
      if (id === 'def' && P.red >= o.defCap) tv *= 0.5;
      v += dv + tv;
      // Preparar la evolución: la stat que pide el foco (o un prioritario), cuanto antes.
      for (const m of pl.moves) {
        const e = G.Moves.EVO[m.id];
        if (!e || e[1] !== id || taken > 0 || m.evolved || m.kind === 'buff') continue;
        if (!F.includes(m) && !prio(m.id)) continue;
        const c = G.Moves.instance(m.id, m.def.maxLvl), c2 = Object.assign({}, c); G.Moves.evolve(c2);
        const gain = L(rawDps(c2, P) / Math.max(1e-6, rawDps(c, P)));
        v += o.evoBonus * gain * (0.35 + 0.65 * (m.lvl - 1) / (m.def.maxLvl - 1));
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
    // Se evalúa sin el objeto que se lleva (se quita su efecto en el modelo).
    const P = snap(pl, curTime);
    const cur = pl.item;
    if (cur === 'choiceband') P.atk /= 1.4;
    if (cur === 'lifeorb') { P.atk /= 1.3; P.regen += lifeOrbDrain(pl); }
    if (cur === 'quickclaw') P.cdMul /= 0.8;
    if (cur === 'assaultvest') P.red -= 0.2;
    if (cur === 'leftovers') P.regen -= pl.maxHp * 0.015;
    if (cur === 'shellbell') P.regen -= 3;
    const F = pl.slots[focusSlot(pl)] || [];
    const D0 = Math.max(1e-6, groupDps(F, P)), T0 = tough(F, P);
    const P2 = Object.assign({}, P);
    let v = 0;
    switch (id) {
      case 'leftovers':   P2.regen += pl.maxHp * 0.015; break;
      case 'choiceband':  P2.atk *= 1.4; v -= 0.03; break;                 // no deja cambiar de foco
      case 'quickclaw':   P2.cdMul *= 0.8; break;
      case 'focussash':   v += 0.08; break;
      case 'shellbell':   P2.regen += 3; break;
      case 'amuletcoin':  v -= 0.05; break;
      case 'luckyegg':    v += 0.08 * Math.exp(-pl.level / 25); break;
      case 'lifeorb': {
        P2.atk *= 1.3;
        let casts = 0;
        for (const m of F) if (m.kind !== 'orbit' && m.kind !== 'trail') casts += 1 / Math.max(0.12, m.cd * P.cdMul);
        P2.regen -= 2 * pl.maxHp * 0.01 * casts;   // deja la vida baja: pesa el doble
        break;
      }
      case 'choicescarf': v += 0.07; break;
      case 'rockyhelmet': v += 0.04; break;
      case 'assaultvest': P2.red = P.red + 0.2; break;
    }
    return v + o.wD * L(groupDps(F, P2) / D0) + o.wT * L(tough(F, P2) / T0);
  }

  // ---------------- vínculos ----------------

  function groupValue(g, P) { return o.wD * L(Math.max(1e-6, groupDps(g, P))) + o.wT * L(tough(g, P)); }

  const bot = {
    name: 'cards',

    card(cards, api) {
      G = api.G; curTime = api.time;
      let bi = 0, bv = -Infinity;
      cards.forEach((c, i) => { const v = score(c, api.pl, api.time); if (v > bv) { bv = v; bi = i; } });
      if (o.log) console.log(`[${Math.round(api.time)}s nv${api.pl.level}] ` + cards.map((c, i) => (i === bi ? '*' : '') + c.key + '=' + score(c, api.pl, api.time).toFixed(3)).join('  '));
      return bi;
    },

    item(curId, nextId, api) {
      G = api.G; curTime = api.time;
      const pl = api.pl;
      return itemScore(nextId, pl) > itemScore(curId, pl) + 0.01 ? nextId : curId;
    },

    bond(opt, api) {
      G = api.G; curTime = api.time;
      const pl = api.pl, P = snap(pl, api.time);
      const loose = opt.loose.filter(m => !o.avoid.includes(m.id));
      let best = null, bv = -Infinity;
      if (opt.mode === 'add') {
        for (const m of loose) { const v = groupValue(opt.group.concat([m]), P); if (v > bv) { bv = v; best = [m]; } }
      } else {
        for (let i = 0; i < loose.length; i++) for (let j = i + 1; j < loose.length; j++) {
          const g = [loose[i], loose[j]];
          if (g.every(m => m.kind === 'buff')) continue;
          const v = groupValue(g, P);
          if (v > bv) { bv = v; best = g; }
        }
        // El que más pega va primero (da nombre al hueco).
        if (best) best.sort((a, b) => rawDps(b, P) - rawDps(a, P));
      }
      return best || [];
    },

    secondMove(pool, api) {
      G = api.G; curTime = 0;
      const P = snap(api.pl, 0);
      const ok = pool.filter(id => !o.avoid.includes(id));
      for (const id of o.priority) if (ok.includes(id)) return id;
      let best = ok[0], bv = -1;
      for (const id of ok) { const v = potential(id, P) * 0.5 + rawDps(G.Moves.instance(id, 1), P) * 4; if (v > bv) { bv = v; best = id; } }
      return best;
    },

    /** Hueco activo: el foco (cacheado; se recalcula cada 0,5 s o si cambian los huecos). */
    active(api) {
      G = api.G; curTime = api.time;
      const pl = api.pl;
      if (api.time - focusCache.t > 0.5 || focusCache.n !== pl.slots.length) {
        focusCache = { t: api.time, i: focusSlot(pl), n: pl.slots.length };
      }
      return focusCache.i;
    },

    // Para otros bots / depuración.
    _model: { rawDps, groupDps, tough, snap, focusSlot: pl => focusSlot(pl) }
  };
  // Para poder probarla sola (--bot cards) lleva el movimiento de flee.js (o el de
  // opts.mover), pero NO enumerable: al mezclarla con otro bot no le pisa su move().
  // Se crea al primer uso (si otro bot nos mezcla, nunca se crea: sin require circular).
  let mover = null;
  const mv = () => mover || (mover = require('./' + (o.mover || 'flee'))(Object.assign({}, o, { mover: undefined })));
  Object.defineProperty(bot, 'move', { value: a => mv().move(a), enumerable: false });
  Object.defineProperty(bot, 'init', { value: a => { if (mv().init) mover.init(a); }, enumerable: false });
  return bot;
};
