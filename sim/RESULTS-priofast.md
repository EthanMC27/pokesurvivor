# Priofast en todo el Acero — resultados

Build **priofast** (ver `GUIA-bola-de-nieve.md`, sección 4): prioridad Puño Meteoro → Danza Espada →
Fortaleza, Carrera con peso ×3 y **Pañuelo Elección primero**. Escenario: Mejoras al máximo,
3 vetos automáticos, `--bot best`, partida completa. Opciones exactas: `sim/out/queue4.sh`.

## Conclusiones

1. **Priofast mejora a casi todos los Pokémon de Acero** [MEDIDO, 540 parejas]: supervivencia
   ×1,49 (IC95 ×1,39-×1,60), y los que llegan al minuto 30 pasan de 103 a 252 de 540.
2. **Los baratos se vuelven buenos** [MEDIDO, confirmado con semillas nuevas 501-520]: Pawniard,
   Togedemaru y Bisharp ×2,01 (IC95 ×1,61-×2,52), de 8 a 34 de 60 al minuto 30.
3. **El Pañuelo NO es una regla general** [MEDIDO, 180 parejas]: en los mejores de supervivencia
   (Marshadow, Xurkitree, Plusle...) "Pañuelo + Carrera" da ×1,02 (IC95 ×0,92-×1,13): ayuda a
   Voltorb, Plusle o Marshadow y perjudica a Luxio y Sneasler. Funciona con Puño Meteoro porque esas
   builds mueren rodeadas hacia el minuto 8-10.
4. **Copiar la receta a Lucha no funciona** [MEDIDO, 75 parejas]: prioridad Golpe Kárate → Esfera
   Aural → Danza Espada → Fortaleza + Pañuelo da ×0,81. A Lucario (Lucha/Acero) le quita Puño
   Meteoro y se hunde; sólo Machamp mejora (×1,40).

## Ranking juntando todas las partidas con priofast (y el bot normal para los de supervivencia)

| # | Pokémon | Rareza | Build | Partidas | Llegan al 30 | Mediana | Peor 10 % | Nivel min 15 | Derrotados (mediana) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Marshadow | 5 (leg.) | normal | 50 | 76 % | 31:40 | 18:04 | 50 | 2698.5 |
| 2 | Gholdengo | 4 | priofast | 32 | 75 % | 31:36 | 6:38 | 105 | 15473.5 |
| 3 | Archaludon | 5 | priofast | 32 | 75 % | 31:33 | 7:58 | 103.5 | 17376 |
| 4 | Empoleon | 4 | priofast | 35 | 74 % | 31:40 | 7:16 | 91 | 8362 |
| 5 | Lucario | 4 | priofast | 35 | 71 % | 30:41 | 6:52 | 94.5 | 12921 |
| 6 | Revavroom | 4 | priofast | 35 | 69 % | 30:47 | 8:23 | 98 | 8686 |
| 7 | Jirachi | 5 (leg.) | priofast | 35 | 69 % | 30:41 | 7:06 | 92.5 | 6592 |
| 8 | Kartana | 4 | priofast | 31 | 68 % | 30:40 | 9:46 | 101.5 | 11793 |
| 9 | Xurkitree | 4 | normal | 50 | 66 % | 31:40 | 10:11 | 56 | 2891 |
| 10 | Aegislash | 4 | priofast | 35 | 66 % | 31:40 | 5:38 | 86 | 5714 |
| 11 | Duraludon | 4 | priofast | 35 | 66 % | 31:10 | 6:58 | 96 | 13080 |
| 12 | Cobalion | 5 (leg.) | priofast | 32 | 66 % | 30:37 | 7:56 | 96 | 11528.5 |
| 13 | Orthworm | 3 | priofast | 35 | 63 % | 31:40 | 7:28 | 95.5 | 11413 |
| 14 | Heatran | 5 (leg.) | priofast | 35 | 63 % | 31:24 | 6:49 | 95 | 8466 |
| 15 | Plusle | 2 | normal | 50 | 62 % | 31:40 | 10:00 | 50 | 1970 |
| 16 | Togedemaru | 3 | priofast | 60 | 62 % | 30:39 | 7:23 | 88 | 6684 |
| 17 | Registeel | 5 (leg.) | priofast | 15 | 60 % | 31:40 | 7:30 | 104 | 15353 |
| 18 | Kingambit | 4 | priofast | 15 | 60 % | 31:19 | 6:48 | 95 | 9751 |
| 19 | Bisharp | 3 | priofast | 40 | 60 % | 31:16 | 6:48 | 101 | 11327 |
| 20 | Doublade | 3 | priofast | 15 | 60 % | 30:49 | 7:13 | 99 | 8922 |
| 21 | Solgaleo | 5 (leg.) | priofast | 15 | 60 % | 30:40 | 6:32 | 97 | 9346 |
| 22 | Pawniard | 2 | priofast | 60 | 58 % | 31:22 | 6:55 | 91 | 5570 |
| 23 | Magearna | 5 (leg.) | priofast | 35 | 57 % | 30:47 | 6:50 | 100 | 10391 |
| 24 | Durant | 3 | priofast | 35 | 57 % | 30:37 | 6:37 | 96.5 | 6548 |
| 25 | Klinklang | 4 | priofast | 20 | 55 % | 30:39 | 6:55 | 101 | 8701.5 |
| 26 | Corviknight | 4 | priofast | 35 | 54 % | 30:57 | 7:34 | 95.5 | 3670 |
| 27 | Forretress | 3 | priofast | 15 | 53 % | 31:17 | 3:19 | 97 | 7691 |
| 28 | Tinkatuff | 2 | priofast | 15 | 53 % | 31:15 | 7:03 | 86 | 2824 |
| 29 | Metagross | 5 | priofast | 15 | 53 % | 30:54 | 5:09 | 104 | 10048 |
| 30 | Genesect | 5 (leg.) | priofast | 15 | 53 % | 30:12 | 6:38 | 98 | 8199 |

