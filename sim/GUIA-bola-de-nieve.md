# Guía de bola de nieve: Acero y Puño Meteoro

Guía práctica para un jugador **humano** que quiere ganar matando mucho y subiendo mucho de
nivel, sin quedarse sólo en huir. El tiempo que aguantas sigue siendo lo que cuenta.

Escenario de todas las pruebas: tienda de Mejoras al máximo, 3 vetos automáticos y el mejor bot
del simulador (`--bot best`). Cada afirmación lleva una etiqueta:

- **[MEDIDO]**: sale de partidas simuladas. Se indica cuántas.
- **[CÓDIGO]**: sale directamente de las reglas del juego (`js/`), sin azar.
- **[CONJETURA]**: razonamiento o tendencia sin prueba suficiente. Tómalo con cautela.

Ojo: el bot no juega como una persona. Esquiva peor que un buen jugador en algunos momentos y mejor
en otros. Los números sirven para **comparar** builds entre sí, no como promesa de tiempo.

---

## 1. Resumen en 30 segundos

1. Coge un Pokémon de **Acero** rápido: **Kartana, Archaludon, Gholdengo o Cobalion**. [MEDIDO]
2. Segundo movimiento inicial (Repertorio): **Puño Meteoro**. [MEDIDO]
3. En el primer minuto, **Danza Espada y Fortaleza** en cuanto salgan. [MEDIDO]
4. Sube Puño Meteoro al 5 y coge **Potencia** para evolucionarlo hacia el minuto 2. [CÓDIGO + MEDIDO]
5. Primer vínculo: **Puño Meteoro + Danza Espada + Fortaleza**. Cuarto miembro, según el Pokémon. [MEDIDO]
6. Objeto: **Pañuelo Elección siempre que salga**. Nunca la Cinta Elección. [MEDIDO]
7. El momento peligroso es el **minuto 8-10**: la horda te rodea. No te quedes quieto. [MEDIDO]

---

## 2. Por qué Puño Meteoro hace bola de nieve

### 2.1 Cómo funciona [CÓDIGO]

`js/data/moves.js` y `js/systems/combat.js`:

| fase | meteoros | daño (×Ataque) | radio | recarga |
|---|---|---|---|---|
| nivel 1 | 2 | 34 | 54 | 1,4 s |
| nv 2: +1 meteoro | 3 | 34 | 54 | 1,4 s |
| nv 3: +45 % daño | 3 | 49 | 54 | 1,4 s |
| nv 4: +30 % radio | 3 | 49 | 70 | 1,4 s |
| nv 5: +2 meteoros y −20 % recarga | 5 | 49 | 70 | 1,12 s |
| **evolución "Bomba Imán"** (pide Potencia): ×1,7 daño, +2 meteoros, ×1,2 radio | **7** | **84** | **84** | 1,12 s |

- Cada meteoro cae **sobre un enemigo cercano al azar** y daña a **todo** lo que hay en su círculo.
  Es daño de área repartido por la horda, no daño a un solo objetivo.
- La tier list del fan lo pone en **B** porque mide daño a un solo objetivo. En una horda densa
  pega a muchos a la vez, y por eso rinde mucho más de lo que dice esa nota. [CONJETURA sobre el
  criterio de la tier list]
- Sólo lo aprenden los Pokémon de tipo **Acero** (el repertorio = movimientos Normal + los de tus
  tipos, `poolFor`).

### 2.2 La rueda de la bola de nieve [CÓDIGO + MEDIDO]

1. **Más muertes → más experiencia → más niveles.** Cada nivel trae una tanda de 3 cartas. [CÓDIGO]
2. **Más cartas → más Potencia.** Cada Potencia es ×1,1 al ataque. El tope son 40 cartas:
   ×1,4 de la tienda × 1,1^40 = **×63,4**. [CÓDIGO]
3. **Más ataque → mueren antes → más experiencia.** Y vuelta a empezar.
4. Resultado: en el minuto 15 los Pokémon de Acero con Puño Meteoro van por el **nivel ~100**.
   El resto del juego va por el **~50**. [MEDIDO, 524 partidas, semillas 111-130]
5. Potencia sale más cuando tienes **los 4 huecos llenos** (pesa 7 en vez de 4). Un hueco libre
   llena la tanda de movimientos nuevos. [CÓDIGO, ver `STRATEGY.md` sección 1]

