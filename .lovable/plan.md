

# Klassiska Ravensburger-liknande pusselbitar

## Vad som andras

Bitarnas form ska matcha referensbilden: runda, fylliga flikar med smal hals och bred, cirkulär huvud -- den klassiska Ravensburger-stilen. Inga andra forandringar (inga gap-fixar, inga layoutandringar -- enbart formen).

## Teknisk andring

### Fil: `src/lib/puzzle.ts`

**1. Uppdatera `FIXED_TAB_PARAMS` (rad 40-46)**

Nuvarande varden ger for smala, spetsiga flikar. Nya varden for att matcha referensbilden:

```text
posStart: 0.34       (oforandrad, var tabben borjar langs kanten)
posEnd: 0.66         (oforandrad)
neckWidth: 0.06      (smalare hals: 0.10 -> 0.06)
tabHeight: 0.30      (hogre flik: 0.28 -> 0.30)
headRadius: 0.18     (storre rundning: 0.15 -> 0.18)
```

**2. Omskriven `drawJigsawSide`-funktion (rad 72-136)**

Nuvarande implementering anvander 4 bezier-kurvor som ger en alltfor smal och kantig form. Den nya implementeringen anvander en mer anatomiskt korrekt kurva med tydliga faser:

1. Rak linje till halsens start
2. Mjuk insvangning in mot halsen (smal, tydlig midja)
3. Utsvangning fran halsen till flikens breda huvud (cirkulart, stort)
4. Avrundad topp pa flikens huvud (bred, rund)
5. Symmetrisk nergång tillbaka genom halsen
6. Rak linje till kanten slut

Nyckelskillnader mot nuvarande:
- Halsen ar smalare och mer uttalad (tydlig midja)
- Huvudet ar bredare och mer cirkulart (storre radie i bezierkurvorna)
- Overgangen fran hals till huvud ar mjukare med fler kontrollpunkter
- Formen ar mer symmetrisk och "rund" overall

**3. 3D-effekter oforandrade**

Skugg- och highlight-blocken (rad 226-252) andras INTE. De har redan `strokeStyle = "transparent"` med `stroke()` som enbart driver skuggeffekten. Bitarnas visuella djup bevaras.

## Sammanfattning

| Fil | Andring |
|---|---|
| `src/lib/puzzle.ts` | Justerade `FIXED_TAB_PARAMS` + omskriven `drawJigsawSide` for runda Ravensburger-flikar med bred rund huvud och smal hals |

Inga andra filer andras. Bitarnas rendering, klippning, snapping och 3D-effekter ar identiska -- enbart kurvgeometrin uppdateras.
