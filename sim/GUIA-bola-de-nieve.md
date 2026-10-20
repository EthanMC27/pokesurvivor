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
3. Los más fiables: **Cobalion, Archaludon** (~75 % llegan al minuto 30), **Kartana, Dialga, Empoleon,
   Gholdengo, Klinklang, Lucario y Revavroom** (55-68 %). Baratos (rareza 3): **Durant y Togedemaru** (~53 %).
   [MEDIDO, 40 partidas cada uno]
4. Nivel típico: ~95-100 en el minuto 15 y ~140-160 en el 30, con 7.000-12.000 derrotados. El tope de
   40 Potencias llega poco: en 1 de cada 20 partidas. [MEDIDO]
5. Movimiento inicial: **el de serie**, y Puño Meteoro de segundo con Repertorio. Sólo con **Empoleon y
   Togedemaru** conviene empezar directamente con Puño Meteoro. [MEDIDO]
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

## 4. Ranking (priofast con huecos reservados) [MEDIDO]

Juntando las tres tandas (semillas 701-720 o 901-920, más la confirmación con semillas nuevas
1001-1020). "MI = PM": Movimiento inicial = Puño Meteoro.

| Pokémon | rareza | leg. | partidas | llegan al 30 | mediana | nivel min 15 | nivel min 30* | derrotados | tope Potencia |
|---|---|---|---|---|---|---|---|---|---|
| **Cobalion** | 5 | sí | 40 | **78 %** | 31:35 | 94 | 142 | 7.807 | 0/40 |
| **Archaludon** | 5 | no | 40 | **75 %** | 31:04 | 96 | 152 | 9.989 | 2/40 |
| **Kartana** | 4 | no | 40 | 68 % | 31:10 | 102 | 161 | 12.721 | 5/40 |
| **Dialga** | 5 | sí | 40 | 68 % | 31:04 | 97 | 161 | 10.392 | 2/40 |
| **Empoleon** (MI = PM) | 4 | no | 40 | 65 % | 31:03 | 96 | 144 | 8.148 | 3/40 |
| **Gholdengo** | 4 | no | 40 | 60 % | 31:00 | 91 | 135 | 6.796 | 1/40 |
| **Klinklang** | 4 | no | 40 | 58 % | 30:40 | 100 | 155 | 8.732 | 2/40 |
| **Lucario** | 4 | no | 40 | 55 % | 30:52 | 101 | 159 | 7.971 | 1/40 |
| **Revavroom** | 4 | no | 40 | 55 % | 30:45 | 101 | 160 | 9.289 | 2/40 |
| **Durant** (barato) | 3 | no | 40 | 55 % | 30:51 | 93 | 141 | 6.611 | 2/40 |
| **Togedemaru** (barato, MI = PM) | 3 | no | 40 | 52 % | 30:39 | 89 | 133 | 4.764 | 0/40 |
| Registeel | 5 | sí | 40 | 48 % | 26:10 | 100 | 158 | 4.552 | 3/40 |
| Perrserker | 3 | no | 20 | 45 % | 17:28 | 106 | 182 | 4.668 | 3/20 |
| Melmetal | 5 | sí | 40 | 40 % | 10:10 | 108 | **194** | 2.379 | **7/40** |
| Skarmory | 3 | no | 20 | 40 % | 8:53 | 92 | 138 | 1.804 | 0/20 |
| Pawniard | 2 | no | 40 | 35 % | 8:49 | 96 | 145 | 1.742 | 2/40 |
| Klang | 3 | no | 20 | 25 % | 9:19 | 101 | 186 | 1.924 | 1/20 |
| Bisharp | 3 | no | 20 | 20 % | 8:55 | 104 | 172 | 1.802 | 1/20 |
| Orthworm | 3 | no | 20 | 15 % | 9:10 | 93 | 148 | 1.917 | 0/20 |

*Nivel mediano en el minuto 30 de las que llegan.

- Con 40 partidas por Pokémon, diferencias de ±10 puntos en "llegan al 30" son ruido. Entre las dos
  tandas un mismo Pokémon varía bastante (Registeel 12/20 y luego 7/20; Gholdengo 15/20 y luego 9/20). [MEDIDO]
- **Los Acero puros (Melmetal, Perrserker, Klang) son los que más suben** (nivel 182-194 en el min 30 y
  más topes de Potencia), por el +20 % del monotipo, pero **se mueren más**: son lentos (velocidad 92-99)
  o tienen poca Def. Esp. Si te sabes mover mejor que el bot, son la bola de nieve más fuerte. [MEDIDO + CONJETURA]

---

## 5. Fichas