### 2.3 El precio: la horda no se para [CÓDIGO]

Lo que dice el código (`js/systems/spawner.js`, `js/data/enemies.js`):

- **La fuerza de los enemigos sólo depende del minuto, no de cuánto mates.** La vida crece con
  ×(1 + t/95) y el daño con ×(1 + t/420).
- **El mapa admite 64 enemigos.** Si no matas, se llena y deja de salir gente: la horda se "congela".
  Si matas rápido, se liberan sitios y **siguen llegando enemigos a todo ritmo**, más las mareas.
- Con **54 o más enemigos vivos**, los nuevos salen **élite**: ×1,6 de vida, ×1,25 de daño
  y ×1,6 de experiencia.

Lo que esto quiere decir para jugar:

- Matar mucho **no hace a los enemigos más fuertes**, pero hace que **te lleguen más**.
  Una build de bola de nieve vive siempre rodeada.
- Si tu daño se queda corto aunque sea un momento, la horda se acumula muy rápido.
  Esto es lo que mata en el minuto 8-10 (sección 7). [CONJETURA sobre la causa; el momento está MEDIDO]

---

## 3. Qué Pokémon coger

### 3.1 Los cuatro recomendados

Cómo conseguirlos [CÓDIGO, `js/systems/gacha.js`]: cada tirada da rareza 4 con un 6,5 % y rareza 5
con un 1,5 %. A las 70 tiradas sin un 5 en ese banner, el siguiente es 5 seguro.
Las tiradas de la última columna son una **estimación** que supone un reparto igual dentro de cada
rareza del banner. [CONJETURA]

| Pokémon | tipos | rareza | legendario | banner | tiradas aprox. para uno concreto | velocidad base |
|---|---|---|---|---|---|---|
| **Kartana** (798) | Planta/Acero | 4 | no | gen 7 (20 de rareza 4) | ~300 | 124 |
| **Gholdengo** (1000) | Acero/Fantasma | 4 | no | gen 9 (30 de rareza 4) | ~460 | 113 |
| **Archaludon** (1018) | Acero/Dragón | 5 | no | gen 9 (12 de rareza 5) | ~500 | 114 |
| **Cobalion** (638) | Acero/Lucha | 5 | **sí** | gen 5 (14 de rareza 5) | ~600 | 123 |

### 3.2 Cómo les va: ronda fuerte frente a confirmación

Bot normal, sin la build afinada. Ronda fuerte: semillas 101-110, 10 partidas.
Confirmación: semillas 111-130, 20 partidas nuevas (`sim/out/confirm1.jsonl`).

| Pokémon | llegan al min 30 (fuerte → confirm.) | mediana de tiempo (confirm.) | nivel min 15 (fuerte → confirm.) | nivel min 30 (confirm.) | tope de Potencia (confirm.) |
|---|---|---|---|---|---|
| Kartana | 5/10 → 7/20 | 9:54 | 109 → 98 | 183 | 2/20 |
| Gholdengo | 4/10 → **12/20** | 30:49 | 93 → 100 | 172 | 4/20 |
| Cobalion | 5/10 → **13/20** | 31:14 | 88 → 100 | 194 | **7/20** |
| Genesect (649, leg.) | 4/10 → 9/20 | 25:42 | 75 → 82 | 123 | 1/20 |
| Magnezone (462) | **0/10 → 5/20** | 11:06 | 72 → 105 | 221 | 4/20 |

Lo que se sostiene [MEDIDO]:

- **El nivel de ~100 en el minuto 15 se confirma** en los cuatro. Es el doble que la media del resto
  (50 en 524 partidas).
- **Gholdengo y Cobalion** aguantan más de lo que parecía: 12-13 de 20 llegan al minuto 30.
  Están entre los más fiables de la confirmación. Marshadow, el mejor en supervivencia, saca 14 de 20.
- **Kartana es el que más mata, pero es frágil** con el bot normal: mediana de 9:54.
  Con la build de la sección 4 cambia mucho.
- **Magnezone no era 0 de 10**: fue mala suerte de la ronda fuerte. Aun así es el más lento.
- Archaludon no estaba en la confirmación. Su dato de 20 semillas sale de la sección 4.

### 3.3 Más Pokémon de Acero (barrido completo) [MEDIDO, 10 partidas cada uno]

