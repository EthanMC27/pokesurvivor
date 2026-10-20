# Bola de nieve con la versión del 19-10-2026 — resultados

Escenario de todo: tienda de Mejoras al máximo (incluida la nueva **Movimiento inicial**), 3 vetos
automáticos (`--ban auto`), `--bot best`, semillas nuevas que no se usaron para ajustar nada.
Datos en `sim/out/v5/` (no están en git: `sim/out/` está en `.gitignore`); comandos al final.
Guía para jugar: `sim/GUIA-bola-de-nieve.md`. Lo que cambió en el código del juego y en el
simulador: `sim/FIDELITY.md`, "Tercera revisión".

Columnas de las tablas de `snowstats.js`: `t med` mediana de tiempo, `p10` el peor 10 %, `≥30`
partidas que llegan al minuto 30, `nv10/nv15/nv30` nivel mediano en ese minuto de las que siguen
vivas, `derr.` derrotados (mediana), `tope Pot.` partidas que llegan a las 40 cartas de Potencia,
`min tope` minuto mediano en que llegan, `atk@15` cartas de Potencia en el minuto 15, `vs base`
cociente geométrico de tiempo emparejado por semilla con la primera variante (±1 error típico).

## Conclusiones

1. **La mejor bola de nieve sigue siendo Acero + Puño Meteoro + Danza Espada + Fortaleza + Pañuelo
   Elección, pero hay que reservar huecos** (no aprender otros ataques hasta tener las dos danzas). Sin
   reservar, 42 % llegan al minuto 30; reservando, 55 % (×1,50 frente al bot normal, 160 parejas).
2. Juntando 660 partidas con la receta: **Cobalion 78 %, Archaludon 75 %, Kartana y Dialga 68 %,
   Empoleon (con Movimiento inicial = Puño Meteoro) 65 %, Gholdengo 60 %, Klinklang 58 %, Lucario,
   Revavroom y Durant 55 %, Togedemaru (con Movimiento inicial) 52 %** al minuto 30, con nivel ~95-100
   en el min 15 y ~140-160 en el 30.
3. **Peor que en la versión anterior** (mismos 8 Pokémon: 69 % → 55 % al 30, nivel 171 → 159 en el 30,
   tope de Potencia 26 % → 6 %), por más muertes en el muro del minuto 6-12 y un final más lento.
4. **Lucha ya no hace bola de nieve** (Esfera Aural es especial y Danza Espada ya no la sube); ni Patada
   Giro ni Garra Dragón la sustituyen. Roca sube de nivel pero muere pronto.
5. **Agua y Fantasma con Maquinación** (Torbellino, Viento Aciago) son lo más seguro de esta versión
   (70-90 % al 30) pero suben poco: no son bola de nieve. Gengar con el bot normal está a medio camino.
6. **Veneno**: igual que antes fuera de la Sentencia; en ella ya no tumba legendarios gigantes.

## 1. Qué cambió y qué se esperaba [CÓDIGO]

- Puño Meteoro es **físico**: pega con el Ataque del Pokémon, no con el mayor de los dos.
  Gholdengo ×0,72, Magnezone/Magneton ×0,76, Heatran ×0,85, Magearna ×0,86, Empoleon y Dialga ×0,89,
  Duraludon ×0,90, Archaludon ×0,92. Los Acero puros (monotipo) **×1,2**: Melmetal, Perrserker,
  Klinklang, Orthworm, Klang, Registeel, Meltan, Klink.
- Danza Espada y Danza Dragón sólo suben ataques físicos: **ya no suben Esfera Aural** (especial).
  Maquinación (nueva, la aprende cualquiera) sube los especiales.
- La defensa media de los enemigos frente a cada categoría está entre ×0,95 y ×1,13 según el minuto
  (`G.Stats.taken`, media del elenco): no cambia el reparto entre físicos y especiales de forma apreciable.
- El veneno sólo pierde fuerza contra vidas de más de 60.000 (los legendarios de la Sentencia).
- Cada Pokémon tiene ahora 3-7 ataques más en su lista (38 nuevos): **eso tiene un efecto que no se
  veía en el código a simple vista** (sección 2).

## 2. Priofast con los Acero de antes (8 Pokémon × 20 semillas, 701-720) [MEDIDO, 640 partidas]

Variantes (todas emparejadas en las mismas semillas):
- `steel-normal`: bot normal.
- `steel-pf`: priofast tal cual (prioridad Puño Meteoro → Danza Espada → Fortaleza, Carrera ×3,
  Pañuelo Elección primero; inicial de serie y Puño Meteoro con Repertorio).
- `steel-pfr`: priofast **+ huecos reservados** (`reserve`: no aprender ningún otro ataque mientras
  falten los de la prioridad y queden justo esos huecos libres).
- `steel-pfrs`: `pfr` + Movimiento inicial = Puño Meteoro (Repertorio da otro ataque).

```
variante      Pokémon     n    t med  p10   ≥30     nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base        
steel-normal  Archaludon  20   8:43   6:36  8/20    63    106   170   1748   1/20       28.8      13                     
steel-pf      Archaludon  20   8:41   5:12  8/20    64    99    157   1738   0/20       -         12      ×0.92 ±23% (20)
steel-pfr     Archaludon  20   31:09  7:07  16/20   64    101   161   11247  1/20       26.2      14      ×1.70 ±22% (20)
steel-pfrs    Archaludon  20   20:19  6:39  9/20    63    91    147   4606   0/20       -         11      ×1.11 ±24% (20)
steel-normal  Lucario     20   10:24  5:45  9/20    65    95    138   1917   1/20       29.3      12                     
steel-pf      Lucario     20   30:52  4:51  11/20   63    95    139   7994   0/20       -         9       ×1.12 ±27% (20)
steel-pfr     Lucario     20   31:12  5:10  13/20   64    102   159   9187   1/20       30.0      12      ×1.33 ±26% (20)
steel-pfrs    Lucario     20   30:55  5:58  10/20   64    99    158   7957   2/20       27.5      11      ×1.12 ±25% (20)
steel-normal  Gholdengo   20   10:18  5:58  7/20    61    95    138   2168   0/20       -         10                     
steel-pf      Gholdengo   20   31:21  7:16  14/20   63    93    140   8017   0/20       -         11      ×1.52 ±24% (20)
steel-pfr     Gholdengo   20   31:13  8:38  15/20   64    92    140   8852   1/20       30.0      11      ×1.70 ±19% (20)
steel-pfrs    Gholdengo   20   31:40  5:21  14/20   63    96    155   10827  0/20       -         12      ×1.47 ±24% (20)
steel-normal  Kartana     20   10:24  6:55  8/20    65    102   162   2513   1/20       26.8      12                     
steel-pf      Kartana     20   12:56  7:05  8/20    58    85    131   2620   0/20       -         8       ×1.09 ±21% (20)
steel-pfr     Kartana     20   31:26  8:58  15/20   66    104   171   14567  3/20       27.2      13      ×1.60 ±18% (20)
steel-pfrs    Kartana     20   31:03  7:34  14/20   65    103   180   11758  4/20       29.4      12      ×1.53 ±15% (20)
steel-normal  Empoleon    20   8:48   5:32  6/20    64    95    140   1568   0/20       -         12                     
steel-pf      Empoleon    20   31:04  6:42  11/20   65    100   150   6777   0/20       -         12      ×1.36 ±19% (20)
steel-pfr     Empoleon    20   9:57   5:57  6/20    64    97    150   2157   0/20       -         13      ×1.02 ±21% (20)
steel-pfrs    Empoleon    20   31:04  8:44  14/20   64    97    145   9348   2/20       27.9      12      ×1.68 ±19% (20)
steel-normal  Revavroom   20   8:37   5:08  3/20    64    108   183   1588   0/20       -         14                     
steel-pf      Revavroom   20   8:15   6:03  7/20    59    87    128   1600   0/20       -         9       ×1.29 ±20% (20)
steel-pfr     Revavroom   20   31:01  7:55  11/20   66    107   172   11834  2/20       29.5      14      ×2.00 ±19% (20)
steel-pfrs    Revavroom   20   10:17  5:00  8/20    66    98    164   2109   0/20       -         13      ×1.39 ±24% (20)
steel-normal  Pawniard    20   7:11   4:49  0/20    66    -     -     878    0/20       -         -                      
steel-pf      Pawniard    20   7:35   4:44  5/20    58    79    118   1152   0/20       -         10      ×1.40 ±13% (20)
steel-pfr     Pawniard    20   8:49   5:15  6/20    64    97    149   1715   2/20       28.5      11      ×1.64 ±17% (20)
steel-pfrs    Pawniard    20   8:55   5:41  4/20    62    103   179   1422   0/20       -         15      ×1.56 ±12% (20)
steel-normal  Togedemaru  20   8:45   5:34  4/20    57    87    129   1414   0/20       -         11                     
steel-pf      Togedemaru  20   8:14   5:41  3/20    62    88    132   1468   1/20       30.5      10      ×1.00 ±13% (20)
steel-pfr     Togedemaru  20   8:35   6:37  6/20    62    98    161   1745   0/20       -         13      ×1.24 ±17% (20)
steel-pfrs    Togedemaru  20   30:50  8:35  13/20   61    90    133   6908   0/20       -         10      ×2.07 ±17% (20)
steel-normal  TODOS       160  8:40   5:27  45/160  63    96    140   1501   3/160      28.8                             
steel-pf      TODOS       160  9:30   5:18  67/160  62    93    139   1816   1/160      30.5              ×1.20 ±7% (160)
steel-pfr     TODOS       160  30:46  6:26  88/160  64    100   159   7241   10/160     28.5              ×1.50 ±7% (160)
steel-pfrs    TODOS       160  30:40  5:58  86/160  63    96    149   7414   8/160      27.9              ×1.46 ±7% (160)
```

