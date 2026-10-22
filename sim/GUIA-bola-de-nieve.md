# Guía de bola de nieve (versión del juego del 21-10-2026)

Guía para un jugador **humano** que quiere ganar matando mucho y subiendo mucho de nivel, sin
quedarse sólo en huir. Condición: llegar al minuto 30 en la mitad de las partidas o más, porque
morir pronto también corta la bola de nieve.

Escenario de todas las pruebas: tienda de Mejoras al máximo (incluida **Movimiento inicial**),
3 vetos automáticos y el mejor bot del simulador (`--bot best`), cada Pokémon con su habilidad.
Tablas completas y método: `sim/RESULTS-v6.md` (y `RESULTS-v5.md` para lo anterior). Etiquetas:

- **[MEDIDO]**: sale de partidas simuladas; se dice cuántas.
- **[CÓDIGO]**: sale de las reglas del juego (`js/`), sin azar.
- **[CONJETURA]**: razonamiento o tendencia sin prueba suficiente.

El bot no juega como una persona: los números sirven para **comparar** builds, no como promesa.

---

## 1. Resumen en 30 segundos

1. La mejor bola de nieve sigue siendo un **Pokémon de Acero con Puño Meteoro evolucionado**,
   fusionado con **Danza Espada y Fortaleza**, y el **Pañuelo Elección** en cuanto salga. Con la
   actualización del 21-10 va igual o algo mejor: 63 % llegan al minuto 30 (v5: 58 %). [MEDIDO, 160 partidas]
2. **Deja huecos libres**: ningún ataque nuevo hasta tener Danza Espada y Fortaleza (con 4 huecos llenos ya
   no salen). [MEDIDO + CÓDIGO]
3. Los más fiables ahora: **Archaludon (25/30), Kartana (23/30), Lucario (23/30), Dialga (22/30) y
   Revavroom (21/30)**. Kartana es el que más mata (~14.000) y más veces llega al tope de Potencia. [MEDIDO, 30 cada uno]
4. **Habilidad y naturaleza importan poco** con esta receta: casi todas las pruebas caben en el ruido. Lo
   único claro: Lucario con **Impasible** (9/10) mejor que con Fuerza Mental (5/10). No gastes en Cápsulas
   Ocultas ni en Mentas por esta receta. [MEDIDO, 10 por fila]
5. **No aprendas MT** para esta receta: cada una entra en tu lista de ataques y hace que salgan menos Danza
   Espada y Fortaleza. [CÓDIGO]
6. **Movimiento inicial: Puño Meteoro.** El 2.º (Repertorio) puede ser al azar o elegido con la mejora nueva
   "Segundo movimiento inicial": no se nota la diferencia. [MEDIDO, 30 partidas con Lucario]
7. Fuera del Acero, lo mejor es **Spectrier** (rareza 5, banner de Galar) con **Bola Sombra + Maquinación +
   Fortaleza** reservando huecos: 18/20 llegan al 30, nivel 132 y ~6.400 derrotados (la mitad que el Acero).
   Hiperrayo + Maquinación no hace bola de nieve. [MEDIDO, 20 y 80]

---

## 2. Qué ha cambiado (21-10-2026)

| novedad | efecto en la receta | etiqueta |
|---|---|---|
| Naturaleza (±10 % a dos stats; Menta 1.500) | +10 % de Ataque = +10 % de daño de Puño Meteoro; en partidas, dentro del ruido (Kartana neutra 9/10, Firme 7/10, Alegre 10/10) | [CÓDIGO + MEDIDO, 30] |
| Habilidad (efectos reales; Cápsula 1.500, Oculta 5.000) | Ultraimpulso (Kartana, Celesteela) +15 % de daño en cuanto llevas 30 derrotados; el resto, poco | [CÓDIGO + MEDIDO] |
| MT (8 al día en la Tienda Kecleon) | diluyen las cartas: no conviene | [CÓDIGO] |
| Segundo movimiento inicial (400) | no se nota con esta receta | [MEDIDO, 30] |
| Ataques, cartas, objetos, enemigos | sin cambios: la tabla de daño sale idéntica | [CÓDIGO + MEDIDO] |

(Lo que cambió el 19-10-2026, físico/especial y los 38 ataques nuevos, sigue igual: ver `RESULTS-v5.md`.)

