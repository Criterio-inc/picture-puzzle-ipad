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
    size: 0.92 + rng() * 0.16,   // 0.92–1.08 (moderate variation, clean shapes)
    offset: 0.42 + rng() * 0.16, // 0.42–0.58 (centred, avoids corner distortion)
    tilt: (rng() - 0.5) * 0.06,  // ±0.03 (minimal tilt, symmetric knobs)
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

  // ─── Draw one edge with a Ravensburger-style knob ───────────────────────
  //
  // Reference shape (cross-section of a tab):
  //
  //            ╭───╮
  //           │     │      ← large round head (nearly circular)
  //            ╰─┬─╯
  //              │         ← narrow neck
  //           ╱     ╲      ← concave undercut (dips INTO the piece)
  //     ─────╱       ╲───── edge line
  //
  // The undercut is the KEY feature that creates the classic "lock" feel.
  // The path dips slightly past the edge line (inward) before rising
  // through the neck into the round head.
  //
  function drawEdge(
    x1: number, y1: number,
    x2: number, y2: number,
    edge: EdgeDef,
    normal: { nx: number; ny: number },
  ) {
    if (edge.type === 'flat') {
      path.lineTo(x2, y2);
      return;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const edgeLen = Math.sqrt(dx * dx + dy * dy);

    const ex = dx / edgeLen;
    const ey = dy / edgeLen;

    const dir = edge.type === 'tab' ? 1 : -1;
    const nx = normal.nx * dir;
    const ny = normal.ny * dir;

    // ── Proportions matching the red reference piece ──
    // All sizes relative to knobH (the total outward protrusion)
    const knobH = Math.min(w, h) * knobScale * edge.size;

    const baseHW   = knobH * 0.42;   // half-width where knob departs from edge
    const neckHW   = knobH * 0.20;   // half-width of the narrow neck
    const headR    = knobH * 0.46;   // radius of the round head
    const undercutD = knobH * 0.08;  // depth of undercut (INTO the piece)
    const neckLen  = knobH * 0.28;   // neck length (edge → head bottom)
    // tip height from edge = neckLen + headR*2 ≈ knobH*1.2 (generous protrusion)

    // Centre of knob on the edge line
    const cx = x1 + dx * edge.offset + ey * edge.tilt * edgeLen * 0.05;
    const cy = y1 + dy * edge.offset - ex * edge.tilt * edgeLen * 0.05;

    // ── Key points ──

    // Base: where the shape leaves the straight edge (wide)
    const b1x = cx - ex * baseHW;
    const b1y = cy - ey * baseHW;
    const b2x = cx + ex * baseHW;
    const b2y = cy + ey * baseHW;

    // Undercut trough: dips INTO the piece (opposite of normal)
    const u1x = cx - ex * neckHW * 1.1 - nx * undercutD;
    const u1y = cy - ey * neckHW * 1.1 - ny * undercutD;
    const u2x = cx + ex * neckHW * 1.1 - nx * undercutD;
    const u2y = cy + ey * neckHW * 1.1 - ny * undercutD;

    // Neck top: where narrow neck meets the head bottom
    const n1x = cx - ex * neckHW + nx * neckLen;
    const n1y = cy - ey * neckHW + ny * neckLen;
    const n2x = cx + ex * neckHW + nx * neckLen;
    const n2y = cy + ey * neckHW + ny * neckLen;

    // Head centre
    const hcx = cx + nx * (neckLen + headR);
    const hcy = cy + ny * (neckLen + headR);

    // Shoulder: widest point of head (at head centre height)
    const s1x = hcx - ex * headR;
    const s1y = hcy - ey * headR;
    const s2x = hcx + ex * headR;
    const s2y = hcy + ey * headR;

    // Tip: top of head
    const tipX = hcx + nx * headR;
    const tipY = hcy + ny * headR;

    // ── Path: 6 bezier segments ──
    path.lineTo(b1x, b1y);

    // 1. Left base → undercut trough (concave dip into piece)
    path.bezierCurveTo(
      b1x - nx * undercutD * 0.6,  b1y - ny * undercutD * 0.6,   // pull inward
      u1x - nx * undercutD * 0.3,  u1y - ny * undercutD * 0.3,   // deep in undercut
      u1x,                          u1y,                            // undercut trough
    );

    // 2. Undercut → neck top (S-curve: from inward dip up through narrow neck)
    path.bezierCurveTo(
      u1x + nx * neckLen * 0.4,    u1y + ny * neckLen * 0.4,     // rise from undercut
      n1x - nx * neckLen * 0.2,    n1y - ny * neckLen * 0.2,     // approach neck top
      n1x,                          n1y,                            // neck top
    );

    // 3. Neck top → shoulder (widen to head)
    path.bezierCurveTo(
      n1x + nx * headR * 0.15,     n1y + ny * headR * 0.15,      // slightly above neck
      s1x - nx * headR * 0.6,      s1y - ny * headR * 0.6,       // approach shoulder from below
      s1x,                          s1y,                            // left shoulder
    );

    // 4. Shoulder → tip (left half of head arc)
    path.bezierCurveTo(
      s1x + nx * headR * 0.56,     s1y + ny * headR * 0.56,      // circular arc control
      tipX - ex * headR * 0.56,     tipY - ey * headR * 0.56,     // approach tip
      tipX,                          tipY,                           // tip
    );

    // 5. Tip → right shoulder (right half of head arc — mirror of 4)
    path.bezierCurveTo(
      tipX + ex * headR * 0.56,     tipY + ey * headR * 0.56,     // leave tip
      s2x + nx * headR * 0.56,      s2y + ny * headR * 0.56,      // circular arc control
      s2x,                           s2y,                            // right shoulder
    );

    // 6. Right shoulder → neck top (narrow down — mirror of 3)
    path.bezierCurveTo(
      s2x - nx * headR * 0.6,       s2y - ny * headR * 0.6,       // below shoulder
      n2x + nx * headR * 0.15,      n2y + ny * headR * 0.15,      // slightly above neck
      n2x,                           n2y,                            // neck top
    );

    // 7. Neck top → undercut (mirror of 2)
    path.bezierCurveTo(
      n2x - nx * neckLen * 0.2,     n2y - ny * neckLen * 0.2,     // descend from neck
      u2x + nx * neckLen * 0.4,     u2y + ny * neckLen * 0.4,     // approach undercut
      u2x,                           u2y,                            // undercut trough
    );

    // 8. Undercut → right base (mirror of 1)
    path.bezierCurveTo(
      u2x - nx * undercutD * 0.3,   u2y - ny * undercutD * 0.3,   // deep in undercut
      b2x - nx * undercutD * 0.6,   b2y - ny * undercutD * 0.6,   // pull inward
      b2x,                           b2y,                            // right base
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
