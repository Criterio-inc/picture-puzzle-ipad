

# Rundare pusselbitar -- mjukare former som i referensbilden

## Problem
Nuvarande bitar har for smala nackar och kantiga flikar. Referensbilden (bild 2) visar bitar med:
- **Bredare, mjukare nackar** -- ingen "klammad" look
- **Rundare, storre flikhuvuden** -- nastan cirkulara klumpar
- **Jamnare overganger** -- inga skarpa vinklar mellan kropp och flik

## Andringar i `src/lib/puzzle.ts` -- funktionen `drawJigsawSide`

### Nya parametrar
- `neckStart`: 0.34 -> **0.38** (nacken borjar langre in = kortare rak kant)
- `neckEnd`: 0.66 -> **0.62**
- `neckWidth`: 0.10 -> **0.14** (bredare nacke, mindre "klamd")
- `neckInset`: 0.02 -> **0.00** (ingen inbuktning alls vid nacken)
- `tabHeight`: 0.30 -> **0.34** (hogre flik = storre rund klump)
- `headSpread`: 0.26 -> **0.30** (bredare cirkulart huvud)

### Justerade Bezier-kurvor
- Nackens oppning: ta bort inbuktningen (`neckInset = 0`) sa att kurvan gar mjukt ut fran kanten utan att forst ga inat
- Huvudets sidor: justera kontrollpunkterna for att fa en mer cirkulart rundad form med storre `tabHeight`-multiplikator (1.12 -> 1.15) och bredare `headSpread`
- Nackens stangning: spegla oppningen symmetriskt

### Fil som andras
1. **`src/lib/puzzle.ts`** -- Uppdatera 6 parametrar och finjustera Bezier-kontrollpunkter i `drawJigsawSide`

