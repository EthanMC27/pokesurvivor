# Fidelidad del simulador (sim/)

Revisión de `sim/engine.js` y `sim/load.js` frente a `js/game.js` (16-10-2026).
Comprobación rápida: `node sim/selftest.js` (1-2 min). Segunda revisión, más abajo.

## Qué se simula tal cual

- **Todo el código de juego es el real.** `load.js` ejecuta los scripts de `dev.html`
  en su orden y sólo salta interfaz (`js/ui/`), red social/ranking, `db.js`,
  `firebase-config.js`, `updater.js`, `game.js` y `main.js`.
- **Bucle de `update()`** en el mismo orden: jugador → cámara → mundo → rutas →
  oleadas → enemigos → combate → proyectiles → campos → recogidas → zonas avisadas →
  objetos del mapa → grieta → Sentencia → eventos → clima → efectos.
- **Inicio de partida** como `startRun()`: mismos `reset()`, semilla del mapa sacada
  del mismo generador, Repertorio (2.º movimiento sin potenciadores ni vetados),
  Veto (`o.ban`, con el tope de la mejora) y Atajos (`o.bind`).
- **Recogidas** como `onCollect()` en solitario: experiencia, monedas, curación 30 %,
  imán, bomba (sólo lo que se ve en pantalla), tickets y objetos (sin objeto se pone;
  el mismo, nada; otro, elige el bot).
- **Subida de nivel** como `maybeLevelUp()`: una tanda de 3 cartas por fotograma,
  nunca con el Pokémon caído; los niveles pendientes esperan. Cambio de cartas:
  1 gratis + los de la mejora.
- **Vínculos** como `offerBond()`: fuera de la arena, vivo y sin cartas abiertas en
  ese fotograma; si no hay dos movimientos sueltos se guarda. No se puede rechazar.
- **Grieta**: entrar, arena, caer dentro (te devuelve con 30 % de vida, la partida sigue).
- **Sentencia de Arceus** (min 30): la animación para el reloj (10,1 s) y no se salta,
  como la primera vez; después, pelea sin límite.
- **Muerte** fuera de la arena: el reloj se para y la partida acaba (1,3 s de animación).
- Eventos (horda, hora dorada, Pokémon perdido), duendes del tesoro, clima, manantiales,
  altares, cofres y trampas: es el código real, sin cambios.
- Cámara de 768×432 (cualquier pantalla 16:9): de ella dependen dónde salen los
  enemigos, los rezagados, la bomba y qué disparos se descartan.
- Determinismo: `Math.random` con semilla y `performance.now` con el reloj simulado.

## Arreglado en esta revisión

1. **Banda Focus muerta el primer minuto.** `performance.now()` empezaba en 0 y la
   banda exige `now - sashT > 60000` con `sashT = -999`. Ahora empieza en 1 h.
2. **Todas las cartas pendientes en el mismo fotograma.** El juego enseña una tanda
   por fotograma y entre una y otra pasa un fotograma de juego. Ahora igual.
3. **Faltaba el cambio de cartas** (1 gratis + mejora "Cambio de cartas"). Nuevo:
   `bot.card` puede devolver `'reroll'` o el bot puede tener `bot.reroll(cards, api)`.
4. **Vínculo rechazable.** Si el bot devolvía `[]` se perdía el vínculo, cosa imposible en
   el juego. Ahora una respuesta no válida fusiona lo de por defecto.
5. **Objeto inventado.** Si `bot.item` devolvía un id que no era ni el actual ni el
   nuevo, se equipaba. Ahora sólo vale uno de los dos.
6. **Repertorio** cogía también movimientos vetados y `bot.secondMove` recibía una api
   a medias; ahora con Veto y la api completa. Faltaban Veto y Atajos (`o.ban`, `o.bind`).
