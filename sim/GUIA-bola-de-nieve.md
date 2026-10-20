# Guía de bola de nieve (versión del juego del 19-10-2026)

Guía para un jugador **humano** que quiere ganar matando mucho y subiendo mucho de nivel, sin
quedarse sólo en huir. Condición: llegar al minuto 30 en la mitad de las partidas o más, porque
morir pronto también corta la bola de nieve.

Escenario de todas las pruebas: tienda de Mejoras al máximo (incluida **Movimiento inicial**),
3 vetos automáticos y el mejor bot del simulador (`--bot best`). Tablas completas y método:
`sim/RESULTS-v5.md`. Cada afirmación lleva una etiqueta:

- **[MEDIDO]**: sale de partidas simuladas; se dice cuántas.
- **[CÓDIGO]**: sale de las reglas del juego (`js/`), sin azar.
- **[CONJETURA]**: razonamiento o tendencia sin prueba suficiente.

El bot no juega como una persona: los números sirven para **comparar** builds, no como promesa.

---

## 1. Resumen en 30 segundos

1. La mejor bola de nieve sigue siendo un **Pokémon de Acero con Puño Meteoro evolucionado**,
   fusionado con **Danza Espada y Fortaleza**, y el **Pañuelo Elección** en cuanto salga. [MEDIDO, 660 partidas]
2. **Novedad importante: deja huecos libres.** No aprendas ningún otro ataque hasta tener Danza Espada
   y Fortaleza. Con los 38 ataques nuevos, si llenas los 4 huecos en el primer minuto, Danza Espada
   ya no te sale hasta el primer vínculo. Sin esto la build va mucho peor. [MEDIDO + CÓDIGO]
3. Los más fiables: **Kartana, Cobalion y Dialga** (70 % llegan al minuto 30), **Klinklang, Archaludon,
   Gholdengo, Melmetal, Empoleon y Lucario** (50-65 %). Baratos (rareza 3): **Perrserker y Durant** (60-70 %).
   [MEDIDO, 20 partidas con la receta de jugador + 20-40 con la del bot]
4. Nivel típico: ~95-100 en el minuto 15 y ~140-160 en el 30, con 7.000-12.000 derrotados. El tope de
   40 Potencias llega poco: en 1 de cada 20 partidas. [MEDIDO]
5. **Movimiento inicial: Puño Meteoro**, con todos. Repertorio te da el segundo ataque **al azar**
   (`startRun`: `G.U.pick`) [CÓDIGO]: sin la mejora de Movimiento inicial no hay forma segura de empezar con él.
   (Las pruebas anteriores dejaban al bot elegir el de Repertorio; ver §4 y `FIDELITY.md`, cuarta revisión.)
6. Ya **no** hacen bola de nieve: Lucha (Golpe Kárate + Esfera Aural, ni Patada Giro), Dragón (Garra
   Dragón) ni Roca (Avalancha, que sube de nivel pero muere pronto). Agua y Fantasma con Maquinación
   aguantan muchísimo pero suben poco. [MEDIDO]

---

## 2. Qué ha cambiado respecto a la guía anterior

| antes | ahora | por qué |
|---|---|---|
| priofast: Puño Meteoro + Danza Espada + Fortaleza + Pañuelo, ~69 % al minuto 30 | lo mismo **sin reservar huecos**: 42 %; **reservando**: 55 % (×1,50 frente al bot normal) | con más ataques en la lista se llenan los huecos pronto y con 4 huecos llenos no salen ataques nuevos [MEDIDO, 480 partidas; CÓDIGO] |
| nivel ~100 en el min 15, 150-230 en el 30 | ~100 en el min 15 (igual), ~150 en el 30 | más muertes en el muro del minuto 6-12 y menos cartas por minuto pasado el 20 [MEDIDO] |
| tope de Potencia en ~25 % de las partidas | ~5 % | lo mismo: el final es más lento [MEDIDO] |
| Gholdengo y Magnezone pegaban con su At. Esp. | Puño Meteoro es **físico**: Gholdengo pega un 28 % menos, Magnezone un 24 % | Ataque y At. Esp. separados [CÓDIGO] |
| — | los **Acero puros** pegan +20 % con Puño Meteoro (Klinklang, Melmetal, Registeel, Perrserker, Klang, Orthworm) | monotipos +20 % [CÓDIGO]; sube el nivel (Melmetal 194 en el min 30) pero no el aguante |
| Lucha con Golpe Kárate + Esfera Aural hacía bola de nieve "a medias" | ya no: nivel 43 en el min 15 | Esfera Aural es especial y Danza Espada ya no la sube [CÓDIGO + MEDIDO] |
| el veneno era lo que mejor escalaba al final | fuera de la Sentencia, igual; **en la Sentencia ya no mata legendarios gigantes** | % de vida "efectiva" con raíz por encima de 60.000 [CÓDIGO] |
| Pañuelo Elección: la clave | sigue siéndolo: 72 % llegan al 30 con el Pañuelo en el min 7, frente a 30-51 % con otro objeto | [MEDIDO, 755 partidas] |

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

