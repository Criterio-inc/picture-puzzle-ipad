

# Tre forbattringar: Passform, helskarmsyta och naturlig kansla

## 1. Perfekt passform mellan konvex och konkav (ingen glipa)

**Problem**: Varje pusselbit renderas med kantlinjer (2.5px skugga + 1.5px ljus + 1px border). Nar tva bitar mots syns bada kanterna, vilket skapar en synlig glipa -- trots att geometrin ar korrekt.

**Losning**: Ta bort de yttre kant-effekterna (stroke/border) fran bitarnas rendering i `splitImage`. Behall enbart den subtila 3D-effekten via skuggor (shadowColor/shadowBlur) men **utan stroke()**-anrop. Skuggorna ger djupkansla utan att ata in pa bitytan. Specifikt:
- Ta bort det yttre border-blocket (strokeStyle `rgba(0,0,0,0.15)`, lineWidth 1)
- Ta bort `ctx.stroke()` fran de tva 3D-effektblocken -- behall enbart `shadowColor`/`shadowBlur`/`shadowOffset` for att skuggan laggs **utanfor** klippytan
- Resultatet: bitarna moter varandra pixel-perfekt utan nagon kant som skapar gap

## 2. Hela skarmytan ar pusselytan

**Problem**: `PUZZLE_ORIGIN` ar satt till `{x: 800, y: 800}` vilket placerar pusslet langt fran skarmens horn. Det finns en separat "arbetsyta" under pusslet. Anvandaren vill att pusslets ovre vanstra horn = skarmens ovre vanstra horn.

**Losning**:
- Andra `PUZZLE_ORIGIN` till `{x: 0, y: 0}` i `src/lib/puzzle.ts`
- Uppdatera `PuzzleBoard` initial view-logik sa kameran borjar med pusslet inpassat i skarmens viewport (redan delvis implementerat via `fitToPuzzle`)
- Uppdatera `placeAroundPuzzle` for att placera bitar **under** pusslet istallet for till vanster, eftersom vanster nu ar utanfor skarmytan (negativa koordinater)
- Ta bort "Visa arbetsytan"-knappen (focusOnWorkArea) eftersom hela ytan ar en enda pusselyta
- Justera initial zoom och pan sa pusslet fyller skarmens synliga yta

## 3. Skon och naturlig kansla

**Losning**:
- Lagg till en kort CSS-transition pa pusselbitarnas `left`/`top` (t.ex. 80ms ease-out) som bara aktiveras nar biten INTE dras (under drag: `transition: none`). Det ger en mjuk "landa"-effekt nar biten slakts
- Oka snap-puls-animationen fran 0.5s till 0.7s for en mjukare effekt
- Lagga till en subtle skala-effekt (1.05x) pa bitar medan de dras, sa det kanns som att de "lyfts" fran ytan
- Snappning-toast: ta bort text-toast och behall enbart den visuella glow-animationen for att inte storta floden

## Teknisk sammanfattning

| Fil | Andring |
|---|---|
| `src/lib/puzzle.ts` | Andra `PUZZLE_ORIGIN` till `{x:0, y:0}`. Ta bort stroke()-anrop i `splitImage` rendering. Uppdatera `placeAroundPuzzle` att placera bitar under pusslet. |
| `src/components/puzzle/PuzzleBoard.tsx` | Ta bort focusOnWorkArea-knappen. Lagg till transition pa bitars position for mjuk landa-effekt. Lagg till scale-effekt vid drag. Justera initial view for origin (0,0). |
| `src/index.css` | Justera snap-pulse animation (langsammare, mjukare). |
| `src/pages/PuzzleGame.tsx` | Ta bort snap-toast (`toast.success("Klick!")`) for att behalla naturligt flode. |

