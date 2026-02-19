# Djup Kodanalys: Picture Puzzle iPad

## Sammanfattning
Denna analys identifierar kritiska funktionalitetsproblem i pusselapplikationen och förklarar grundorsaker till varför funktionaliteten inte är optimal.

---

## 🔴 KRITISKA PROBLEM

### 1. KRITISKT: Pusselbitarna genereras med nya former vid återuppstart

**Problem**: När ett sparat pussel laddas om, genereras pusselbitarna med helt nya slumpmässiga former, vilket gör sparade positioner oanvändbara.

**Grundorsak**:
- I `src/lib/puzzle.ts` rad 24-40 genereras slumpmässig tabs-konfiguration vid varje anrop till `splitImage()`
- I `src/pages/PuzzleGame.tsx` rad 107 anropas `splitImage()` varje gång ett sparat spel laddas
- Tabs-konfigurationen (som definierar utbuktningar/inbuktningar) sparas ALDRIG till databasen
- Varje laddning skapar nya slumpmässiga former som inte matchar de sparade positionerna

**Teknisk förklaring**:
```typescript
// puzzle.ts rad 24-40
function generateTabsConfig(rows: number, cols: number): TabsConfig {
  const horizontal: number[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontal.push([]);
    for (let c = 0; c < cols; c++) {
      horizontal[r].push(Math.random() > 0.5 ? 1 : -1); // ← NYA slumptal varje gång!
    }
  }
  // ... samma för vertical
}
```

När spel laddas (PuzzleGame.tsx rad 105-114):
```typescript
const allPieces = await splitImage(data.image_url, COLS, ROWS); // ← Skapar NYA former
const savedBoard = data.board_pieces as any[]; // ← Gamla positioner
setBoardPieces(deserializePieces(savedBoard, allPieces)); // ← Matchar inte!
```

**Konsekvenser**:
- Bitar som låstes ihop vid föregående session passar inte längre ihop
- Bitpositioner är fortfarande där de var, men bitformerna är annorlunda
- "Locked"-status är meningslös eftersom bitarna inte längre passar på guiden
- Pusslet blir omöjligt att slutföra från ett sparat tillstånd

**Bevis i kod**:
- `puzzle.ts:159` - tabs skapas lokalt i `splitImage()` utan seed
- Ingen serialisering av tabs i `serializePieces()` (rad 429-431)
- Ingen deserialiseringsstöd för tabs i `deserializePieces()` (rad 434-444)

---

### 2. KRITISKT: Pusselbitarna har inte unika former per passning

**Problem**: Även om grundfunktionaliteten för matchande bitar finns, är implementeringen inte fullständigt unik per kantpassning.

**Grundorsak**:
Tabs-konfigurationen använder bara två värden (1 eller -1) för varje kant, vilket ger:
- Samma utbuktningsform för ALLA utåtriktade tabs
- Samma inbuktningsform för ALLA inåtriktade tabs

**Teknisk förklaring**:
```typescript
// puzzle.ts rad 43-102: drawJigsawSide()
// Använder SAMMA proportioner för alla tabs:
const neckStart = 0.35;      // Alltid 35% längs kanten
const neckEnd = 0.65;        // Alltid 65% längs kanten
const neckWidth = len * 0.10; // Alltid 10% av kantlängd
const tabHeight = len * 0.28; // Alltid 28% av kantlängd
const headRadius = len * 0.15; // Alltid 15% av kantlängd
```

Alla utbuktningar ser identiska ut, och alla inbuktningar ser identiska ut. Det finns ingen variation i:
- Position längs kanten (alltid mitt på, 35-65%)
- Storlek på utbuktningen (alltid 28% av kantlängd)
- Form på "huvudet" (alltid 15% radie)
- Halsbredd (alltid 10%)

**Jämförelse med verkliga pussel**:
Riktiga Ravensburger-pussel (som koden påstår sig efterlikna) har:
- Varierande position för utbuktningar (inte alltid centrerade)
- Varierande storlek på utbuktningar
- Unika kombinationer som gör varje passning distinkt
- Asymmetriska former som förhindrar felaktig passning

**Aktuell implementering**:
- Endast binär valmöjlighet: ut (1) eller in (-1)
- Alla "ut"-tabs är identiska
- Alla "in"-tabs är identiska
- Ingen variation i storlek, position eller form