Emparejado, bot normal → priofast con reserva:

```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Archaludon    20    8:40→31:06       8→16     105.0→100.5  1636.5→11075.5  ×1.70
Empoleon      20    8:36→9:56        6→6        95→97    1491.5→2115.0  ×1.02
Gholdengo     20   10:05→31:09       7→15     95.0→92    2066.0→7878.5  ×1.70
Kartana       20    9:45→31:18       8→15     98.5→104   2194.0→14530.0  ×1.60
Lucario       20    9:44→31:02       9→13       95→102   1846.5→9130.0  ×1.33
Pawniard      20    7:10→8:46        0→6         0→96.5   877.5→1638.0  ×1.64
Revavroom     20    8:31→30:53       3→11      108→104.0  1509.0→10808.5  ×2.00
Togedemaru    20    8:41→8:33        4→6      85.5→91.0  1364.5→1697.5  ×1.24
TOTAL 160 parejas: ×1.50 (IC95 ×1.30-×1.72); llegan30 45→88
```

Otras parejas (160 cada una): normal → priofast tal cual ×1,20 (IC95 ×1,04-×1,38), 45 → 67 al
minuto 30; priofast → priofast con reserva ×1,25 (×1,09-×1,44), 67 → 88; con reserva → además
Movimiento inicial = Puño Meteoro ×0,98 (×0,84-×1,14), 88 → 86.

Los mismos 8 Pokémon con priofast en la versión anterior (semillas 601-620, `sim/out/final-pf.jsonl`):

```
variante  Pokémon     n    t med  p10    ≥30      nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
old-pf8   Empoleon    20   31:40  8:31   15/20    61    91    134   8530   0/20       -         9              
old-pf8   Lucario     20   31:02  9:50   16/20    63    92    179   14287  8/20       28.9      11             
old-pf8   Pawniard    20   11:06  7:15   9/20     63    95    151   2879   1/20       25.1      12             
old-pf8   Togedemaru  20   30:44  7:11   12/20    63    100   168   9141   3/20       26.3      15             
old-pf8   Kartana     20   30:41  10:16  14/20    64    103   169   13976  3/20       27.3      13             
old-pf8   Revavroom   20   31:06  6:10   14/20    65    100   166   13026  5/20       29.2      15             
old-pf8   Gholdengo   20   31:40  6:24   15/20    66    103   185   17925  8/20       24.8      15             
old-pf8   Archaludon  20   31:32  7:38   16/20    65    107   212   18594  14/20      24.6      16             
old-pf8   TODOS       160  31:02  7:11   111/160  64    99    171   11523  42/160     26.3
```

Qué ha pasado y por qué:

1. **Priofast tal cual funciona mucho peor que antes** (42 % al minuto 30 frente a 69 %). [MEDIDO]
   La causa es que **Danza Espada y Fortaleza casi no salen**: en los 5 primeros minutos se ofreció
   Danza Espada en 97 de 160 partidas (antes en 348 de 360), y cuando sale se coge siempre. Kartana la
   aprendía de mediana en el minuto 7,7 (antes 0,4). [MEDIDO] El mecanismo [CÓDIGO]: con más ataques en
   la lista el bot llena los 4 huecos en el primer minuto con ataques nuevos (Disparo Espejo, Enfado,
   Hiperrayo...), y **con los 4 huecos llenos ya no salen cartas de movimiento nuevo** hasta que un
   vínculo libera uno (`levelup.js`). Además cada ataque concreto sale menos en la tanda (≈12 % por
   tanda para Danza Espada con 16-18 posibles).
2. **Reservar los huecos lo arregla en buena parte**: ×1,50 frente al bot normal y 88/160 (55 %) al
   minuto 30. El nivel del minuto 15 es el de antes (100 frente a 99). [MEDIDO]
3. Aun así queda por debajo de la versión anterior: 55 % frente a 69 % al minuto 30, nivel 159 frente a
   171 en el minuto 30 y tope de Potencia en 10/160 frente a 42/160. [MEDIDO] Hasta el minuto 20 las dos
   versiones van igual (nivel 64/100/122 en los min 10/15/20, Potencia 8/13/16); se separan en dos cosas:
   más muertes en el muro de los minutos 6-12 (54 frente a 40 de 160) y menos cartas por minuto
   entre el 20 y el 25 (3,7 frente a 4,6). Las muertes siguen siendo por contacto con la horda que te
   rodea (`deathcause.js`, 7 partidas). [MEDIDO] Por qué más: [CONJETURA] Gholdengo, Empoleon y
   Archaludon pegan menos con Puño Meteoro (físico) y Kartana o Pawniard reciben hasta un 25 % más de
   los enemigos especiales (Def. Esp. 31 y 40).
4. **Movimiento inicial = Puño Meteoro no aporta nada** en conjunto (×0,98): Repertorio ya lo daba de
   segundo. Con algunos Pokémon cambia mucho en un sentido u otro (Togedemaru ×2,08 frente a sólo
   reserva; Archaludon y Revavroom peor), pero con 20 semillas es ruido o depende del 2.º ataque que
   toque al azar. [MEDIDO, ruido grande por Pokémon]

## 3. Lucha y veneno (bot normal, 20 semillas, 701-720) [MEDIDO, 140 partidas]

