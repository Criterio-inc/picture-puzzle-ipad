/**
 * Canvas renderer for puzzle pieces.
 *
 * Ravensburger-style rendering:
 *   1. Soft drop shadow (piece is raised off table)
 *   2. Image clipped to piece shape
 *   3. Subtle inner bevel — gentle top-left highlight + bottom-right shadow
 *   4. Thin, soft outline between pieces
 *
 * The key is SUBTLETY — the image should dominate, with the 3D effect
 * being felt rather than seen. No heavy borders or dark frames.
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

  // ── 1. Drop shadow ────────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);
  if (options.snapGlow) {
    ctx.shadowColor = `rgba(60,210,60,${(0.9 * glowAlpha).toFixed(2)})`;
    ctx.shadowBlur = 28 * glowAlpha;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (piece.isSelected) {
    ctx.shadowColor = 'rgba(60,100,255,0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 3;
  }
  // Fill with neutral color just to generate the shadow
  ctx.fillStyle = '#ccc';
  ctx.fill(path);
  ctx.restore();

  // ── 2. Clipped image ──────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);
  ctx.clip(path);

  // Draw the full board image offset so the correct slice shows through
  ctx.drawImage(image, -solvedX, -solvedY, boardW, boardH);

  // ── 3. Subtle inner bevel (all inside the clip) ───────────────────────────
  // Light from top-left: highlight on top + left, shadow on bottom + right

  // Bottom shadow — very gentle darkening along bottom edge
  ctx.globalAlpha = 0.18;
  const darkV = ctx.createLinearGradient(0, h * 0.65, 0, h);
  darkV.addColorStop(0, 'rgba(0,0,0,0)');
  darkV.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = darkV;
  ctx.fillRect(0, 0, w, h);

  // Right shadow — gentle darkening along right edge
  ctx.globalAlpha = 0.10;
  const darkH = ctx.createLinearGradient(w * 0.7, 0, w, 0);
  darkH.addColorStop(0, 'rgba(0,0,0,0)');
  darkH.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = darkH;
  ctx.fillRect(0, 0, w, h);

  // Top highlight — subtle white sheen along top edge
  ctx.globalAlpha = 0.22;
  const lightV = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  lightV.addColorStop(0, 'rgba(255,255,255,0.50)');
  lightV.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lightV;
  ctx.fillRect(0, 0, w, h);

  // Left highlight — subtle white sheen along left edge
  ctx.globalAlpha = 0.08;
  const lightH = ctx.createLinearGradient(0, 0, w * 0.15, 0);
  lightH.addColorStop(0, 'rgba(255,255,255,0.35)');
  lightH.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lightH;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();

  // ── 4. Outline ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);

  if (options.snapGlow) {
    ctx.strokeStyle = `rgba(60,210,60,${(0.9 * glowAlpha).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.stroke(path);
  }

  // Thin soft outline — just enough to define the piece edges
  ctx.strokeStyle = piece.isSelected
    ? 'rgba(60,100,255,0.75)'
    : 'rgba(40,30,15,0.35)';
  ctx.lineWidth = piece.isSelected ? 2 : 1;
  ctx.stroke(path);

  ctx.restore();
}