---

## 3. Por qué funciona (y por qué hay que reservar huecos)

### 3.1 Puño Meteoro [CÓDIGO]

| fase | meteoros | daño (×Ataque) | radio | recarga |
|---|---|---|---|---|
| nivel 1 | 2 | 34 | 54 | 1,4 s |
| nivel 5 | 5 | 49 | 70 | 1,12 s |
| **evolución "Bomba Imán"** (pide Potencia) | **7** | **84** | **84** | 1,12 s |

- Es **físico**: pega con el **Ataque** de tu Pokémon. Si tu Pokémon tiene más At. Esp. que Ataque,
  pega menos (Gholdengo ×0,72, Empoleon y Dialga ×0,89, Archaludon ×0,92). Si es Acero puro, ×1,2.
- Cada meteoro cae sobre un enemigo cercano y daña a todo lo de su círculo. Con la horda pegada hace
  3,3 veces el daño que a un enemigo solo. Sigue siendo el ataque que más daño hace a una horda
  (3.349 por unidad de ataque evolucionado; el siguiente, Patada Giro, 2.883). [MEDIDO, `sim/RESULTS-v5.md` §4]
- Sólo lo aprenden los Pokémon de tipo **Acero**.

### 3.2 Danza Espada y Fortaleza [CÓDIGO]

- **Danza Espada** fusionada se relanza sola: a nivel 5, ×2,78 de daño **para los ataques físicos**
  (Puño Meteoro lo es). Ya no sirve para Esfera Aural, Bola Sombra ni ningún especial: para esos está
  **Maquinación** (nueva), que no sirve para Puño Meteoro.
- **Fortaleza** fusionada lleva la reducción de daño al tope de 0,8 (a nivel 1 ya da +0,35).
- Como mucho se ofrecen 2 potenciadores. Con Danza Espada y Fortaleza, Maquinación y Agilidad ya no
  salen (y los vetos automáticos las quitan igualmente).

### 3.3 Reservar huecos [CÓDIGO + MEDIDO]

- Con los **4 huecos llenos ya no salen cartas de ataque nuevo** (`levelup.js`) hasta que un vínculo
  libera uno.
- Cada Pokémon de Acero tiene ahora **5-8 ataques más** en su lista (16-23 en total; Maquinación y los
  38 nuevos) [CÓDIGO]. Con los dos iniciales y 3 vetos, cada tanda trae Danza Espada con un ~12 % de
  probabilidad, y otro tanto Fortaleza. [MEDIDO, 4.000 sorteos con el código real]
- El bot normal coge los ataques nuevos que salen (Disparo Espejo, Enfado, Hiperrayo...) y llena los
  huecos en el primer minuto. Sin reservar, Danza Espada llegaba de mediana en el **minuto 7,7** (antes
  0,4) y se ofrecía en los 5 primeros minutos sólo en 97 de 160 partidas. [MEDIDO]
- **Reservando**, Danza Espada y Fortaleza llegan hacia el minuto 0,5-0,7 y la build vuelve a funcionar:
  ×1,25 frente a priofast sin reservar y ×1,50 frente al bot normal. [MEDIDO, 160 parejas cada una]

En la práctica: empiezas con 2 ataques (el de serie y Puño Meteoro). **Hasta tener Danza Espada y
Fortaleza, no cojas ninguna carta de "ataque nuevo"** aunque parezca buena: coge mejoras de Puño
Meteoro o stats. Si no sale nada útil, usa el cambio de cartas.

### 3.4 El precio: el minuto 6-12 [MEDIDO]

- Casi todas las muertes caen entre los minutos **6 y 12**, por **contacto con la horda que te rodea**
  (`deathcause.js`). Es el mismo muro de antes, algo más duro. [MEDIDO, 7 partidas analizadas golpe a golpe]
- El Pañuelo Elección (+35 % de velocidad) es lo que más ayuda a pasarlo. [MEDIDO]

---

## 4. Ranking [MEDIDO]

**Receta de jugador**: Movimiento inicial = Puño Meteoro, Repertorio **al azar**, huecos reservados, Pañuelo
primero, la mejor habilidad no oculta y naturaleza neutra. 10 semillas (3101-3110) para todos y 20 más
(3301-3320) para los 8 mejores (`sim/out/v6/steel.jsonl`, `conf.jsonl`).

