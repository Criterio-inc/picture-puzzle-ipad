

# Fix: Svårighetsgrad ignoreras

## Problem
`handleImageSelect`-funktionen i `Home.tsx` har en stale closure. Den använder `difficulty`-variabeln men har bara `[navigate]` i sin dependency array. Det betyder att den alltid använder det initiala värdet `"hard"` oavsett vad man väljer.

## Lösning
Enkel fix på en rad — lägg till `difficulty` i dependency-arrayen:

**Fil: `src/pages/Home.tsx`, rad 67**

Ändra:
```ts
}, [navigate]);
```
Till:
```ts
}, [navigate, difficulty]);
```

Det är allt som behövs. När `difficulty` ingår i dependency-arrayen återskapas callbacken varje gång användaren byter svårighetsgrad, och rätt cols/rows skickas till puzzle-sidan.

