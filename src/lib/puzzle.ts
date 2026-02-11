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

interface TabsConfig {
  horizontal: number[][];
  vertical: number[][];
}

function generateTabsConfig(rows: number, cols: number): TabsConfig {
  const horizontal: number[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontal.push([]);
    for (let c = 0; c < cols; c++) {
      horizontal[r].push(Math.random() > 0.5 ? 1 : -1);
    }
  }
  const vertical: number[][] = [];
  for (let r = 0; r < rows; r++) {
    vertical.push([]);
    for (let c = 0; c < cols - 1; c++) {
      vertical[r].push(Math.random() > 0.5 ? 1 : -1);
    }
  }
  return { horizontal, vertical };
}

// Classic jigsaw tab shape with rounder, more natural curves
function drawJigsawSide(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  tabDir: number
) {
  if (tabDir === 0) {
    ctx.lineTo(x1, y1);
    return;
  }

  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Unit vectors along and perpendicular to the edge
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * tabDir;
  const ny = ux * tabDir;
  const tabHeight = len * 0.25;
  const neckWidth = len * 0.08;
  const headWidth = len * 0.16;

  // Straight segment to neck start
  ctx.lineTo(x0 + dx * 0.34, y0 + dy * 0.34);

  // Neck inward curve (slight pinch)
  ctx.bezierCurveTo(
    x0 + dx * 0.36 + nx * neckWidth * 0.3, y0 + dy * 0.36 + ny * neckWidth * 0.3,
    x0 + dx * 0.38 - nx * neckWidth * 0.5, y0 + dy * 0.38 - ny * neckWidth * 0.5,
    x0 + dx * 0.38 + nx * neckWidth, y0 + dy * 0.38 + ny * neckWidth
  );

  // Left side of tab head (round bulge)
  ctx.bezierCurveTo(
    x0 + dx * 0.34 - ux * headWidth * 0.4 + nx * tabHeight, y0 + dy * 0.34 - uy * headWidth * 0.4 + ny * tabHeight,
    x0 + dx * 0.42 - ux * headWidth * 0.1 + nx * tabHeight * 1.05, y0 + dy * 0.42 - uy * headWidth * 0.1 + ny * tabHeight * 1.05,
    x0 + dx * 0.5 + nx * tabHeight, y0 + dy * 0.5 + ny * tabHeight
  );

  // Right side of tab head (round bulge, mirror)
  ctx.bezierCurveTo(
    x0 + dx * 0.58 + ux * headWidth * 0.1 + nx * tabHeight * 1.05, y0 + dy * 0.58 + uy * headWidth * 0.1 + ny * tabHeight * 1.05,
    x0 + dx * 0.66 + ux * headWidth * 0.4 + nx * tabHeight, y0 + dy * 0.66 + uy * headWidth * 0.4 + ny * tabHeight,
    x0 + dx * 0.62 + nx * neckWidth, y0 + dy * 0.62 + ny * neckWidth
  );

  // Neck outward curve back to edge
  ctx.bezierCurveTo(
    x0 + dx * 0.62 - nx * neckWidth * 0.5, y0 + dy * 0.62 - ny * neckWidth * 0.5,
    x0 + dx * 0.64 + nx * neckWidth * 0.3, y0 + dy * 0.64 + ny * neckWidth * 0.3,
    x0 + dx * 0.66, y0 + dy * 0.66
  );

  // Straight to end
  ctx.lineTo(x1, y1);
}

function drawPiecePath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  top: number, right: number, bottom: number, left: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  drawJigsawSide(ctx, x, y, x + w, y, top);
  drawJigsawSide(ctx, x + w, y, x + w, y + h, right);
  drawJigsawSide(ctx, x + w, y + h, x, y + h, -bottom);
  drawJigsawSide(ctx, x, y + h, x, y, -left);
  ctx.closePath();
}

function getTabDirs(row: number, col: number, rows: number, cols: number, tabs: TabsConfig) {
  const top = row === 0 ? 0 : -tabs.horizontal[row - 1][col];
  const bottom = row === rows - 1 ? 0 : tabs.horizontal[row][col];
  const left = col === 0 ? 0 : -tabs.vertical[row][col - 1];
  const right = col === cols - 1 ? 0 : tabs.vertical[row][col];
  return { top, right, bottom, left };
}