Lo común a todos (y por eso no se repite): **vetos** los automáticos; **ataque principal** Puño
Meteoro; **grupo**: Puño Meteoro + Danza Espada + Fortaleza y un cuarto miembro; **objeto**: Pañuelo
Elección en cuanto salga (si no, Garra Rápida o Restos; **nunca** la Cinta Elección); huecos reservados
hasta tener Danza Espada y Fortaleza. Los minutos son medianas de las partidas que llegan vivas al
minuto 21 (`node sim/cardorder.js sim/out/v5/pool-pfr.jsonl --dex N`). [MEDIDO, 21-32 partidas por Pokémon]

### 5.1 Caros

#### Cobalion (638) — el más fiable · rareza 5, legendario
- **Vetos:** Maquinación, Agilidad, Disparo Espejo. **Movimiento inicial:** el de serie (Garra Metal);
  Puño Meteoro con Repertorio.
- **Grupo:** Puño Meteoro + Danza Espada + Fortaleza + **Garra Metal** (22 de 32) o Placaje (8).
- **Hitos:** Danza Espada y Fortaleza en el 0:40; Puño Meteoro evoluciona en el 2:06; Danza al 5 en el
  3:24, Fortaleza al 5 en el 4:36; Potencia n.º 10 en el 13, n.º 20 en el 24.
- 31 de 40 llegan al minuto 30; nunca llegó al tope de Potencia (sube algo menos que los demás).

#### Archaludon (1018) — el mejor no legendario · rareza 5
- **Vetos:** Maquinación, Agilidad, Sustituto. **Movimiento inicial:** el de serie (Garra Metal).
- **Grupo:** + **Garra Metal** (13 de 30) o **Garra Dragón** (10).
- **Hitos:** Fortaleza 0:30, Danza Espada 0:40, evolución 2:06, Danza al 5 en el 3:36, Fortaleza al 5 en
  el 4:30, Potencia 10 en el 11:50 y 20 en el 20:40.
- Pega un 8 % menos que antes con Puño Meteoro (Ataque < At. Esp.), y aun así es de los mejores.
  **Ojo:** con Movimiento inicial = Puño Meteoro le fue peor (9/20 frente a 16/20 con las mismas semillas). [MEDIDO, 20 parejas]

#### Kartana (798) — el que más mata · rareza 4
- **Vetos:** Maquinación, Agilidad, Disparo Espejo. **Movimiento inicial:** el de serie (Látigo Cepa).
- **Grupo:** + **Látigo Cepa** (12 de 27) o Placaje (10).
- **Hitos:** Fortaleza 0:30, Danza Espada 0:40, evolución 2:06, las dos al 5 hacia el 4:00, Potencia 10
  en el 11:30, 20 en el 23:50.
- Mediana de 12.721 derrotados y 5 de 40 al tope de Potencia: la bola de nieve más fuerte de los fiables.
  Def. Esp. muy baja (31): los enemigos especiales le pegan un 25 % más. [CÓDIGO]

#### Dialga (483) · rareza 5, legendario
- **Vetos:** Maquinación, Agilidad, Sustituto. **Movimiento inicial:** el de serie (Garra Metal).
- **Grupo:** + **Garra Metal** (15 de 27).
- **Hitos:** Danza Espada 0:24, Fortaleza 0:36, evolución 2:18, Potencia 10 en el 11:20, 20 en el 21:30,
  30 en el 27 (11 de 27).
- Antes era el de más nivel pero moría pronto (7/20); ahora 27 de 40 llegan al 30.

#### Empoleon (395) — con Movimiento inicial · rareza 4
- **Vetos:** Agilidad, Sustituto, Disparo Espejo. **Movimiento inicial: Puño Meteoro** (Repertorio da
  otro al azar).
- **Grupo:** + **Torbellino** (9 de 26), Placaje o Garra Metal.
- **Hitos:** Danza Espada 0:30, Fortaleza 0:36, evolución 1:54, Potencia 10 en el 13, 20 en el 21:40.
- Con el inicial de serie (Pistola Agua) le fue mal: 6/20. Con Puño Meteoro de inicial, 26/40.
  [MEDIDO, 20 parejas: ×1,64]

#### Gholdengo (1000) · rareza 4
- **Vetos:** Agilidad, Sustituto, Disparo Espejo. **Movimiento inicial:** el de serie (Garra Metal).
- **Grupo:** + **Garra Metal** (13 de 25) o Lengüetazo (6).
- **Hitos:** Danza Espada 0:24, Fortaleza 0:30, evolución 2:06, Potencia 10 en el 13.
- Es el que más pierde con el cambio: Puño Meteoro le pega un 28 % menos (Ataque 1,03 frente a At. Esp.
  1,43). Sigue siendo fiable (60 %) pero mata menos que los demás (6.796). [CÓDIGO + MEDIDO]