## Prueba final comparable (las mismas 20 semillas nuevas, 601-620)

| # | Pokémon | Tipos | Rareza | Build | Llegan al 30 | Mediana | Peor 10 % | Nivel min 15 | Nivel min 30* | Derrotados (mediana) | Potencia al tope |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Archaludon | steel/dragon | 5 | priofast | 16/20 | 31:32 | 7:38 | 107 | 209.5 | 18039.5 | 14/20 |
| 2 | Lucario | fighting/steel | 4 | priofast | 16/20 | 30:53 | 9:50 | 92 | 176 | 14144.5 | 8/20 |
| 3 | Marshadow | fighting/ghost | 5 (leg.) | normal | 15/20 | 31:40 | 24:42 | 50 | 63 | 2744 | 0/20 |
| 4 | Gholdengo | steel/ghost | 4 | priofast | 15/20 | 31:36 | 6:24 | 103 | 185 | 16216 | 8/20 |
| 5 | Empoleon | water/steel | 4 | priofast | 15/20 | 31:30 | 8:31 | 91 | 134 | 8446 | 0/20 |
| 6 | Revavroom | steel/poison | 4 | priofast | 14/20 | 31:00 | 6:10 | 100 | 166 | 11780 | 5/20 |
| 7 | Kartana | grass/steel | 4 | priofast | 14/20 | 30:40 | 10:16 | 102.5 | 168 | 12370.5 | 3/20 |
| 8 | Cobalion | steel/fighting | 5 (leg.) | priofast | 14/20 | 30:37 | 8:38 | 96 | 167.5 | 11528.5 | 7/20 |
| 9 | Xurkitree | electric | 4 | normal | 13/20 | 31:40 | 9:31 | 59 | 68 | 2926.5 | 2/20 |
| 10 | Plusle | electric | 2 | normal | 13/20 | 31:40 | 9:26 | 52 | 68 | 1955.5 | 0/20 |
| 11 | Duraludon | steel/dragon | 4 | priofast | 13/20 | 31:16 | 6:58 | 98 | 208 | 13803.5 | 10/20 |
| 12 | Jirachi | steel/psychic | 5 (leg.) | priofast | 13/20 | 30:40 | 7:06 | 91 | 140 | 6069 | 2/20 |
| 13 | Heatran | fire/steel | 5 (leg.) | priofast | 12/20 | 31:19 | 6:43 | 95 | 154.5 | 5217.5 | 1/20 |
| 14 | Aegislash | steel/ghost | 4 | priofast | 12/20 | 31:09 | 5:38 | 88.5 | 142 | 4429 | 1/20 |
| 15 | Togedemaru | electric/steel | 3 | priofast | 12/20 | 30:42 | 7:11 | 99.5 | 167.5 | 8201.5 | 3/20 |
| 16 | Orthworm | steel | 3 | priofast | 11/20 | 30:41 | 7:26 | 91 | 198 | 7007.5 | 8/20 |
| 17 | Corviknight | flying/steel | 4 | priofast | 10/20 | 28:06 | 7:34 | 95 | 149.5 | 3136 | 3/20 |
| 18 | Durant | bug/steel | 3 | priofast | 10/20 | 21:34 | 6:37 | 93 | 150.5 | 3315.5 | 2/20 |
| 19 | Magearna | steel/fairy | 5 (leg.) | priofast | 10/20 | 19:59 | 7:51 | 105.5 | 189.5 | 6155.5 | 6/20 |
| 20 | Pawniard | dark/steel | 2 | priofast | 9/20 | 10:54 | 7:15 | 95 | 151 | 2412 | 1/20 |
| 21 | Dialga | steel/dragon | 5 (leg.) | priofast | 7/20 | 9:13 | 5:39 | 109.5 | 217 | 2070.5 | 7/20 |

