/**
 * Ravensburger-style puzzle piece generator
 *
 * Each edge between two pieces gets a unique "tab" or "blank" shape.
 * The connector is a bezier-curve knob that protrudes from one side
 * and an identical indent on the adjacent piece — so they interlock perfectly.
 */

export type EdgeType = 'tab' | 'blank' | 'flat'; // flat = outer border

/** Shared constant so renderer, canvas, and tray all use the same knob scale. */
export const KNOB_SCALE = 0.38;

export interface EdgeDef {
  type: EdgeType;
  /** Randomised knob size (0.8 – 1.2 of base unit) */
  size: number;
  /** Horizontal offset of knob centre along the edge, 0.3–0.7 of edge length */
  offset: number;
  /** Slight tilt of knob, -0.15 – +0.15 */
  tilt: number;
}

export interface PieceDef {
  col: number;
  row: number;
  /** top / right / bottom / left */
  edges: [EdgeDef, EdgeDef, EdgeDef, EdgeDef];
  /** pixel position of top-left corner on the solved board */
  solvedX: number;
  solvedY: number;
  /** current position on the canvas (draggable) */
  x: number;
  y: number;
  width: number;
  height: number;
  isPlaced: boolean;
  isSelected: boolean;
  id: string;
  zIndex: number;
}

export interface PuzzleLayout {
  cols: number;
  rows: number;
  pieceWidth: number;
  pieceHeight: number;
  pieces: PieceDef[];
  boardWidth: number;
  boardHeight: number;
}

// Seeded PRNG so the same puzzle can be recreated
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeEdge(rng: () => number, isFlat: boolean, isTab: boolean): EdgeDef {
  if (isFlat) return { type: 'flat', size: 1, offset: 0.5, tilt: 0 };
  return {
    type: isTab ? 'tab' : 'blank',
    size: 0.85 + rng() * 0.25,   // 0.85–1.10 (tighter range → more uniform knobs)
    offset: 0.36 + rng() * 0.28, // 0.36–0.64 (keep knob away from corners)
    tilt: (rng() - 0.5) * 0.12,  // ±0.06 (much less tilt → no more weird bent pieces)
  };
}

export function generatePuzzle(
  imageWidth: number,
  imageHeight: number,
  cols: number,
  rows: number,
  seed: number = 42,
): PuzzleLayout {
  const rng = mulberry32(seed);
  const pieceWidth = imageWidth / cols;
  const pieceHeight = imageHeight / rows;

  // Build edge definitions: shared between adjacent pieces.
  // hEdges[r][c] = edge between piece(r-1,c) bottom and piece(r,c) top
  // vEdges[r][c] = edge between piece(r,c-1) right and piece(r,c) left
  const hEdges: EdgeDef[][] = [];
  const vEdges: EdgeDef[][] = [];

  for (let r = 0; r <= rows; r++) {
    hEdges[r] = [];
    for (let c = 0; c < cols; c++) {
      const isFlat = r === 0 || r === rows;
      const isTab = rng() > 0.5;
      hEdges[r][c] = makeEdge(rng, isFlat, isTab);
    }
  }
  for (let r = 0; r < rows; r++) {
    vEdges[r] = [];
    for (let c = 0; c <= cols; c++) {
      const isFlat = c === 0 || c === cols;
      const isTab = rng() > 0.5;
      vEdges[r][c] = makeEdge(rng, isFlat, isTab);
    }
  }

  const pieces: PieceDef[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const topEdge = hEdges[r][c];
      const bottomEdgeRaw = hEdges[r + 1][c];
      // Bottom of this piece is the mirror of the top of the next row piece.
      // The bottom edge is traversed RIGHT→LEFT (opposite to the shared edge's
      // canonical LEFT→RIGHT direction), so we must flip offset and negate tilt
      // so the knob geometry lands at the same physical position.
      const bottomEdge: EdgeDef = {
        ...bottomEdgeRaw,
        type: bottomEdgeRaw.type === 'tab' ? 'blank' : bottomEdgeRaw.type === 'blank' ? 'tab' : 'flat',
        offset: 1 - bottomEdgeRaw.offset,
        tilt: -bottomEdgeRaw.tilt,
      };

      const leftEdgeRaw = vEdges[r][c];
      // Left edge is traversed BOTTOM→TOP (opposite to the shared edge's
      // canonical TOP→BOTTOM direction), so flip offset and negate tilt.
      const leftEdge: EdgeDef = {
        ...leftEdgeRaw,
        type: leftEdgeRaw.type === 'tab' ? 'blank' : leftEdgeRaw.type === 'blank' ? 'tab' : 'flat',
        offset: 1 - leftEdgeRaw.offset,
        tilt: -leftEdgeRaw.tilt,
      };

      const rightEdge = vEdges[r][c + 1];

      pieces.push({
        col: c,
        row: r,
        edges: [topEdge, rightEdge, bottomEdge, leftEdge],
        solvedX: c * pieceWidth,
        solvedY: r * pieceHeight,
        x: 0,
        y: 0,
        width: pieceWidth,
        height: pieceHeight,
        isPlaced: false,
        isSelected: false,
        id: `${c}-${r}`,
        zIndex: 0,
      });
    }
  }

  return {
    cols,
    rows,
    pieceWidth,
    pieceHeight,
    pieces,
    boardWidth: imageWidth,
    boardHeight: imageHeight,
  };
}

/**
 * Build the SVG/Canvas clip path for one piece.
 *
 * The path is in LOCAL coordinates starting at (0, 0) to (w, h),
 * with connector knobs added/subtracted on each edge.
 *
 * knobScale controls the knob size relative to piece size.
 */