| Pokémon | rareza | habilidad | llegan al 30 | nivel min 15 | nivel min 30* | derrotados | tope Potencia |
|---|---|---|---|---|---|---|---|
| **Archaludon** | 5 | Robustez | **25/30** | 98 | 160 | 11.968 | 4/30 |
| **Kartana** | 4 | Ultraimpulso | **23/30** | 103 | **177** | **13.893** | **7/30** |
| **Lucario** | 4 | Impasible | **23/30** | 100 | 149 | 9.693 | 1/30 |
| **Dialga** | 5 | Presión | 22/30 | 103 | 159 | 12.122 | 3/30 |
| **Revavroom** | 4 | Funda | 21/30 | 103 | 172 | 13.427 | 5/30 |
| Cobalion | 5 | Justiciero | 20/30 | 95 | 154 | 10.343 | 1/30 |
| Magearna | 5 | Coránima | 16/30 | 106 | 181 | 11.358 | 4/30 |
| Melmetal | 5 | Puño Férreo | 13/30 | 107 | 183 | 2.563 | 6/30 |
| Togedemaru (barato) | 3 | Punta Acero | 8/10 | 96 | 148 | 9.110 | 1/10 |
| Empoleon | 4 | Torrente | 7/10 | 84 | 129 | 6.543 | 2/10 |
| Gholdengo | 4 | Cuerpo Áureo | 6/10 | 99 | 156 | 9.036 | 0/10 |
| Klinklang | 4 | Más | 5/10 | 106 | 175 | 12.214 | 1/10 |
| Celesteela | 4 | Ultraimpulso | 5/10 | 97 | 155 | 10.244 | 1/10 |
| Perrserker (barato) | 3 | Garra Dura | 5/10 | 105 | 165 | 7.712 | 2/10 |
| Genesect | 5 | Descarga | 4/10 | 105 | 169 | 2.181 | 1/10 |
| Durant (barato) | 3 | Entusiasmo | 2/10 | 79 | 190 | 2.613 | 0/10 |

*Nivel mediano en el minuto 30 de las que llegan. Derrotados: mediana de todas las partidas.

- Con 10 partidas, ±3 en "llegan al 30" es ruido; con 30, ±5. Fiables en las dos tandas: **Archaludon,
  Kartana, Lucario, Dialga y Revavroom**. [MEDIDO]
- Cambios respecto a la v5: Revavroom pasa de irregular a fiable; Durant y Perrserker bajan (2/10 y 5/10,
  dentro de lo que ya eran irregulares); Melmetal sigue subiendo mucho y muriendo mucho. [MEDIDO]
- Baratos (rareza 3): el mejor ahora es **Togedemaru** (8/10). [MEDIDO, 10]

---

## 5. Fichas

(Grupos e hitos medidos en la v5; la actualización del 21-10 no cambia ataques ni cartas [CÓDIGO]. La
habilidad recomendada es la de la tabla del §4; en las pruebas de habilidad de `RESULTS-v6.md` §6 sólo
Lucario sale claramente mejor con una, **Impasible**.)

Lo común a todos (y por eso no se repite): **Movimiento inicial** Puño Meteoro; **vetos** 3 cualesquiera
que no sean de la receta (da igual cuáles, §6.1; los automáticos son Maquinación, Agilidad y Sustituto);
**ataque principal** Puño Meteoro; **grupo**: Puño Meteoro + Danza Espada + Fortaleza y un cuarto miembro; **objeto**: Pañuelo
Elección en cuanto salga (si no, Garra Rápida o Restos; **nunca** la Cinta Elección); huecos reservados
hasta tener Danza Espada y Fortaleza. Los minutos son medianas de las partidas que llegan vivas al
minuto 21 (`node sim/cardorder.js sim/out/v5/pool-pfr.jsonl --dex N`). [MEDIDO, 21-32 partidas por Pokémon]

### 5.1 Caros