*Mediana entre las partidas que llegan al minuto 30.

## Comparaciones emparejadas (A = bot normal, B = priofast)

### Acero baratos (semillas 201-220)
```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Bisharp       20    8:39→31:16       5→12       93→101.5  1683.5→11626.0  ×1.65
Ferroseed     20    6:46→8:36        2→4      106.5→92     995.0→1617.5  ×1.25
Klefki        20    8:41→10:06       2→8      109.0→88.0  1702.0→2243.0  ×1.55
Klink         20    7:29→8:36        2→3      105.0→97    1269.5→1694.5  ×1.11
Klinklang     20    9:44→30:39       9→11       99→101   2116.5→8701.5  ×1.16
Meltan        20    8:33→13:22       4→9      107.0→95.5  1744.5→2371.0  ×1.60
Pawniard      20    9:15→31:40       6→15     96.5→90    1937.5→8932.0  ×1.94
Scizor        20   16:50→25:15       9→10     89.5→94    3082.0→4563.5  ×1.00
Togedemaru    20   10:55→30:42       8→14     105.0→84    2250.5→6481.5  ×1.66
Varoom        20    8:45→9:52        1→6      105.0→96    1406.0→2152.0  ×1.63
TOTAL 200 parejas: ×1.43 (IC95 ×1.26-×1.61); llegan30 48→92
```
### Confirmación de los baratos (semillas nuevas 501-520)
```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Bisharp       20    8:51→31:14       5→12       93→100.5  1818.5→10911.5  ×1.67
Pawniard      20    5:45→31:00       0→11        0→91     717.0→4517.5  ×2.77
Togedemaru    20    8:44→30:27       3→11     106.0→88.0  1791.5→6204.5  ×1.76
TOTAL 60 parejas: ×2.01 (IC95 ×1.61-×2.52); llegan30 8→34
```
### Resto del Acero viable (semillas 201-215)
```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Aegislash     15    9:01→31:40       2→11       97→85      1764→6716    ×2.02
Aggron        15    7:39→8:38        1→3       105→91      1416→1807    ×1.25
Bronzong      15    7:05→8:35        0→4         0→93.5    1112→1717    ×1.67
Celesteela    15    7:01→7:11        1→3       108→104     1242→1157    ×1.27
Corviknight   15   12:05→30:57       5→9       103→96      2474→9735    ×1.47
Doublade      15    8:44→30:49       1→9      95.0→99      1750→8922    ×2.01
Duraludon     15    9:59→31:10       3→10      101→95.5    1886→12438   ×1.78
Durant        15    8:41→30:37       4→10     94.0→99.5    1775→8680    ×1.77
Empoleon      15   10:14→31:40       7→11       98→95      2286→8209    ×1.36
Escavalier    15    8:13→9:22        1→5      107.0→110     1758→2129    ×1.42
Excadrill     15   11:48→29:14       4→7      84.5→92.0    2194→5013    ×1.22
Ferrothorn    15    7:10→9:04        1→1      96.5→116     1149→1977    ×1.09
Forretress    15    8:35→31:17       3→8        94→97      1500→7691    ×1.53
Genesect      15   17:53→30:12       7→8      94.0→98      4123→8199    ×1.08
Heatran       15    9:41→31:40       4→10     107.5→94      2243→9106    ×1.97
Honedge       15    8:40→8:41        3→5      95.0→93      1551→2020    ×1.11
Jirachi       15    9:20→30:41       6→11     106.5→94      1799→6592    ×1.77
Kingambit     15    8:28→31:19       0→9      96.5→95      1717→9751    ×2.07
Klang         15    7:17→8:33        0→4         0→104.0    1162→1858    ×1.76
Lairon        15    7:39→8:00        2→2      84.5→90.5    1290→1536    ×1.11
Lucario       15    9:41→30:37       6→9       106→96      2160→9730    ×1.16
Magearna      15    9:05→31:25       4→10     114.0→93.5    1968→10517   ×1.69
Magnemite     15    9:03→9:51        2→6      93.5→99      1950→2137    ×1.56
Magneton      15    8:57→10:56       5→7        85→98      1878→2858    ×1.23
Mawile        15    8:54→8:37        0→4       106→92.5    1689→1810    ×1.24
Melmetal      15    8:59→10:08       5→6       108→109.0    2078→2324    ×1.39
Metagross     15    8:46→30:54       2→8      92.5→104.0    1830→10048   ×1.55
Orthworm      15    9:25→31:40       5→11      108→96      2238→12883   ×1.86
Perrserker    15    9:07→12:00       4→7      107.5→100     1870→3256    ×1.34
Registeel     15    9:25→31:40       3→9        98→104     1666→15353   ×1.82
Revavroom     15    8:40→30:44       4→10       98→93.0    1802→8134    ×1.79
Skarmory      15    8:32→9:37        1→5       116→93.5    1677→2017    ×1.71
Solgaleo      15    8:31→30:40       2→9       104→97      1466→9346    ×1.93
Stakataka     15    6:51→6:55        0→0         0→0       1082→1133    ×1.05
Tinkatink     15    7:38→8:37        1→3       105→91      1330→1598    ×1.23
Tinkatuff     15    9:18→31:15       4→8      95.0→86.0    1698→2824    ×1.44
TOTAL 540 parejas: ×1.49 (IC95 ×1.39-×1.60); llegan30 103→252
```
### Pañuelo + Carrera en los mejores de supervivencia (A = normal, B = Pañuelo; semillas 111-130)
```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Barraskewda   20   31:29→31:04      11→14       48→43.0  1905.5→1636.5  ×1.14
Cinderace     20   28:14→31:09       9→12     38.5→34.5  1310.5→1277.5  ×1.12
Keldeo        20   29:58→30:44      10→11     51.0→51.0  3039.5→1933.5  ×0.83
Luxio         20   31:11→18:01      12→8        49→44    2441.5→1391.5  ×0.76
Marshadow     20   31:40→30:57      14→16     49.5→47.0  2589.0→2165.0  ×1.17
Plusle        20   27:38→31:17      10→16     49.0→40.0  1856.5→1889.5  ×1.17
Sneasler      20   25:33→14:10      10→8      50.0→48.5  1788.5→1586.5  ×0.78
Voltorb       20   19:04→31:40       8→14     42.5→41    1432.0→1812.5  ×1.29
Xurkitree     20   31:26→31:28      13→14       51→51.0  2859.5→2210.5  ×1.07
TOTAL 180 parejas: ×1.02 (IC95 ×0.92-×1.13); llegan30 97→113
```
### Lucha con prioridad + Pañuelo (A = normal, B = variante; semillas 401-415)
```
Pokémon        n    mediana A→B  llegan30 A→B    nv15 A→B     derrot. A→B  ×geo
Conkeldurr    15   10:14→4:43        5→3      65.0→62.5    1269→251     ×0.53
Lucario       15   12:20→11:53       7→4       107→41      2504→615     ×0.89
Machamp       15   11:05→19:16       4→7      43.0→59      1067→1472    ×1.40
Mankey        15   17:27→8:16        3→6        49→54      1591→490     ×0.77
Zamazenta     15   11:57→5:33        2→2      60.0→43.0    1226→282     ×0.69
TOTAL 75 parejas: ×0.81 (IC95 ×0.60-×1.10); llegan30 21→22
```