**Konsekvenser**:
- Bitar kan teoretiskt sett "fuskpassas" om de har samma tab-mönster
- Mindre visuellt distinktion mellan bitar
- Svårare att känna igen rätt passningar visuellt
- Inte sant "Ravensburger-style" som kommentaren påstår (rad 42, 62)

---

### 3. KRITISKT: Bitar överlappar varandra när de skickas till bordet

**Problem**: När bitar skickas från lådan till bordet placeras de på slumpmässiga positioner utan kollisionskontroll, vilket orsakar överlappningar.

**Grundorsak**:
```typescript
// PuzzleGame.tsx rad 153-158
const placed = toMove.map((p) => ({
  ...p,
  selected: false,
  x: 50 + Math.random() * 300,  // ← Helt slumpmässig position!
  y: 50 + Math.random() * 300,  // ← Ingen kollisionskontroll!
}));
```

**Tekniska brister**:
1. **Ingen kollisionsdetektion**: Systemet kontrollerar inte om en position redan är upptagen
2. **Litet placeringsområde**: 300x300 pixlar är mycket litet för många bitar
3. **Fel position**: Bitarna placeras i hörnet (50-350px) istället för nära pusslet (som är vid 800,800)
4. **Saknar spatial planering**: Ingen hänsyn till:
   - Befintliga bitars positioner
   - Optimal arbetsyta-layout
   - Avstånd från pusselguiden
   - Gruppering av närliggande bitar

**Matematisk analys**:
- Placeringsområde: 300 × 300 = 90,000 px²
- Genomsnittlig bitstorlek vid 24×24 pussel: ~100 × 100 = 10,000 px²
- Om 50 bitar skickas samtidigt: 50 × 10,000 = 500,000 px² behövs
- Tillgängligt utrymme: endast 90,000 px²
- **Resultat**: 5.5x mer yta behövs än vad som finns tillgängligt → garanterad överlappning

**Visuella konsekvenser**:
- Användaren ser en hög av överlappande bitar
- Svårt att hitta och välja specifika bitar
- Måste manuellt dra isär bitarna före användning
- Dålig användarupplevelse

**Bevis**:
- Ingen `getBoundingBox()` eller kollisionscheck i koden
- Ingen rutnätslayout eller spatial algoritm
- `sendToBoard()` funktionen (rad 149-163) har ingen logik för smart placering

---

### 4. ALLVARLIGT: Arbetsytan är inte optimerad för pusselarbete

**Problem**: Pusselguiden placeras vid (800, 800) på en 6000×6000px yta, men bitarna placeras vid (50-350, 50-350), vilket skapar dålig arbetsflöde.

**Grundorsak**: Dålig spatial planering mellan olika områden.

**Tekniska problem**:

**A) Pusselguidens position**:
```typescript
// puzzle.ts rad 17
export const PUZZLE_ORIGIN = { x: 800, y: 800 };
```
- Pusslet börjar vid 800px från vänster och topp
- För ett 24×24 pussel (svårighetsgrad "Hard"):
  - Bitbredd: ~100px → Pusslet är ~2400px brett
  - Pusselslut: 800 + 2400 = 3200px
  - Pusselcentrum: ~2000px från vänster

**B) Bitplacering**:
```typescript
// PuzzleGame.tsx rad 156-157
x: 50 + Math.random() * 300,  // 50-350px från vänster
y: 50 + Math.random() * 300,  // 50-350px från topp
```
- Bitar placeras 450-750px TILL VÄNSTER om pusselguiden
- Användaren måste panorera eller dra bitar långt för att nå pusslet

**C) Standardzoom och panorering**:
```typescript
// PuzzleBoard.tsx rad 33-34
const [zoom, setZoom] = useState(0.4);  // 40% zoom
const [pan, setPan] = useState({ x: 0, y: 0 });  // Inget offset
```
- Vid 40% zoom är 6000px bred yta → 2400px synlig bredd
- Synligt område: (0, 0) till (2400, 2400)
- Pusselguide vid 800px är synlig, men bara topp-vänster hörnet
- Bitar vid 50-350px är också synliga, men långt från pusslet

**Visualisering av problemet**:
```
[Skärm vid 40% zoom - visar 0-2400px]
│
├─ 50-350px: Bitar placerade här (litet område)
│  [●●●●●] ← Överlappande bitar
│
├─ 800px: Pusselguide börjar här
│  ┌─────────────────┐
│  │                 │
│  │    PUSSEL       │
│  │    GUIDE        │
│  │                 │
│  └─────────────────┘
│     (extends to ~3200px)
│
└─ 6000px: Total bredd
```