**Receta de jugador** (la que puede hacer un humano): Movimiento inicial = Puño Meteoro, Repertorio
**al azar**, huecos reservados, Pañuelo primero. 20 partidas por Pokémon con semillas nuevas (1101-1120,
`sim/out/v5/human-pf.jsonl`). La columna "bot" es la misma receta pero con el 2.º ataque elegido por el
bot (Puño Meteoro de Repertorio; 40 partidas de 3 tandas): sirve para ver si el orden se sostiene.

| Pokémon | rareza | leg. | llegan al 30 (jugador) | llegan al 30 (bot) | nivel min 15 | nivel min 30* | derrotados | tope Potencia |
|---|---|---|---|---|---|---|---|---|
| **Kartana** | 4 | no | **14/20 (70 %)** | 27/40 | 103 | 181 | 15.072 | 5/20 |
| **Cobalion** | 5 | sí | **14/20 (70 %)** | 31/40 | 97 | 151 | 8.945 | 0/20 |
| **Dialga** | 5 | sí | **14/20 (70 %)** | 27/40 | 98 | 164 | 8.658 | 2/20 |
| **Perrserker** (barato) | 3 | no | **14/20 (70 %)** | 9/20 | 104 | 174 | 14.524 | 2/20 |
| **Klinklang** | 4 | no | 13/20 (65 %) | 23/40 | 103 | 164 | 10.512 | 1/20 |
| **Archaludon** | 5 | no | 12/20 (60 %) | 30/40 | 96 | 150 | 7.986 | 3/20 |
| **Gholdengo** | 4 | no | 12/20 (60 %) | 24/40 | 94 | 148 | 5.880 | 3/20 |
| **Durant** (barato) | 3 | no | 12/20 (60 %) | 22/40 | 95 | 148 | 7.594 | 2/20 |
| **Melmetal** | 5 | sí | 11/20 (55 %) | 16/40 | 106 | **189** | 13.500 | **5/20** |
| **Empoleon** | 4 | no | 11/20 (55 %) | 26/40 | 92 | 137 | 7.234 | 0/20 |
| **Lucario** | 4 | no | 10/20 (50 %) | 22/40 | 87 | 142 | 3.334 | 1/20 |
| Togedemaru (barato) | 3 | no | 9/20 (45 %) | 21/40 | 96 | 147 | 2.682 | 0/20 |
| Revavroom | 4 | no | 5/20 (25 %) | 22/40 | 100 | 169 | 1.910 | 0/20 |

*Nivel mediano en el minuto 30 de las que llegan. Derrotados: mediana de todas las partidas.

Sin medir con la receta de jugador (sólo con la del bot, 20-40 partidas): Registeel 48 %, Skarmory 40 %,
Pawniard 35 %, Klang 25 %, Bisharp 20 %, Orthworm 15 %.

- En conjunto la receta de jugador va **igual o algo mejor** que la del bot: 151/260 (58 %) al minuto 30,
  nivel 100 en el 15 y 158 en el 30, 24/260 al tope de Potencia. [MEDIDO]
- Con 20 partidas, ±3 en "llegan al 30" es ruido normal: Revavroom (5/20 frente a 22/40) o Perrserker
  (14/20 frente a 9/20) cambian mucho de una tanda a otra. Lo fiable es lo que sale bien en las dos columnas:
  **Kartana, Cobalion, Dialga, Klinklang, Archaludon, Gholdengo y Durant**. [MEDIDO]
- **Los Acero puros (Melmetal, Perrserker, Klinklang) son los que más suben** (nivel 164-189 en el min 30,
  más topes de Potencia) por el +20 % del monotipo. Melmetal y Perrserker son lentos (92-99): en manos de
  alguien que se mueva mejor que el bot, probablemente son la bola de nieve más fuerte. [MEDIDO + CONJETURA]

---

## 5. Fichas

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

## 9. Datos y cómo repetirlo

| qué | archivo |
|---|---|
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

Con Movimiento inicial = Puño Meteoro, añadir `"start":"auto"` (empieza con el 1.º de `priority`).