Barrido `sim/out/steel1.jsonl`: los 61 Pokémon de Acero (610 partidas), semillas 201-210,
**bot normal** (sin la build afinada). Con 10 semillas el ruido es grande. Los que mejor salen:

| Pokémon | rareza | legendario | llegan al min 30 | mediana | nivel min 15 | nivel min 30 | derrotados (mediana) |
|---|---|---|---|---|---|---|---|
| Cobalion | 5 | sí | 6/10 | 31:40 | 98 | 182 | 8.847 |
| Scizor (212) | 4 | no | 6/10 | 31:40 | 89 | 144 | 6.307 |
| Genesect | 5 | sí | 5/10 | 31:40 | 96 | 159 | 4.413 |
| Klinklang (601) | 4 | no | 5/10 | 31:15 | 97 | 214 | 5.677 |
| **Togedemaru (777)** | **3** | no | 5/10 | 31:10 | 101 | 163 | 4.873 |
| **Pawniard (624)** | **2** | no | 5/10 | 30:52 | 95 | 159 | 3.906 |
| Dialga (483) | 5 | sí | 5/10 | 30:11 | 110 | 232 | **21.692** |
| Lucario (448) | 4 | no | 4/10 | 26:33 | 106 | 223 | 2.901 |

- **Si no tienes ninguno de los cuatro**, Pawniard (rareza 2) y Togedemaru (rareza 3) son las
  opciones baratas que mejor salen. [MEDIDO, 10 partidas: tómalo como pista, no como prueba]
- **Dialga** es la bola de nieve más fuerte del barrido: 5 de 10 llegan al tope de Potencia.
  [MEDIDO, 10 partidas]
- Hay Pokémon de **muchísimo nivel pero que mueren pronto** con el bot normal: Klink (rareza 1)
  y Ferroseed (rareza 1) van por el nivel 115 en el minuto 15, pero su mediana es de unos 7 minutos.
  La build de la sección 4 podría ayudarles, pero **no se ha probado**. [CONJETURA]
- En el barrido, 583 de las 610 partidas evolucionaron Puño Meteoro en el grupo principal hacia el
  minuto 1:30. Las 25 que no lo evolucionaron murieron en una mediana de 3:04. [MEDIDO]
- **Con Puño Meteoro evolucionado, casi cualquier Pokémon de Acero hace bola de nieve**: incluso
  los de rareza 1-2 (Klink, Ferroseed, Meltan, Varoom, Klefki) van por el nivel 110-116 en el
  minuto 15. Lo que separa a los buenos es **sobrevivir** (velocidad y vida), no el daño. [MEDIDO]
- Tabla completa (los 61): `sim/out/steel1-summary.md` (`node sim/steelreport.js --all`).

### 3.4 No recomendados para bola de nieve

- **Magnezone**: el más lento de los cinco (velocidad 103). Ninguna versión probada lo arregla
  sin hundir el nivel (sección 4.3). [MEDIDO]
- Los Pokémon de Acero lentos o de poca vida del barrido (Beldum, Shieldon, Bronzor, Steelix,
  Bastiodon): mueren antes del minuto 7 de mediana. [MEDIDO, 10 partidas cada uno]

---

## 4. La build: "priofast"

### 4.1 Qué cambia y cuánto ayuda [MEDIDO]

Prioridad a **Puño Meteoro, Danza Espada y Fortaleza** desde el principio y el **Pañuelo Elección
primero** en los objetos. Se compara con el bot normal en las mismas semillas.

| prueba | partidas | llegan vivas al min 21 | nivel min 15 |
|---|---|---|---|
| normal, semillas 301-320 | 100 | 43/100 | 104 |
| **priofast**, semillas 301-320 | 100 | **74/100** | 103 |

Aguantas de media **×1,34 (±7 %)** más, **con el mismo nivel**.

A partida completa (semillas 301-310, 50 partidas por lado):

| | normal | priofast |
|---|---|---|
| llegan al minuto 30 | 21/50 | **34/50** |
| mediana de tiempo | 11:30 | **30:44** |
| derrotados por partida (mediana) | 2.757 | **13.549** |
| llegan al tope de Potencia | 14/50 | 15/50 (hacia el min 26,5) |
| nivel min 30 (de las que llegan) | 204 | 180 |