```
variante       Pokémon     n   t med  p10    ≥30    nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base       
fight-normal   Conkeldurr  20  9:58   4:33   4/20   36    44    64    885    0/20       -         4                     
old-strong1    Conkeldurr  10  15:07  4:11   4/10   49    56    181   1786   2/10       27.7      7                     
old-fight      Conkeldurr  15  10:14  5:39   5/15   48    68    104   1269   1/15       24.9      9                     
fight-normal   Zamazenta   20  29:25  6:55   9/20   35    45    56    1052   0/20       -         6                     
old-strong1    Zamazenta   10  15:24  4:00   2/10   41    57    155   802    1/10       28.8      4                     
old-fight      Zamazenta   15  11:57  2:40   2/15   46    64    124   1226   0/15       -         9                     
fight-normal   Machamp     20  10:24  4:37   4/20   37    53    80    752    0/20       -         7                     
old-strong1    Machamp     10  30:40  4:27   5/10   45    54    84    3177   0/10       -         5                     
old-fight      Machamp     15  11:05  2:42   4/15   27    56    128   1067   0/15       -         7                     
fight-normal   Hitmontop   20  23:29  6:29   8/20   35    42    54    988    0/20       -         3                     
old-strong1    Hitmontop   10  8:06   4:31   2/10   46    57    85    330    0/10       -         7                     
old-strong1    Tentacruel  10  17:11  4:43   2/10   44    58    83    1516   0/10       -         4                     
poison-normal  Tentacruel  20  10:02  5:41   9/20   54    71    94    1199   0/20       -         5                     
old-strong1    Gengar      10  9:38   3:54   3/10   49    57    71    1630   0/10       -         5                     
poison-normal  Gengar      20  30:55  6:34   11/20  59    89    118   2566   0/20       -         7                     
old-strong1    Sneasler    10  31:40  10:42  7/10   47    63    82    3043   0/10       -         4                     
poison-normal  Sneasler    20  28:15  6:34   9/20   51    70    85    1905   0/20       -         5                     
old-confirm1   Sneasler    20  31:01  8:24   10/20  41    50    68    1963   0/20       -         3                     
fight-normal   TODOS       80  15:40  4:42   25/80  36    43    56    919    0/80       -                               
old-strong1    TODOS       70  15:48  4:00   25/70  45    57    83    1713   3/70       27.7              ×NaN ±NaN% (0)
old-fight      TODOS       45  11:25  2:52   11/45  44    62    104   1226   1/45       24.9              ×NaN ±NaN% (0)
poison-normal  TODOS       60  28:15  5:50   29/60  55    73    92    1905   0/60       -                 ×NaN ±NaN% (0)
old-confirm1   TODOS       20  31:01  8:24   10/20  41    50    68    1963   0/20       -                 ×NaN ±NaN% (0)
```

(`old-*`: versión anterior; strong1 = semillas 101-110, old-fight = 401-415, confirm1 = 111-130.)

- **Lucha (Golpe Kárate + Esfera Aural + Danza Espada + Fortaleza) ya no hace bola de nieve**: nivel
  43 en el min 15 y 56 en el 30 (antes 54-68 y 84-181). El bot normal ya ni la monta: ahora elige
  **Puño Dinámico** (aturdir) de principal. Causas [CÓDIGO]: Esfera Aural es especial y Danza Espada ya
  no la sube; y el modelo de cartas del bot sobrevaloraba Puño Dinámico evolucionado ×1,5 (corregible
  con `tableLevel`, sección 10). El aguante es parecido (25/80 al minuto 30).
- **Veneno**: fuera de la Sentencia no cambia nada en el código (los enemigos no pasan de 60.000 de
  vida). Lo que se ve es otra cosa: **Gengar sube mucho** (nivel 89 en el min 15 frente a 57, 11/20 al
  minuto 30) porque ahora monta Viento Aciago, a veces con Maquinación (sus ataques especiales suben con su At.
  Esp. de 1,42); Sneasler, igual o algo peor; Tentacruel mejor (9/20 frente a 2/10), con Torbellino.
  En la Sentencia el veneno pierde casi todo contra los legendarios grandes (con 6 millones de vida
  quita como si tuvieran 600.000) [CÓDIGO]: ya no es "lo que mejor escala al final".

## 4. Ficha de los 38 ataques nuevos [MEDIDO + CÓDIGO]

`node sim/movecards.js --single sim/out/move-dps-1.json --sort evo`. Daño por segundo por unidad del
ataque con el que pega (Ataque o At. Esp., ×1,2 si es monotipo de ese tipo), con una horda de 15
enemigos pegada (`horda`) o un solo enemigo (`1 solo`), a nivel 1, al máximo y evolucionado. Ojo:
con la horda pegada, lo que pega alrededor (cuerpo a cuerpo, giro, empujón) sale favorecido; en una
partida acercarse cuesta vida. Se incluyen ataques de antes como referencia (columna "nuevo" vacía).

