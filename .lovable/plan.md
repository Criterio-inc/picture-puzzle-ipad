
# Buggfix: Snap-logik, validering och visuell feedback

## Identifierade problem

### 1. Fel bitar snapper ihop
`trySnap`-funktionen kontrollerar korrekt att bitar maste vara grannar i rutnatet (rad/kolumn-skillnad exakt 1). Problemet ar att `SNAP_THRESHOLD = 18` ar for generost i forhallande till bitstorlek. Med 24x24 pa en 2400px bild ar varje cell ~100px, sa 18px = 18% av cellbredden. Tva bitar som ar grannar i rutnatet men som inte alls ar nara varandra visuellt kan anda snappa om de av misstag placeras nara den "forvantade" positionen relativt nagon annan bit.

**Losning:** Gora SNAP_THRESHOLD dynamisk -- baserad pa cellstorlek istallet for ett fast varde. Anvand ~8% av cellbredden, vilket ger battre precision.

### 2. Kantbitar snapper inte ihop
Samma snap-logik galler for kantbitar som for alla andra -- problemet ar sannolikt att threshold ar for liten i forhallande till hur noggrant anvandaren placerar dem. Med dynamisk threshold och ett hogre relativt varde (10% av cellstorlek) bor det fungera battre.

### 3. Saknas tydlig SNAP-effekt
Nar bitar snapper ihop syns ingen visuell feedback. Anvandaren vet inte om det lyckades.

**Losning:** Nar `trySnap` eller `trySnapToGuide` faktiskt andrar nagon bits position/grupp, returnera aven om snap skedde. Visa en kort visuell puls-animation pa den snappade gruppen + ett ljud/toast.

### 4. Antal bitar
24x24 = 576 bitar (inte 546). Logiken ar korrekt, men det kan vara bra att kontrollera att ratt antal faktiskt skapas.

## Tekniska andringar

### `src/lib/puzzle.ts`

1. **Dynamisk SNAP_THRESHOLD**: Beraken fran cellstorlek istallet for fast 18px
   - `const SNAP_THRESHOLD = Math.max(8, cellW * 0.10)` (10% av cellbredd, minst 8px)
   - Flytta berakningen in i `trySnap` och `trySnapToGuide`

2. **Returnera snap-resultat**: Lat `trySnap` och `trySnapToGuide` returnera `{ pieces, snapped: boolean }` istallet for bara `pieces[]`, sa att anroparen kan reagera pa att snap skedde.

3. **Ta bort den globala `SNAP_THRESHOLD`-konstanten** -- den beraknas nu dynamiskt.

### `src/pages/PuzzleGame.tsx`

1. **Reagera pa snap**: I `handlePieceDrop`, kontrollera om snap skedde och visa feedback:
   - Visa kort toast: "Klick! Bitar snappade ihop"
   - Spela ett kort snap-ljud (valfritt -- kan anvanda Web Audio API for ett kort "klick")

2. **Visuell feedback**: Skicka snapped-grupp-ID till `PuzzleBoard` for att visa en kort puls-animation.

### `src/components/puzzle/PuzzleBoard.tsx`

1. **Snap-animation**: Nar en grupp just har snappats, lagg till en kort CSS-animation (gron glow/puls) pa alla bitar i den gruppen som forsvinner efter ~500ms.

## Sammanfattning av andringar

| Fil | Andring |
|---|---|
| `src/lib/puzzle.ts` | Dynamisk threshold, returnera snap-status |
| `src/pages/PuzzleGame.tsx` | Hantera snap-feedback, visa toast vid snap |
| `src/components/puzzle/PuzzleBoard.tsx` | Visuell puls-animation vid snap |

