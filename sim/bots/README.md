# Bots del simulador

Cada fichero `sim/bots/<nombre>.js` exporta una fábrica `(opts) => bot` (ver la
cabecera de `sim/engine.js` para la API). Se lanzan con
`node sim/run.js --bot <nombre> --opts '{"...":...}'`.

- **`best.js` — el mejor bot**: `pro-a.js` (movimiento, opciones de la ronda 4 apagadas) + `cards.js` v3
  (por defecto = v2) y sus vetos. Ver "Ronda 4: integración" abajo.
- `pa-f.js` — pro-a + cartas v2 congeladas (`cards-v2-frozen.js`), banco del movimiento.
- `flee.js` — referencia tonta: huye de lo cercano y coge la primera carta.
- `cards.js` — **sólo decisiones** (cartas, objetos, vínculos, 2.º movimiento, hueco activo). Sin movimiento propio.
- `flee-cards.js` — `flee.js` + `cards.js`, para probar las decisiones.
- `cards-v1.js`, `cards-v2.js`, `cards-v3.js` — las políticas v1, v2 y v3, congeladas (para comparar; `opts.cards = 'v1' | 'v2'`).
- `pro-a-frozen.js` — copia congelada de pro-a (commit c8f3101) para los experimentos de cartas; `opts.cardsFile` elige la política (por defecto `cards-v2`); `SIM_BANOPTS` cambia los vetos de `--ban auto`.
- `with-cards.js`, `spacer-v1.js`, `spacer-v2.js` — un bot de movimiento con otra política de cartas (A/B).

## cards.js — política de decisiones (v3 = v2 por defecto + opciones nuevas)

Se mezcla en un bot de movimiento:

```js
module.exports = (opts) => Object.assign(miMovimiento(opts), require('./cards')(opts));
```

Da `card` (o `'reroll'`), `item`, `bond`, `secondMove` y **`active`** (elige el hueco
activo: el "foco"). Conviene usar también `active`: al aprender un movimiento el juego
lo pone activo, y si es un potenciador (Danza Espada...) dejas de hacer daño.
`move`/`init`/`bans` existen pero no son enumerables: `--bot cards` funciona sola (con
el movimiento de `flee.js` o el de `opts.mover`) y al mezclarla no pisa al otro bot.

- `opts.cards = 'v1'` devuelve la política anterior, congelada en `cards-v1.js`
  (vale con cualquier bot que mezcle `cards.js`: `--opts '{"cards":"v1"}'`).
- `spacer-v1.js` / `spacer-v2.js`: spacer con una u otra (para A/B). Lo hace
  `with-cards.js`, que sirve para cualquier bot que haga `require('./cards')`:
  `require('./with-cards')('dodger', './cards-v1')`.

### Cómo decide

La partida se decide por el **grupo fusionado** (vínculos: todos sus movimientos se
lanzan a la vez desde un hueco). El plan:

1. **Un foco**: el hueco que más rinde (con histéresis y un plus por lo invertido). Sus
   mejoras valen enteras; se sube al máximo y se evoluciona cuanto antes. La stat de
   la evolución vale entera cuando el movimiento ya está al máximo (la evolución sale
   a la tanda siguiente) y un poco antes (`evoBonus`): en cuanto está al máximo esa
   stat sale siempre, así que cogerla antes sólo adelanta un par de niveles.
2. **Candidatos a vínculo**: los movimientos sueltos se ordenan por lo que sumarían
   al foco fusionados (sólo caben `4 − tamaño del grupo`). Aprenderlos y mejorarlos vale
   `bondK` (0,5) de lo que sumarían; 1 con un vínculo pendiente; casi nada pasado el
   min 27,5 (ya no hay grietas). Lo que no entra en el grupo vale `sideUp` (5 %).
   Un potenciador fusionado se relanza solo y queda siempre al máximo (Danza Espada
   nivel 5: ×2,8 de daño; Fortaleza: hasta el tope de 0,8 de reducción), y un
   cuerpo a cuerpo en el grupo da el −25 % de daño recibido: el modelo lo cuenta.
3. **Vínculo**: prueba todas las fusiones posibles y elige la que deja el mejor hueco.
   Con la Cinta Elección (no se puede cambiar de hueco) la fusión incluye el hueco activo.