7. Bomba sin sacudida de cámara (la sacudida gasta números aleatorios); en la animación
   de la Sentencia faltaban `pl.anim` y `FX.update`; `G.Game.state` no existía;
   `G.DB.save` sin `legends` ni `stats.judged`.
8. Añadidos (compatibles): `api.rerollsLeft()`, `api.dt`; en `sense()`: `event`, `lost`,
   `weather`, `arceus {x, y, r}`; en el resultado: `timeExact`, `rerolls`,
   `pendingLevels`, `frames`. `o.dt` y `run.js --dt 1/60 --ban a,b --bind '{...}'`.

Revisado sin problemas: `G.Coop` se carga y está inactivo; `G.Settings` es el real
(calidad 'auto' alta, sólo cambia efectos visuales); nada de la lógica lee `G.UI`,
`G.HUD`, `G.Icons` ni `G.Ranking` (los agujeros sólo se usan para dibujar);
`G.Progress` sólo apunta logros (salvo `kill`, ver abajo); `G.onRescue` y `G.onShinyCaught` sólo dan monedas.

## Segunda revisión (16-10-2026, tarde)

### La Sentencia: "0 legendarios" era un fallo del simulador (sólo del contador)

`G.Progress.kill(e)` no es sólo de logros: en la Sentencia llama a `G.Judgment.bossDown()`,
que es lo que cuenta los legendarios vencidos. `engine.js` vaciaba todo `G.Progress`, así que
`judge.bosses` salía **siempre 0**, aunque los legendarios sí caían (la pelea era la real).
Arreglado: `Progress.kill` vuelve a avisar a la Sentencia. No cambia ninguna partida (sólo el contador).

Lo que pasa de verdad (Gengar, spacer, inmortal, semillas 1 y 3, nivel 152 y 177):
- 1.er legendario: 126.000 y 203.000 de vida (3 s de su mejor daño a un enemigo: 42.000 y
  68.000 por segundo; el suelo de la fórmula es ~6.000). Cada uno el doble que el anterior.
- En 160 s salen 32 y caen **28 y 26**, aunque el 25.º tenga 3·10¹² de vida: el veneno
  (8 cargas × 1,2 % de la vida máxima cada 0,6 s, también a los legendarios) mata a cualquiera
  en unos 6-10 s. Es el juego tal cual: con veneno al máximo, la vida de los legendarios no importa.
- Lo que acaba la Sentencia en el juego es el **daño**: cada legendario pega el doble que el
  anterior (el 10.º, 512 veces el 1.º). En inmortal no se puede caer, así que la Sentencia sólo
  termina con `maxTime` y las "vidas" de esa parte se disparan (millones). Por eso ahora hay
  `lives30` (vidas antes de la Sentencia) y `--mortal-judge` (inmortal hasta el minuto 30 y
  la Sentencia de verdad: la partida acaba al caer).
  Con `--mortal-judge` esas dos partidas (llegan al minuto 30 con nivel 149 y 175) aguantan
  **24 y 29 s** en la Sentencia y vencen **3 legendarios** cada una: lo normal es caer pronto.

Nuevo en `result.judge`: `base` (vida del 1.er legendario), `single` (daño por segundo a un
enemigo medido antes), `spawned` y `log` [{ dex, hp, at, down }] (segundo de pelea en que sale
y en que cae, o null).

### Qué es el modo inmortal (`o.immortal`, `--immortal`)

- Cada golpe se calcula con el código real (`Player.hurt`: tipos, clima, reducción, cuerpo a
  cuerpo, invulnerabilidad de 0,45 s) pero no se aplica: se suma en `lives` (en vidas máximas
  de ese momento). `lives30` = las de antes de la Sentencia; `curve[m].lives` por minuto.