- El nivel del minuto 30 baja porque **ahora también llegan partidas más flojas**. No es que la
  build suba menos. [MEDIDO + CONJETURA sobre la causa]
- **La clave es el Pañuelo Elección** (+35 % de velocidad). De las partidas de priofast que lo
  llevaban en el minuto 7, **44 de 45** llegaron vivas al minuto 21. El bot normal casi nunca lo
  coge (3 de 100). [MEDIDO]
- Las cartas de Carrera extra no añaden nada: con Pañuelo y sin Carrera ×3, igual (×0,98). [MEDIDO, 50 parejas]

### 4.2 Por Pokémon (20 semillas, hasta el minuto 21) [MEDIDO]

| Pokémon | priofast frente a normal | partida completa (10 semillas): llegan al 30, normal → priofast |
|---|---|---|
| Kartana | **×1,77** | 4/10 → **7/10** |
| Archaludon | **×1,58** | 2/10 → **8/10** (tope de Potencia en 7 de 10) |
| Cobalion | **×1,40** | 3/10 → **7/10** |
| Gholdengo | ×0,99 (igual) | 8/10 → 9/10 |
| Magnezone | ×1,11 ±17 % (ruido) | 4/10 → 3/10 |

### 4.3 Lo que se probó y no compensa [MEDIDO, 50 partidas cada una]

| versión | aguante | nivel min 15 | por qué no |
|---|---|---|---|
| Agilidad + Danza + Fortaleza en el grupo | ×1,37 (la que más aguanta) | **82** (frente a 105) | pierde 25-35 niveles y la mitad de los derrotados: ya no es bola de nieve |
| Potencia antes (`potSnow`) | ×0,99 | 104 | no ayuda |
| Plan fijo Danza + Fortaleza sin prioridad | ×1,04 | 104 | no ayuda |
| Sólo Carrera ×3 + Pañuelo (sin prioridad) | ×1,06 | 101 | no ayuda |

---

## 5. Ficha por Pokémon

Los vetos son los que elige `--ban auto`. Los minutos son medianas de las partidas de priofast que
llegan vivas al minuto 21 (`node sim/cardorder.js sim/out/snow/priofast.jsonl sim/out/snow/priofast2.jsonl --dex N`).
[MEDIDO, 15-17 partidas por Pokémon]

### Kartana (798) — el que más mata

- **Vetos:** Agilidad, Tormenta Floral, Sustituto.
- **Principal:** Puño Meteoro (se evoluciona hacia el min 1:54).
- **Grupo, en este orden:** Puño Meteoro + Fortaleza + Danza Espada, y de cuarto **Golpe Cuerpo**
  (7 de 17), Látigo Cepa (5) o Garra Metal (5). Golpe Cuerpo llega tarde (min 7).
- **Objeto:** Pañuelo Elección.
- **Ojo:** con el bot normal es frágil (mediana 9:54 en 20 partidas). **No juegues Kartana sin el
  Pañuelo y sin Danza + Fortaleza en el primer minuto.** [MEDIDO + CONJETURA para el humano]

### Archaludon (1018) — el que más mejora con la build

- **Vetos:** Agilidad, Sustituto, Vozarrón.
- **Principal:** Puño Meteoro (evolución hacia el min 1:48).
- **Grupo:** Puño Meteoro + Danza Espada + Fortaleza, y de cuarto **Golpe Cuerpo** (10 de 16,
  hacia el min 4) o Garra Metal (6).
- **Objeto:** Pañuelo Elección.
- El que más llega al tope de Potencia con priofast: 7 de 10, hacia el min 24. 30 Potencias hacia
  el min 20 en 3 de 16. [MEDIDO]

### Cobalion (638) — el más fiable de los cuatro (legendario)

- **Vetos:** Agilidad, Sustituto, Vozarrón.
- **Principal:** Puño Meteoro (evolución hacia el min 2:18).
- **Grupo:** Puño Meteoro + Danza Espada + Fortaleza, y de cuarto **Golpe Kárate** (11 de 15,
  hacia el min 4) o Garra Metal (3).
- **Objeto:** Pañuelo Elección.
- Sin la build ya llega 13 de 20 veces al minuto 30. Con ella, de 3/10 a 7/10. [MEDIDO]

### Gholdengo (1000) — el que menos necesita

