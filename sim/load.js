/* ============ sim/load.js — el código REAL del juego dentro de Node ============
 * Carga los scripts de dev.html (en su orden) en un contexto aislado de `vm`
 * con un navegador falso: todo lo que dibuja o suena es un "agujero negro"
 * que acepta cualquier llamada. Cada llamada a load() da un juego limpio
 * (los sistemas guardan estado en sus cierres, así que no se comparte nada).
 *
 * Math.random va con semilla (mulberry32) y performance.now con el reloj de la
 * simulación (empieza en 1 h): misma semilla + mismo bot = misma partida.
 *
 * Lo que se salta (SKIP) es sólo interfaz, red, guardado y arranque; lo que
 * la lógica usa de ello lo pone engine.js (G.Game, G.DB, G.Social...). Ver
 * sim/FIDELITY.md.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function hole() {
  const f = function () { return p; };
  const p = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      return p;
    },
    set() { return true; },
    apply() { return p; },
    construct() { return p; },
    has() { return true; }
  });
  return p;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Lo que no hace falta para simular el combate (interfaz, red, guardado, arranque).
const SKIP = /(\/ui\/|\/net\/social|\/net\/ranking|db\.js|firebase|updater\.js|game\.js|main\.js)/;

/*
 * Atajos de velocidad (sólo en memoria; los ficheros del juego no se tocan). Cada uno
 * hace EXACTAMENTE lo mismo que el original, más deprisa; si el texto del juego cambia y
 * el atajo ya no encaja, no se aplica (y se avisa una vez). SIM_NOPATCH=1 los quita todos
 * (para comprobar que dan lo mismo: `node sim/selftest.js` lo hace).
 *
 * world.js: terrainAt/propAtTile buscaban el chunk con una clave de texto ("cx,cy") en
 * cada consulta (cientos de miles por segundo: pathing, colisiones, rocas). Ahora una
 * caché numérica que apunta al MISMO objeto del mapa `data`; se vacía cada vez que `data`
 * borra algo (expulsión de chunks viejos, arena, reset), así que nunca da un chunk que el
 * juego ya no tendría.
 */