4. **Cambio de cartas**: estima (con sus propios números aleatorios, sin gastar los
   del juego) lo que vale de media la mejor carta de una tanda nueva, con los pesos
   de `G.LevelUp.offer`; si es `rerollGain` más que la mejor de ahora, cambia.

Modelo (todo en logaritmos, `V(grupo) = wD·ln K + wT·ln T`):

- **K, derribos por segundo** = (daño directo + quemadura) / vida de los enemigos
  + `poisonK` · 2 %/s por cada acumulación de veneno que se mantiene
  (máx. 8 por enemigo, dura ~4 s). El daño directo sale de `move-dps.json` (escala por
  movimiento) y la fórmula (cómo cambia con nivel, Potencia y Reflejos; las torretas
  no notan Reflejos en su ritmo de disparo, sólo al ponerlas). Los golpes por segundo
  salen de ahí también: con ellos se cuentan acumulaciones de veneno y quemadura.
  La **vida de los enemigos** y cuántos hay cerca se leen de la partida
  (`G.EnemyMgr`; × `hpAhead`, porque las cartas son para siempre). Así el veneno
  (que quita % de vida) gana peso solo a medida que la vida enemiga crece.
  Infortunio ×1,56 si el grupo pone estados; críticos de la tienda; frenar +15 %.
- **T, aguante** = (vida + regeneración·20 s) / (1 − reducción) (tope 0,8; ÷0,75 con
  cuerpo a cuerpo en el hueco). Coraza: `min(0,7, reducción + 0,06)`, como el juego
  (con el Chaleco Asalto puesto incluso puede bajar).
- Stats: Potencia ×1,10 (tope 40), Reflejos ×0,92, Vigor, Coraza, Síntesis por el
  modelo; Carrera, Imán y Aprendizaje con un valor fijo que decrece; Baya Zidra y
  Vigor valen más con poca vida.
- Objetos: el mismo modelo (Chaleco +0,2 de reducción, Restos 1,5 %/s, Cinta ×1,4,
  Garra recarga ×0,8, Vidasfera ×1,3 con su coste de vida al doble...).

### Vetos (`bans`)

`require('./cards').bans(mon, G, opts)` → los 3 movimientos que menos suman al grupo
que se espera (los 3 mejores de su lista al máximo y evolucionados); nunca el inicial
ni los de `priority`; los de `avoid` primero; `opts.ban` (lista) manda.
Desde la consola: `node sim/bots/cards.js 94 4 68`. Se pasan con `run.js --ban a,b,c`
(el motor sólo aplica tantos como niveles de Veto: con `--upgrades max`, 3).

### Opciones (`opts`)

