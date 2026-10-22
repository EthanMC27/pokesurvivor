# Resultados v6 — versión del juego del 21-10-2026 (naturalezas, habilidades, MT)

Simulador al día con upstream ce57853 (`sim/FIDELITY.md`, quinta revisión). Escenario de siempre: tienda de
Mejoras al máximo, 3 vetos automáticos, `--bot best`. Nuevo: **cada Pokémon lleva su habilidad** (por
defecto la "mejor no oculta" según `sim/abilpick.js`, la que puedes poner con una Cápsula de 1.500) y
**naturaleza neutra** salvo donde se diga. Datos: `sim/out/v6/`. Etiquetas: [MEDIDO] (con nº de partidas),
[CÓDIGO], [CONJETURA].

"Receta de Acero" = la receta de jugador de la v5: Movimiento inicial **Puño Meteoro**, Repertorio **al azar**,
prioridad Puño Meteoro → Danza Espada → Fortaleza **reservando huecos** (`reserve`), velocidad ×3 en las
cartas de stat y el Pañuelo Elección primero (`itemRank`).

## 1. Qué cambia en el juego [CÓDIGO]

- Ningún ataque, carta, objeto, enemigo ni mejora antigua cambia. Lo nuevo es la **naturaleza** (±10 % a dos
  stats), la **habilidad** (efectos de combate reales, `data/ability-fx.js`), las **MT** y la mejora **Segundo
  movimiento inicial** (Repertorio deja de ser al azar si la compras). Detalle en `FIDELITY.md`.
- Una MT aprendida entra en la lista de ataques del Pokémon (`G.Moves.poolFor`): con la receta de Acero
  **diluye** las cartas de Danza Espada y Fortaleza. No conviene aprender MT para esta receta.

## 2. El simulador y el bot

| prueba | resultado | etiqueta |
|---|---|---|
| ¿Cambia la tabla de daño de los ataques? (4 ataques × 3 semillas, código de antes y de ahora) | **idéntica**: no hace falta recalibrar `move-dps.json` | [MEDIDO] |
| Cartas valorando la habilidad (`abilK` en `bots/cards.js`) frente al bot de ayer | ×1,01 de tiempo (IC95 ×0,96-×1,06); al min 20: 25 frente a 24 | [MEDIDO, 80 parejas] |
| Esquivar teniendo en cuenta la habilidad y la defensa por categoría (`inK` en `pro-a.js`) | **peor**: al min 20, 15 frente a 24 (15 parejas sólo el viejo, 6 sólo el nuevo) → apagado | [MEDIDO, 80 parejas] |

`best` = pro-a (sin `inK`) + cards.js con `abilK`. Congelados para comparar: `best-pre22`, `best-c22`.

## 3. Criba (966 Pokémon × 2 semillas, hasta el minuto 15, bot normal) [MEDIDO, 1.932 partidas]

`sim/out/v6/screen.jsonl`. La media de nivel en el min 15 es la misma que en la v5 (32,2 las dos): con 2
semillas cada Pokémon tiene mucho ruido. Arriba: Spectrier (95), Koffing (94), Primarina (88), Keldeo (86),
Skeledirge (81), Venusaur (79), Melmetal (77), Genesect y Magearna (76). **Hiperrayo evolucionado** aparece
en muchas de las mejores (es Normal: lo aprende cualquiera).

## 4. Ronda fuerte (24 mejores de la criba sin los de Acero, 6 semillas, partida entera) [MEDIDO, 144]

| Pokémon | llegan al 30 | nv min 15 | derrotados |
|---|---|---|---|
| Spectrier | 6/6 | 96 | 8.841 |
| Mismagius | 4/6 | 81 | 4.241 |
| Keldeo | 4/6 | 66 | 3.031 |
| Polteageist | 3/6 | 80 | 2.901 |
| Gengar | 3/6 | 73 | 2.759 |
| Eternatus, Koffing, Rampardos, Kilowattrel, Bellibolt | 2/6 | 81-101 | 800-2.500 |
| los otros 14 | 0-2/6 | | < 2.500 |