| ataque | id | tipo | forma | cat. | recarga | daño | evolución (pide) | horda nv1 | horda máx | horda evo | 1 solo evo | horda/1 | nuevo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Puño Meteoro | meteor-mash | Acero | meteoros | físico | 1.4 s | 34 | Bomba Imán (Potencia) | 255 | 1415 | 3349 | 1012 | 3.3 |  |
| Patada Giro | rolling-kick | Lucha | giro | físico | 0.95 s | 11 | Patada Salto Alta (Carrera) | 128 | 743 | 2883 | 1147 | 2.5 | sí |
| Garra Dragón | dragon-claw | Dragón | cuerpo a cuerpo | físico | 0.52 s | 23 | Carga Dragón (Potencia) | 117 | 546 | 2362 | 400 | 5.9 | sí |
| Púas | spikes | Tierra | minas | físico | 1.2 s | 18 | Fisura (Potencia) | 127 | 527 | 2277 | 778 | 2.9 |  |
| Avalancha | rock-slide | Roca | meteoros | físico | 1.3 s | 21 | Trampa Rocas (Reflejos) | 249 | 700 | 2038 | 716 | 2.8 |  |
| Carantoña | play-rough | Hada | cuerpo a cuerpo | físico | 0.6 s | 26 | Choque Anímico (Potencia) | 173 | 971 | 1970 | 860 | 2.3 | sí |
| Viento Aciago | ominous-wind | Fantasma | remolino | especial | 3 s | 9 | Golpe Umbrío (Imán) | 172 | 749 | 1839 | 660 | 2.8 | sí |
| Púas Tóxicas | toxic-spikes | Veneno | minas | físico | 1.1 s | 11 | Lanza Mugre (Síntesis) | 56 | 380 | 1811 | 292 | 6.2 |  |
| Bola Sombra | shadow-ball | Fantasma | proyectil | especial | 0.66 s | 19 | Golpe Fantasma (Reflejos) | 55 | 420 | 1618 | 541 | 3.0 |  |
| Torbellino | whirlpool | Agua | remolino | especial | 3 s | 8 | Salmuera (Síntesis) | 171 | 799 | 1612 | 577 | 2.8 | sí |
| Garra Metal | metal-claw | Acero | cuerpo a cuerpo | físico | 0.5 s | 18 | Cabeza de Hierro (Potencia) | 146 | 607 | 1551 | 575 | 2.7 |  |
| Esfera Aural | aura-sphere | Lucha | proyectil | especial | 0.62 s | 17 | Onda Certera (Reflejos) | 26 | 291 | 1463 | 770 | 1.9 |  |
| Enfado | outrage | Dragón | giro | físico | 1.1 s | 12 | Dracoflecha (Vigor) | 177 | 542 | 1413 | 1208 | 1.2 | sí |
| Bucle Arena | sand-tomb | Tierra | remolino | físico | 3 s | 9 | Fuerza Equina (Vigor) | 263 | 616 | 1322 | 514 | 2.6 | sí |
| Nitrocarga | flame-charge | Fuego | embestida | físico | 0.8 s | 19 | Golpe Calor (Carrera) | 150 | 519 | 1137 | 491 | 2.3 | sí |
| Ida y Vuelta | u-turn | Bicho | embestida | físico | 0.7 s | 17 | Sanguijuela (Síntesis) | 164 | 507 | 1109 | 309 | 3.6 | sí |
| Giro Bola | gyro-ball | Acero | giro | físico | 1.05 s | 12 | Cuerpo Pesado (Coraza) | 94 | 435 | 1085 | 835 | 1.3 | sí |
| Giro Rápido | rapid-spin | Normal | giro | físico | 1 s | 9 | Triataque (Carrera) | 103 | 373 | 1066 | 741 | 1.4 | sí |
| Lengüetazo | lick | Fantasma | cuerpo a cuerpo | físico | 0.48 s | 14 | Puño Sombra (Potencia) | 199 | 796 | 1026 | 512 | 2.0 |  |
| Tajo Umbrío | night-slash | Siniestro | giro | físico | 1 s | 11 | Lariat Oscuro (Carrera) | 155 | 456 | 988 | 995 | 1.0 | sí |
| Golpe Kárate | karate-chop | Lucha | cuerpo a cuerpo | físico | 0.5 s | 22 | A Bocajarro (Potencia) | 128 | 341 | 792 | 444 | 1.8 |  |
| Tumba Rocas | rock-tomb | Roca | aturdir | físico | 1.7 s | 31 | Testarazo (Vigor) | 56 | 286 | 749 | 224 | 3.3 | sí |
| Onda Vacío | vacuum-wave | Lucha | empujón | especial | 1.1 s | 17 | Puño Incremento (Coraza) | 95 | 414 | 735 | 286 | 2.6 | sí |
| Voz Cautivadora | disarming-voice | Hada | empujón | especial | 1.15 s | 15 | Encanto (Coraza) | 75 | 216 | 728 | 242 | 3.0 | sí |
| Puño Dinámico | dynamic-punch | Lucha | aturdir | físico | 1.7 s | 33 | Megapuño (Potencia) | 125 | 237 | 706 | 202 | 3.5 | sí |
| Paranormal | extrasensory | Psíquico | empujón | especial | 1.2 s | 16 | Psicoonda (Coraza) | 82 | 430 | 699 | 228 | 3.1 | sí |
| Magnitud | magnitude | Tierra | onda por el suelo | físico | 1.15 s | 18 | Taladradora (Potencia) | 144 | 252 | 658 | 317 | 2.1 | sí |
| Hiperrayo | hyper-beam | Normal | carga (rayo) | especial | 2.2 s | 58 | Rayo Prisma (Potencia) | 207 | 369 | 654 | 402 | 1.6 | sí |
| Rayo Solar | solar-beam | Planta | carga (rayo) | especial | 2.3 s | 62 | Cuchilla Solar (Reflejos) | 135 | 362 | 645 | 324 | 2.0 | sí |
| Remolino | whirlwind | Volador | empujón | especial | 1.1 s | 14 | Huracán (Carrera) | 63 | 402 | 562 | 207 | 2.7 | sí |
| Energibola | energy-ball | Planta | persigue | especial | 0.62 s | 19 | Gigadrenado (Síntesis) | 28 | 134 | 552 | 497 | 1.1 | sí |
| Golpe Bajo | sucker-punch | Siniestro | persigue | físico | 0.7 s | 22 | Juego Sucio (Potencia) | 30 | 123 | 547 | 492 | 1.1 | sí |
| Sombra Vil | shadow-sneak | Fantasma | persigue | físico | 0.45 s | 14 | Garra Umbría (Reflejos) | 29 | 139 | 516 | 404 | 1.3 | sí |
| Liofilización | freeze-dry | Hielo | aturdir | especial | 1.6 s | 24 | Frío Polar (Potencia) | 66 | 306 | 497 | 186 | 2.7 | sí |
| Dragoaliento | dragon-breath | Dragón | abanico | especial | 0.7 s | 7 | Pulso Dragón (Potencia) | 55 | 215 | 495 | 375 | 1.3 | sí |
| Canto Helado | ice-shard | Hielo | persigue | físico | 0.32 s | 9 | Carámbano (Reflejos) | 26 | 124 | 448 | 378 | 1.2 | sí |
| Onda Trueno | thunder-wave | Eléctrico | aturdir | especial | 1.6 s | 22 | Voltio Cruel (Potencia) | 88 | 204 | 408 | 202 | 2.0 | sí |
| Beso Drenaje | draining-kiss | Hada | persigue | especial | 0.55 s | 13 | Luz Lunar (Síntesis) | 20 | 91 | 384 | 269 | 1.4 | sí |
| Tajo Aéreo | air-slash | Volador | persigue | especial | 0.55 s | 9 | Ataque Aéreo (Reflejos) | 30 | 147 | 357 | 289 | 1.2 | sí |
| Bola Neblina | mist-ball | Psíquico | persigue | especial | 0.55 s | 13 | Resplandor (Reflejos) | 21 | 103 | 355 | 237 | 1.5 | sí |
| Poder Pasado | ancient-power | Roca | órbita | especial | 0.28 s | 13 | Tormenta de Diamantes (Coraza) | 59 | 224 | 324 | 353 | 0.9 | sí |
| Joya de Luz | power-gem | Roca | rebota | especial | 0.66 s | 11 | Rayo Meteórico (Potencia) | 59 | 145 | 218 | 212 | 1.0 | sí |
| Bola Voltio | electro-ball | Eléctrico | rebota | especial | 0.62 s | 10 | Chispa (Carrera) | 60 | 168 | 213 | 116 | 1.8 | sí |
| Rayo Señal | signal-beam | Bicho | rebota | especial | 0.6 s | 10 | Megacuerno (Potencia) | 60 | 168 | 213 | 116 | 1.8 | sí |
| Bomba Ácida | acid-spray | Veneno | rebota | especial | 0.66 s | 8 | Onda Tóxica (Síntesis) | 36 | 127 | 189 | 92 | 2.1 | sí |
| Bomba Germen | seed-bomb | Planta | rebota | físico | 0.6 s | 10 | Mazazo (Potencia) | 44 | 150 | 176 | 72 | 2.4 | sí |
| Disparo Espejo | mirror-shot | Acero | rebota | especial | 0.64 s | 10 | Metaláser (Potencia) | 52 | 141 | 138 | 105 | 1.3 | sí |

Los que, como Puño Meteoro, **pegan a la horda entera** al evolucionar (horda/1 alto y mucho daño de
horda): **Garra Dragón** (5,9), **Púas Tóxicas** (6,2, de antes), **Ida y Vuelta** (3,6), **Tumba Rocas**
y **Puño Dinámico** (3,3-3,5, pero poco daño), **Viento Aciago** y **Torbellino** (2,8, remolinos
especiales que además juntan a la horda). **Patada Giro** es el que más daño hace después de Puño
Meteoro (2.883), pero reparte menos (2,5). Los que persiguen o rebotan apenas reparten (≈1) y pegan
poco: no hacen bola de nieve.

## 5. Criba: todos los Pokémon, nivel en el minuto 15 (2 semillas, 801-802, corte en el 15) [MEDIDO, 1.932 partidas]

Nivel en el minuto 15 (media de las dos; si cae antes cuenta el nivel con el que cae, así que morir
pronto penaliza). Con 2 semillas es una criba: sólo sirve para elegir a quién medir bien.

