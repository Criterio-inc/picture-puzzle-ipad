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
  options: { snapGlow?: boolean; snapGlowAlpha?: number } = {},
): void {
  const { x, y, width: w, height: h, solvedX, solvedY } = piece;
  const path = buildPiecePath(piece, KNOB_SCALE);
  const glowAlpha = options.snapGlowAlpha ?? 1;

  // ── 1. Drop shadow (no clip) ──────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);
  if (options.snapGlow) {
    const a = glowAlpha.toFixed(2);
    ctx.shadowColor = `rgba(60,210,60,${(0.9 * glowAlpha).toFixed(2)})`;
    ctx.shadowBlur = 28 * glowAlpha;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    void a; // suppress unused warning
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
    ctx.strokeStyle = `rgba(60,210,60,${(0.9 * glowAlpha).toFixed(2)})`;
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

