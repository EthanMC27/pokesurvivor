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

## Cuarta revisión (20-10-2026): merge de upstream hasta 11fe868 y Repertorio al azar

- **Repertorio era un fallo del simulador desde el principio**: en el juego el 2.º ataque es AL AZAR
  (`startRun`: `G.U.pick(pool)`), pero el motor dejaba que el bot lo eligiera (`bot.secondMove`). Todas las
  recetas medidas antes de esta fecha empiezan con el 2.º ataque elegido (Puño Meteoro con priofast), cosa
  que un jugador no puede hacer. Ahora es al azar por defecto; `o.pickSecond` (en `--opts`,
  `"pickSecond": true`) recupera lo de antes para reproducir resultados viejos.
- Upstream: los ataques que disparan bolas (`projectile`, `homing`, `bounce`) tienen `count` 1 y `spread`
  0,12 de base (antes "+1 proyectil" no sumaba en 15 de ellos): recalibrados en `move-dps.json` (los que
  rebotan, ×5 evolucionados). Infortunio y remolinos de un invitado ya funcionan en cooperativo (no afecta
  al solitario). Tope de 50 niveles de golpe en `gainXp` (sin efecto normal).
- `load.js`: `TextDecoder` (net/codec.js) y `top` (noframe.js). Selftest: todo bien.

## Cooperativo (sim/party.js, 20-10-2026)

- `sim/party.js` repite el bucle de `engine.js` con 2-4 jugadores, cada uno con su bot (ver su cabecera:
  experiencia del equipo con `xpFactor`, nivel común, cartas para cada uno, revivir, grieta para todos,
  cámara por jugador). G.Coop sigue inactivo: todos los jugadores son "del anfitrión" (sin copias ni
  fantasmas), que desde upstream 41c40a8 es lo que hace el juego también para los invitados (Infortunio y
  remolinos). Atajos de `load.js` para el grupo (`coop-owner`, `coop-hazards`, `coop-touch`), idénticos en
  solitario: selftest (con y sin atajos) y una partida de Lucario con el bot bueno, 600 s, idéntica.
- **Comprobado**: una party de 1 da la misma partida que `engine.runOne` (`node sim/party.js --check`).
- **La correa**: con los bots atados a 320 px del compañero, las parejas caían en el minuto 7-8 (1/12 al
  minuto 20); sin correa, 9/12, como en solitario (8/12). Por defecto, sin correa: cada bot juega a lo suyo
  y casi nunca levanta al compañero caído. Es lo mínimo de un grupo sin coordinarse.
- Diferencias que quedan: el clima y la cura del Pokémon perdido sólo para el anfitrión; altares
  compartidos; una sola recarga del toque de Arceus.

## Quinta revisión (21-10-2026): merge de upstream hasta ce57853 ("la gran actualización")

### Qué cambió en la lógica del juego [CÓDIGO]

- **Naturaleza** de cada Pokémon (`data/natures.js`, `systems/mons.js`): +10 % a un stat y −10 % a otro
  (`pa`, `sa`, `df`, `sd`, `spd`; 5 neutras). `G.Mons.monFor(dex)` da una copia con ella aplicada y
  `startRun` juega con esa copia. La que te toca es fija por cuenta y Pokémon (hash de `save.created` + dex);
  se cambia con una **Menta** (1.500 monedas, Tienda Kecleon).
- **Habilidad** (`data/abilities.js`, efectos en `data/ability-fx.js`): una de las 2-3 suyas (la oculta sale
  1 de cada 20; se cambia con Cápsula Habilidad, 1.500, o la Oculta, 5.000). Ganchos en `Player.hurt`
  (absorber un tipo, esquivar, ×daño recibido, Robustez), `Player.heal`, `Player.spd`, `Combat.hit` y los
  disparos (×daño hecho, críticos ×2 de Francotirador, Potencia Bruta quita estados, Dicha los dobla), el
  contacto, las trampas, las explosiones kamikaze, la lava y los derrotados (Autoestima, Ultraimpulso).
  Las que no tienen efecto propio dan **+8 % con los ataques de su tipo principal**. Ejemplos que importan:
  Potencia/Energía Pura +50 % a los físicos; Ultraimpulso/Autoestima +0,5 % por derrota hasta +15 %;
  Entusiasmo +25 % a los físicos pero 1 de cada 6 sale a ×0,3 (×1,09 de media); Robustez salva de un golpe
  letal cada 90 s; Pereza (Truant) ×1,35 de daño con ×1,6 de recarga (pierde).
