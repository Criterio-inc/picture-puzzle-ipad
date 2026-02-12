
# Fix: Pusselbitar som inte passar ihop visuellt

## Grundorsak

Det finns en matematisk bugg i hur flikarna (tabs) beraknas. Tva separata negationer tar ut varandra:

1. `getTabDirs` negerar `top` och `left` (rad 120, 122): `-tabs.horizontal[...]`, `-tabs.vertical[...]`
2. `drawPiecePath` negerar ocksa `bottom` och `left` (rad 114-115): `-bottom`, `-left`

Resultatet: angransande bitar far **identiska** flikformer istallet for komplementara. Bade ovansidan pa en bit och undersidan pa biten ovanfor pekar at samma hall -- sa tva utskjutande flikar moter varandra, eller tva haligheter moter varandra. Bitarna kan aldrig passa ihop visuellt.

## Losning

**En enda andring i `getTabDirs` (rad 120 och 122 i `src/lib/puzzle.ts`)**:

Ta bort negationen for `top` och `left`:

Fran:
```text
const top = row === 0 ? 0 : -tabs.horizontal[row - 1][col];
const left = col === 0 ? 0 : -tabs.vertical[row][col - 1];
```

Till:
```text
const top = row === 0 ? 0 : tabs.horizontal[row - 1][col];
const left = col === 0 ? 0 : tabs.vertical[row][col - 1];
```

`drawPiecePath` hanterar redan riktningsomkastningen genom att negera bottom och left nar kanterna ritas i omvand ordning (medurs). Den extra negationen i `getTabDirs` gor att de tar ut varandra -- efter fixen far angransande kanter **motsatta** flikriktningar, precis som i ett riktigt pussel.

## Fil som andras

| Fil | Andring |
|---|---|
| `src/lib/puzzle.ts` | Ta bort `-` fran `top` och `left` i `getTabDirs` (2 tecken) |

## Verifiering

Efter andringen:
- Om bit (r,c) har en utskjutande flik pa hogersidan, har bit (r,c+1) en halighet pa vanstersidan
- Om bit (r,c) har en halighet pa undersidan, har bit (r+1,c) en utskjutande flik pa oversidan
- Bitarna passar visuellt ihop som ett riktigt pussel