| # | Pokémon | dex | tipos | rareza | lado | nivel min 15 | vivos | derrotados | grupo principal (1.ª semilla) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Magneton | 82 | electric/steel | 3 | esp | 81.0 | 1/2 | 3403 | harden+meteor-mash+swords-dance+thunder-shock |
| 2 | Ferropúas | 995 | rock/electric | 4 | fís | 81.0 | 1/2 | 3523 | harden+hyper-beam+rock-slide+swords-dance |
| 3 | Cryogonal | 615 | ice (mono) | 4 | esp | 79.0 | 1/2 | 2760 | hail+ice-beam+nasty-plot+powder-snow |
| 4 | Jirachi | 385 | steel/psychic | 5 leg. | fís | 78.5 | 1/2 | 2891 | harden+metal-claw+meteor-mash+swords-dance |
| 5 | Archaludon | 1018 | steel/dragon | 5 | esp | 78.5 | 1/2 | 2991 | dragon-dance+metal-claw+meteor-mash+swords-dance |
| 6 | Skarmory | 227 | steel/flying | 3 | fís | 77.5 | 1/2 | 3158 | harden+metal-claw+meteor-mash+swords-dance |
| 7 | Lycanroc | 745 | rock (mono) | 3 | fís | 77.5 | 1/2 | 3233 | body-slam+rock-slide+rock-throw |
| 8 | Dialga | 483 | steel/dragon | 5 leg. | esp | 77.0 | 1/2 | 3114 | harden+metal-claw+meteor-mash+swords-dance |
| 9 | Revavroom | 966 | steel/poison | 4 | fís | 77.0 | 1/2 | 2825 | harden+metal-claw+meteor-mash+toxic-spikes |
| 10 | Kartana | 798 | grass/steel | 4 | fís | 75.5 | 1/2 | 3388 | metal-claw+meteor-mash+razor-leaf+swords-dance |
| 11 | Polteageist | 855 | ghost (mono) | 4 | esp | 75.5 | 2/2 | 2814 | body-slam+harden+hyper-beam+ominous-wind |
| 12 | Overqwil | 904 | dark/poison | 4 | fís | 75.0 | 2/2 | 2146 | bite+harden+night-slash+toxic-spikes |
| 13 | Rayquaza | 384 | dragon/flying | 5 leg. | fís | 73.5 | 1/2 | 2446 | dragon-claw+dragon-rage+harden+hyper-beam |
| 14 | Tentacruel | 73 | water/poison | 4 | esp | 73.0 | 2/2 | 2274 | harden+nasty-plot+toxic-spikes+whirlpool |
| 15 | Mantine | 226 | water/flying | 3 | esp | 73.0 | 1/2 | 2983 | body-slam+harden+nasty-plot+whirlpool |
| 16 | Prinplup | 394 | water (mono) | 2 | esp | 72.0 | 2/2 | 2189 | bubble-beam+harden+tackle+whirlpool |
| 17 | Stonjourner | 874 | rock (mono) | 3 | fís | 72.0 | 1/2 | 2735 | harden+rock-slide+rock-tomb+tackle |
| 18 | Weavile | 461 | dark/ice | 4 | fís | 70.5 | 2/2 | 2280 | bite+hail+harden+night-slash |
| 19 | Heatran | 485 | fire/steel | 5 leg. | esp | 70.0 | 1/2 | 2606 | body-slam+heat-wave+meteor-mash+swords-dance |
| 20 | Manaphy | 490 | water (mono) | 5 leg. | fís | 70.0 | 2/2 | 2313 | aqua-ring+harden+tackle+whirlpool |
| 21 | Terrakion | 639 | rock/fighting | 5 leg. | fís | 70.0 | 1/2 | 2381 | karate-chop+rock-slide+rolling-kick+swords-dance |
| 22 | Glalie | 362 | ice (mono) | 3 | fís | 69.5 | 1/2 | 2225 | hail+harden+nasty-plot+tackle |
| 23 | Bastiodon | 411 | rock/steel | 4 | fís | 69.5 | 1/2 | 2193 | body-slam+meteor-mash+swords-dance |
| 24 | Durant | 632 | bug/steel | 3 | fís | 69.5 | 1/2 | 2595 | gyro-ball+meteor-mash+rapid-spin+tackle |
| 25 | Cloyster | 91 | water/ice | 4 | fís | 68.5 | 2/2 | 2021 | aqua-ring+hail+harden+whirlpool |
| 26 | Hoopa | 720 | psychic/ghost | 5 leg. | esp | 68.5 | 1/2 | 2587 | body-slam+nasty-plot+ominous-wind |
| 27 | Bisharp | 625 | dark/steel | 3 | fís | 67.5 | 1/2 | 2726 | bite+dark-pulse+meteor-mash |
| 28 | Cobalion | 638 | steel/fighting | 5 leg. | fís | 67.0 | 1/2 | 2292 | dynamic-punch+hyper-beam+metal-claw+meteor-mash |
| 29 | Cofagrigus | 563 | ghost (mono) | 3 | esp | 66.5 | 2/2 | 1955 | harden+lick+nasty-plot+ominous-wind |
| 30 | Azumarill | 184 | water/fairy | 3 | esp | 66.0 | 2/2 | 1906 | harden+nasty-plot+water-gun+whirlpool |
| 31 | Gorebyss | 368 | water (mono) | 3 | esp | 66.0 | 1/2 | 2019 | aqua-ring+nasty-plot+water-gun+whirlpool |
| 32 | Regirock | 377 | rock (mono) | 5 leg. | fís | 66.0 | 1/2 | 2941 | rock-slide+rock-throw+tackle |
| 33 | Walrein | 365 | ice/water | 4 | esp | 65.5 | 0/2 | 1821 | aqua-ring+hail+harden+ice-beam |
| 34 | Porygon-Z | 474 | normal (mono) | 4 | esp | 65.0 | 1/2 | 1796 | harden+hyper-beam+nasty-plot+tackle |
| 35 | Tyranitar | 248 | rock/dark | 5 | fís | 64.5 | 1/2 | 2697 | body-slam+rock-slide |
| 36 | Escavalier | 589 | bug/steel | 4 | fís | 64.5 | 1/2 | 2174 | body-slam+gyro-ball+meteor-mash+string-shot |
| 37 | Rockruff | 744 | rock (mono) | 1 | fís | 64.5 | 1/2 | 2974 | body-slam+rock-slide+rock-throw+rock-tomb |
| 38 | Pincurchin | 871 | electric (mono) | 3 | fís | 64.5 | 0/2 | 2402 | body-slam+hyper-beam+nasty-plot+thunder-shock |
| 39 | Oshawott | 501 | water (mono) | 1 | esp | 64.0 | 2/2 | 1885 | harden+hyper-beam+tackle+whirlpool |
| 40 | Orthworm | 968 | steel (mono) | 3 | fís | 63.5 | 1/2 | 2543 | hyper-beam+metal-claw+meteor-mash |

966 Pokémon; nivel min 15: mediana 28.5, p90 52.5
En el top 40: harden 22, meteor-mash 14, swords-dance 10, nasty-plot 10, body-slam 10, hyper-beam 8, metal-claw 8, whirlpool 8, tackle 8, rock-slide 7, hail 5, aqua-ring 4, rock-throw 3, toxic-spikes 3, ominous-wind 3

## 6. Ronda fuerte: top 40 de la criba + 7 de referencia, bot normal (semillas 901-910, partida completa) [MEDIDO, 470 partidas]

```
variante  Pokémon      n    t med  p10    ≥30      nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
strong    Ferropúas    10   6:38   5:20   1/10     68    109   176   995    0/10       -         10             
strong    Magneton     10   8:27   6:27   0/10     61    80    -     1677   0/10       -         10             
strong    Cryogonal    10   16:53  5:40   4/10     56    80    117   2973   0/10       -         8              
strong    Jirachi      10   8:37   7:02   1/10     63    88    96    1639   0/10       -         10             
strong    Archaludon   10   18:12  6:41   4/10     64    101   196   5015   1/10       29.6      11             
strong    Skarmory     10   7:59   7:29   1/10     63    89    118   1269   0/10       -         12             
strong    Lycanroc     10   8:50   5:05   2/10     63    105   166   1472   0/10       -         14             
strong    Dialga       10   8:26   6:51   3/10     65    89    146   1649   0/10       -         11             
strong    Revavroom    10   7:40   6:02   2/10     69    111   169   1307   0/10       -         21             
strong    Kartana      10   7:50   7:13   1/10     71    87    119   1429   0/10       -         5              
strong    Polteageist  10   31:19  10:12  8/10     54    68    87    3121   0/10       -         7              
strong    Overqwil     10   7:38   4:54   1/10     57    76    93    1097   0/10       -         9              
strong    Rayquaza     10   7:04   5:35   0/10     47    58    -     967    0/10       -         10             
strong    Tentacruel   10   9:49   6:02   3/10     52    74    87    1177   0/10       -         6              
strong    Mantine      10   10:58  6:34   1/10     41    57    67    952    0/10       -         6              
strong    Prinplup     10   30:57  6:02   5/10     45    53    59    1552   0/10       -         7              
strong    Stonjourner  10   8:49   5:16   4/10     65    105   159   1688   0/10       -         12             
strong    Weavile      10   5:43   4:46   0/10     -     -     -     500    0/10       -         -              
strong    Heatran      10   7:36   5:08   2/10     64    96    142   1246   0/10       -         12             
strong    Manaphy      10   30:44  4:59   5/10     38    46    60    1093   0/10       -         5              
strong    Terrakion    10   8:45   7:04   1/10     57    75    100   1658   0/10       -         3              
strong    Glalie       10   7:03   5:35   1/10     59    83    132   1045   0/10       -         12             
strong    Bastiodon    10   7:07   5:02   1/10     62    87    132   939    0/10       -         7              
strong    Durant       10   9:35   7:20   4/10     63    89    137   1979   0/10       -         9              
strong    Cloyster     10   10:16  5:54   2/10     58    76    106   1597   0/10       -         10             
strong    Hoopa        10   10:55  6:56   2/10     45    66    72    1279   0/10       -         9              
strong    Bisharp      10   6:54   6:42   0/10     -     -     -     1076   0/10       -         -              
strong    Cobalion     10   30:45  8:54   6/10     56    75    99    3991   1/10       23.2      11             
strong    Cofagrigus   10   10:38  4:35   2/10     58    83    112   1867   0/10       -         15             
strong    Azumarill    10   9:21   5:33   2/10     40    47    55    940    0/10       -         7              
strong    Gorebyss     10   17:26  7:27   4/10     46    45    57    1537   0/10       -         7              
strong    Regirock     10   8:29   5:52   1/10     68    108   165   1610   0/10       -         13             
strong    Walrein      10   10:47  4:55   3/10     63    95    151   1668   0/10       -         14             
strong    Porygon-Z    10   31:22  9:26   6/10     49    67    94    3257   0/10       -         12             
strong    Tyranitar    10   8:34   4:41   0/10     62    95    -     1142   0/10       -         12             
strong    Escavalier   10   7:58   6:49   1/10     69    108   147   1144   0/10       -         17             
strong    Rockruff     10   5:01   2:15   0/10     -     -     -     516    0/10       -         -              
strong    Pincurchin   10   4:55   3:56   0/10     -     -     -     554    0/10       -         -              
strong    Oshawott     10   30:28  4:29   5/10     38    47    58    1127   0/10       -         6              
strong    Orthworm     10   7:01   4:59   2/10     65    111   198   1116   1/10       29.6      18             
strong    Lucario      10   9:02   5:48   2/10     57    100   156   1454   0/10       -         15             
strong    Empoleon     10   11:23  5:15   4/10     56    105   165   2101   1/10       27.7      10             
strong    Togedemaru   10   10:59  6:35   2/10     62    95    156   2128   0/10       -         8              
strong    Gengar       10   31:25  16:20  7/10     57    79    148   5160   0/10       -         10             
strong    Conkeldurr   10   31:25  5:49   5/10     37    43    55    1201   0/10       -         5              
strong    Zamazenta    10   26:59  9:15   4/10     37    43    67    1332   0/10       -         4              
strong    Machamp      10   12:32  7:12   2/10     35    47    65    960    0/10       -         4              
strong    TODOS        470  8:45   5:04   117/470  55    75    105   1241   4/470      29.6
```