| opción | por defecto | qué hace |
|---|---|---|
| `cards` | — | `'v1'` / `'v2'` = usar la política v1 / v2 congelada (en pro-a también `'v2f'` = `cards-v2-frozen.js`) |
| `priority` | `[]` | ids preferidos, en orden: se aprenden (+1) y mejoran (+0,3) antes, y el primero que tengas es el foco |
| `avoid` | `[]` | ids que no se cogen nunca (ni en vínculos, si hay otra opción) |
| `statWeights` | `{}` | multiplicador por carta de stat: `{ hp, atk, spd, cd, def, rgn, mag, xp, heal }` (0 = nunca, salvo que sea lo único) |
| `statBonus` | `{}` | suma fija por carta de stat (forzar una hipótesis: `{ def: 1 }`) |
| `focus` | `'best'` | `'best'`, `'active'` (siempre el hueco 0) o un id |
| `maxMoves` | `16` | tope de movimientos aprendidos en total (fusionados incluidos), salvo los de `priority` |
| `itemRank` | `null` | lista de objetos de mejor a peor; si se da, manda sobre el modelo |
| `ban` | `null` | vetos fijos para `bans()` |
| `wD`, `wT` | `1`, `1` | peso de derribos/s y del aguante |
| `bondK` | `0.5` | cuánto vale hoy lo que sólo rinde fusionado |
| `poisonK` | `0.7` | peso del veneno frente al daño directo (mata despacio) |
| `hpAhead` | `1.5` | vida enemiga de referencia = la de ahora × esto |
| `switchK` | `1.8` | histéresis del foco |
| `startBias` | `2` | niveles de ventaja del movimiento inicial al elegir el foco |
| `kindMul` | `{ melee: 0.6, dash: 0.6, aura: 0.6, trail: 0.5, orbit: 0.8, nova: 0.7 }` | corrige la tabla por familia (se midió con la horda pegada) |
| `defCap` | `0.6` | reducción a partir de la cual Coraza vale la mitad |
| `evoBonus` | `0.15` | peso de coger la stat de una evolución antes de llegar al máximo |
| `fillBonus` | `0.03` | extra por llenar el último hueco (dejan de salir movimientos nuevos) |
| `aheadK` | `0.4` | una mejora vale también lo que abre (los niveles siguientes y la evolución, por carta) por este peso (Danza Espada nv3→4 sólo da duración, pero abre el nv5) |
| `sideUp` | `0.05` | fracción de una mejora fuera del plan |
| `rerollGain` | `0.08` | cambia las cartas si una tanda nueva vale de media esto más |
| `rerollBelow` | `0.02` | ... o si la mejor no llega a esto (y una tanda nueva sí) |
| `rerollUntil` | `80` | no cambia cartas pasado este nivel |
| `table` | `true` | `false` = sólo la fórmula, sin `move-dps.json` |
| `mover` | `'flee'` | movimiento con `--bot cards` sola |
| `log` | `false` | saca cada tanda con el valor de cada carta, los cambios y los vínculos |
| `reserve` | `false` | (19-10-2026) reservar huecos: mientras falten ataques de `priority` y queden justo esos huecos libres, no aprende ningún otro (con 4 huecos llenos no salen ataques nuevos). Imprescindible para priofast en la versión nueva |
| `start` | `'base'` | (19-10-2026) Movimiento inicial: `'base'` = el de serie, un id, o `'auto'` = el 1.º de `priority` que se pueda (o el que elija el modelo) |
| `tableLevel` | `false` | (19-10-2026) factor de `move-dps.json` por nivel en vez de uno por ataque (el modelo coincide con la tabla a cada nivel). Sin probar en partidas |

Ejemplos:

```
node sim/run.js --dex 94 --bot spacer --seeds 1-12 --upgrades max --jobs 3 --ban agility,substitute,toxic
node sim/run.js --dex 94 --bot spacer --opts '{"priority":["toxic-spikes","shadow-ball"],"poisonK":1}'
node sim/run.js --dex 68 --bot spacer --opts '{"statWeights":{"def":0},"itemRank":["choiceband","lifeorb"]}'
node sim/run.js --dex 4 --bot spacer --opts '{"cards":"v1"}'
```

### A/B v1 → v2 (spacer, `--upgrades max`, semillas 1-12, máx. 1900 s, 16-10-2026)

Tiempo de supervivencia (s): media geométrica / mediana · partidas que llegan a la
Sentencia (min 30). Vetos: los de `bans()` (abajo). Datos en `sim/out/cards/`.

| | Gengar (94) | Charmander (4) | Machamp (68) |
|---|---|---|---|
| v1 | 520 / 509 · 1 | 233 / 222 · 0 | 305 / 343 · 0 |
| v2 sin mirar adelante (`aheadK` 0) | 899 / 1690 · 6 | 489 / 405 · 2 | 579 / 529 · 2 |
| v2 `aheadK` 0, con vetos | 1109 / 1519 · 6 | 475 / 462 · 0 | 608 / 519 · 1 |
| **v2 (`aheadK` 0,4), con vetos** | **1144 / 1810 · 7** | **555 / 384 · 0** | **614 / 518 · 1** |
| v2 `aheadK` 0,8, con vetos | 1121 / 1564 · 6 | 862 / 1330 · 1 | 565 / 547 · 1 |

El ruido entre semillas es grande (±20 % en la media geométrica con 12 semillas).
Inmortal 30 min (semillas 1-6): v2 pierde muchas menos "vidas" (Gengar 12 frente a 22,
Charmander 31 frente a 256, Machamp 24 frente a 115) pero llega a menos nivel con Gengar
(55 frente a 68): prefiere aguante. `poisonK` 0,3 sube el nivel (64) pero vuelve a 27 vidas;
`wT` 0,6, 58 y 27.