Sube mucho y muere pronto: Eternatus, Koffing, Reshiram, Rampardos. Sólo Spectrier parecía bola de nieve; con
semillas nuevas baja (§6).

## 5. Receta de Acero con habilidades [MEDIDO]

10 semillas (3101-3110) para los 16 y 20 más (3301-3320) para los 8 mejores. **Total: 101/160 (63 %) en la
primera tanda** (v5: 58 %). Nivel min 30 = mediana de las que llegan; derrotados = mediana de todas; tope =
partidas con 40 Potencias.

| Pokémon | habilidad | llegan al 30 | nv min 15 | nv min 30 | derrotados | tope 40 |
|---|---|---|---|---|---|---|
| **Archaludon** (1018) | Robustez | **25/30** | 98 | 160 | 11.968 | 4/30 |
| **Kartana** (798) | Ultraimpulso | **23/30** | 103 | **177** | **13.893** | **7/30** |
| **Lucario** (448) | Impasible | **23/30** | 100 | 149 | 9.693 | 1/30 |
| **Dialga** (483) | Presión | 22/30 | 103 | 159 | 12.122 | 3/30 |
| **Revavroom** (966) | Capa Mágica | 21/30 | 103 | 172 | 13.427 | 5/30 |
| Cobalion (638) | Justiciero | 20/30 | 95 | 154 | 10.343 | 1/30 |
| Magearna (801) | Coránima | 16/30 | 106 | 181 | 11.358 | 4/30 |
| Melmetal (809) | Puño Férreo | 13/30 | 107 | 183 | 2.563 | 6/30 |
| Togedemaru (777) | Punta Acero | 8/10 | 96 | 148 | 9.110 | 1/10 |
| Empoleon (395) | Torrente | 7/10 | 84 | 129 | 6.543 | 2/10 |
| Gholdengo (1000) | Cuerpo Áureo | 6/10 | 99 | 156 | 9.036 | 0/10 |
| Klinklang (601) | Más | 5/10 | 106 | 175 | 12.214 | 1/10 |
| Celesteela (797) | Ultraimpulso | 5/10 | 97 | 155 | 10.244 | 1/10 |
| Perrserker (863) | Garra Dura | 5/10 | 105 | 165 | 7.712 | 2/10 |
| Genesect (649) | Descarga | 4/10 | 105 | 169 | 2.181 | 1/10 |
| Durant (632) | Entusiasmo | 2/10 | 79 | 190 | 2.613 | 0/10 |

- Con 10 partidas, ±3 es ruido; con 30, ±5. Lo fiable (arriba en las dos tandas): **Archaludon, Kartana,
  Lucario, Dialga y Revavroom**. Revavroom era irregular en la v5 (5/20 y 22/40); ahora 8/10 y 13/20.
- **Kartana** sigue siendo el que más mata y el que más llega al tope de Potencia (mediana de 28 Potencias).
- **Melmetal y Magearna** son los que más suben (181-183 en el min 30) pero mueren mucho en el muro.
- Pañuelo Elección: con él llegan al 30 148 de 171 partidas; sin él, 15 de 79. **Ojo**: está sesgado (quien
  muere pronto no llega a tenerlo; sale de mediana en el minuto 5-8), pero apunta a lo mismo que en la v5.
  [MEDIDO, 250 partidas]

## 6. Habilidades, naturalezas y 2.º movimiento [MEDIDO, 10 partidas por fila, mismas semillas]