- **Arreglado**: antes, un golpe mayor que la vida que quedaba hacía saltar la **Banda Focus**
  (gastaba su recarga y daba 1,2 s de invulnerabilidad en vez de 0,45) o "mataba" al Pokémon un
  instante, y eso **borraba sus órbitas** (`clearOrbs`). Ahora el golpe se calcula con una vida
  enorme y se deshace: ni Banda Focus ni caída. Cambia algunas partidas inmortales respecto a
  las de antes (las que recibían golpes letales: sobre todo pasado el minuto 15).
- No cubre lo que no pasa por `hurt`: el clima de arena/nieve quita un 1,2 % cada 2 s sin
  matar nunca (como en el juego), y eso sí baja la vida y no cuenta en `lives`.
- **Grietas**: sin caer no se pierden nunca (sólo por tiempo), así que hay más vínculos que en
  una partida de verdad. `--mortal-rifts` (`o.mortalRifts`): dentro de la grieta el daño es
  real; si caes, la grieta se pierde y vuelves con el 30 % (lo del juego) y sigues inmortal.
- **Sentencia**: ver arriba; `--mortal-judge` (`o.mortalJudge`) para medirla.
- La curación, la regeneración y todo lo demás funcionan igual (la vida casi siempre está llena).

### Más rápido sin cambiar nada (load.js)

`load.js` aplica en memoria unos atajos a `world.js` (los ficheros del juego no se tocan):
caché numérica de chunks para `terrainAt`/`propAtTile` (antes, una clave de texto en cada
consulta: cientos de miles por segundo con el pathing y las colisiones), tabla por casilla de
los objetos sólidos y el terreno puro de cada chunk recordado (el juego guarda 400 chunks y
expulsa el más antiguo, y al volver los regeneraba). Dan exactamente lo mismo: mismos objetos,
misma expulsión, mismos números aleatorios. Si el texto de `world.js` cambia, el atajo no se
aplica (avisa). `SIM_NOPATCH=1` los quita; `selftest.js` comprueba que con y sin dan la misma
partida. Mejora medida (máquina compartida, en paralelo con la versión sin atajos): 11 % menos tiempo en una partida
de 30 min con spacer (605 → 539 s, idéntica) y 20 % con forager (277 → 221 s, idéntica).
`run.js` reutiliza los hilos (cada partida carga el juego y el bot de cero).

Lo que más cuesta ahora es del juego (enemigos, pathing, colisiones) y del bot (`spacer.move`
y su `predict`, ~20 %).

## Diferencias que quedan

- **Paso de 1/30 s.** El juego usa `min(1/30, fotograma real)`: a 60 FPS va a 1/60.
  1/30 es lo que tiene un aparato lento, así que es válido; las colisiones de disparos
  son barridas. En 9 partidas de prueba (dodger, Gengar) 1/30 y 1/60 dieron lo mismo
  dentro del ruido (mediana 186 s frente a 190 s). Para confirmar algo fino: `--dt 1/60`.
- **Misma semilla ≠ misma partida del navegador.** En el juego, el dibujo (clima, grieta,
  menú) también gasta `Math.random`; aquí no. Las estadísticas son las mismas.
- **Pausas.** En el juego, la recarga de la Banda Focus sigue contando con las cartas
  abiertas (va con el reloj real); aquí sólo cuenta el tiempo simulado.
- **Cuenta nueva.** Todos los legendarios igual de probables en las grietas (en una
  cuenta veterana, los no vencidos salen 4 veces más). Pokémon no shiny (sólo cambia el aspecto).
- **Pantalla 16:9.** En móviles más alargados la vista es más ancha y los enemigos
  salen un poco más lejos.
- **El bot lo ve todo.** `sense().enemies` incluye a los que están fuera de la pantalla, y el
  bot puede moverse en cualquier ángulo y con cualquier intensidad (como el joystick
  táctil; el teclado sólo da 8 direcciones). Un bot que use esto juega "mejor que un humano".
