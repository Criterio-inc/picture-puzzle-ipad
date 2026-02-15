
# Fix: Låsta grupper hoppar vid sammankoppling

## Grundorsak

`trySnap` ignorerar `locked`-flaggan helt. Nar tva grupper kopplas ihop valjer den alltid att flytta grupp B till grupp A -- oavsett om grupp B ar last (korrekt placerad pa guiden). Det ar darfor den nedre delen "hoppade at hoger" nar den kopplades samman med den ovre.

Scenario som orsakar buggen:
1. Anvandaren bygger ovre vanstra kolumnen (grupp A, lastad till guiden)
2. Anvandaren bygger nedre vanstra kolumnen (grupp B, ocksa lastad till guiden)
3. Anvandaren placerar en sammanbindande bit -- den snappas forst till grupp A
4. Nu forsaker `trySnap` koppla ihop den utokade grupp A med grupp B
5. Grupp B (lastad, korrekt position) shiftas for att matcha grupp A -- fel!

## Losning

Andra `trySnap` i `src/lib/puzzle.ts` sa att:

1. **Om grupp B ar lastad och grupp A inte ar det**: valja att flytta grupp A till grupp B istallet (omvand riktning)
2. **Om bada grupper ar lasta**: de bor redan vara korrekt positionerade relativt varandra -- gora merge utan shift (bara byt groupId)
3. **Om ingen grupp ar lastad**: bete sig som idag (flytta B till A)

### Teknisk andring i `trySnap` (rad 294-309)

Nar en snap hittas, kontrollera `locked`-status for bada grupper:

```text
const aLocked = updated.some(p => p.groupId === a.groupId && p.locked);
const bLocked = updated.some(p => p.groupId === b.groupId && p.locked);

if (bLocked && !aLocked) {
  // Flytta A:s grupp till B istallet
  const expectedAx = b.x - dc * cellW;
  const expectedAy = b.y - dr * cellH;
  const shiftX = expectedAx - a.x;
  const shiftY = expectedAy - a.y;
  const oldGroupId = a.groupId;
  for (const p of updated) {
    if (p.groupId === oldGroupId) {
      p.groupId = b.groupId;
      if (p.x !== null) p.x += shiftX;
      if (p.y !== null) p.y += shiftY;
      p.locked = true;
    }
  }
} else {
  // Befintlig logik: flytta B:s grupp till A
  // + om A ar lastad, markera aven B-bitarna som locked
}
```

## Fil som andras

| Fil | Andring |
|---|---|
| `src/lib/puzzle.ts` | Hantera `locked`-status i `trySnap` vid merge av grupper |
