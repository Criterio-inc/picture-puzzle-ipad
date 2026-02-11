

# Plan: 576 bitar med stora, synliga pusselbitar

## Problemet
Att minska antalet bitar (fran 24x24 till 8x8) var fel approach. Riktiga pussel har 500+ bitar och varje bit ar fortfarande stor nog att se. Losningen ar istallet att behalla 24x24 (576 bitar) men gora varje bit visuellt stor i brickan, med en scrollbar yta dar man blaaddrar igenom alla bitar.

## Losning

### 1. Aterstall 24x24 rutnatet
- `PuzzleGame.tsx`: COLS = 24, ROWS = 24 (576 bitar)

### 2. Gora bitarna storre i renderingen
- `puzzle.ts`: Andra `scale` fran 1.5 till 1.0 (eller lagre) sa att `displayWidth`/`displayHeight` blir storre. Varje bit far ungefar dubbelt sa stor visning som nu.

### 3. Omdesigna brickan (PieceTray) for scrollning
Den nuvarande brickan ar 140px ihopfalld och 55dvh expanderad. Den nya designen:

- **Ihopfalld**: Visar en tunn rad med en "drag-upp"-indikator och text ("576 bitar kvar - dra upp")
- **Expanderad**: Tar upp ~65-70% av skarmen (h-[70dvh]) med full vertikal scrollning
- Bitarna visas i ett `flex-wrap` grid med storlek ca 70-90px per bit sa man tydligt ser bildinnehallet
- Scrollbar via `overflow-y-auto` -- man scrollar nedat for att se alla 576 bitar
- "Markera alla synliga" / "Avmarkera alla" knappar for smidigare arbetsflode
- "Skicka (N)" knappen fixerad langst ner i brickan

### 4. Storlek pa bitar pa bordet (PuzzleBoard)
- Bordet anvander pan+zoom (CSS transform) sa att man kan navigera det stora pusslet
- Nar alla 576 bitar ar utlagda pa bordet behover man kunna panorera och zooma
- Implementera pinch-to-zoom och tva-finger-panorering pa bordet

## Tekniska detaljer

### puzzle.ts
```
// Rad 176: Andra scale
const scale = 1.0;  // Fran 1.5 -> 1.0 for storre bitar
```

### PuzzleGame.tsx
```
const COLS = 24;
const ROWS = 24;
```

### PieceTray.tsx (omskriven)
- Expanderad hojd: `h-[70dvh]` istallet for `h-[55dvh]`
- Ihopfalld: `h-[52px]` (bara en indikator-rad)
- Bitar renderas i storlek `piece.displayWidth * 0.6` (ca 70-80px per bit med scale 1.0)
- `overflow-y-auto` for scrollning genom alla bitar
- Sticky "Skicka"-knapp langst ner
- Visa raknare: "42 av 576 markerade"

### PuzzleBoard.tsx (zoom + pan)
- Lagg till `transform: scale(zoom) translate(panX, panY)` pa board-containern
- Lagg till scroll-hjul / pinch-zoom hantering
- Zoom-knappar (+/-) i ett horn
- Dubbelklick for att aterstalla zoom

### Flode
```text
+------------------------------------------+
|  Header: 12/576 pa bordet | Spara | ...  |
+------------------------------------------+
|                                          |
|         PUSSELBORD (pan + zoom)          |
|    Stort arbetsomrade med utlagda bitar  |
|                                          |
+------------------------------------------+
|  ^ Dra upp (544 bitar kvar)             |  <-- ihopfalld
+------------------------------------------+

         ELLER (expanderad):

+------------------------------------------+
|  Header                                  |
+------------------------------------------+
|  Bord (30%)                              |
+------------------------------------------+
|  v Dra ner                               |
|  +------+------+------+------+------+    |
|  | bit1 | bit2 | bit3 | bit4 | bit5 |    |
|  +------+------+------+------+------+    |
|  | bit6 | bit7 | bit8 | bit9 | ...  |    |
|  +------+------+------+------+------+    |
|  |  ... scrollbar nedat for fler ... |    |
|  +-----------------------------------+   |
|  [====== Skicka (42 markerade) ======]   |
+------------------------------------------+
```

### Filer som andras
1. **src/pages/PuzzleGame.tsx** -- COLS/ROWS tillbaka till 24
2. **src/lib/puzzle.ts** -- scale fran 1.5 till 1.0
3. **src/components/puzzle/PieceTray.tsx** -- storre bitar, scrollbar layout, sticky skicka-knapp
4. **src/components/puzzle/PuzzleBoard.tsx** -- zoom och pan-funktionalitet