| Pokémon | prueba | llegan al 30 | derrotados |
|---|---|---|---|
| Archaludon | Robustez / Firmeza / Acérrimo (oculta) | 8 / 6 / 6 | 11.968 / 9.624 / 9.373 |
| Perrserker | Garra Dura / Armadura Batalla / Alma Acerada (oculta) | 5 / 7 / 6 | 7.712 / 12.365 / 14.380 |
| Klinklang | Más / Cuerpo Puro | 5 / 2 | 12.214 / 2.231 |
| Durant | Entusiasmo / Enjambre | 2 / 4 | 2.613 / 5.394 |
| **Lucario** | **Impasible / Fuerza Mental** | **9 / 5** | 9.851 / 6.618 |
| Togedemaru | Punta Acero / Robustez (oculta) | 8 / 5 | 9.110 / 6.453 |
| Revavroom | Funda / Filtro (oculta) | 8 / 8 | 14.228 / 12.004 |
| Dialga | Presión / Telepatía (oculta) | 7 / 8 | 12.961 / 11.654 |
| Kartana | neutra / Firme / Alegre | 9 / 7 / 10 | 16.644 / 18.304 / 16.026 |
| Lucario Pícara (Impasible) | 2.º al azar / Placaje / Golpe Kárate | 9 / 8 / 7 | 13.116 / 10.538 / 13.104 |

- Casi todo cabe en el ruido. Lo más marcado: **Lucario con Impasible** (9 frente a 5) y Klinklang con Más
  (5 frente a 2). Las ocultas (Cápsula Oculta, 5.000) no han dado nada claro: no las compres por esta receta.
- Elegir el 2.º movimiento (mejora nueva) no se nota con esta receta.

## 7. Otras recetas

| receta | Pokémon | llegan al 30 | nv min 15 / 30 | derrotados | ¿bola de nieve? |
|---|---|---|---|---|---|
| Hiperrayo + Maquinación + Fortaleza, reservando | 10 especiales de la criba | 34/80 | 52-66 / 63-92 | 1.000-2.400 | **no** [MEDIDO, 80] |
| Spectrier, bot normal | Spectrier | 14/20 (20/26 con la ronda fuerte) | 77 / 104 | 4.185 | a medias [MEDIDO, 20] |
| Viento Aciago + Maquinación + Fortaleza, reservando | Spectrier | 17/20 | 72 / 98 | 4.119 | a medias [MEDIDO, 20] |
| igual | Mismagius | 17/20 | 68 / 93 | 3.878 | no [MEDIDO, 20] |

| **Bola Sombra + Maquinación + Fortaleza, reservando** | **Spectrier** | **18/20** | 84 / 132 | **6.416** | **sí, la mejor fuera del Acero** [MEDIDO, 20] |
| igual | Mismagius | 17/20 | 72 / 99 | 4.463 | a medias [MEDIDO, 20] |

- Spectrier (Fantasma puro: +20 % con Bola Sombra; At. Esp. 1,5; velocidad 133; Relincho Negro +15 % de
  daño en cuanto lleva 30 derrotados) es lo mejor de lo que no es de Acero: aguanta tanto como el mejor de
  Acero y hace la mitad de derrotados (6.416 frente a ~12.000-14.000). Con el bot normal y semillas nuevas,
  14/20 y 4.185: las 6 de la ronda fuerte salieron con suerte.
- Las 3 recetas de Spectrier y Mismagius van en las mismas semillas (3301-3320).
- Comprobación de determinismo, de rebote: tras el corte de corriente, una cola vieja y la nueva hicieron las
  mismas 40 partidas de Bola Sombra; las 40 salieron idénticas. [MEDIDO, 40 parejas]

## 8. Cómo repetirlo

```
IR='["choicescarf","quickclaw","leftovers","assaultvest","focussash","lifeorb","shellbell","luckyegg","rockyhelmet","amuletcoin","choiceband"]'
node sim/sweep.js --bot best --dex 798,448,1018 --seeds 3301-3320 --max 1900 --ban auto --jobs 14 --out x.jsonl \
  --opts '{"priority":["meteor-mash","swords-dance","harden"],"reserve":true,"statWeights":{"spd":3},"start":"auto","abil":"best","itemRank":'"$IR"'}'
node sim/out/v6/tab.js x.jsonl          # tabla por Pokémon
node sim/out/v6/ab.js a.jsonl b.jsonl   # comparación por parejas (mismas semillas)
```

Colas: `sim/out/v6/queue*.sh` (la 6 retoma la 5 tras un corte de corriente; `sweep.js` salta lo hecho).
