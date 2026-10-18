# PokéSurvivor — qué cartas coger (guía medida con el simulador)

Guía práctica para subir de nivel bien, con cada consejo respaldado por partidas simuladas.
Cada regla lleva una etiqueta:

- **[MEDIDO]**: comparación emparejada (mismo Pokémon, misma semilla, sólo cambia la regla).
- **[CÓDIGO]**: sale directamente de las reglas del juego (`js/systems/levelup.js`), sin azar.
- **[CONJETURA]**: razonamiento o tendencia que no llega a ser significativa. Tómalo con cautela.

Escenario de todas las pruebas: tienda de Mejoras al máximo y 3 vetos. El jugador es el mejor
bot del simulador (movimiento de pro-a, congelado). Se mide **cuánto aguantas**.

## Cómo leer los números

- **×0,64** = con esa regla aguantas, de media geométrica, un 64 % de lo que aguantas jugando
  "normal" (la política v2 del bot, que ya juega bastante bien). ×1,00 = igual.
- Entre paréntesis, el intervalo de confianza del 95 %. Si incluye el 1,00, **no hay efecto claro**.
- Base de cada prueba: 8 Pokémon (Gengar, Charmander, Machamp, Blastoise, Pikachu, Magmortar,
  Yanmega, Mimikyu) × 10 semillas = 80 partidas por lado, cortadas en el minuto 20. Las dos
  reglas más dudosas se repitieron con 15 semillas nuevas (120 partidas más).
- El azar entre partidas es enorme (±25 %): una diferencia de ±7 % con 80 partidas es ruido.

**Lo más importante de todo**: el juego "normal" del bot es difícil de mejorar. Ninguno de los
15 cambios probados le gana de forma clara, y **los que se apartan mucho de "coge lo que más
te sube ahora" pierden**. Las reglas de abajo son, sobre todo, errores que evitar.

---

## 0. Huecos, movimientos y vínculos (para no confundirse) [CÓDIGO]

- **Hay 4 huecos, no 4 movimientos.** Un hueco es un movimiento suelto o un **grupo fusionado
  de hasta 4** (`Player.maxMoves = 4`, `BOND_MAX = 4` en `js/entities/player.js`).
- Cada **vínculo** mete movimientos sueltos en un grupo y **te libera un hueco**: vuelven a salir
  movimientos nuevos y puedes aprender más. En teoría caben 4 grupos × 4 = **16 movimientos**
  (en partidas largas se ven 2-3 grupos de 4).
- **Sólo crece un grupo a la vez**: mientras haya uno de 2-3, el vínculo tiene que añadirle un
  movimiento; sólo cuando llega a 4 se empieza otro. Un grupo de 4 cuesta 3 vínculos.
- **Sólo dispara el hueco activo.** Un segundo o tercer grupo no suma daño salvo que cambies a él.
- Tope práctico: los movimientos de tipo Normal (todos los tienen) + los de tus tipos − tus 3 vetos.
- En esta guía, "4 huecos llenos" = los 4 huecos ocupados (por sueltos o por grupos), que es lo
  que decide qué cartas te salen.

## 1. Cómo se reparten las cartas (lo que hay que saber) [CÓDIGO]

En cada nivel salen 3 cartas sorteadas por peso:

| tipo | peso | cuándo sale |
|---|---|---|
| movimiento nuevo | 10 cada uno, hasta 6 | sólo mientras tengas **algún hueco libre** (menos de 4) |
| mejora de un movimiento | 8 cada uno | por cada movimiento que no esté al máximo |
| evolución | 40 | siempre, en cuanto un movimiento al máximo tiene su stat cogida |
| stat (Potencia, Coraza...) | 4 con huecos libres, **7 con los 4 llenos** | 5 de las 9 al azar (las topadas no salen) |

Probabilidad de que **Potencia** esté entre las 3 cartas (20.000 sorteos con el código real,
`node sim/offerodds.js`):