#### Cobalion (638) — el más fiable · rareza 5, legendario
- **Grupo:** Puño Meteoro + Danza Espada + Fortaleza + **Garra Metal** (22 de 32) o Placaje (8).
- **Hitos:** Danza Espada y Fortaleza en el 0:40; Puño Meteoro evoluciona en el 2:06; Danza al 5 en el
  3:24, Fortaleza al 5 en el 4:36; Potencia n.º 10 en el 13, n.º 20 en el 24.
- 31 de 40 llegan al minuto 30; nunca llegó al tope de Potencia (sube algo menos que los demás).

#### Archaludon (1018) — el mejor no legendario · rareza 5
- **Grupo:** + **Garra Metal** (13 de 30) o **Garra Dragón** (10).
- **Hitos:** Fortaleza 0:30, Danza Espada 0:40, evolución 2:06, Danza al 5 en el 3:36, Fortaleza al 5 en
  el 4:30, Potencia 10 en el 11:50 y 20 en el 20:40.
- Pega un 8 % menos que antes con Puño Meteoro (Ataque < At. Esp.), y aun así es de los mejores (12/20 y 30/40).

#### Kartana (798) — el que más mata · rareza 4
- **Grupo:** + **Látigo Cepa** (12 de 27) o Placaje (10).
- **Hitos:** Fortaleza 0:30, Danza Espada 0:40, evolución 2:06, las dos al 5 hacia el 4:00, Potencia 10
  en el 11:30, 20 en el 23:50.
- Mediana de 12.721 derrotados y 5 de 40 al tope de Potencia: la bola de nieve más fuerte de los fiables.
  Def. Esp. muy baja (31): los enemigos especiales le pegan un 25 % más. [CÓDIGO]

#### Dialga (483) · rareza 5, legendario
- **Grupo:** + **Garra Metal** (15 de 27).
- **Hitos:** Danza Espada 0:24, Fortaleza 0:36, evolución 2:18, Potencia 10 en el 11:20, 20 en el 21:30,
  30 en el 27 (11 de 27).
- Antes era el de más nivel pero moría pronto (7/20); ahora 27 de 40 llegan al 30.

#### Empoleon (395) · rareza 4
- **Grupo:** + **Torbellino** (9 de 26), Placaje o Garra Metal.
- **Hitos:** Danza Espada 0:30, Fortaleza 0:36, evolución 1:54, Potencia 10 en el 13, 20 en el 21:40.
- Sin empezar con Puño Meteoro le iba mal (6/20 con el inicial de serie): su lista es de las más largas y
  Puño Meteoro tarda en salir. [MEDIDO, 20 parejas: ×1,64]

#### Gholdengo (1000) · rareza 4
- **Grupo:** + **Garra Metal** (13 de 25) o Lengüetazo (6).
- **Hitos:** Danza Espada 0:24, Fortaleza 0:30, evolución 2:06, Potencia 10 en el 13.
- Es el que más pierde con el cambio: Puño Meteoro le pega un 28 % menos (Ataque 1,03 frente a At. Esp.
  1,43). Sigue siendo fiable (60 %) pero mata menos que los demás (6.796). [CÓDIGO + MEDIDO]

#### Klinklang (601) — Acero puro · rareza 4
- **Grupo:** + **Placaje** (13 de 23) o Garra Metal (10).
- **Hitos:** Danza Espada 0:30, Fortaleza 0:36, evolución 1:54, Potencia 10 en el 13, 20 en el 21.
- +20 % de daño con Puño Meteoro por ser monotipo. [CÓDIGO]

#### Lucario (448) · rareza 4
- **Grupo:** + **Golpe Kárate** (14 de 22).
- **Hitos:** Danza Espada y Fortaleza hacia el 0:30, evolución 2:36, Potencia 10 en el 11:30, 20 en el 22,
  30 en el 27 (10 de 22).

#### Melmetal (809) — el que más sube · rareza 5, legendario, Acero puro
- **Grupo:** + **Placaje** (7 de 11) o Garra Metal (3).
- **Hitos:** Danza Espada 0:18, Fortaleza 0:42, evolución 2:00, Potencia 10 en el 9:48, 20 en el 18:48,
  30 en el 27 (10 de 11), **40 en el 29 (5 de 11)**. [MEDIDO, 11 partidas de la receta de jugador]
- Nivel 189 en el min 30 y 13.500 derrotados, pero lento (92): 11/20 y 16/40 llegan al 30.

