

# Synligare pusselbord + bildfix

## Problem
1. **Bakgrunden och guide-rektangeln har nastan samma farg** -- board ar `hsl(220, 15%, 93%)` (ljusgra) och guiden ar vit med lag opacitet. Nastan ingen kontrast.
2. **Bilden kan fortfarande vara for liten** -- skarmklippet visar en pytteliten bild fran iPad-fotobiblioteket som valjs. Normaliseringen finns pa plats men guiden/bitarna kanske inte syns pa grund av fargproblemet.

## Losning

### 1. Ljust lila bakgrund pa borda (`src/index.css`)

Byt `--board` till en ljust lila farg som ger tydlig kontrast mot den vita guide-rektangeln:

- Light mode: `--board: 262 30% 88%` (ljust lila, tydligt skild fran vit)
- Dark mode: `--board: 262 20% 15%` (morkt lila for dark mode)
- Uppdatera board-border for att matcha: light `262 25% 82%`, dark `262 20% 22%`

### 2. Starkare guide-rektangel mot ny bakgrund (`src/components/puzzle/PuzzleBoard.tsx`)

Med lila bakgrund ska guiden vara vit och tydlig:
- Solid vit kant istallet for streckad: `2px solid rgba(255,255,255,0.85)`
- Starkare vit bakgrund inuti: `rgba(255,255,255,0.12)`
- Hornmarkorer med starkare opacitet och storre storlek (30x30px)

### Filer som andras

1. **`src/index.css`** -- Byt `--board` och `--board-border` till ljust lila i bade light och dark mode
2. **`src/components/puzzle/PuzzleBoard.tsx`** -- Starkare guide-rektangel som kontrasterar mot lila bakgrund