| tu situación | Potencia en la tanda | con 1 cambio de cartas |
|---|---|---|
| 2 huecos libres | 7 % | 14 % |
| 1 hueco libre | 7 % | 13 % |
| 4 huecos llenos, 4 movimientos por subir | 18 % | 32 % |
| 4 llenos, grupo hecho + 3 sueltos por subir | 20 % | 35 % |
| 4 llenos, sólo 1 por subir | 27 % | 46 % |
| 4 llenos, todo al máximo | 33 % | 55 % |
| igual, pero un vínculo de más te ha vuelto a abrir un hueco | 10 % | 19 % |
| todo al máximo y Carrera, Imán y Aprendizaje topados | 50 % | 75 % |
| ... y además Reflejos y Coraza topados | 75 % | 94 % |

Lo que esto quiere decir:

- **Un solo hueco libre llena la tanda de movimientos nuevos** (Potencia sale 3 veces menos).
- Cada vínculo que fusiona dos sueltos **te abre un hueco**: vuelven los movimientos nuevos.
- En las partidas del bot (v2), Potencia salía sólo en el **15 %** de las tandas y se rechazaba
  1-3 veces por partida. Por eso se cogen tan pocas (mediana 4 en 20 min, ~38 niveles).

## 2. Reglas de subida de nivel

### 2.1 Llena los 4 huecos y aprende movimientos [MEDIDO]

Quedarse con sólo 3 movimientos en toda la partida: **×0,64 (0,54-0,77)**, peor en 7 de 8
Pokémon (Machamp ×0,48, Blastoise ×0,45), con 13 niveles y 2 Potencias menos.
Con un hueco libre la tanda se llena de movimientos nuevos (ver la tabla) y además te faltan
compañeros para los vínculos.

Pero **no hace falta correr**: dar mucha prisa a llenar el último hueco (aunque sea con lo
primero que salga) da **×0,93 (0,87-1,01)**, sin efecto claro. Llénalo cuando salga algo útil.

### 2.2 Potencia: cógela cuando salga, pero no la persigas [MEDIDO]

- Valer Potencia el doble que lo normal: **×0,96 (0,87-1,09)** y, con 15 semillas nuevas,
  **×1,02 (0,89-1,12)**. Da +1 Potencia y +2 niveles por partida, sin cambiar el tiempo.
- Doblar Potencia y Reflejos sólo cuando el grupo principal está al máximo y evolucionado:
  **×0,93 (0,87-0,97)** (en 20 minutos el grupo casi nunca está terminado).
- El problema real de Potencia no es rechazarla (pasa 1-3 veces por partida) sino que **sale
  poco** (15 % de las tandas), por lo de la sección 1.

### 2.3 "Moldear el mazo" (subir lo que no usas para que deje de salir): no compensa [MEDIDO]

La idea: con los 4 huecos llenos, subir al máximo los movimientos que no disparan hace que su
carta de mejora deje de salir y quedan más stats (Potencia). Sobre el papel funciona (de 20 % a
33 % de Potencia, tabla de arriba), pero cuesta 4 cartas por movimiento:

| regla | resultado |
|---|---|
| subir lo suelto cuando no hay nada mejor | ×0,91 (0,83-0,99) |
| topar Carrera, Imán, Aprendizaje, Reflejos y Coraza para que salga más Potencia | ×0,94 (0,83-1,03) |
| todo junto (llenar huecos + subir lo suelto + Potencia ×2) | **×0,83 (0,75-0,92)** |

Las cartas que gastas en "limpiar" te faltan justo cuando más falta hacen, y tampoco compensa
en partidas hasta el minuto 30 (sección 6).

### 2.4 Mejoras de movimientos que no disparan [MEDIDO]

Sólo dispara el **hueco activo**. Aun así, no subir nunca lo que está fuera del grupo principal
no cambia nada: **×0,99 (0,88-1,10)** y con semillas nuevas **×0,97 (0,89-1,06)**. El bot ya
casi no las coge (3 por partida, cuando no hay otra cosa). Regla: cógelas sólo si la tanda no
trae nada para tu grupo ni una stat que te sirva.

### 2.5 Coraza: unas pocas, las que salgan [MEDIDO]

