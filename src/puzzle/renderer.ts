/**
 * Canvas renderer for puzzle pieces.
 * Ravensburger-style: image clipped to piece shape + inner bevel highlight
 * for a realistic 3-D look.
 */

import { PieceDef, buildPiecePath, KNOB_SCALE } from './generator';

export function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: PieceDef,
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  boardW: number,
  boardH: number,
  options: { snapGlow?: boolean } = {},
): void {
  const { x, y, width: w, height: h, solvedX, solvedY } = piece;
  const path = buildPiecePath(piece, KNOB_SCALE);

  // ── 1. Drop shadow (no clip) ──────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);
  if (options.snapGlow) {
    ctx.shadowColor = 'rgba(60,210,60,0.9)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (piece.isSelected) {
    ctx.shadowColor = 'rgba(60,100,255,0.65)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = '#ccc'; // opaque fill so shadow renders
  ctx.fill(path);
  ctx.restore();

  // ── 2. Clipped image pass ─────────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);
  ctx.clip(path);

  // Draw full puzzle-board-sized image, offset so the correct slice shows.
  ctx.drawImage(image, -solvedX, -solvedY, boardW, boardH);

  // ── 3. Inner bevel: top-left light, bottom-right shadow (inside clip) ─────
  // Creates the Ravensburger 3D embossed look.
  const bevW = Math.min(w, h) * 0.06;

  // Dark edge (bottom + right inset) — feels pushed in
  ctx.globalAlpha = 0.22;
  const darkGrad = ctx.createLinearGradient(0, 0, 0, h);
  darkGrad.addColorStop(0, 'rgba(0,0,0,0)');
  darkGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
  darkGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = darkGrad;
  ctx.fillRect(-bevW, -bevW, w + bevW * 2, h + bevW * 2);

  // Light edge (top-left) — top highlight
  const lightGrad = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  lightGrad.addColorStop(0, 'rgba(255,255,255,0.32)');
  lightGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(-bevW, -bevW, w + bevW * 2, h + bevW * 2);

  ctx.restore();

  // ── 4. Crisp outline ──────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);

  if (options.snapGlow) {
    ctx.strokeStyle = 'rgba(60,210,60,0.9)';
    ctx.lineWidth = 3.5;
    ctx.stroke(path);
  }

  // Thin dark outline for crispness between adjacent pieces
  ctx.strokeStyle = piece.isSelected
    ? 'rgba(60,100,255,0.8)'
    : 'rgba(30,20,10,0.45)';
  ctx.lineWidth = piece.isSelected ? 2 : 1.2;
  ctx.stroke(path);

  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  boardX: number,
  boardY: number,
  boardW: number,
  boardH: number,
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  pieces: PieceDef[],
  snapGlowId: string | null,
  showGuide: boolean,
): void {
  // Background
  ctx.clearRect(0, 0, cw, ch);
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, '#f0e6d4');
  grad.addColorStop(1, '#dfd0b4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Board shadow + background
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#f5edd9';
  ctx.beginPath();
  ctx.roundRect(boardX - 8, boardY - 8, boardW + 16, boardH + 16, 12);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(140,110,70,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(boardX - 8, boardY - 8, boardW + 16, boardH + 16, 12);
  ctx.stroke();

  // Guide outlines (faint piece silhouettes on the board)
  if (showGuide) {
    for (const piece of pieces) {
      if (piece.isPlaced) continue;
      ctx.save();
      ctx.translate(boardX + piece.solvedX, boardY + piece.solvedY);
      const p = buildPiecePath(piece, KNOB_SCALE);
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#6b5030';
      ctx.lineWidth = 1;
      ctx.stroke(p);
      ctx.restore();
    }
  }

  // Draw pieces: placed first (lower z), then floating on top
  const sorted = [...pieces].sort((a, b) => a.zIndex - b.zIndex);

  for (const piece of sorted) {
    if (!piece.isPlaced) continue;
    drawPiece(ctx, piece, image, boardW, boardH, {
      snapGlow: piece.id === snapGlowId,
    });
  }
  for (const piece of sorted) {
    if (piece.isPlaced) continue;
    drawPiece(ctx, piece, image, boardW, boardH, {
      snapGlow: piece.id === snapGlowId,
    });
  }
}