**Användarproblem**:
1. Bitar är inte nära pusslet → onödigt dragande
2. Inget tydligt "arbetsområde" för lösa bitar
3. Inget naturligt flöde: "välj bit → dra till pussel"
4. Användaren måste manuellt organisera arbetsytan

**Saknade funktioner**:
- Ingen "smart placering" runt pusselguiden
- Ingen definierad "arbetsyta" vs "pusselyta"
- Ingen magnetisk eller guide-baserad layout
- Ingen "organisera bitar"-funktion

---

## 🟡 DESIGNPROBLEM

### 5. Lådan (Tray) samverkar inte med brädet

**Problem**: Bitar i lådan och bitar på brädet behandlas som helt separata system utan koppling.

**Tekniska brister**:
1. **Ingen kontextuell information**: Lådan visar inte vilka bitar som passar nära redan placerade bitar
2. **Ingen sortering**: Bitar visas i slumpmässig ordning (från shuffle)
3. **Ingen förhandsgranskning**: Användaren kan inte se var en bit hör hemma innan placering
4. **Ingen "smart select"**: Inget stöd för "välj alla kantbitar" eller "välj bitar från samma område"

**Kod-bevis**:
```typescript
// PieceTray.tsx rad 51-83
// Renderar bara pieces.map() rakt av utan sortering eller gruppering
{pieces.map((piece) => { /* ... bara visa bilden ... */ })}
```

Ingen logik för:
- Sortera efter row/col för att gruppera närliggande bitar
- Markera kantbitar (row === 0, col === 0, etc.)
- Filtrera baserat på färg eller region
- Visa "föreslagna nästa bitar" baserat på vad som är placerat

**Jämförelse med fysiska pussel**:
I verkliga pussel:
- Sorterar man ofta kantbitar först
- Grupperar bitar efter färg/mönster
- Lägger liknande bitar nära varandra
- Arbetar i regioner

I denna app:
- Alla bitar blandade slumpmässigt
- Ingen hjälp att hitta rätt bit
- Användaren måste skrolla genom hundratals bitar

---

### 6. Zoom och panoreringsproblem

**Problem**: Zoomgränser och standardvy är inte optimerade för pusselarbete.

**Tekniska värden**:
```typescript
// PuzzleBoard.tsx
const MIN_ZOOM = 0.15;  // 15% zoom
const MAX_ZOOM = 2;     // 200% zoom
const [zoom, setZoom] = useState(0.4);  // Startar vid 40%
```

**Problem vid 40% standardzoom**:
- För 24×24 pussel: Synlig bredd = 6000 × 0.4 = 2400px
- iPad skärm: ~1024px bred (eller 2048px för Pro)
- Vid 0.4 zoom på 1024px skärm: kan se 2560px av brädet
- Pusslet är ~2400px brett, så hela pusslet är *nästan* synligt
- Men bitar är vid 50-350px, långt från pusselcentrum

**Problem vid MIN_ZOOM (15%)**:
- Synlig area: 6000 × 0.15 = 900px bred på brädet per 1024px skärm
- För stort område, bitar blir för små
- Svårt att se detaljer i bitarna

**Problem vid MAX_ZOOM (200%)**:
- För nära, kan inte se helheten
- Svårt att hitta bitar utanför synfält

**Saknad funktionalitet**:
- Ingen "fit puzzle"-knapp som zoomar till pusslets storlek
- Ingen "focus on piece"-funktion
- Ingen smart initial panorering (börjar alltid vid 0,0)

---

## 🟢 MINDRE PROBLEM

### 7. Ineffektiv snappning

**Observationer**:
- `trySnap()` loopar igenom alla bitpar: O(n²) komplexitet
- För 576 bitar: 165,600 jämförelser per snap-försök
- Använder iterativ convergence loop som kan köra flera varv

**Förbättringspotential**:
- Spatial indexering (grid eller quadtree) skulle reducera till O(n)
- Bara kolla grannar inom threshold-avstånd

**Aktuell kod**:
```typescript
// puzzle.ts rad 273-347
while (changed) {
  changed = false;
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      // ... kolla varje par ...
    }
  }
}
```