| regla | resultado |
|---|---|
| Coraza siempre hasta el 50 % de reducción, antes que nada | **×0,76 (0,64-0,91)** (+1,8 Corazas, −2,2 Potencias, −11 niveles) |
| nunca Coraza | ×0,89 (0,79-1,03); **Gengar ×0,60 (0,44-0,79)** |

Lo normal del bot (unas 2 Corazas en 20 minutos, cuando salen y no hay nada mejor) es lo que
mejor va. Con Pokémon de poca vida que pelean pegados (Gengar con Púas Tóxicas) no la dejes.

### 2.6 Compañeros de vínculo [MEDIDO, débil]

El primer vínculo que une dos movimientos sueltos **decide qué grupo crece** (los siguientes
sólo pueden añadir a ese grupo hasta 4) [CÓDIGO]: que el primero sea tu movimiento principal.
Invertir el doble en los futuros compañeros (subirlos antes de tener el vínculo):
×0,92 (0,80-1,10), sin efecto claro. El vínculo no se puede rechazar [CÓDIGO]: si sólo tienes
relleno, se fusiona relleno; por eso conviene tener 2-3 movimientos que valgan la pena.

Un 15 % de los grupos principales del bot llevan algún movimiento de daño a nivel 1-2
(sobre todo Golpe Cuerpo y Placaje) y la mitad llevan Fortaleza: Fortaleza a nivel 1 ya da 5
acumulaciones de +7 % de reducción (+35 %), así que **no es relleno** [CÓDIGO].

### 2.7 Danza Espada / Danza Dragón [MEDIDO, no concluyente]

| regla | resultado |
|---|---|
| meterla siempre en el grupo principal | ×0,89 (0,76-1,07), +2 niveles |
| no cogerla nunca | ×0,94 (0,86-1,04), −7 niveles |

Ninguna de las dos es mejor que decidir según la partida (cógela si tu grupo tiene sitio y no
hay un movimiento de daño mejor para fusionar). Fusionada se relanza sola y llega a ×2,8 de daño
a nivel 5 [CÓDIGO], pero ocupa uno de los 4 sitios del grupo.

### 2.8 Sustituto: no [MEDIDO]

Prueba limpia: mismos Pokémon y semillas; Sustituto vetado (lo normal) frente a Sustituto sin
vetar, aprendido pronto, subido y metido en el grupo principal: **×0,62 (0,52-0,74)**, peor en
**los 8 Pokémon** (Machamp ×0,30, el mejor Gengar ×0,79), con 11 niveles y 2 Potencias menos.
Cuesta 5-6 cartas (más la evolución) y quita un sitio del grupo a un movimiento de daño.
**Vétalo.**

## 3. Vetos [MEDIDO en parte]

Lo que veta el bot (los 3 movimientos que menos suman al grupo esperado): **Agilidad** y
**Sustituto** en los 8 Pokémon, más uno propio (Gengar Tóxico, Charmander Fuego Fatuo,
Machamp Vozarrón, Blastoise Burbuja, Pikachu Rayo, Magmortar Fuego Fatuo, Yanmega Tornado,
Mimikyu Viento Feérico). Vetar no cambia cuántos movimientos nuevos salen, sólo **cuáles** [CÓDIGO].
Medido sólo el de Sustituto (sección 2.8); el resto es la recomendación del modelo [CONJETURA].

## 4. Objetos [MEDIDO / CONJETURA]

- **Cinta Elección**: las partidas que acaban con ella duran poco (mediana 10:33 frente a
  20:00 con Chaleco Asalto o Restos), pero es **correlación**: no cogerla nunca da
  **×0,99 (0,93-1,04)**, igual [MEDIDO]. No es la causa: se coge en partidas que ya iban mal.
- Lo que más se queda puesto el bot (y en partidas largas): Chaleco Asalto, Restos, Garra Rápida,
  Campana Concha [CONJETURA: correlación, no prueba].

## 5. Por tipo de ataque principal [MEDIDO con pocas partidas por grupo]

