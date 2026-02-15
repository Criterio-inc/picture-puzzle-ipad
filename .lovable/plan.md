

# Fix: Runda Ravensburger-bitar, synliga bitar i ladan, helskarms-guide

## Tre problem att losa

### 1. Bitarnas form ar inte rund nog (drawJigsawSide)

Nuvarande bezier-kurvor ger en for kantig/platt form. Problemet ar att kontrollpunkterna i `drawJigsawSide` inte skapar den klassiska "svampformen" -- halsen ar for bred och huvudet for platt. 

**Losning**: Skriva om bezier-kurvorna i `drawJigsawSide` (rad 72-135) med nya kontrollpunkter som ger:
- Tydligare inbuktning vid halsen (smalare midja)
- Bredare, mer cirkulart huvud som sticker ut mer
- Mjukare overgång mellan hals och huvud

Nya parametrar i `FIXED_TAB_PARAMS`:
```text
posStart: 0.35
posEnd: 0.65
neckWidth: 0.04      (smalare hals for tydligare midja)
tabHeight: 0.28      (hogre flik)
headWidth: 0.22      (bredare huvud relativt halsen)
```

Ny `drawJigsawSide` med 6 bezier-kurvor:
1. Rak linje till neckStart
2. Inbuktning: kanten gar INAT lite innan halsen (skapar den typiska "insvangningen")
3. Hals uppat: smal passage med tydlig midja
4. Vanster sida av huvudet: bred utsvangning med stor radie
5. Hoger sida av huvudet: symmetrisk spegelbild
6. Hals nerat och tillbaka till kanten med insvangning
7. Rak linje till slut

Den stora skillnaden mot nuvarande: huvudet ska vara markant bredare an halsen (ca 3-4x), och det ska finnas en liten "indrag" precis vid halsens start for att skapa den typiska Ravensburger-formen.

### 2. Vissa bitar SYNS INTE i ladan

Problemet ar att bitarnas rendering i `PieceTray` beraknar `size` baserat pa `displayWidth * 0.55` men `displayWidth` inkluderar tab-marginaler (`tabW * 2`). For bitar med mesta av sin bild i tab-omradet (t.ex. hornbitar med tva platta sidor) kan bilddatan vara nastan helt transparent, vilket gor dem osynliga.

**Losning** i `PieceTray.tsx` (rad 178-180): 
- Oka minsta storlek och skalningsfaktor
- Andra fran `0.55` till `0.45` och satt `minSize` hogre (80px)
- Lagg till en subtil bakgrund pa varje bit sa att aven nastan-transparenta bitar syns

### 3. Guide-rektangeln fyller INTE hela skarmen

Anvandaren vill att pusslets guide ska matcha hela viewporten -- skarmens horn = pusslets horn. Just nu har `fitToPuzzle` en `paddingFactor` pa 1.4 och initial view har padding pa 1.1 med 20px margin.

**Losning** i `PuzzleBoard.tsx`:
- Initial view (rad 53-71): Satt `paddingFactor = 1.0` och `panX = 0, panY = 0` sa guiden precis fyller viewporten
- `fitToPuzzle` (rad 154-179): Andra `paddingFactor` fran `1.4` till `1.0` sa den passar exakt

Aven ta bort harnmarkorerna (L-formade horn) da de inte behovs nar guiden matchar skarmens kanter.

## Sammanfattning

| Fil | Andring |
|---|---|
| `src/lib/puzzle.ts` | Omskriven `drawJigsawSide` med nya bezier-kontrollpunkter for rund Ravensburger-form. Justerade `FIXED_TAB_PARAMS`. |
| `src/components/puzzle/PieceTray.tsx` | Oka bitstorlek i ladan och lagg till bakgrundsfarg sa alla bitar syns. |
| `src/components/puzzle/PuzzleBoard.tsx` | Satt paddingFactor=1.0 och pan=(0,0) sa guiden fyller hela skarmen. Ta bort hornmarkoer. |