---

### 8. Saknad funktionalitet för användarhjälp

**Vad som saknas**:
- Ingen "hint"-funktion som visar var en bit hör hemma
- Ingen "preview"-funktion som visar originalbild
- Ingen "sort by edge"-funktion
- Ingen "auto-complete"-hjälp för nästan färdiga sektioner
- Ingen "undo"-funktion

---

## 📊 SAMMANFATTNING AV PROBLEM

| Problem | Allvarlighetsgrad | Typ | Påverkan |
|---------|-------------------|-----|----------|
| Nya former vid reload | 🔴 Kritisk | Bug | Omöjligt att fortsätta sparat spel |
| Bitar överlappar | 🔴 Kritisk | UX | Frustrerande användarupplevelse |
| Ej unika former | 🔴 Kritisk | Design | Inte sant pusselspel |
| Dålig arbetsyta | 🟡 Allvarlig | UX | Ineffektivt arbetsflöde |
| Låda-bräde samverkan | 🟡 Allvarlig | Design | Saknar pusselhjälp |
| Zoom/pan-problem | 🟡 Allvarlig | UX | Svårt att navigera |
| Ineffektiv snappning | 🟢 Mindre | Performance | Långsam vid många bitar |
| Saknad användarhjälp | 🟢 Mindre | Feature | Svårare än nödvändigt |

---

## 🔧 ROTORSAKER

### Tekniska rotorsaker:
1. **Ingen seed för slumpgenerering**: Math.random() utan seed gör tabs icke-reproducerbara
2. **Serialisering saknar tabs**: Tabs sparas aldrig till databas
3. **Ingen spatial planering**: Position-algoritmer är för enkla
4. **Brist på designsystem**: Ingen tydlig separation mellan zones

### Designrotorsaker:
1. **"Quick and dirty"-implementering**: Kod prioriterar funktion över kvalitet
2. **Ingen användarforskning**: Flödet matchar inte hur människor puslar
3. **Saknar pusselkonventioner**: Ingen hänsyn till fysiska pusselprinciper

### Arkitekturrotorsaker:
1. **State management**: Pieces hanteras som flat array, inte som zones
2. **Rendering strategy**: Allt renderas alltid (ingen virtualisering)
3. **Separation of concerns**: UI-logik blandat med spellogik

---

## 💡 PRIORITERADE ÅTGÄRDER

### Måste fixas (Kritiskt):
1. ✅ **Spara och ladda tabs-konfiguration**
   - Lägg till `tabs` i databasschemat
   - Serialisera tabs vid spara
   - Använd sparade tabs vid laddning
   - Alternativt: Använd seedable random med game ID

2. ✅ **Implementera smart bitplacering**
   - Collision detection
   - Placera bitar i ring runt pusselguiden
   - Större placeringsområde
   - Grid-baserad layout

3. ✅ **Gör tabs-former unika**
   - Variera position längs kant (30-70% istället för 35-65%)
   - Variera storlek (20-35% istället för fast 28%)
   - Variera halsbredd (8-12% istället för 10%)
   - Lägg till fler parametrar för variation

### Bör fixas (Viktigt):
4. ✅ **Förbättra arbetsyta-layout**
   - Definiera "puzzle zone" och "work zone"
   - Smart initial panorering
   - "Fit to puzzle"-zoom funktion

5. ✅ **Förbättra låda-bräde integration**
   - Sortera bitar efter position
   - Markera kantbitar
   - Visa "recommended next pieces"

### Kan fixas (Förbättringar):
6. ⚠️ **Optimera snappning** (spatial indexing)
7. ⚠️ **Lägg till användarhjälpfunktioner** (hints, preview, etc.)

---

## 🎯 SLUTSATS

Kodverket har en solid grundstruktur med bra separation mellan komponenter, men lider av kritiska brister i:
- **Databeständighet**: Tabs sparas inte → spel går sönder vid reload
- **Spatial planering**: Dålig layout och överlappning
- **Användarupplevelse**: Saknar naturligt pusselflöde

De tre viktigaste problemen att åtgärda är:
1. Spara tabs-konfiguration för reproducerbara pussel
2. Implementera smart bitplacering utan överlappning
3. Skapa unika tab-former för varje passning

Med dessa fixar skulle applikationen gå från "dysfunktionell" till "användbar", och med de övriga förbättringarna till "professionell".