const PATCHES = [
  { file: /world\/world\.js$/, name: 'world-chunk-cache', edits: [
    // Caché de chunks: último usado + mapa numérico (cx -> cy -> chunk). Se vacía con
    // cualquier borrado de `data`. Y el terreno puro de cada chunk (sin arena, sólo
    // depende de la semilla) se recuerda para cuando un chunk expulsado se vuelve a crear
    // (el juego guarda 400 y expulsa el más antiguo); los objetos se colocan como siempre.
    { from: 'const data = new Map();',
      to: 'const data = new Map(); let __fk = new Map(), __lx = 0, __ly = 0, __lc = null; const __terr = new Map(); ' +
          '{ const d0 = data.delete.bind(data), c0 = data.clear.bind(data); ' +
          'data.delete = k => { __fk = new Map(); __lc = null; return d0(k); }; ' +
          'data.clear = () => { __fk = new Map(); __lc = null; __terr.clear(); return c0(); }; } ' +
          'function __chunk(cx, cy) { if (__lc !== null && cx === __lx && cy === __ly) return __lc; ' +
          'let m = __fk.get(cx); if (m === undefined) { m = new Map(); __fk.set(cx, m); } let c = m.get(cy); ' +
          "if (c === undefined) { c = data.get(cx + ',' + cy) || chunkData(cx, cy); m.set(cy, c); } " +
          '__lx = cx; __ly = cy; __lc = c; return c; } ' +
          // Terreno puro (sin arena) de una casilla: del chunk recordado si lo hay (placeProps
          // mira las 8 vecinas de cada casilla con terrainRaw: era lo más caro al crear chunks).
          'function __raw(tx, ty) { if (arena) return terrainRaw(tx, ty); const cx = Math.floor(tx / N), cy = Math.floor(ty / N); ' +
          "const k = cx + ',' + cy; let t = __terr.get(k); if (!t) { t = new Uint8Array(N * N); " +
          'for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) t[j * N + i] = terrainRaw(cx * N + i, cy * N + j); __terr.set(k, t); } ' +
          'return t[(ty - cy * N) * N + (tx - cx * N)]; } ' +
          // propAt: el mismo Map de siempre ("tx,ty" -> objeto sólido) con una copia en una tabla
          // por casilla del chunk, para consultarla sin construir la clave de texto.
          'class __PA extends Map { constructor() { super(); this.a = new Array(N * N).fill(undefined); } ' +
          '  static i(k) { const j = k.indexOf(","), tx = +k.slice(0, j), ty = +k.slice(j + 1); return (((ty % N) + N) % N) * N + (((tx % N) + N) % N); } ' +
          '  set(k, v) { this.a[__PA.i(k)] = v; return super.set(k, v); } ' +
          '  delete(k) { this.a[__PA.i(k)] = undefined; return super.delete(k); } ' +
          '  clear() { this.a.fill(undefined); return super.clear(); } }',
      count: 1 },
    { from: "const c = data.get(cx + ',' + cy) || chunkData(cx, cy);", to: 'const c = __chunk(cx, cy);', count: 2 },
    { from: "    return c.propAt.get(tx + ',' + ty) || null;",
      to: '    return c.propAt.a[(ty - cy * N) * N + (tx - cx * N)] || null;', count: 1 },
    { from: '        if (terrainRaw(tx + a, ty + b) !== FLOOR) { open = false; break; }',
      to: '        if (__raw(tx + a, ty + b) !== FLOOR) { open = false; break; }', count: 1 },
    { from: '      const t = terrainRaw(tx, ty);\n      c.terr[j * N + i] = t;',
      to: '      const t = __tc ? __tc[j * N + i] : terrainRaw(tx, ty);\n      c.terr[j * N + i] = t;', count: 1 },
    { from: '          props: [], propAt: new Map(), liquids: [] };\n',
      to: '          props: [], propAt: new __PA(), liquids: [] };\n    const __tc = arena ? null : __terr.get(k);\n', count: 1 },
    { from: '    if (data.size > MAX_DATA) data.delete(data.keys().next().value);',
      to: '    if (!arena && !__tc) __terr.set(k, c.terr.slice());\n    if (data.size > MAX_DATA) data.delete(data.keys().next().value);', count: 1 }
  ] }
];
/*
 * Para el cooperativo (sim/party.js, 20-10-2026). En solitario dan EXACTAMENTE lo mismo (cada disparo es
 * del único jugador y everyone() = [jugador]); en grupo hacen lo que cada ordenador hace con su Pokémon:
 *   combat.js   los golpes de un disparo se apuntan a su dueño (crítico, daño hecho, Concha Sonora, drenaje),
 *               no a quien se le pasa a resolve();
 *   hazards.js  una zona avisada daña a todos los que pilla (no sólo a G.Game.player);
 *   judgment.js el toque de Arceus se comprueba con cada jugador.
 */
PATCHES.push(
  { file: /systems\/combat\.js$/, name: 'coop-owner', edits: [
    // (21-10-2026: con habilidades, el crítico, los estados y abilOut/afterHit también son del dueño del disparo)
    { from: '        const crit = isCrit(pl), sk = statusK(pl);\n        const k = (p.mtype ? typeK(p.mtype, e) : 1) * G.Stats.taken(e.mon, p.mcat) * (crit ? critMul(pl) : 1) * abilOut(pl, p.src, e);',
      to: '        const ow = p.owner || pl, crit = isCrit(ow), sk = statusK(ow);\n        const k = (p.mtype ? typeK(p.mtype, e) : 1) * G.Stats.taken(e.mon, p.mcat) * (crit ? critMul(ow) : 1) * abilOut(ow, p.src, e);', count: 1 },
    { from: '        pl.dmgDealt += p.dmg * k;', to: '        ow.dmgDealt += p.dmg * k;', count: 1 },
    { from: '        pl.onDealt(p.dmg * k);', to: '        ow.onDealt(p.dmg * k);', count: 1 },
    { from: '        if (p.drain) pl.heal(p.drain);', to: '        if (p.drain) ow.heal(p.drain);', count: 1 },
    { from: '        afterHit(pl, e, p.src);', to: '        afterHit(ow, e, p.src);', count: 1 }
  ] },
  { file: /systems\/hazards\.js$/, name: 'coop-hazards', edits: [
    { from: '        if (pl && !pl.dead && inside(h, pl.x, pl.y, pl.r) && !(h.boom && pl.abil && pl.abil.damp)) {',
      to: '        for (const pl of (G.Game.everyone ? G.Game.everyone() : [G.Game.player])) if (pl && !pl.dead && inside(h, pl.x, pl.y, pl.r) && !(h.boom && pl.abil && pl.abil.damp)) {', count: 1 }
  ] },
  { file: /systems\/judgment\.js$/, name: 'coop-touch', edits: [
    { from: '    touch(pl);\n    ember(dt);', to: '    for (const p of (G.Game.everyone ? G.Game.everyone() : [pl])) touch(p);\n    ember(dt);', count: 1 }
  ] }
);
const NOPATCH = !!process.env.SIM_NOPATCH;
const PATCHED = [];