#### Revavroom (966) · rareza 4 — irregular
- **Grupo:** + **Garra Metal** (15 de 23).
- **Hitos:** Fortaleza 0:18, Danza Espada 0:30, evolución 2:12, Potencia 10 en el 11, 20 en el 23.
- Irregular: 22/40 con la receta del bot y 5/20 con la de jugador. [MEDIDO] No lo recomiendo hasta medirlo más.

### 5.2 Baratos (rareza 3)

#### Perrserker (863) — barato y el que más sube de los baratos · Acero puro
- **Grupo:** + **Garra Metal** (5 de 14), Golpe Cuerpo (5) o Placaje (4).
- **Hitos:** Danza Espada y Fortaleza en el 0:30, evolución 2:06, Potencia 10 en el 10:36, 20 en el 20:24,
  30 en el 27 (7 de 14), 40 en el 28 (2 de 14). [MEDIDO, 14 partidas de la receta de jugador]
- 14/20 con la receta de jugador, 9/20 con la del bot: muy irregular (velocidad 99). Nivel 174 en el min 30.

#### Durant (632) — el mejor barato
- **Grupo:** + **Picadura** (9 de 22) o Garra Metal (7).
- **Hitos:** Danza Espada 0:42, Fortaleza 1:00, evolución 2:18, Danza al 5 en el 4:30, Fortaleza al 5 en
  el 5, Potencia 10 en el 12, 20 en el 22.
- Velocidad 124: el más rápido de los baratos. 22 de 40 al minuto 30 (8/20 y luego 14/20).

#### Togedemaru (777)
- **Grupo:** + **Placaje** (8 de 21) o Golpe Cuerpo (5).
- **Hitos:** Danza Espada 0:30, Fortaleza 0:48, evolución 1:54, Potencia 10 en el 11:40.
- Sin empezar con Puño Meteoro, 6/20; con él, 21/40 y 9/20. [MEDIDO]
- Sube algo menos que los demás (133 en el min 30, 4.764 derrotados).

#### Si no tienes ninguno de estos
- **Pawniard** (rareza 2) con la misma receta: más nivel que Durant, pero un 35 % llegan al minuto 30. **Klang, Bisharp y Orthworm** con el bot se mueren antes
  del 10 casi siempre (15-25 %). [MEDIDO, 20-40 partidas]

---

## 6. Orden de cartas por fase (todos los de arriba) [MEDIDO]

| minuto | qué coger |
|---|---|
| **inicio** | **Movimiento inicial: Puño Meteoro.** Repertorio da otro al azar (si es el 4.º miembro de la ficha, mejor). |
| **0:00-1:00** | **Danza Espada y Fortaleza** en cuanto salgan (hacia el 0:30-0:40). **Ningún otro ataque nuevo** mientras falten. El resto: mejoras de Puño Meteoro. |
| **1:00-2:30** | Puño Meteoro al 5 (hacia el 1:30) y **Potencia** en cuanto salga (la pide su evolución). Evoluciona hacia el 2:00. **Vínculos: 1.º Puño Meteoro + Fortaleza (o Danza Espada), 2.º la otra, 3.º el 4.º miembro** (ver §6.1). |
| **2:30-5:00** | Danza Espada al 5 (3:00-4:30) y Fortaleza al 5 (4:00-5:00). El 4.º ataque (ver ficha) y el 4.º miembro del grupo. |
| **2:00-7:00** | **Pañuelo Elección** en cuanto salga. |
| **5:00-12:00** | El muro: Vigor, Carrera, Reflejos y Síntesis repartidos, Potencia cuando salga (n.º 10 hacia el min 11-13). Muévete en círculos amplios. |
| **12:00-30:00** | Sobre todo Potencia (n.º 20 hacia el 21-24), Vigor y Síntesis. El tope de 40 llega en ~5 % de las partidas. |

### 6.1 Vínculos y vetos

- **Cómo van los vínculos** [CÓDIGO, `Player.bondOptions` / `fuse`]: el 1.º une **dos** ataques sueltos en un
  grupo nuevo; cada vínculo siguiente **añade uno** a ese grupo (hasta 4), y mientras no esté lleno no se
  empieza otro. Al fusionar, el grupo pasa a ser el activo (salvo con Cinta Elección).