Vetos recomendados (`node sim/bots/cards.js 94 4 68`): Gengar `agility,substitute,toxic`;
Charmander `agility,will-o-wisp,substitute`; Machamp `agility,substitute,hyper-voice`.


## cards.js v3 — experimentos de cartas (17/18-10-2026)

**Por defecto la v3 decide exactamente igual que la v2** (comprobado: mismas partidas). Ninguno
de los 15 cambios probados mejora el tiempo de forma clara y los que cambian mucho las
decisiones lo empeoran, así que la v3 deja las decisiones de la v2 y añade las opciones (apagadas)
para seguir probando. Guía para jugadores con los resultados: `sim/STRATEGY.md`.

Montaje: `pro-a-frozen` + la política (`--opts '{"cardsFile":"cards-v3",...}'`), `--upgrades max
--ban auto` (vetos de la v2 para todos), tope 1200 s, 8 Pokémon (94, 4, 68, 9, 25, 467, 469, 778)
× semillas 1-10 = 80 partidas emparejadas por variante; las prometedoras, otra vez en 61-75
(120 partidas). ×geo = media geométrica de t(variante)/t(v2) partida a partida, IC 95 % por
bootstrap. Herramientas: `node sim/cardlab.js pair A.json B.json` (emparejado, también Potencias
cogidas/ofrecidas, Coraza, Vigor...), `node sim/cardlab.js stats f.json`, `node sim/offerodds.js`
(probabilidad de que salga Potencia según el estado, con el código real de levelup.js).
`engine.js` apunta ahora en cada carta cogida las que había (`cards[i].of`). Datos: `sim/out/v3/`.

| opción nueva | qué hace | resultado (×geo, IC 95 %) |
|---|---|---|
| `statWeights: {atk: 2}` | Potencia vale el doble | 0,96 (0,87-1,09); semillas 61-75: 1,02 (0,89-1,12). +1 Potencia por partida |
| `potAfter: 1` | Potencia/Reflejos ×2 con el foco hecho | 0,93 (0,87-0,97) (casi nunca está "hecho" antes del min 20) |
| `potSnow` | Potencia/Reflejos + x·(lo que queda de 30 min) | no probada |
| `fillBonus: 0.3` (ya existía, 0,03) | llenar el último hueco cuanto antes | 0,93 (0,87-1,01) |
| `maxMoves: 3` (ya existía) | sólo 3 movimientos en total | **0,64 (0,54-0,77)** |
| `drainUp: 0.1` | con los 4 huecos llenos, subir lo suelto para que deje de salir | 0,91 (0,83-0,99) |
| `drainStat: 0.1` | topar Carrera/Imán/Aprendizaje/Reflejos/Coraza | 0,94 (0,83-1,03) |
| fill + drainUp + Potencia ×2 | "moldear el mazo" entero | 0,83 (0,75-0,92) |
| `sideUp: 0` (ya existía, 0,05) | nada a lo que está fuera del plan | 0,99 (0,88-1,10); 61-75: 0,97 (0,89-1,06) |
| `bondK: 1` (ya existía, 0,5) | invertir más en los compañeros de vínculo | 0,92 (0,80-1,10) |
| `defTarget: 0.5` | Coraza siempre hasta el 50 % | 0,76 (0,64-0,91) |
| `statWeights: {def: 0}` | nunca Coraza | 0,89 (0,79-1,03); Gengar 0,60 |
| `plan: ['substitute']` + sin vetarlo | Sustituto aprendido, al máximo y al grupo | **0,62 (0,52-0,74)**, peor en los 8 |
| `plan: ['swords-dance','dragon-dance']` | Danza Espada/Dragón al grupo siempre | 0,89 (0,76-1,07) |
| `avoid: ['swords-dance','dragon-dance']` | nunca Danza | 0,94 (0,86-1,04) |
| `itemAvoid: ['choiceband']` | nunca la Cinta Elección | 0,99 (0,93-1,04) |

Hasta la Sentencia (tope 1900 s; 94, 9, 25, 778 × semillas 61-70): Potencia ×2 **1,13 (0,91-1,38)**,
moldear el mazo 0,93 (0,74-1,21). Juntando todo, Potencia ×2: 1,02 (0,96-1,08) en 240 partidas;
moldear el mazo: 0,86 (0,77-0,97) en 120. Lo más prometedor para una ronda más larga: Potencia ×2
en partidas de 30 min con más semillas.