- **Vetos:** Agilidad, Sustituto, Vozarrón.
- **Principal:** Puño Meteoro (evolución hacia el min 2:00).
- **Grupo:** Puño Meteoro + Fortaleza + Danza Espada, y de cuarto **Lengüetazo** (12 de 17,
  hacia el min 3:20) o Golpe Cuerpo (6).
- **Objeto:** el Pañuelo no le cambia nada (×0,99), pero tampoco estorba.
- Con el bot normal llega 12 de 20 veces al minuto 30 y en el 7 de 10 llega al tope de Potencia
  (hacia el min 27). [MEDIDO]

### Alternativas baratas de Acero [CONJETURA]

Pawniard, Togedemaru, Klinklang y Scizor salen bien en el barrido con el bot normal. La build
priofast **no se ha probado** con ellos. Lo razonable es la misma receta: Puño Meteoro +
Danza Espada + Fortaleza + Pañuelo. Vetos auto: Agilidad, Sustituto y Vozarrón (Togedemaru: Rayo
en vez de Vozarrón).

---

## 6. Orden de cartas práctico

Sacado de unas 65 partidas buenas de priofast (las que llegan vivas al minuto 21).
Los minutos son medianas. [MEDIDO]

| minuto | qué coger |
|---|---|
| **inicio** | Segundo movimiento con Repertorio: **Puño Meteoro**. |
| **0:00-1:00** (unas 5 cartas) | **Fortaleza** y **Danza Espada** en cuanto salgan (hacia el 0:25-0:35). El resto, mejoras de Puño Meteoro. |
| **1:00-2:00** | Puño Meteoro al 5 (hacia el 1:25). Después, **Potencia** en cuanto salga: es lo que pide su evolución. Evoluciona hacia el 2:00. **Primer vínculo: Puño Meteoro + Danza Espada + Fortaleza.** |
| **2:00-4:00** | Danza Espada al 5 (3:20) y Fortaleza al 5 (4:00). Con Fortaleza en el grupo la reducción llega al tope de 0,8: **Coraza casi no hace falta**. |
| **3:00-5:00** | El cuarto miembro del grupo (Lengüetazo, Golpe Kárate o Golpe Cuerpo, según el Pokémon). |
| **2:00-6:00** | **Pañuelo Elección** en cuanto salga. Si no sale, Garra Rápida. **Nunca** la Cinta Elección. |
| **3:00-10:00** | Cartas de stat repartidas. Hacia el min 9 tienes unas 5 de Vigor, 5 de Carrera y 5 de Reflejos. Potencia a 5 hacia el min 7. |
| **10:00-20:00** | Mejoras de los otros movimientos (para llenar los otros huecos), Potencia (10 hacia el min 11, 20 hacia el 17), Síntesis y Vigor. |
| **20:00-30:00** | Sobre todo Potencia, Vigor y Síntesis. El tope de 40 Potencias llega hacia el min 24-28, en un 30 % de las partidas. |

Detalles que importan:

- **Danza Espada fusionada** se relanza sola y da ×2,8 de daño a nivel 5. **Fortaleza** a nivel 1 ya
  da +35 % de reducción. Ninguna de las dos es relleno. [CÓDIGO]
- **El primer vínculo decide qué grupo crece.** Que sea el de Puño Meteoro. [CÓDIGO]
- **Sólo dispara el hueco activo.** Mantén activo el grupo de Puño Meteoro. [CÓDIGO]

---

## 7. Errores que evitar