export function splitImage(
  imageDataUrl: string,
  cols: number,
  rows: number
): Promise<PuzzlePiece[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const pieceW = Math.floor(img.width / cols);
      const pieceH = Math.floor(img.height / rows);
      const tabW = Math.ceil(pieceW * 0.28);
      const tabH = Math.ceil(pieceH * 0.28);
      const pieces: PuzzlePiece[] = [];
      const tabs = generateTabsConfig(rows, cols);

      const canvasW = pieceW + tabW * 2;
      const canvasH = pieceH + tabH * 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, canvasW, canvasH);
          const { top, right, bottom, left } = getTabDirs(r, c, rows, cols, tabs);

          // Clipping
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.clip();

          ctx.drawImage(
            img,
            c * pieceW - tabW, r * pieceH - tabH, canvasW, canvasH,
            0, 0, canvasW, canvasH
          );
          ctx.restore();

          // Border with slight shadow effect
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();

          // Inner highlight
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 0.5;
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

      resolve(pieces);
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

const SNAP_THRESHOLD = 18;

export function trySnap(pieces: PuzzlePiece[]): PuzzlePiece[] {
  if (pieces.length < 2) return pieces;

  const sample = pieces[0];
  const cellW = sample.displayWidth - 2 * sample.offsetX;
  const cellH = sample.displayHeight - 2 * sample.offsetY;

  let updated = pieces.map((p) => ({ ...p }));
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = 0; i < updated.length; i++) {
      const a = updated[i];
      if (a.x === null || a.y === null) continue;

      for (let j = i + 1; j < updated.length; j++) {
        const b = updated[j];
        if (b.x === null || b.y === null) continue;
        if (a.groupId === b.groupId) continue;

        const dr = b.row - a.row;
        const dc = b.col - a.col;
        if (Math.abs(dr) + Math.abs(dc) !== 1) continue;

        const expectedBx = a.x + dc * cellW;
        const expectedBy = a.y + dr * cellH;
        const dx = b.x - expectedBx;
        const dy = b.y - expectedBy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < SNAP_THRESHOLD) {
          const oldGroupId = b.groupId;
          const newGroupId = a.groupId;
          const shiftX = expectedBx - b.x;
          const shiftY = expectedBy - b.y;

          for (const p of updated) {
            if (p.groupId === oldGroupId) {
              p.groupId = newGroupId;
              if (p.x !== null) p.x += shiftX;
              if (p.y !== null) p.y += shiftY;
            }
          }
          changed = true;
        }
      }
    }
  }

  return updated;
}

/** Snap pieces to the guide border if close to their correct absolute position.
 *  Lock groups containing edge pieces when snapped correctly. */
export function trySnapToGuide(pieces: PuzzlePiece[], cols: number, rows: number): PuzzlePiece[] {
  if (pieces.length === 0) return pieces;

  const sample = pieces[0];
  const cellW = sample.displayWidth - 2 * sample.offsetX;
  const cellH = sample.displayHeight - 2 * sample.offsetY;
  const offsetX = sample.offsetX;
  const offsetY = sample.offsetY;

  let updated = pieces.map((p) => ({ ...p }));

  // Group pieces by groupId
  const groups = new Map<number, typeof updated>();
  for (const p of updated) {
    if (!groups.has(p.groupId)) groups.set(p.groupId, []);
    groups.get(p.groupId)!.push(p);
  }

  for (const [groupId, groupPieces] of groups) {
    if (groupPieces[0].locked) continue;

    // Check if group has at least one edge piece
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

      if (dist < SNAP_THRESHOLD) {
        const shiftX = correctX - p.x;
        const shiftY = correctY - p.y;

        for (const gp of updated) {
          if (gp.groupId === groupId) {
            if (gp.x !== null) gp.x += shiftX;
            if (gp.y !== null) gp.y += shiftY;
            gp.locked = true;
          }
        }
        break;
      }
    }
  }

  return updated;
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