## move-dps.json

`node sim/calib-moves.js [--n 15] [--secs 30] [--seeds 1] [--jobs 3] [--only id,id]`
regenera la tabla (unos 15 min con 3 hilos). Condiciones: jugador invulnerable,
enemigos inmortales y siempre N alrededor, tipos y clima neutros, el jugador rodea a
la horda a la distancia que pide su ataque. Mide el ritmo de daño directo por unidad
de ataque (sin veneno ni quemadura). Ojo: con la horda pegada, lo que pega alrededor
(auras, cuerpo a cuerpo de 360°, rastros) sale muy favorecido; en una partida real
acercarse cuesta vida (por eso `kindMul`).

## pa-f.js — banco del movimiento (17-10-2026)

`pa-f.js` = `pro-a.js` + `cards-v2-frozen.js` (copia congelada de `cards.js` v2 con su
`move-dps-frozen.json`), para medir cambios del movimiento sin que cambien las cartas.
Con las opciones por defecto reproduce `best.js` de esa fecha (medianas 31:36 / 9:24 / 18:34 / 23:26).

- `node sim/xpaudit.js --bot pa-f --dex 94,4,68,9 --seeds 1-5 --max 1800`: experiencia soltada /
  recogida / en el suelo por minuto, imanes, altares y cofres vistos / usados.
- `node sim/paired.js base.json nuevo.json --min 10,20,30`: comparación emparejada (misma semilla).

Resultado (ronda 4, `sim/out/xp/`): se recoge el 99 % de la experiencia; altares el 67 % de los
vistos; cofres con candado sólo el 11 %, pero quedarse a abrirlos no sube el nivel y hace más daño.
Ninguna idea de movimiento (wp2, chestW, wLine, band) movió el nivel o los derribos fuera del ruido.

## Ronda 4: integración (18-10-2026, `sim/out/r4/`)

`best.js` = `pro-a.js` actual + `cards.js` v3 (sin `cards: 'v2'`; vetos de `cards.js`). No depende
de las copias congeladas (`pro-a-frozen.js`, `cards-v2*.js`, `pa-f.js`, `move-dps-frozen.json`),
que se quedan para reproducir los experimentos.

Comprobación en semillas nuevas 61-80, `--upgrades max --ban auto --max 1900`, 4 de referencia
(94, 4, 68, 9) + 4 supervivientes del barrido (130 Gyarados, 135 Jolteon, 855 Polteageist,
815 Cinderace), 160 partidas por lado: best anterior (`pro-a-frozen` + `cards-v2`) frente al nuevo
→ **las 160 partidas son idénticas** (tiempo, derribos, nivel). Era lo esperado: las dos rondas
dejaron sus opciones apagadas. Mediana 16:38, p10 6:25, 53/160 llegan al min 30
(nivel mediano en el min 30: 70; atkMul mediano ×2,25, ×3,00 en las que llegan al 30).

Tercer brazo, lo más prometedor de la v3 (`--opts '{"statWeights":{"atk":2}}'`, Potencia ×2), en las
mismas 160: ×1,04 (0,92-1,15), 60 ganadas / 60 perdidas, 55/160 al min 30, mediana 18:00, nivel en
el min 30 79, atkMul ×2,61. Sin efecto claro (con las 240 de antes, sigue ≈ ×1,02-1,04): no se adopta.
Resumen: `node sim/out/r4/sum.js A.json B.json` (o `node sim/cardlab.js pair A.json B.json`).

## Versión del 19-10-2026 (sim/FIDELITY.md, sim/RESULTS-v5.md)

`cards.js` usa el ataque de cada movimiento (físico o especial, ×1,2 monotipo), las danzas por
categoría (Danza Espada/Dragón físicos, Maquinación especiales), la defensa media de los enemigos y las
8 formas nuevas. `move-dps.json` recalibrado (la anterior: `move-dps-v1.json`). Por defecto decide
como antes salvo por eso. Receta priofast nueva: `{"priority":["meteor-mash","swords-dance","harden"],
"reserve":true,"statWeights":{"spd":3},"itemRank":[...Pañuelo primero...]}`.