- **Orden**: 1.º Puño Meteoro + Fortaleza, 2.º Danza Espada, 3.º el 4.º miembro de la ficha. El bot fusionó
  primero Fortaleza en 2 de cada 3 partidas buenas y Danza Espada en la otra [MEDIDO, 312 partidas]; **no se
  ha comparado cuál es mejor**. Fortaleza primero por el muro del minuto 6-12 [CONJETURA]. Un potenciador
  suelto en su hueco no hace nada mientras no esté activo.
- **Vetos: da igual cuáles 3** (siempre que no sean los de la receta). Vetar Maquinación y Agilidad no
  ayuda a que salgan Danza Espada y Fortaleza más que vetar 3 ataques (11-14 % por tanda en los dos casos,
  [MEDIDO, 20.000 sorteos]), y en partidas tampoco: vetar Giro Bola, Giro Rápido e Hiperrayo en vez de los
  automáticos dio ×0,92 (IC95 ×0,80-×1,06) [MEDIDO, 160 parejas]. Con 2 potenciadores aprendidos el juego
  ya no ofrece más [CÓDIGO], así que vetar potenciadores no sirve después del minuto 1.

---

## 7. Alternativas que no son de Acero

**Nuevo (21-10-2026)** [MEDIDO, 20 partidas cada una, semillas 3301-3320, `RESULTS-v6.md` §7]:

| build | ejemplo | llegan al 30 | nivel min 15 / 30 | derrotados | ¿bola de nieve? |
|---|---|---|---|---|---|
| **Fantasma: Bola Sombra + Maquinación + Fortaleza, reservando** | **Spectrier** (Relincho Negro) | **18/20** | 84 / 132 | **6.416** | **sí, a la mitad que el Acero** |
| Fantasma: Viento Aciago + Maquinación + Fortaleza | Spectrier / Mismagius | 17/20 / 17/20 | 72 / 98 · 68 / 93 | ~4.000 | a medias |
| Hiperrayo + Maquinación + Fortaleza | 10 especiales (Reshiram, Eternatus...) | 34/80 | 52-66 / 63-92 | 1.000-2.400 | **no** |

**Spectrier**: Movimiento inicial **Bola Sombra**; vetos, 3 cualesquiera que no sean de la receta; primer
minuto, Maquinación y Fortaleza sin coger ningún otro ataque; vínculos Bola Sombra + Maquinación, luego
Fortaleza [CONJETURA, el orden no se ha comparado]; Pañuelo Elección. Al ser Fantasma puro, Bola Sombra hace
+20 % y Relincho Negro +15 % en cuanto lleva 30 derrotados. [CÓDIGO]

De la v5 (sin habilidades):

| build | ejemplo | llegan al 30 | nivel min 15 / 30 | derrotados | ¿bola de nieve? |
|---|---|---|---|---|---|
| Fantasma con el bot normal (Viento Aciago, Bola Sombra, a veces Maquinación) | **Gengar** | 53 % (60 partidas) | 82 / 118 | 2.863 | a medias: el doble de nivel que la media, un tercio de las muertes del Acero |
| Fantasma: Viento Aciago + Maquinación + Fortaleza, reservando | Polteageist, Mismagius | 85-90 % | 63-70 / 79-88 | ~3.000 | no: aguanta muchísimo pero sube poco |
| Agua: Torbellino + Maquinación + Fortaleza, reservando | Prinplup, Manaphy, Kyogre, Tentacruel | 70-90 % | 58-70 / 77-99 | 2.600-3.900 | no: igual |
| Roca: Avalancha + Danza Espada + Fortaleza | Regirock, Lycanroc, Stonjourner | 20-40 % | 82-96 / 133-169 | 1.700-2.200 | sí, pero muere pronto |
| Hielo: Granizo + Maquinación + Fortaleza | Cryogonal | 45 % | 88 / 124 | 3.788 | a medias |
| Lucha: Patada Giro + Danza Espada + Fortaleza | Conkeldurr, Machamp | 0-20 % | ~29 | ~300 | **no** |
| Dragón: Garra Dragón + Danza Dragón + Fortaleza | Rayquaza | 30 % | 37 | 743 | **no** |

[MEDIDO, 20 partidas cada una salvo Gengar]