- Con el bot normal, **casi todos los que más suben de nivel mueren hacia el minuto 7-9**: Orthworm,
  Revavroom, Regirock, Lycanroc, Stonjourner, Ferropúas y Escavalier van por el nivel 105-111 en el
  minuto 15 y sólo 1-4 de 10 llegan al 30. Es lo que priofast corregía con el Acero.
- Los que aguantan sin receta suben poco (Polteageist, Porygon-Z, Prinplup, Oshawott, Manaphy: nivel
  47-68 en el min 15). La excepción es **Gengar**: 7/10 al 30, nivel 79 y 148.

## 7. Recetas por familia, estilo priofast con huecos reservados (semillas 901-920) [MEDIDO, 640 + 640 partidas]

Todas: prioridad a los 3 ataques de la familia, `reserve`, Carrera ×3 y Pañuelo Elección primero.
Acero: Puño Meteoro → Danza Espada → Fortaleza. Fantasma: Viento Aciago → Maquinación → Fortaleza.
Agua: Torbellino → Maquinación → Fortaleza. Roca: Avalancha → Danza Espada → Fortaleza. Hielo:
Granizo → Maquinación → Fortaleza. Lucha: Patada Giro → Danza Espada → Fortaleza. Dragón: Garra
Dragón → Danza Dragón → Fortaleza.

```
variante   Pokémon     n    t med  p10   ≥30     nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
rec-steel  Orthworm    20   9:10   6:54  3/20    63    93    148   1917   0/20       -         15             
rec-steel  Cobalion    20   31:35  8:01  15/20   65    102   149   9660   0/20       -         13             
rec-steel  Durant      20   9:36   6:57  8/20    61    90    159   2001   1/20       27.3      13             
rec-steel  Escavalier  20   9:32   7:03  6/20    63    106   162   2189   0/20       -         13             
rec-steel  Melmetal    20   30:30  8:45  10/20   69    108   194   9866   3/20       28.2      13             
rec-steel  Klinklang   20   30:41  8:41  12/20   64    103   164   9652   1/20       24.9      15             
rec-steel  Registeel   20   30:48  8:41  12/20   64    99    172   10196  2/20       29.9      12             
rec-steel  Dialga      20   30:56  8:08  12/20   65    103   166   10621  2/20       26.6      15             
rec-steel  Heatran     20   8:38   5:31  5/20    64    105   169   1691   0/20       -         13             
rec-steel  TODOS       180  11:43  6:47  83/180  64    102   162   2724   9/180      27.3                     
variante   Pokémon      n    t med  p10    ≥30     nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
rec-ghost  Gengar       20   31:35  10:02  12/20   51    70    97    3056   0/20       -         8              
rec-ghost  Polteageist  20   31:40  30:48  18/20   53    70    88    3262   1/20       28.6      7              
rec-ghost  Cofagrigus   20   30:29  7:50   10/20   52    65    85    2330   0/20       -         7              
rec-ghost  Hoopa        20   31:29  7:04   13/20   53    73    100   2927   0/20       -         8              
rec-ghost  Mismagius    20   31:40  12:12  17/20   52    63    79    2997   0/20       -         7              
rec-ghost  TODOS        100  31:29  8:34   70/100  52    67    88    2927   1/100      28.6                     
variante   Pokémon     n    t med  p10    ≥30     nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
rec-water  Empoleon    20   31:34  5:52   15/20   47    60    84    2415   0/20       -         5              
rec-water  Prinplup    20   31:40  30:36  18/20   49    61    77    2611   0/20       -         6              
rec-water  Manaphy     20   31:40  30:29  18/20   52    64    82    2971   0/20       -         7              
rec-water  Kyogre      20   31:40  8:31   14/20   51    70    99    3931   0/20       -         7              
rec-water  Tentacruel  20   31:40  11:35  16/20   48    58    86    2750   0/20       -         6              
rec-water  Primarina   20   23:46  8:41   8/20    45    55    77    1953   0/20       -         4              
rec-water  TODOS       120  31:39  8:27   89/120  47    61    84    2626   0/120      -                        
variante  Pokémon      n    t med  p10   ≥30     nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
rec-rock  Stonjourner  20   8:44   6:34  4/20    62    96    169   1675   0/20       -         16             
rec-rock  Lycanroc     20   10:07  5:46  6/20    60    82    154   1978   1/20       29.9      10             
rec-rock  Regirock     20   10:01  4:43  8/20    60    91    133   2172   0/20       -         11             
rec-rock  Ferropúas    20   8:41   5:38  6/20    60    93    140   1690   0/20       -         9              
rec-rock  Tyranitar    20   7:43   4:56  4/20    59    92    132   1259   0/20       -         11             
rec-rock  TODOS        100  8:43   5:12  28/100  60    91    138   1690   1/100      29.9                     
variante  Pokémon    n   t med  p10   ≥30    nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
rec-ice   Cryogonal  20  18:06  8:01  9/20   61    88    124   3788   1/20       25.7      10             
rec-ice   Walrein    20  10:36  6:46  5/20   57    85    123   1846   0/20       -         10             
rec-ice   TODOS      40  17:43  7:09  14/40  59    86    124   3064   1/40       25.7                     
variante   Pokémon     n   t med  p10   ≥30   nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
rec-fight  Conkeldurr  20  7:27   4:18  0/20  26    27    -     319    0/20       -         1              
rec-fight  Machamp     20  9:14   5:07  0/20  22    28    -     321    0/20       -         1              
rec-fight  Zamazenta   20  14:41  7:16  4/20  24    30    42    438    0/20       -         3              
rec-fight  Terrakion   20  8:16   4:48  0/20  27    30    -     272    0/20       -         1              
rec-fight  TODOS       80  9:14   5:07  4/80  24    29    42    322    0/80       -                        
variante    Pokémon   n   t med  p10   ≥30   nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base
rec-dragon  Rayquaza  20  17:04  4:47  6/20  33    37    53    743    0/20       -         4              
rec-dragon  TODOS     20  17:04  4:47  6/20  33    37    53    743    0/20       -
```

