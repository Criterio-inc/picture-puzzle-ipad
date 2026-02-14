export interface PuzzlePiece {
  id: number;
  row: number;
  col: number;
  imageDataUrl: string;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
  selected: boolean;
  x: number | null;
  y: number | null;
  groupId: number;
  locked: boolean;
}

export const PUZZLE_ORIGIN = { x: 800, y: 800 };

export interface TabsConfig {
  horizontal: number[][];
  vertical: number[][];
}

export interface SplitImageResult {
  pieces: PuzzlePiece[];
  tabs: TabsConfig;
}

// Enhanced tab configuration with variation parameters for unique piece shapes
export interface TabParams {
  dir: number;           // 1 = outward, -1 = inward, 0 = flat
  posStart: number;      // Where tab starts (0.30-0.40)
  posEnd: number;        // Where tab ends (0.60-0.70)
  neckWidth: number;     // Neck width ratio (0.08-0.12)
  tabHeight: number;     // Tab height ratio (0.22-0.34)
  headRadius: number;    // Head radius ratio (0.13-0.18)
}

export interface EnhancedTabsConfig {
  horizontal: TabParams[][];
  vertical: TabParams[][];
}

function generateRandomTabParams(): TabParams {
  const dir = Math.random() > 0.5 ? 1 : -1;
  const posStart = 0.30 + Math.random() * 0.10;  // 0.30-0.40
  const posEnd = 0.60 + Math.random() * 0.10;    // 0.60-0.70
  const neckWidth = 0.08 + Math.random() * 0.04;  // 0.08-0.12
  const tabHeight = 0.22 + Math.random() * 0.12;  // 0.22-0.34
  const headRadius = 0.13 + Math.random() * 0.05; // 0.13-0.18

  return { dir, posStart, posEnd, neckWidth, tabHeight, headRadius };
}

function generateTabsConfig(rows: number, cols: number): EnhancedTabsConfig {
  const horizontal: TabParams[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontal.push([]);
    for (let c = 0; c < cols; c++) {
      horizontal[r].push(generateRandomTabParams());
    }
  }
  const vertical: TabParams[][] = [];
  for (let r = 0; r < rows; r++) {
    vertical.push([]);
    for (let c = 0; c < cols - 1; c++) {
      vertical[r].push(generateRandomTabParams());
    }
  }
  return { horizontal, vertical };
}

// Enhanced Ravensburger-style jigsaw tab with unique variations
function drawJigsawSide(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  tabParams: TabParams | null
) {
  if (!tabParams || tabParams.dir === 0) {
    ctx.lineTo(x1, y1);
    return;
  }

  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * tabParams.dir;
  const ny = ux * tabParams.dir;

  // Use varied parameters for unique shapes
  const neckStart = tabParams.posStart;
  const neckEnd = tabParams.posEnd;
  const neckWidth = len * tabParams.neckWidth;
  const tabHeight = len * tabParams.tabHeight;
  const headRadius = len * tabParams.headRadius;

  const midPoint = (neckStart + neckEnd) / 2;

  // 1. Straight to neck start
  ctx.lineTo(x0 + dx * neckStart, y0 + dy * neckStart);

  // 2. Slight inward curve at neck entrance
  const entryCurvePoint = neckStart + (midPoint - neckStart) * 0.25;
  ctx.bezierCurveTo(
    x0 + dx * (neckStart + 0.01), y0 + dy * (neckStart + 0.01),
    x0 + dx * (neckStart + 0.03) + nx * neckWidth * 0.3, y0 + dy * (neckStart + 0.03) + ny * neckWidth * 0.3,
    x0 + dx * entryCurvePoint + nx * neckWidth, y0 + dy * entryCurvePoint + ny * neckWidth
  );

  // 3. Left side of round knob head
  const leftHeadPoint = midPoint - 0.05;
  ctx.bezierCurveTo(
    x0 + dx * (midPoint - 0.15) + nx * (tabHeight * 0.7), y0 + dy * (midPoint - 0.15) + ny * (tabHeight * 0.7),
    x0 + dx * (midPoint - 0.12) + nx * tabHeight, y0 + dy * (midPoint - 0.12) + ny * tabHeight,
    x0 + dx * midPoint + nx * tabHeight, y0 + dy * midPoint + ny * tabHeight
  );

  // 4. Right side of round knob head (mirror)
  const exitCurvePoint = midPoint + (neckEnd - midPoint) * 0.75;
  ctx.bezierCurveTo(
    x0 + dx * (midPoint + 0.12) + nx * tabHeight, y0 + dy * (midPoint + 0.12) + ny * tabHeight,
    x0 + dx * (midPoint + 0.15) + nx * (tabHeight * 0.7), y0 + dy * (midPoint + 0.15) + ny * (tabHeight * 0.7),
    x0 + dx * exitCurvePoint + nx * neckWidth, y0 + dy * exitCurvePoint + ny * neckWidth
  );

  // 5. Neck closing
  ctx.bezierCurveTo(
    x0 + dx * (neckEnd - 0.03) + nx * neckWidth * 0.3, y0 + dy * (neckEnd - 0.03) + ny * neckWidth * 0.3,
    x0 + dx * (neckEnd - 0.01), y0 + dy * (neckEnd - 0.01),
    x0 + dx * neckEnd, y0 + dy * neckEnd
  );

  // 6. Straight to end
  ctx.lineTo(x1, y1);
}