function patch(f, src) {
  if (NOPATCH) return src;
  for (const P of PATCHES) {
    if (!P.file.test(f)) continue;
    let out = src, okAll = true;
    const nl = src.includes('\r\n') ? '\r\n' : '\n';      // (los ficheros pueden venir con CRLF)
    for (const e of P.edits) {
      const from = e.from.split('\n').join(nl), to = e.to.split('\n').join(nl);
      const n = out.split(from).length - 1;
      if (n !== e.count) { okAll = false; break; }
      out = out.split(from).join(to);
    }
    if (okAll) { src = out; PATCHED.push(P.name); }
    else console.warn('[sim] atajo "' + P.name + '" no aplicado: ' + f + ' ha cambiado (se usa el código tal cual)');
  }
  return src;
}

let FILES = null, SOURCES = null;
function sources() {
  if (SOURCES) return SOURCES;
  const html = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8');
  FILES = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1].split('?')[0])
    .filter(f => !/^https?:/.test(f) && !SKIP.test(f));
  // Compilados una vez; cada contexto los ejecuta de nuevo.
  SOURCES = FILES.map(f => new vm.Script(patch(f, fs.readFileSync(path.join(ROOT, f), 'utf8')), { filename: f }));
  return SOURCES;
}

function load(seed = 1) {
  const H = hole();
  const store = {};
  const M = Object.create(null);
  for (const k of Object.getOwnPropertyNames(Math)) M[k] = Math[k];
  M.random = mulberry32(seed >>> 0);
  const ctx = {
    console, Math: M, Date, JSON, Set, Map, WeakMap, WeakSet, Array, Object, Promise, Symbol, Number, String, Error, Boolean, RegExp, Reflect, Proxy,
    isFinite, isNaN, parseInt, parseFloat,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    // performance.now() no empieza en 0: en el navegador la página lleva rato
    // abierta (menú). Con 0, la Banda Focus (sashT = -999 ms, recarga de 60 s)
    // no funcionaba el primer minuto.
    __now: 3600e3,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: H, navigator: { userAgent: 'node', language: 'es' }, location: { search: '', hostname: 'localhost', href: '', pathname: '/' },
    Image: function () { return H; }, Audio: function () { return H; }, AudioContext: function () { return H; },
    fetch: () => new Promise(() => {}), addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }), innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    ImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    OffscreenCanvas: function () { return H; }, screen: { width: 1280, height: 720 },
    // i18n.js (18-10-2026) envuelve fillText/strokeText del prototipo del canvas.
    CanvasRenderingContext2D: Object.assign(function () {}, { prototype: { fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }) } }),
    URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto,      // TextDecoder: net/codec.js (20-10-2026)
    Uint8ClampedArray, Uint8Array, Float32Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float64Array, ArrayBuffer, DataView
  };
  ctx.performance = { now: () => ctx.__now };
  ctx.window = ctx; ctx.self = ctx; ctx.top = ctx; ctx.globalThis = ctx;   // top: noframe.js (no estamos en un marco)
  vm.createContext(ctx);
  for (const s of sources()) s.runInContext(ctx);
  return { ctx, G: ctx.G };
}

module.exports = { load, hole, ROOT, patched: () => (sources(), PATCHED.slice()) };