Emparejado con el bot normal en las mismas semillas (A = normal, B = receta):

```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Cobalion      20   10:19→31:34       9→15       77→100.0  2087.5→9467.0  ×1.53
Cofagrigus    20   10:13→26:53       3→10       64→65    1433.0→2187.5  ×1.51
Conkeldurr    20   21:57→7:24        8→0        50→27    1127.5→313.5   ×0.56
Cryogonal     20   21:27→18:00       7→9        72→88    3046.0→3772.5  ×1.01
Dialga        20    8:38→30:53       3→12       89→102.5  1699.5→10378.0  ×1.83
Durant        20    9:32→9:15        6→8      87.0→89.5  1813.0→1951.0  ×1.15
Empoleon      20    9:30→31:30       6→15     98.0→58.5  1794.5→2123.0  ×1.88
Escavalier    20    8:14→9:28        1→6      105.5→104.0  1118.5→2127.0  ×1.49
Ferropúas     20    6:33→8:34        3→6       100→91.0   931.0→1680.5  ×1.39
Gengar        20   31:06→31:34      12→12     71.0→70    3033.5→2779.0  ×1.10
Heatran       20    8:04→8:37        4→5      96.0→99.0  1429.0→1685.5  ×1.09
Hoopa         20    8:53→31:08       5→13       64→73    1230.0→2924.5  ×1.78
Klinklang     20    9:16→30:40       5→12      104→103.0  1861.0→8640.5  ×1.56
Kyogre        20   31:31→31:40      14→14       67→70    2644.0→3568.5  ×0.99
Lycanroc      20    7:02→9:53        3→6       102→81.5  1043.0→1901.0  ×1.54
Machamp       20   10:18→9:05        3→0        48→27.0   820.0→316.0   ×0.81
Manaphy       20   27:07→31:40      10→18       55→63.0  1554.0→2967.5  ×1.59
Melmetal      20    8:53→20:30       4→10      102→107.0  1840.5→6228.0  ×1.62
Mismagius     20   11:25→31:40       7→17       81→63    1558.0→2909.0  ×1.95
Orthworm      20    7:05→9:08        3→3       107→93    1083.0→1897.0  ×1.24
Polteageist   20   31:17→31:40      16→18     71.5→70    2719.0→3225.0  ×1.20
Primarina     20    8:58→22:59       5→8      71.0→55    1117.0→1943.0  ×1.56
Prinplup      20   30:57→31:40      13→18     52.5→60.5  1576.5→2603.0  ×1.47
Rayquaza      20    7:05→16:55       1→6        58→37     985.5→729.0   ×1.58
Regirock      20    7:24→9:31        1→8      101.0→91    1039.0→1976.0  ×1.65
Registeel     20    7:35→30:44       1→12      111→99    1219.5→10037.0  ×2.51
Stonjourner   20    7:42→8:35        5→4      94.5→96.0  1273.0→1615.0  ×1.03
Tentacruel    20   16:35→31:40       8→16     69.0→58.0  1625.0→2720.0  ×1.62
Terrakion     20    8:43→7:52        2→0      75.5→29.5  1664.0→264.0   ×0.75
Tyranitar     20    7:09→7:39        0→4        95→89.0   995.0→1245.5  ×1.32
Walrein       20    8:21→10:13       5→5        91→85    1363.5→1763.0  ×1.35
Zamazenta     20   28:47→13:33      10→4        39→30.0  1189.0→410.0   ×0.75
TOTAL 640 parejas: ×1.33 (IC95 ×1.24-×1.42); llegan30 183→294
```

- **Acero**: todas mejoran (×1,09-×2,51): Registeel ×2,51, Dialga ×1,83, Melmetal ×1,62, Klinklang ×1,56,
  Cobalion ×1,53, Escavalier ×1,49.
- **Fantasma y Agua con Maquinación**: llegan al 30 un 40-90 %, pero con nivel ~60-70 en el min 15 y
  ~80-100 en el 30, y unos 3.000 derrotados: aguante, no bola de nieve.
- **Roca**: mejora el aguante (×1,0-×1,65) pero sigue muriendo pronto (28/100 al 30).
- **Lucha** (Patada Giro) y **Dragón** (Garra Dragón): mucho peor. El giro obliga a meterse en la horda
  sin el −25 % de daño recibido del cuerpo a cuerpo (`Player.hurt`: sólo `kind: 'melee'`) [CÓDIGO], y las
  partidas mueren entre los minutos 4 y 6, antes del primer vínculo. [MEDIDO]

## 8. Confirmación con semillas nuevas (1001-1020) [MEDIDO, 460 partidas]

`conf-pfr`: priofast con reserva. `conf-pfrs`: además Movimiento inicial = Puño Meteoro (Empoleon y
Togedemaru, que en la sección 2 mejoraban así). `conf-normal`: bot normal (Gengar y los baratos nuevos).

```
variante     Pokémon     n    t med  p10   ≥30      nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base        
conf-pfr     Archaludon  20   31:04  8:33  14/20    62    91    133   7263   1/20       29.8      13                     
conf-pfr     Kartana     20   30:55  8:31  12/20    66    101   160   11359  2/20       28.1      12                     
conf-pfr     Gholdengo   20   27:32  6:27  9/20     61    90    128   5444   0/20       -         9                      
conf-pfr     Lucario     20   17:35  8:13  9/20     63    99    165   4427   0/20       -         13                     
conf-pfr     Cobalion    20   31:40  8:56  16/20    61    89    134   7802   0/20       -         8                      
conf-pfr     Registeel   20   10:18  8:20  7/20     66    100   150   2375   1/20       29.3      11                     
conf-pfr     Dialga      20   31:11  8:37  15/20    64    96    143   10392  0/20       -         10                     
conf-pfr     Klinklang   20   30:33  8:47  11/20    63    94    146   8732   1/20       29.6      10                     
conf-pfr     Melmetal    20   9:19   8:36  6/20     67    112   198   2053   4/20       27.0      16                     
conf-pfr     Revavroom   20   30:42  7:07  11/20    63    98    154   9239   0/20       -         13                     
conf-pfr     Durant      20   31:21  6:56  14/20    61    93    141   8909   1/20       25.0      12                     
conf-pfr     Pawniard    20   9:04   5:52  8/20     63    93    145   1832   0/20       -         12                     
conf-pfr     Klang       20   9:19   7:47  5/20     65    101   186   1924   1/20       29.0      17                     
conf-normal  Klang       20   8:07   5:05  1/20     64    96    166   1335   0/20       -         10      ×0.65 ±17% (20)
conf-pfr     Perrserker  20   17:28  8:25  9/20     65    106   182   4668   3/20       27.0      15                     
conf-normal  Perrserker  20   8:48   5:59  5/20     67    107   182   1793   0/20       -         13      ×0.73 ±21% (20)
conf-pfr     Bisharp     20   8:55   6:38  4/20     66    104   172   1802   1/20       28.1      18                     
conf-normal  Bisharp     20   6:59   5:27  4/20     69    108   182   1133   0/20       -         17      ×0.86 ±21% (20)
conf-pfr     Skarmory    20   8:53   6:36  8/20     63    92    138   1804   0/20       -         10                     
conf-normal  Skarmory    20   8:31   5:23  1/20     65    102   152   1654   0/20       -         16      ×0.71 ±19% (20)
conf-pfrs    Empoleon    20   30:52  7:29  12/20    62    92    143   6651   1/20       27.1      9                      
conf-pfrs    Togedemaru  20   9:05   6:45  8/20     60    89    138   1964   0/20       -         10                     
conf-normal  Gengar      20   27:58  7:08  9/20     58    92    134   3371   0/20       -         8                      
conf-pfr     TODOS       320  27:32  7:10  158/320  63    96    150   3782   15/320     28.1                             
conf-pfrs    TODOS       40   30:32  6:56  20/40    61    89    138   2922   1/40       27.1              ×NaN ±NaN% (0) 
conf-normal  TODOS       100  8:33   5:23  20/100   65    98    161   1643   0/100      -                 ×0.73 ±10% (80)
```

Emparejado en los baratos nuevos (A = normal, B = priofast con reserva):