| error | qué pasa | etiqueta |
|---|---|---|
| No evolucionar Puño Meteoro pronto | Las 21 partidas del barrido de Acero que no lo evolucionaron murieron en una mediana de 3:14 (frente a 8:45). | [MEDIDO, 431 partidas] |
| Dejar Danza Espada o Fortaleza para luego | El bot normal las cogía en el min 3-8, y Fortaleza a veces nunca. Es justo lo que arregla priofast (×1,34). | [MEDIDO, 100 parejas] |
| Ir sin velocidad | Casi todas las muertes caen en el **min 8-10**, muchas hacia el 8:40, por **contacto con la horda que te rodea**: 61-97 golpes en 30 s, con más de 10 enemigos cerca. Los jefes no son el problema. | [MEDIDO] |
| Rechazar el Pañuelo Elección | Con Pañuelo en el min 7, 44 de 45 partidas llegan al min 21. | [MEDIDO] |
| Meter Agilidad para sobrevivir | Aguantas más, pero bajas al nivel 82 en el min 15 y matas la mitad. | [MEDIDO, 50 partidas] |
| Perseguir Potencia antes de tiempo | No ayuda (×0,99). Cógela cuando salga. | [MEDIDO, 50 partidas] |
| Coraza fija o Sustituto | Con Fortaleza en el grupo la reducción ya está al tope. Sustituto cuesta 5-6 cartas y quita un sitio de daño (×0,62 en otras pruebas). | [CÓDIGO + MEDIDO] |
| Dejar un hueco libre mucho tiempo | La tanda se llena de movimientos nuevos y Potencia sale 3 veces menos. | [CÓDIGO] |
| Elegir Magnezone para bola de nieve | Ninguna versión probada lo arregla sin perder el nivel. | [MEDIDO] |

Para el minuto 8-10, como jugador humano [CONJETURA]:

- **Muévete en círculos amplios** y no te dejes encerrar. Los meteoros caen solos alrededor.
- **Fortaleza y el Pañuelo deben estar ya** a esas alturas. Si no los tienes, juega más a huir
  hasta tenerlos.

---

## 8. Alternativa sin Acero: Lucha

Golpe Kárate + Esfera Aural + Danza Espada + Fortaleza también hace bola de nieve, aunque bastante
menos que Puño Meteoro.

Ronda fuerte, bot normal, 10 partidas cada uno. [MEDIDO, ruido grande]

| Pokémon | rareza | legendario | nivel min 15 | nivel min 30 | derrotados min 30 | llegan al 30 | tope Potencia |
|---|---|---|---|---|---|---|---|
| Conkeldurr (534) | 4 | no | 56 | 125 | 7.022 | 4/10 | 2/10 |
| Zamazenta (889) | 5 | sí | 57 | 126 | 7.083 | 2/10 | 1/10 |
| Machamp (68) | 4 | no | 54 | 84 | 3.850 | 5/10 | 0/10 |
| Hitmontop (237) | 3 | no | 57 | 84 | 3.962 | 2/10 | 0/10 |

- Llegan a la **mitad de nivel** que los de Acero en el minuto 15 (unos 56 frente a unos 100).
- **Vetos auto:** Agilidad, Sustituto y Vozarrón.
- **Ninguno está en la confirmación de 20 semillas** ni se ha probado con la build priofast. [CONJETURA]
- **Lucario** (Lucha/Acero, rareza 4) junta las dos cosas: lleva Puño Meteoro con Golpe Kárate en
  el grupo. Nivel 106 en el min 15 y 223 en el min 30, con 4 de 10 que llegan al 30.
  [MEDIDO, 10 partidas, bot normal]
- Cobalion (Acero/Lucha) ya usa Golpe Kárate como cuarto miembro del grupo. Es la mejor versión
  "de Lucha" que se ha medido.

---

## 9. Datos y cómo repetirlo

| qué | archivo |
|---|---|
| Ronda fuerte (130 Pokémon × 10, semillas 101-110) | `sim/out/strong1.jsonl`, `sim/RESULTS-ronda-fuerte.md` |
| Confirmación (28 Pokémon × 20, semillas 111-130) | `sim/out/confirm1.jsonl` |
| Barrido de Acero (61 × 10, semillas 201-210) | `sim/out/steel1.jsonl`, `node sim/steelreport.js` |
| Pruebas de build (semillas 301-320) | `sim/out/snow/*.jsonl`, `node sim/snowstats.js base.jsonl priofast.jsonl` |
| Orden de cartas por Pokémon | `node sim/cardorder.js sim/out/snow/priofast.jsonl sim/out/snow/priofast2.jsonl --dex 798` |
| De qué muere cada partida | `node sim/deathcause.js` |
| Reglas generales de cartas | `sim/STRATEGY.md` |

Comando base: `node sim/run.js --dex 798 --bot best --upgrades max --ban auto --max 1900 --seeds 301-320 --jobs 3`.
La versión priofast añade prioridad a `meteor-mash`, `swords-dance` y `harden` y pone
`choicescarf` primero en `itemRank`, más 3 cartas de Carrera (que no cambian nada).