- **Sólo solitario.** El cooperativo (escalado de vida, revivir, pausas compartidas) no se simula.
- Tras caer, el juego mueve los enemigos 1,3 s más a cámara lenta; aquí no (no cambia nada).
- `sense()` calcula `props` (objetos a 420 px) aunque el bot no lo use; eso puede crear algún
  chunk un poco antes que el juego (el juego crea los que ve la cámara). Sólo cambia el orden
  de expulsión de chunks lejanos; se deja así para no cambiar las partidas ya medidas.

## Herramientas

- `node sim/run.js --dex 4,94,68 --bot spacer --seeds 1-20 --upgrades max --jobs 3 [--ban auto]
  [--immortal [--mortal-rifts] [--mortal-judge]] [--table] [--json x.json]`: con varios Pokémon,
  tabla por Pokémon y total. `--ban auto` usa `bans` del bot o de `bots/cards.js` (array,
  `{ dex: [...] }` o función `(dex, G)`); si no existe, sin vetos.
- `node sim/compare.js a.json b.json ... [--by dex] [--csv]`: tabla comparativa (tiempo
  mediana/media/p10/p90, nivel, derrotados, jefes, vínculos, ≥30 min, vidas antes de la
  Sentencia y legendarios vencidos en ella).

## Tercera revisión: versión del 19-10-2026 (merge de upstream/main, 12 commits desde 5bbc3b2)

### Qué cambió en la lógica del juego [CÓDIGO]

- **Físico y especial** (`js/systems/stats.js`, nuevo). Cada ataque tiene `cat` (`moves.js`: lista
  `PHYSICAL`; el resto especiales; los potenciadores, ninguna). El jugador pega con
  `Player.atkFor(m) = atk · fit · danza de su lado · monotipo`, donde `atk` sigue siendo el mayor de
  Ataque y At. Esp. (`mon.atk`) y `fit = (pa o sa) / atk` (1 con los de su lado bueno, menos con los
  otros: Gholdengo con Puño Meteoro 0,72). Los enemigos se defienden con su Defensa o su Def. Esp.:
  `guard(def) = clamp((75/def)^0,35, 0,78, 1,25)` (hasta −22 % con mucha, +25 % con poca). Tú también:
  cada enemigo pega con su lado fuerte (`Enemy.cat`) y lo para tu defensa de esa categoría
  (`Player.hurt(amount, type, pure, cat)`: 4.º argumento nuevo; zonas, disparos y contacto lo pasan).
- **Danzas**: Danza Espada y Danza Dragón suben `patk` (sólo físicos); **Maquinación** (nueva, grupo
  Normal: la puede aprender cualquiera) sube `satk` (sólo especiales). Mismos números que Danza Espada.
- **Monotipos**: ×1,2 de daño con los ataques de su tipo (`Player.MONO_K`).
- **Cartas** (`levelup.js`): los movimientos nuevos de su lado bueno salen el doble (`pickWeighted`,
  peso 2 frente a 1). Gasta los números aleatorios de otra forma que `pickN`.
- **Aprender un ataque ya no lo pone activo** (`addMove`): sólo si no tenías ninguno.
- **Movimiento inicial** (mejora nueva `start`, 1 nivel): eliges con qué ataque empiezas
  (`G.startChoices`: los de su lista sin potenciadores, y el de serie). Con Repertorio, el 2.º sale
  al azar de los demás.
- **38 ataques nuevos** con 8 formas nuevas: `homing` (persiguen), `bounce` (rebotan hasta `bounce`
  veces a <220 px), `charge` (se cargan 0,75 s y sale un rayo), `spin` (giro: `count` golpes
  alrededor cada 0,13 s), `quake` (ondas en línea cada 34 px), `vortex` (remolino que atrae y daña
  cada 0,4 s, 2 a la vez como mucho), `shove` (onda que daña y empuja; no a los jefes), `stun` (zona
  con aviso de 0,45 s que daña y aturde; a los jefes ×0,35). Aturdido = ni se mueve ni pega por contacto.