function drawPiecePath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  top: TabParams | null,
  right: TabParams | null,
  bottom: TabParams | null,
  left: TabParams | null
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  drawJigsawSide(ctx, x, y, x + w, y, top);
  drawJigsawSide(ctx, x + w, y, x + w, y + h, right);
  // Bottom and left need inverted direction
  const bottomInverted = bottom ? { ...bottom, dir: -bottom.dir } : null;
  const leftInverted = left ? { ...left, dir: -left.dir } : null;
  drawJigsawSide(ctx, x + w, y + h, x, y + h, bottomInverted);
  drawJigsawSide(ctx, x, y + h, x, y, leftInverted);
  ctx.closePath();
}

function getTabParams(row: number, col: number, rows: number, cols: number, tabs: EnhancedTabsConfig) {
  const top = row === 0 ? null : tabs.horizontal[row - 1][col];
  const bottom = row === rows - 1 ? null : tabs.horizontal[row][col];
  const left = col === 0 ? null : tabs.vertical[row][col - 1];
  const right = col === cols - 1 ? null : tabs.vertical[row][col];
  return { top, right, bottom, left };
}

const MIN_DIMENSION = 2400;

function normalizeImage(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  const maxSide = Math.max(img.width, img.height);
  if (maxSide >= MIN_DIMENSION) return img;
  const scale = MIN_DIMENSION / maxSide;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

export function splitImage(
  imageDataUrl: string,
  cols: number,
  rows: number,
  savedTabs?: EnhancedTabsConfig
): Promise<SplitImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const src = normalizeImage(img);
      const srcW = src.width;
      const srcH = src.height;
      const pieceW = Math.floor(srcW / cols);
      const pieceH = Math.floor(srcH / rows);
      const tabW = Math.ceil(pieceW * 0.35);
      const tabH = Math.ceil(pieceH * 0.35);
      const pieces: PuzzlePiece[] = [];
      const tabs = savedTabs || generateTabsConfig(rows, cols);

      const canvasW = pieceW + tabW * 2;
      const canvasH = pieceH + tabH * 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, canvasW, canvasH);
          const { top, right, bottom, left } = getTabParams(r, c, rows, cols, tabs);

          // Clipping
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.clip();

          ctx.drawImage(
            src,
            c * pieceW - tabW, r * pieceH - tabH, canvasW, canvasH,
            0, 0, canvasW, canvasH
          );
          ctx.restore();

          // 3D effect: dark shadow on bottom-right edges
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.clip();
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.strokeStyle = "rgba(0,0,0,0.25)";
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();

          // 3D effect: light highlight on top-left edges
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.clip();
          ctx.shadowColor = "rgba(255,255,255,0.4)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = -1.5;
          ctx.shadowOffsetY = -1.5;
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();

          // Outer border
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          const scale = 1.0;
          const pieceId = r * cols + c;
          pieces.push({
            id: pieceId,
            row: r,
            col: c,
            imageDataUrl: canvas.toDataURL("image/png"),
            displayWidth: canvasW / scale,
            displayHeight: canvasH / scale,
            offsetX: tabW / scale,
            offsetY: tabH / scale,
            selected: false,
            x: null,
            y: null,
            groupId: pieceId,
            locked: false,
          });
        }
      }

      // Shuffle
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }

      resolve({ pieces, tabs });
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

export interface SnapResult {
  pieces: PuzzlePiece[];
  snapped: boolean;
  snappedGroupId: number | null;
}

/**
 * Smart piece placement algorithm that positions pieces in a ring around the puzzle
 * without overlaps. Pieces are arranged in a grid pattern in the work area.
 */