- **MT** (`data/tms.js`): ataques que no son de sus tipos (`save.ptm`). Salen en sus cartas y valen de
  Movimiento inicial (`G.Moves.poolFor` y `G.startChoices` los incluyen). 8 MT a la venta cada día.
- **Segundo movimiento inicial** (mejora `start2`, 400, necesita Repertorio): eliges el 2.º ataque en vez
  de al azar (`G.startMove2Of`, sin potenciadores, como `startChoices`). **Con esta mejora Repertorio deja
  de ser al azar.**
- Cartas: sólo cambia la etiqueta (físico/especial aparte). Kamikazes: su zona lleva `boom` (Humedad).
- Cooperativo: mirar a un compañero estando caído (sólo cámara; no se simula).

### Cambios en el simulador

1. **`engine.js`**: `o.nature` (por defecto `'serious'`, neutra: los stats de siempre), `o.abil` (hueco
   0/1/2 o id; **por defecto el hueco 0**, como un jugador sin Cápsula al que le tocó la 1.ª; `'none'` = sin
   habilidad, lo de antes del 21-10), `o.tms` y `o.start2` (sólo con la mejora `start2` y Repertorio). Se
   escriben en el guardado falso (`save.pnat/pabil/ptm`) y se usa `G.Mons.monFor` y `pl.setAbility`, como
   `startRun`. El resultado lleva `nature` y `abil`. `run.js`: `--nature --abil --tms --start2` (o en `--opts`).
   `party.js` y `partysweep.js`: los mismos campos por miembro.
2. **`load.js`**: los atajos `coop-owner` y `coop-hazards` se rehicieron sobre el código nuevo (los
   disparos usan también la habilidad de su dueño; Humedad en las zonas). Selftest: con y sin atajos,
   idéntica; `party.js --check` ok.
3. **`calib-moves.js`**: Ditto mide sin habilidad (`abil: 'none'`).
4. `selftest.js`: naturaleza en una copia, habilidad por defecto, Sebo ×0,6 al Fuego, MT como inicial y
   Segundo movimiento inicial.

### Sin revisar a fondo (pendiente)

- **Los bots no saben de habilidades.** `pro-a` predice el daño que recibe sin `inMul`, esquivas,
  absorciones ni Robustez (va de prudente), y `bots/cards.js` no valora las habilidades al elegir cartas ni
  la naturaleza más allá de lo que ya lee de `pl.mon` (que sí la lleva). Tampoco sabe de Levitación (agua y
  trampas) ni de Humedad.
- Ninguna medida anterior al 21-10 tiene habilidad: comparar con ellas exige `--abil none`.
- `move-dps.json` no cambia (ningún ataque cambió en `moves.js`), pero sus números no incluyen habilidades.
- La naturaleza "real" de cada cuenta depende de `save.created`: el simulador no la reproduce (usa la que
  se le diga).

### Añadido el 22-10-2026

- **Calibración**: `calib-moves.js` con 4 ataques × 3 semillas da exactamente lo mismo con el código de antes
  del merge (1b55950) y el de ahora: `move-dps.json` sigue valiendo (ningún ataque cambió). [MEDIDO]
- **Bot**: `cards.js` multiplica el daño de cada ataque por la habilidad (`abilK`, gancho `out` con el estado
  de ahora; Entusiasmo con su media, sin gastar números aleatorios): neutro en 80 parejas. `pro-a.js` tiene
  `inK` (defensa por categoría + habilidad al predecir golpes) **apagado** (`opts.inK`): en 80 parejas llegó al
  minuto 20 en 15 frente a 24. Congelados: `best-pre22` (el de ayer), `best-c22` (= best actual).
- `o.abil: 'best' | 'best-h'` (`sim/abilpick.js`): la habilidad que parece mejor con una nota fija por
  habilidad [CONJETURA para ordenar la criba; lo importante se midió hueco a hueco en `RESULTS-v6.md` §6].
- **Determinismo**: tras un corte de corriente, dos colas hicieron las mismas 40 partidas: idénticas.
- Sigue sin modelar en el bot: esquivas, absorciones, Robustez, Levitación (agua y trampas) y Humedad.