- **Lucha ya no funciona**: con el bot normal (que ahora elige Puño Dinámico) el nivel del minuto 15
  baja de ~57 a ~43, y con Patada Giro es peor, porque el giro obliga a meterse en la horda sin el −25 %
  de daño recibido del cuerpo a cuerpo (sólo lo da `kind: 'melee'`). [MEDIDO + CÓDIGO]
- Las de Agua y Fantasma con Maquinación son la mejor forma de **sobrevivir** que se ha medido en esta
  versión, pero no son lo que pide esta guía. [MEDIDO]

---

## 8. Errores que evitar

| error | qué pasa | etiqueta |
|---|---|---|
| Aprender ataques nuevos antes de tener Danza Espada y Fortaleza | se llenan los huecos y Danza Espada no sale hasta el primer vínculo (de mediana, el min 7,7): ×0,80 | [MEDIDO, 160 parejas] |
| Ir sin Pañuelo Elección | con otro objeto en el min 7 llegan al 30 un 30-51 % (con Pañuelo, 72 %) | [MEDIDO, 755 partidas] |
| Usar Maquinación con Puño Meteoro | no le hace nada: Puño Meteoro es físico | [CÓDIGO] |
| Elegir Gholdengo o Magnezone "porque pegan mucho" | Puño Meteoro usa el Ataque: Gholdengo ×0,72, Magnezone ×0,76 | [CÓDIGO] |
| No comprar Movimiento inicial | Repertorio da el 2.º ataque al azar: Puño Meteoro puede no llegar hasta las cartas | [CÓDIGO] |
| Jugar Lucha esperando bola de nieve | ya no la hace | [MEDIDO] |
| Contar con el veneno para la Sentencia | contra los legendarios grandes quita como si tuvieran 10 veces menos vida | [CÓDIGO] |

---
| Aprender MT con la receta de Acero | la MT entra en tu lista de ataques: salen menos Danza Espada y Fortaleza | [CÓDIGO] |
| Gastar en Cápsula Oculta o Menta "para la build" | con esta receta las pruebas de habilidad y naturaleza caben en el ruido (salvo Lucario: Impasible) | [MEDIDO, 10 por fila] |

---

## 9. Datos y cómo repetirlo

| qué | archivo |
|---|---|
| **v6 (21-10-2026): criba, ronda fuerte, receta de Acero, habilidades, Spectrier** | `sim/RESULTS-v6.md`, `sim/out/v6/` |
| Todas las tablas | `sim/RESULTS-v5.md` |
| Priofast antes/ahora (8 Acero × 20, semillas 701-720) | `sim/out/v5/steel-{normal,pf,pfr,pfrs}.jsonl` |
| Criba (966 × 2, corte en el min 15) | `sim/out/v5/screen.jsonl`, `node sim/screenreport.js` |
| Ronda fuerte (47 × 10) | `sim/out/v5/strong.jsonl` |
| Recetas por familia (32 × 20, semillas 901-920) | `sim/out/v5/rec-*.jsonl` |
| Confirmación (semillas 1001-1020) | `sim/out/v5/conf-*.jsonl` |
| Juntas por receta | `sim/out/v5/pool-pfr.jsonl`, `pool-pfrs.jsonl`, `pool-gengar.jsonl` |
| Ficha de los ataques | `node sim/movecards.js --single sim/out/move-dps-1.json` |

Receta en el simulador (priofast con huecos reservados):

```
IR='["choicescarf","quickclaw","leftovers","assaultvest","focussash","lifeorb","shellbell","luckyegg","rockyhelmet","amuletcoin","choiceband"]'
node sim/run.js --dex 638 --bot best --upgrades max --ban auto --max 1900 --seeds 1001-1020 --jobs 14 \
  --opts '{"priority":["meteor-mash","swords-dance","harden"],"reserve":true,"statWeights":{"spd":3},"itemRank":'"$IR"'}'
```

Con Movimiento inicial = Puño Meteoro, añadir `"start":"auto"` (empieza con el 1.º de `priority`). Desde el
21-10-2026, `"abil":"best"` (la mejor habilidad no oculta, `sim/abilpick.js`), `"nature":"jolly"` y
`"start2":"tackle"` (Segundo movimiento inicial) también van en `--opts`.