Mismas pruebas, separando por el ataque principal (×geo; intervalos amplios: 10-50 partidas por grupo):

| regla | proyectil (Charmander, Blastoise, Pikachu, Magmortar, Mimikyu) | cuerpo a cuerpo (Machamp, Yanmega) | minas/veneno (Gengar) |
|---|---|---|---|
| sólo 3 movimientos | 0,70 | 0,53 | 0,55 |
| Sustituto al grupo | 0,67 | **0,44** | 0,79 |
| Coraza hasta 50 % | 0,91 | 0,62 | **0,48** |
| nunca Coraza | 0,92 | 1,01 | **0,60** |
| moldear el mazo (todo junto) | 0,87 | 0,83 | 0,66 |
| no subir lo suelto | 1,08 (0,95-1,21) | 0,88 | 0,81 |

- **Proyectil**: lo menos sensible a todo; nada de lo probado le mejora con claridad.
- **Cuerpo a cuerpo**: castiga mucho perder cartas en cosas que no pegan (Sustituto, Coraza forzada).
- **Minas y veneno (Gengar)**: necesita su Coraza (sin ella ×0,60) pero sin pasarse.
- **Rayos, órbitas y auras**: no había ninguno en las pruebas: **sin datos**.

## 6. Partidas largas (hasta el minuto 30) [MEDIDO, pocas partidas]

Para ver si lo que no compensa en 20 minutos compensa a la larga: Gengar, Blastoise, Pikachu y
Mimikyu × 10 semillas nuevas (61-70), sin corte hasta la Sentencia (40 partidas por lado).

| regla | resultado | llegan al min 30 (v2 → regla) |
|---|---|---|
| Potencia ×2 | ×1,13 (0,91-1,38), +6 niveles, +1 Potencia | 16 → 15 |
| moldear el mazo (todo junto) | ×0,93 (0,74-1,21) | 16 → 13 |

Juntando todas las pruebas de Potencia ×2 (240 partidas emparejadas, cortes de 20 y 30 min):
**×1,02 (0,96-1,08)**, 67 ganadas y 68 perdidas: **no cambia nada**. Moldear el mazo, juntando
las 120: **×0,86 (0,77-0,97)**: pierde también a la larga.

Repetición más grande (18-10-2026, `sim/out/r4/`): Potencia ×2 hasta la Sentencia con el bot
actual, 8 Pokémon (Gengar, Charmander, Machamp, Blastoise, Gyarados, Jolteon, Polteageist,
Cinderace) × semillas nuevas 61-80 = 160 partidas por lado: **×1,04 (0,92-1,15)**, 60 ganadas y
60 perdidas, llegan al min 30 53 → 55, +3,5 niveles y +1,4 Potencias. Sigue sin ser un efecto
claro: "coge Potencia cuando salga" basta.

## 7. Resumen para jugar

1. Ten tus 4 huecos llenos casi siempre; tras un vínculo que te abra un hueco, vuelve a llenarlo
   con algo útil (sin prisa extrema). [MEDIDO]
2. El primer vínculo, con tu movimiento principal; que el grupo de 4 sea tu principal + 2-3 que
   sumen (Fortaleza a nivel 1 ya vale). [CÓDIGO + MEDIDO débil]
3. Coge Potencia cuando salga; coge la mejor carta de la tanda para tu grupo; no persigas planes
   largos (subir lo que no usas, topar stats pequeñas, Coraza fija): pierden. [MEDIDO]
4. Coraza: las que salgan cuando no hay nada mejor (unas 2 en 20 min); con Gengar y similares,
   no la dejes. [MEDIDO]
5. Veta Sustituto (y Agilidad). [MEDIDO / modelo]
6. Danza Espada: según la partida, no por norma. [MEDIDO, no concluyente]
7. Cinta Elección: no hace daño cogerla. [MEDIDO]

Datos y herramientas: `sim/out/v3/` (una partida por línea), `node sim/cardlab.js pair A.json B.json`,
`node sim/offerodds.js`; detalles técnicos en `sim/bots/README.md` (sección "cards.js v3").