#### Klinklang (601) — Acero puro · rareza 4
- **Vetos:** Maquinación, Agilidad, Sustituto. **Movimiento inicial:** el de serie (Garra Metal).
- **Grupo:** + **Placaje** (13 de 23) o Garra Metal (10).
- **Hitos:** Danza Espada 0:30, Fortaleza 0:36, evolución 1:54, Potencia 10 en el 13, 20 en el 21.
- +20 % de daño con Puño Meteoro por ser monotipo. [CÓDIGO]

#### Lucario (448) · rareza 4
- **Vetos:** Maquinación, Agilidad, Disparo Espejo. **Movimiento inicial:** el de serie (Golpe Kárate).
- **Grupo:** + **Golpe Kárate** (14 de 22).
- **Hitos:** Danza Espada y Fortaleza hacia el 0:30, evolución 2:36, Potencia 10 en el 11:30, 20 en el 22,
  30 en el 27 (10 de 22).

#### Revavroom (966) · rareza 4
- **Vetos:** Maquinación, Agilidad, Disparo Espejo. **Movimiento inicial:** el de serie (Garra Metal).
- **Grupo:** + **Garra Metal** (15 de 23).
- **Hitos:** Fortaleza 0:18, Danza Espada 0:30, evolución 2:12, Potencia 10 en el 11, 20 en el 23.
- Con Movimiento inicial = Puño Meteoro, peor (8/20 frente a 11/20). [MEDIDO, 20 parejas, ruido]

### 5.2 Baratos (rareza 3)

#### Durant (632) — el mejor barato
- **Vetos:** Maquinación, Agilidad, Disparo Espejo. **Movimiento inicial:** el de serie (Picadura).
- **Grupo:** + **Picadura** (9 de 22) o Garra Metal (7).
- **Hitos:** Danza Espada 0:42, Fortaleza 1:00, evolución 2:18, Danza al 5 en el 4:30, Fortaleza al 5 en
  el 5, Potencia 10 en el 12, 20 en el 22.
- Velocidad 124: el más rápido de los baratos. 22 de 40 al minuto 30 (8/20 y luego 14/20).

#### Togedemaru (777) — con Movimiento inicial
- **Vetos:** Maquinación, Agilidad, Disparo Espejo. **Movimiento inicial: Puño Meteoro.**
- **Grupo:** + **Placaje** (8 de 21) o Golpe Cuerpo (5).
- **Hitos:** Danza Espada 0:30, Fortaleza 0:48, evolución 1:54, Potencia 10 en el 11:40.
- Con el inicial de serie (Impactrueno), 6/20; con Puño Meteoro, 21/40. [MEDIDO, 20 parejas: ×1,67]
- Sube algo menos que los demás (133 en el min 30, 4.764 derrotados).

#### Si no tienes ninguno de estos
- **Perrserker** (rareza 3, Acero puro) y **Pawniard** (rareza 2) con la misma receta: más nivel que
  Durant, pero un 35-45 % llegan al minuto 30. **Klang, Bisharp y Orthworm** con el bot se mueren antes
  del 10 casi siempre (15-25 %). [MEDIDO, 20-40 partidas]

---

## 6. Orden de cartas por fase (todos los de arriba) [MEDIDO]

| minuto | qué coger |
|---|---|
| **inicio** | Movimiento inicial: el de serie (Empoleon y Togedemaru: Puño Meteoro). Repertorio: **Puño Meteoro**. |
| **0:00-1:00** | **Danza Espada y Fortaleza** en cuanto salgan (hacia el 0:30-0:40). **Ningún otro ataque nuevo** mientras falten. El resto: mejoras de Puño Meteoro. |
| **1:00-2:30** | Puño Meteoro al 5 (hacia el 1:30) y **Potencia** en cuanto salga (la pide su evolución). Evoluciona hacia el 2:00. **Primer vínculo: Puño Meteoro + Danza Espada + Fortaleza.** |
| **2:30-5:00** | Danza Espada al 5 (3:00-4:30) y Fortaleza al 5 (4:00-5:00). El 4.º ataque (ver ficha) y el 4.º miembro del grupo. |
| **2:00-7:00** | **Pañuelo Elección** en cuanto salga. |
| **5:00-12:00** | El muro: Vigor, Carrera, Reflejos y Síntesis repartidos, Potencia cuando salga (n.º 10 hacia el min 11-13). Muévete en círculos amplios. |
| **12:00-30:00** | Sobre todo Potencia (n.º 20 hacia el 21-24), Vigor y Síntesis. El tope de 40 llega en ~5 % de las partidas. |

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
| Movimiento inicial = Puño Meteoro con todos | sólo ayuda a Empoleon y Togedemaru; en conjunto ×0,98 | [MEDIDO, 160 parejas] |
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