export function placeAroundPuzzle(
  piecesToPlace: PuzzlePiece[],
  existingPieces: PuzzlePiece[],
  cols: number,
  rows: number
): PuzzlePiece[] {
  if (piecesToPlace.length === 0) return piecesToPlace;

  const sample = piecesToPlace[0] || existingPieces[0];
  if (!sample) return piecesToPlace;

  const cellW = sample.displayWidth - 2 * sample.offsetX;
  const cellH = sample.displayHeight - 2 * sample.offsetY;

  // Calculate puzzle guide dimensions
  const puzzleWidth = cols * cellW;
  const puzzleHeight = rows * cellH;
  const puzzleLeft = PUZZLE_ORIGIN.x;
  const puzzleTop = PUZZLE_ORIGIN.y;
  const puzzleRight = puzzleLeft + puzzleWidth;
  const puzzleBottom = puzzleTop + puzzleHeight;

  // Define work area to the left and below the puzzle (avoiding top-right where zoom controls are)
  const workAreaLeft = puzzleLeft - 100;  // Small margin from puzzle
  const workAreaTop = puzzleBottom + 100;  // Below the puzzle
  const workAreaWidth = puzzleWidth + 200;  // Slightly wider than puzzle

  // Calculate grid layout for pieces
  const pieceSpacing = Math.max(sample.displayWidth, sample.displayHeight) + 20; // 20px gap
  const piecesPerRow = Math.floor(workAreaWidth / pieceSpacing);

  const positioned = piecesToPlace.map((piece, index) => {
    const row = Math.floor(index / piecesPerRow);
    const col = index % piecesPerRow;

    const x = workAreaLeft + col * pieceSpacing;
    const y = workAreaTop + row * pieceSpacing;

    return {
      ...piece,
      x,
      y,
      selected: false,
    };
  });

  return positioned;
}

/**
 * Optimized snap detection using spatial grid for O(n) complexity instead of O(n²)
 */
export function trySnap(pieces: PuzzlePiece[]): SnapResult {
  if (pieces.length < 2) return { pieces, snapped: false, snappedGroupId: null };

  const sample = pieces[0];
  const cellW = sample.displayWidth - 2 * sample.offsetX;
  const cellH = sample.displayHeight - 2 * sample.offsetY;
  const threshold = Math.max(8, Math.min(cellW, cellH) * 0.10);

  let updated = pieces.map((p) => ({ ...p }));
  let changed = true;
  let snapped = false;
  let snappedGroupId: number | null = null;

  // Build spatial index: map from "row,col" to piece for O(1) neighbor lookup
  const buildSpatialIndex = (pieces: typeof updated) => {
    const index = new Map<string, typeof updated[0]>();
    for (const piece of pieces) {
      if (piece.x !== null && piece.y !== null) {
        index.set(`${piece.row},${piece.col}`, piece);
      }
    }
    return index;
  };

  while (changed) {
    changed = false;
    const spatialIndex = buildSpatialIndex(updated);

    // Only check adjacent neighbors (4 directions)
    for (const a of updated) {
      if (a.x === null || a.y === null) continue;

      // Check all 4 adjacent positions
      const neighbors = [
        { dr: -1, dc: 0 },  // top
        { dr: 1, dc: 0 },   // bottom
        { dr: 0, dc: -1 },  // left
        { dr: 0, dc: 1 },   // right
      ];

      for (const { dr, dc } of neighbors) {
        const neighborKey = `${a.row + dr},${a.col + dc}`;
        const b = spatialIndex.get(neighborKey);

        if (!b || a.groupId === b.groupId) continue;

        const expectedBx = a.x + dc * cellW;
        const expectedBy = a.y + dr * cellH;
        const dx = b.x! - expectedBx;
        const dy = b.y! - expectedBy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < threshold) {
          const aLocked = updated.some(p => p.groupId === a.groupId && p.locked);
          const bLocked = updated.some(p => p.groupId === b.groupId && p.locked);

          if (aLocked && bLocked) {
            // Both locked – merge without shifting
            const oldGroupId = b.groupId;
            for (const p of updated) {
              if (p.groupId === oldGroupId) {
                p.groupId = a.groupId;
              }
            }
            snapped = true;
            snappedGroupId = a.groupId;
            changed = true;
          } else if (bLocked && !aLocked) {
            // B is locked – move A's group to align with B
            const expectedAx = b.x! - dc * cellW;
            const expectedAy = b.y! - dr * cellH;
            const shiftX = expectedAx - a.x!;
            const shiftY = expectedAy - a.y!;
            const oldGroupId = a.groupId;
            for (const p of updated) {
              if (p.groupId === oldGroupId) {
                p.groupId = b.groupId;
                if (p.x !== null) p.x += shiftX;
                if (p.y !== null) p.y += shiftY;
                p.locked = true;
              }
            }
            snapped = true;
            snappedGroupId = b.groupId;
            changed = true;
          } else {
            // Default: move B's group to align with A
            const oldGroupId = b.groupId;
            const newGroupId = a.groupId;
            const shiftX = expectedBx - b.x!;
            const shiftY = expectedBy - b.y!;
            for (const p of updated) {
              if (p.groupId === oldGroupId) {
                p.groupId = newGroupId;
                if (p.x !== null) p.x += shiftX;
                if (p.y !== null) p.y += shiftY;
                if (aLocked) p.locked = true;
              }
            }
            snapped = true;
            snappedGroupId = newGroupId;
            changed = true;
          }

          // Break after finding a snap to rebuild spatial index
          break;
        }
      }

      if (changed) break; // Rebuild spatial index
    }
  }

  return { pieces: updated, snapped, snappedGroupId };
}

