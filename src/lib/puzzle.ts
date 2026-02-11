export interface PuzzlePiece {
  id: number;
  row: number;
  col: number;
  imageDataUrl: string;
  // Display size (scaled down for rendering)
  displayWidth: number;
  displayHeight: number;
  // Offset from grid origin to piece top-left (due to tab overhang)
  offsetX: number;
  offsetY: number;
  selected: boolean;
  x: number | null;
  y: number | null;
}

// Tabs config: +1 = tab protrudes in positive direction, -1 = blank
// horizontalEdges[row][col] = tab direction for the edge below row
// verticalEdges[row][col] = tab direction for the edge right of col
interface TabsConfig {
  horizontal: number[][]; // (rows-1) x cols
  vertical: number[][];   // rows x (cols-1)
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

// Draw one side of a jigsaw piece path
// from (x0,y0) to (x1,y1) with a tab in the perpendicular direction
// tabDir: 0 = flat, +1 = tab outward, -1 = blank inward
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
  // Normal direction (perpendicular)
  const nx = -dy / len * tabDir;
  const ny = dx / len * tabDir;
  const tabSize = len * 0.22;

  // Points along the edge
  const p1x = x0 + dx * 0.35;
  const p1y = y0 + dy * 0.35;
  const p2x = x0 + dx * 0.65;
  const p2y = y0 + dy * 0.65;

  // Neck points
  const n1x = p1x + nx * tabSize * 0.1;
  const n1y = p1y + ny * tabSize * 0.1;
  const n2x = p2x + nx * tabSize * 0.1;
  const n2y = p2y + ny * tabSize * 0.1;

  // Tab tip control points
  const t1x = p1x + nx * tabSize - dx * 0.05;
  const t1y = p1y + ny * tabSize - dy * 0.05;
  const t2x = p2x + nx * tabSize + dx * 0.05;
  const t2y = p2y + ny * tabSize + dy * 0.05;

  ctx.lineTo(p1x, p1y);
  ctx.bezierCurveTo(
    n1x, n1y,
    t1x, t1y,
    x0 + dx * 0.5 + nx * tabSize, y0 + dy * 0.5 + ny * tabSize
  );
  ctx.bezierCurveTo(
    t2x, t2y,
    n2x, n2y,
    p2x, p2y
  );
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
  // Top edge (left to right)
  drawJigsawSide(ctx, x, y, x + w, y, top);
  // Right edge (top to bottom)
  drawJigsawSide(ctx, x + w, y, x + w, y + h, right);
  // Bottom edge (right to left)
  drawJigsawSide(ctx, x + w, y + h, x, y + h, -bottom);
  // Left edge (bottom to top)
  drawJigsawSide(ctx, x, y + h, x, y, -left);
  ctx.closePath();
}

function getTabDirs(row: number, col: number, rows: number, cols: number, tabs: TabsConfig) {
  // Top
  const top = row === 0 ? 0 : -tabs.horizontal[row - 1][col];
  // Bottom
  const bottom = row === rows - 1 ? 0 : tabs.horizontal[row][col];
  // Left
  const left = col === 0 ? 0 : -tabs.vertical[row][col - 1];
  // Right
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
      const tabW = Math.ceil(pieceW * 0.25);
      const tabH = Math.ceil(pieceH * 0.25);
      const pieces: PuzzlePiece[] = [];
      const tabs = generateTabsConfig(rows, cols);

      // Canvas large enough for piece + tab overhang on all sides
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

          // Draw clipping path at center of canvas with tab overhang
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.clip();

          // Draw the source image offset so this piece's grid cell aligns with (tabW, tabH)
          ctx.drawImage(
            img,
            c * pieceW - tabW, r * pieceH - tabH, canvasW, canvasH,
            0, 0, canvasW, canvasH
          );
          ctx.restore();

          // Draw subtle border along the piece edge
          ctx.save();
          drawPiecePath(ctx, tabW, tabH, pieceW, pieceH, top, right, bottom, left);
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          // Calculate display size (scale down for screen)
          const scale = 3;
          pieces.push({
            id: r * cols + c,
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
