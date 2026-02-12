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

// Ravensburger-style jigsaw tab: narrow neck, large round mushroom head
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
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * tabDir;
  const ny = ux * tabDir;

  // Classic jigsaw: square body, round knobs
  const neckStart = 0.35;
  const neckEnd = 0.65;
  const neckWidth = len * 0.10;
  const tabHeight = len * 0.28;
  const headRadius = len * 0.15;

  // 1. Straight to neck start
  ctx.lineTo(x0 + dx * neckStart, y0 + dy * neckStart);

  // 2. Slight inward curve at neck entrance
  ctx.bezierCurveTo(
    x0 + dx * (neckStart + 0.01), y0 + dy * (neckStart + 0.01),
    x0 + dx * (neckStart + 0.03) + nx * neckWidth * 0.3, y0 + dy * (neckStart + 0.03) + ny * neckWidth * 0.3,
    x0 + dx * 0.40 + nx * neckWidth, y0 + dy * 0.40 + ny * neckWidth
  );

  // 3. Left side of round knob head
  ctx.bezierCurveTo(
    x0 + dx * 0.35 + nx * (tabHeight * 0.7), y0 + dy * 0.35 + ny * (tabHeight * 0.7),
    x0 + dx * 0.38 + nx * tabHeight, y0 + dy * 0.38 + ny * tabHeight,
    x0 + dx * 0.5 + nx * tabHeight, y0 + dy * 0.5 + ny * tabHeight
  );

  // 4. Right side of round knob head (mirror)
  ctx.bezierCurveTo(
    x0 + dx * 0.62 + nx * tabHeight, y0 + dy * 0.62 + ny * tabHeight,
    x0 + dx * 0.65 + nx * (tabHeight * 0.7), y0 + dy * 0.65 + ny * (tabHeight * 0.7),
    x0 + dx * 0.60 + nx * neckWidth, y0 + dy * 0.60 + ny * neckWidth
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
  const top = row === 0 ? 0 : tabs.horizontal[row - 1][col];
  const bottom = row === rows - 1 ? 0 : tabs.horizontal[row][col];
  const left = col === 0 ? 0 : tabs.vertical[row][col - 1];
  const right = col === cols - 1 ? 0 : tabs.vertical[row][col];
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
  rows: number
): Promise<PuzzlePiece[]> {
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

      resolve(pieces);
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

        if (dist < threshold) {
          const aLocked = updated.some(p => p.groupId === a.groupId && p.locked);
          const bLocked = updated.some(p => p.groupId === b.groupId && p.locked);

          if (aLocked && bLocked) {
            // Both locked – merge without shifting (already aligned by guide)
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
        }
      }
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