/** Snap pieces to the guide border if close to their correct absolute position.
 *  Lock groups containing edge pieces when snapped correctly. */
export function trySnapToGuide(pieces: PuzzlePiece[], cols: number, rows: number): SnapResult {
  if (pieces.length === 0) return { pieces, snapped: false, snappedGroupId: null };

  const sample = pieces[0];
  const cellW = sample.displayWidth - 2 * sample.offsetX;
  const cellH = sample.displayHeight - 2 * sample.offsetY;
  const offsetX = sample.offsetX;
  const offsetY = sample.offsetY;
  const threshold = Math.max(8, Math.min(cellW, cellH) * 0.10);

  let updated = pieces.map((p) => ({ ...p }));
  let snapped = false;
  let snappedGroupId: number | null = null;

  // Group pieces by groupId
  const groups = new Map<number, typeof updated>();
  for (const p of updated) {
    if (!groups.has(p.groupId)) groups.set(p.groupId, []);
    groups.get(p.groupId)!.push(p);
  }

  for (const [groupId, groupPieces] of groups) {
    if (groupPieces[0].locked) continue;

    const hasEdgePiece = groupPieces.some(
      (gp) => gp.row === 0 || gp.row === rows - 1 || gp.col === 0 || gp.col === cols - 1
    );
    if (!hasEdgePiece) continue;

    for (const p of groupPieces) {
      if (p.x === null || p.y === null) continue;

      const correctX = PUZZLE_ORIGIN.x - offsetX + p.col * cellW;
      const correctY = PUZZLE_ORIGIN.y - offsetY + p.row * cellH;
      const dx = p.x - correctX;
      const dy = p.y - correctY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < threshold) {
        const shiftX = correctX - p.x;
        const shiftY = correctY - p.y;

        for (const gp of updated) {
          if (gp.groupId === groupId) {
            if (gp.x !== null) gp.x += shiftX;
            if (gp.y !== null) gp.y += shiftY;
            gp.locked = true;
          }
        }
        snapped = true;
        snappedGroupId = groupId;
        break;
      }
    }
  }

  return { pieces: updated, snapped, snappedGroupId };
}

/** Compute guide rectangle dimensions */
export function getGuideRect(pieces: PuzzlePiece[], cols: number, rows: number) {
  if (pieces.length === 0) return null;
  const sample = pieces[0];
  const cellW = sample.displayWidth - 2 * sample.offsetX;
  const cellH = sample.displayHeight - 2 * sample.offsetY;
  return {
    x: PUZZLE_ORIGIN.x,
    y: PUZZLE_ORIGIN.y,
    width: cols * cellW,
    height: rows * cellH,
  };
}

/** Serialize pieces for DB storage (strip imageDataUrl to save space) */
export function serializePieces(pieces: PuzzlePiece[]): object[] {
  return pieces.map(({ imageDataUrl, ...rest }) => rest);
}

/** Restore imageDataUrl from a full piece list */
export function deserializePieces(
  saved: Omit<PuzzlePiece, "imageDataUrl">[],
  allPieces: PuzzlePiece[]
): PuzzlePiece[] {
  const imageMap = new Map(allPieces.map((p) => [p.id, p.imageDataUrl]));
  return saved.map((s) => ({
    ...s,
    locked: (s as any).locked ?? false,
    imageDataUrl: imageMap.get(s.id) ?? "",
  }));
}