export function buildPiecePath(
  piece: PieceDef,
  knobScale: number = 0.38,
): Path2D {
  const { width: w, height: h, edges } = piece;
  const [top, right, bottom, left] = edges;

  const path = new Path2D();

  // Helper: draw one edge with a bezier knob connector
  // from (x1,y1) to (x2,y2) on a horizontal or vertical line,
  // with the knob pointing outward (positive normal) if type=tab.
  //
  // Ravensburger-style: the knob has a narrow neck, then a large round head.
  // We use 4 bezier segments for a smooth, organic shape that interlocks perfectly.
  function drawEdge(
    x1: number, y1: number,
    x2: number, y2: number,
    edge: EdgeDef,
    normal: { nx: number; ny: number }, // outward normal direction
  ) {
    if (edge.type === 'flat') {
      path.lineTo(x2, y2);
      return;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const edgeLen = Math.sqrt(dx * dx + dy * dy);

    // Unit vectors: along edge (ex,ey) and outward normal (nx,ny) scaled by tab/blank dir
    const ex = dx / edgeLen;
    const ey = dy / edgeLen;

    const dir = edge.type === 'tab' ? 1 : -1;
    const nx = normal.nx * dir;
    const ny = normal.ny * dir;

    // Knob size — height is the protrusion, width is the head diameter
    const knobH = Math.min(w, h) * knobScale * edge.size;
    const knobW = knobH * 0.9;   // slightly wider than tall → round head

    // Centre of knob base on the edge line
    const cx = x1 + dx * edge.offset + ey * edge.tilt * edgeLen * 0.1;
    const cy = y1 + dy * edge.offset - ex * edge.tilt * edgeLen * 0.1;

    // Neck width (narrow part where knob meets the edge)
    const neckW = knobW * 0.32;
    // Head half-width (widest part of the round head)
    const headW = knobW * 0.50;

    // Base points (where neck starts on the edge)
    const b1x = cx - ex * neckW;
    const b1y = cy - ey * neckW;
    const b2x = cx + ex * neckW;
    const b2y = cy + ey * neckW;

    // Neck shoulder points (where neck widens into head)
    const shoulderH = knobH * 0.40;
    const s1x = cx - ex * headW + nx * shoulderH;
    const s1y = cy - ey * headW + ny * shoulderH;
    const s2x = cx + ex * headW + nx * shoulderH;
    const s2y = cy + ey * headW + ny * shoulderH;

    // Tip of knob (top-centre of round head)
    const tipX = cx + nx * knobH;
    const tipY = cy + ny * knobH;

    // ── Path: edge start → b1 → (neck) → s1 → (head arc) → tip → s2 → b2 → edge end
    path.lineTo(b1x, b1y);

    // Left side of neck, curving symmetrically out to left shoulder
    path.bezierCurveTo(
      b1x + nx * shoulderH * 0.6,  b1y + ny * shoulderH * 0.6,  // ctrl1: smooth rise
      s1x - nx * knobH * 0.04,     s1y - ny * knobH * 0.04,      // ctrl2: near shoulder
      s1x, s1y,
    );

    // Arc across the head: left shoulder → tip
    path.bezierCurveTo(
      s1x + nx * (knobH - shoulderH) * 0.75, s1y + ny * (knobH - shoulderH) * 0.75,
      tipX - ex * headW * 0.65,               tipY - ey * headW * 0.65,
      tipX, tipY,
    );

    // Arc across the head: tip → right shoulder
    path.bezierCurveTo(
      tipX + ex * headW * 0.65,               tipY + ey * headW * 0.65,
      s2x + nx * (knobH - shoulderH) * 0.75,  s2y + ny * (knobH - shoulderH) * 0.75,
      s2x, s2y,
    );

    // Right side of neck, curving symmetrically back to edge
    path.bezierCurveTo(
      s2x - nx * knobH * 0.04,     s2y - ny * knobH * 0.04,
      b2x + nx * shoulderH * 0.6,  b2y + ny * shoulderH * 0.6,
      b2x, b2y,
    );

    path.lineTo(x2, y2);
  }

  path.moveTo(0, 0);
  drawEdge(0, 0, w, 0, top, { nx: 0, ny: -1 });    // top: normal points up (outward)
  drawEdge(w, 0, w, h, right, { nx: 1, ny: 0 });    // right: normal points right
  drawEdge(w, h, 0, h, bottom, { nx: 0, ny: 1 });   // bottom: normal points down
  drawEdge(0, h, 0, 0, left, { nx: -1, ny: 0 });    // left: normal points left
  path.closePath();

  return path;
}

/** Scatter pieces into a tray area using a grid with jitter so pieces don't pile up */
export function scatterPieces(
  pieces: PieceDef[],
  trayX: number,
  trayY: number,
  trayWidth: number,
  trayHeight: number,
  seed: number = 99,
): void {
  const rng = mulberry32(seed);
  if (pieces.length === 0) return;

  const pw = pieces[0].width;
  const ph = pieces[0].height;

  // Cell size: piece core + small gap. Knobs overlap between cells (that's fine visually).
  const gap = 8;
  const cellW = pw + gap;
  const cellH = ph + gap;

  // Aim for 2 columns minimum, fit as many as possible
  const cols = Math.max(2, Math.floor(trayWidth / cellW));

  // Shuffle pieces so they appear in random order
  const shuffled = [...pieces].sort(() => rng() - 0.5);

  shuffled.forEach((piece, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Base grid position + small jitter
    const jitterX = (rng() - 0.5) * gap * 1.5;
    const jitterY = (rng() - 0.5) * gap * 1.5;

    piece.x = trayX + col * cellW + jitterX;
    piece.y = trayY + row * cellH + jitterY;
    piece.zIndex = Math.floor(rng() * pieces.length);
  });
}
