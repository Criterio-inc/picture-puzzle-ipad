
# Rundare pusselbitar och autosparning

## 1. Rundare pusselbitsform (puzzle.ts)

Referensbilden visar klassiska pusselbitar med rejalt runda, bulliga flikar -- nastan cirkelformade "knappar" som sticker ut, och djupa runda hal. Den nuvarande koden har for smala flikar med for liten radie.

Andringar i `drawJigsawSide`-funktionen:
- **Storre flikhojd**: Oka `tabHeight` fran `0.25` till `0.32` av kantlangden
- **Bredare nacke**: Oka `neckWidth` fran `0.08` till `0.12`
- **Bredare huvud**: Oka `headWidth` fran `0.16` till `0.24`
- **Rundare Bezier-kontrollpunkter**: Justera kontrollpunkternas positioner for att skapa mer cirkelformade bulor istallet for spetsiga former. Kontrollpunkterna for "left side of tab head" och "right side of tab head" behover spridas ut mer at sidorna och tryckas langre ut fran kanten
- **Oka tab-marginalen** i `splitImage`: Andra `tabW`/`tabH` fran `pieceW * 0.28` till `pieceW * 0.35` sa att den storre fliken far plats i canvas-ytan

### Tekniska detaljer -- nya Bezier-parametrar

```text
Nuvarande form:        Ny form (rundare):
   /--\                   .----.
  |    |                 /      \
  |    |                |        |
   \--/                  \      /
  | || |                 | || |
  ======                 ======
```

Nyckelandringar i `drawJigsawSide`:
- `tabHeight = len * 0.32` (fran 0.25)
- `neckWidth = len * 0.12` (fran 0.08)
- `headWidth = len * 0.24` (fran 0.16)
- Kontrollpunkter for Bezier-kurvorna justeras for att ge en mer halvsfarsformad flik med jamnare rundning

## 2. Autosparning vid navigering bort (PuzzleGame.tsx)

Istallet for en manuell "Spara"-knapp ska pusslet sparas automatiskt nar anvandaren navigerar tillbaka (trycker pa tillbaka-knappen eller lamnar sidan).

### Implementation:
- Lagg till en `autoSave`-funktion som anropas via:
  1. **Tillbaka-knappen i headern**: Anropa `autoSave()` innan `navigate("/")`
  2. **`beforeunload`-event**: For att fanga webblasar-navigering och flik-stangning
  3. **`visibilitychange`-event**: For att fanga iPad-hemknapps-tryck och app-byte
- Ta bort den manuella "Spara"-knappen och `saving`-state fran `PuzzleHeader`
- `autoSave` gor samma sak som `handleSave` men utan toast-meddelanden (tyst sparning)
- Anvand en ref for att tracka om sparning redan pagat, for att undvika dubbletter

### Andringar i PuzzleHeader:
- Ta bort `onSave` och `saving` fran props
- Ta bort Spara-knappen fran UI
- Andra tillbaka-knappen sa att den anropar en ny `onBack`-callback istallet for direkt `navigate`

### Andringar i PuzzleGame:
- Lagg till `autoSave` som sparar tyst till databasen
- Registrera `beforeunload` och `visibilitychange` event listeners
- Tillbaka-knappen anropar `autoSave().then(() => navigate("/"))`

## Filer som andras

1. **src/lib/puzzle.ts** -- Ny Bezier-geometri for rundare flikar, storre tab-marginaler
2. **src/pages/PuzzleGame.tsx** -- Autosparning vid navigering, ta bort manuell save-logik
3. **src/components/puzzle/PuzzleHeader.tsx** -- Ta bort Spara-knapp, lagg till `onBack`-prop