- **Veneno**: con más de 60.000 de vida máxima el % se aplica a una vida "efectiva"
  `60.000·√(vida/60.000)` (`enemy.js`, `pctHp`). Sólo afecta a los legendarios de la Sentencia (los
  enemigos y jefes normales no pasan de 60.000): con 6 millones, como si tuviera 600.000.
- **Sentencia contra la huida** (`judgment.js`): velocidad del jugador con tope suave (lo que pase de
  130 cuenta un 25 %) mientras dure; los legendarios corren al menos al 80 % de la tuya; desde los 5
  min de Sentencia Arceus acelera y desde los 7 su toque quita cada vez más (100 % a los 10).
- **Jefes que ya no se vuelven inmatables**: curas y escudos sobre un jefe limitados por el daño que
  le haces (`rd`, ~0,4 s y ~1,2 s de tu daño); como mucho 3 curanderos, 3 escuderos y 3 invocadores
  vivos (`spawner.js`). Un jefe a más de 2.500 px vuelve a salir cerca a los 4 s.
- Mando y "Apuntar a mano" (Accesibilidad): apagado por defecto (`G.Settings.get('aimManual')`);
  el simulador no lo usa. Idiomas (`js/core/locales.js`, `js/boot.js`, `i18n.js`): sólo textos.

### Cambios en el simulador

1. **`load.js`**: `i18n.js` envuelve `CanvasRenderingContext2D.prototype` → se da uno vacío;
   `location.pathname`. Se cargan `locales.js`, `boot.js`, `gamepad.js` y `stats.js` (son de
   `dev.html`; los dos primeros sólo tocan textos). El atajo de `world.js` **sigue aplicándose**
   (selftest: con y sin atajos, idéntica).
2. **`engine.js`**: el envoltorio de `pl.hurt` **perdía el 4.º argumento** (la categoría): sin
   arreglarlo, el jugador nunca usaría su Defensa ni su Def. Esp. Arreglado y comprobado en selftest
   (Chansey recibe ×1,41 de un físico que de un especial, como el código).
   Movimiento inicial: `o.start` sólo vale con la mejora y si está en `G.startChoices` (si no, aviso y
   el de serie); sin `o.start`, `bot.startMove(choices, api)` si existe (`o.forceStart` para las
   herramientas). Los vetos se ponen antes de que el bot elija.
3. **`bots/cards.js`**: el modelo usa `atkOf(m, P)` (categoría y monotipo), las danzas por
   categoría (`patk`, `satk`), la defensa media de los enemigos del mapa por categoría, y las 8 formas
   nuevas (curva por nivel en `HITS`; aturdir y empujón cuentan como frenar). Las cartas de
   movimiento nuevo de su lado bueno pesan el doble al estimar una tanda nueva (cambio de cartas).
   `startMove`: por defecto `start: 'base'` (el de serie, como antes); `'auto'` = el modelo elige.
   `bans()` recibe las `--opts` (`run.js`, `sweep.js`, `best.js`): nunca veta los de `priority` ni el
   inicial elegido. Antes los vetos automáticos no veían `priority`.
4. **`bots/pro-a.js`**: distancias y alcance de las formas nuevas (`bandFor`, `reachOf`) y `startMove`.
5. **`calib-moves.js`**: divide por `Player.atkFor(m)` (Ditto es Normal puro: sin esto los ataques
   Normales salían ×1,2) y neutraliza `G.Stats.taken`; distancias de las formas nuevas; `--out`.
   `move-dps.json` recalibrado entero (3 semillas); la tabla anterior queda en `move-dps-v1.json`.

Revisado sin cambios: `G.Pad` (gamepad.js) no encuentra mando (`navigator.getGamepads` no existe) y
`rumble` no hace nada; `handAim` devuelve null (ajuste apagado); `m.since` usa `G.Game.st.time`, que
el motor ya daba. El aturdimiento y los empujones son código del juego: no necesitan nada del motor.