```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Bisharp       20    6:53→8:55        4→4      106.0→104.0  1118.0→1800.5  ×1.17
Klang         20    8:05→9:16        1→5        96→99.5  1310.5→1862.5  ×1.53
Perrserker    20    8:47→14:00       5→9       107→106.0  1781.5→3496.0  ×1.38
Skarmory      20    8:30→8:51        1→8      90.5→90.5  1648.5→1759.0  ×1.40
TOTAL 80 parejas: ×1.36 (IC95 ×1.13-×1.65); llegan30 11→26
```

Lo que se sostiene: Cobalion (16/20), Dialga (15), Archaludon (14), Durant (14), Kartana (12), Empoleon
con Movimiento inicial (12), Klinklang y Revavroom (11). Lo que baja respecto a la tanda anterior:
Registeel (12 → 7), Gholdengo (15 → 9), Lucario (13 → 9). Con 20 partidas, ±3 es ruido normal.

## 9. Ranking juntando todo (misma receta) [MEDIDO]

```
variante     Pokémon     n    t med  p10   ≥30      nv10  nv15  nv30  derr.  tope Pot.  min tope  atk@15  vs base        
pool-pfr     Archaludon  40   31:04  7:07  30/40    63    96    152   9989   2/40       29.8      13                     
pool-pfrs    Archaludon  20   20:19  6:39  9/20     63    91    147   4606   0/20       -         11      ×0.65 ±26% (20)
pool-pfr     Lucario     40   30:52  7:23  22/40    64    101   159   7971   1/40       30.0      12                     
pool-pfrs    Lucario     20   30:55  5:58  10/20    64    99    158   7957   2/20       27.5      11      ×0.84 ±23% (20)
pool-pfr     Gholdengo   40   31:00  6:49  24/40    63    91    135   6796   1/40       30.0      10                     
pool-pfrs    Gholdengo   20   31:40  5:21  14/20    63    96    155   10827  0/20       -         12      ×0.86 ±21% (20)
pool-pfr     Kartana     40   31:10  8:35  27/40    66    102   161   12721  5/40       27.8      13                     
pool-pfrs    Kartana     20   31:03  7:34  14/20    65    103   180   11758  4/20       29.4      12      ×0.96 ±14% (20)
pool-pfr     Empoleon    20   9:57   5:57  6/20     64    97    150   2157   0/20       -         13                     
pool-pfrs    Empoleon    40   31:03  7:43  26/40    63    96    144   8148   3/40       27.4      11      ×1.64 ±22% (20)
pool-pfr     Revavroom   40   30:45  7:07  22/40    65    101   160   9289   2/40       29.5      13                     
pool-pfrs    Revavroom   20   10:17  5:00  8/20     66    98    164   2109   0/20       -         13      ×0.70 ±26% (20)
pool-pfr     Pawniard    40   8:49   5:28  14/40    63    96    145   1742   2/40       28.5      11                     
pool-pfrs    Pawniard    20   8:55   5:41  4/20     62    103   179   1422   0/20       -         15      ×0.95 ±19% (20)
pool-pfr     Togedemaru  20   8:35   6:37  6/20     62    98    161   1745   0/20       -         13                     
pool-pfrs    Togedemaru  40   30:39  6:52  21/40    60    89    133   4764   0/40       -         10      ×1.67 ±17% (20)
pool-pfr     Orthworm    20   9:10   6:54  3/20     63    93    148   1917   0/20       -         15                     
pool-pfr     Cobalion    40   31:35  8:27  31/40    62    94    142   7807   0/40       -         10                     
pool-pfr     Durant      40   30:51  6:56  22/40    61    93    141   6611   2/40       27.3      12                     
pool-pfr     Escavalier  20   9:32   7:03  6/20     63    106   162   2189   0/20       -         13                     
pool-pfr     Melmetal    40   10:10  8:36  16/40    67    108   194   2379   7/40       27.9      14                     
pool-pfr     Klinklang   40   30:40  8:41  23/40    63    100   155   8732   2/40       29.6      11                     
pool-pfr     Registeel   40   26:10  8:20  19/40    65    100   158   4552   3/40       29.3      12                     
pool-pfr     Dialga      40   31:04  8:08  27/40    65    97    161   10392  2/40       26.6      12                     
pool-pfr     Heatran     20   8:38   5:31  5/20     64    105   169   1691   0/20       -         13                     
pool-pfr     Klang       20   9:19   7:47  5/20     65    101   186   1924   1/20       29.0      17                     
pool-pfr     Perrserker  20   17:28  8:25  9/20     65    106   182   4668   3/20       27.0      15                     
pool-pfr     Bisharp     20   8:55   6:38  4/20     66    104   172   1802   1/20       28.1      18                     
pool-pfr     Skarmory    20   8:53   6:36  8/20     63    92    138   1804   0/20       -         10                     
pool-gengar  Gengar      60   30:51  6:45  32/60    58    82    118   2863   0/60       -         8                      
pool-pfr     TODOS       660  29:21  6:43  329/660  64    98    154   5022   34/660     28.1                             
pool-pfrs    TODOS       200  30:39  6:41  106/200  63    95    147   6366   9/200      27.9              ×0.98 ±8% (160)
pool-gengar  TODOS       60   30:51  6:45  32/60    58    82    118   2863   0/60       -                 ×NaN ±NaN% (0)
```

Objeto que llevaban en el minuto 7 (las partidas de `pool-pfr` y `pool-pfrs` que llegan vivas al 7):
Pañuelo Elección 256/355 llegan al 30 (72 %), Garra Rápida 78/169 (46 %), Restos 61/119 (51 %),
Chaleco Asalto 27/67 (40 %), Banda Focus 10/33 (30 %). [MEDIDO; no es un experimento: quien lo lleva
también tuvo más suerte con los objetos]

## 10. Lo que no se ha probado

- **`tableLevel`** (sim/bots/README.md): el modelo de cartas sobrevalora algunos ataques nuevos (Puño
  Dinámico evolucionado ×1,5 respecto a la tabla medida) porque la tabla se ajusta con un solo factor por
  ataque. La opción lo corrige; no se ha medido si cambia los resultados del bot normal.
- Más vetos a mano (por ejemplo, vetar los ataques que llenan huecos): `reserve` ya hace lo mismo para
  el bot, pero un jugador con vetos manuales podría ganar algo de espacio en las tandas.
- Movimiento inicial para los que no son Empoleon y Togedemaru: en conjunto ×0,98 (sección 2); no se
  buscó el mejor inicial distinto de Puño Meteoro.
- La Sentencia (minuto 30 en adelante) sólo se ve hasta el minuto 31:40 (`--max 1900`).

## 11. Cómo repetirlo

Colas en `sim/out/v5/queue{1..6}.sh` (en disco, fuera de git). Lo esencial:

```
export PATH="/c/Program Files/nodejs:$PATH"
IR='["choicescarf","quickclaw","leftovers","assaultvest","focussash","lifeorb","shellbell","luckyegg","rockyhelmet","amuletcoin","choiceband"]'
PFR='{"priority":["meteor-mash","swords-dance","harden"],"reserve":true,"statWeights":{"spd":3},"itemRank":'"$IR"'}'
node sim/sweep.js --bot best --dex 1018,448,1000,798,395,966,624,777 --seeds 701-720 --max 1900 --ban auto --jobs 14 --out sim/out/v5/steel-pfr.jsonl --opts "$PFR"
node sim/sweep.js --bot best --dex all --seeds 801-802 --max 900 --ban auto --jobs 14 --out sim/out/v5/screen.jsonl
node sim/screenreport.js sim/out/v5/screen.jsonl --top 40
node sim/snowstats.js sim/out/v5/steel-normal.jsonl sim/out/v5/steel-pfr.jsonl
PYTHONIOENCODING=utf-8 python sim/paired_ana.py sim/out/v5/steel-normal.jsonl sim/out/v5/steel-pfr.jsonl
node sim/cardorder.js sim/out/v5/pool-pfr.jsonl --dex 638
```

Tiempos con 14 hilos: una partida de 30 min de Acero con priofast ≈ 1 min de reloj; la criba entera
≈ 4 h; la ronda fuerte ≈ 5 h.
