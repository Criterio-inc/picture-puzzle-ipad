

# Alla tre ändringar: Ravensburger-bitar, bildnormalisering, synligare guide

## 1. Ravensburger-stil pusselbitar (`src/lib/puzzle.ts`)

Helt omskriven `drawJigsawSide` med ny kurvprofil:
- Smal nacke med inåtgående "klämma" (neckInset) som ger svampform
- Stort runt huvud med breda Bezier-kurvor som skapar nästan cirkulär form
- Parametrar: `neckWidth = 0.08`, `tabHeight = 0.30`, `headSpread = 0.22`
- 6 segment: rak -> nacke inåt -> vänster bulge -> höger bulge -> nacke tillbaka -> rak

## 2. Bildnormalisering (`src/lib/puzzle.ts`)

Ny `normalizeImage`-funktion som körs innan bitarna klipps:
- Konstant `MIN_DIMENSION = 2400`
- Om bildens största sida understiger 2400px skalas den upp proportionellt
- Uppskalad bild ritas på en canvas som sedan används som källa
- Garanterar att pusselbitar alltid får rimlig storlek

## 3. Synligare guide-rektangel (`src/components/puzzle/PuzzleBoard.tsx`)

- Tjockare kant: `3px dashed rgba(255,255,255,0.7)` 
- Starkare bakgrund: `rgba(255,255,255,0.07)`
- Kraftigare skugga: `inset 0 0 60px rgba(255,255,255,0.10)`
- 4 st L-formade hörnmarkeringar (20x20px) i varje hörn med `rgba(255,255,255,0.8)` kanter

## Filer som ändras

1. `src/lib/puzzle.ts` -- ny drawJigsawSide + normalizeImage + använd normaliserad bild i splitImage
2. `src/components/puzzle/PuzzleBoard.tsx` -- starkare guide-styling + hörnmarkeringar

