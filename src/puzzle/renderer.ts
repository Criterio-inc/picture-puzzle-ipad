/**
 * Canvas renderer for puzzle pieces.
 * Ravensburger-style: image clipped to piece shape + multi-layer bevel
 * with cardboard edge, inner highlight, and deep shadow for a realistic
 * 3-D embossed / raised-cardboard look.
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
  const unit = Math.min(w, h);

  // ── 1. Drop shadow (no clip) ──────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);
  if (options.snapGlow) {
    ctx.shadowColor = `rgba(60,210,60,${(0.9 * glowAlpha).toFixed(2)})`;
    ctx.shadowBlur = 28 * glowAlpha;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (piece.isSelected) {
    ctx.shadowColor = 'rgba(60,100,255,0.65)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    // Deep realistic shadow — piece is raised off the table
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 5;
  }
  ctx.fillStyle = '#b8a88a'; // warm cardboard base
  ctx.fill(path);
  ctx.restore();

  // ── 2. Cardboard edge — a slightly offset, darker fill underneath ─────────
  // This simulates the thickness of the cardboard piece seen from the side
  ctx.save();
  ctx.translate(x, y);
  const edgeThick = Math.max(1.5, unit * 0.025);
  ctx.save();
  ctx.translate(0.5, edgeThick);
  const edgePath = buildPiecePath(piece, KNOB_SCALE);
  ctx.fillStyle = '#8a7a62'; // dark cardboard side
  ctx.fill(edgePath);
  ctx.restore();
  ctx.restore();

  // ── 3. Clipped image pass ─────────────────────────────────────────────────
  ctx.save();
  ctx.translate(x, y);
  ctx.clip(path);

  // Draw full puzzle-board-sized image, offset so the correct slice shows.
  ctx.drawImage(image, -solvedX, -solvedY, boardW, boardH);

  // ── 4. Multi-layer inner bevel (inside clip) ─────────────────────────────
  const bevW = unit * 0.10;

  // Bottom shadow — deep, like light coming from top-left
  ctx.globalAlpha = 0.28;
  const darkGradV = ctx.createLinearGradient(0, 0, 0, h);
  darkGradV.addColorStop(0, 'rgba(0,0,0,0)');
  darkGradV.addColorStop(0.5, 'rgba(0,0,0,0)');
  darkGradV.addColorStop(0.85, 'rgba(0,0,0,0.25)');
  darkGradV.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = darkGradV;
  ctx.fillRect(-bevW, -bevW, w + bevW * 2, h + bevW * 2);

  // Right edge shadow
  ctx.globalAlpha = 0.20;
  const darkGradH = ctx.createLinearGradient(0, 0, w, 0);
  darkGradH.addColorStop(0, 'rgba(0,0,0,0)');
  darkGradH.addColorStop(0.5, 'rgba(0,0,0,0)');
  darkGradH.addColorStop(0.85, 'rgba(0,0,0,0.20)');
  darkGradH.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = darkGradH;
  ctx.fillRect(-bevW, -bevW, w + bevW * 2, h + bevW * 2);

  // Top highlight — bright catch light
  ctx.globalAlpha = 0.42;
  const lightGrad = ctx.createLinearGradient(0, 0, 0, h * 0.20);
  lightGrad.addColorStop(0, 'rgba(255,255,255,0.60)');
  lightGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(-bevW, -bevW, w + bevW * 2, h + bevW * 2);

  // Left highlight — subtle side light
  ctx.globalAlpha = 0.18;
  const leftGrad = ctx.createLinearGradient(0, 0, w * 0.15, 0);
  leftGrad.addColorStop(0, 'rgba(255,255,255,0.40)');
  leftGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(-bevW, -bevW, w + bevW * 2, h + bevW * 2);

  // Inner edge vignette — darkens the perimeter for embossed feel
  ctx.globalAlpha = 0.10;
  const vigSize = unit * 0.06;
  // Top inner edge
  const vigTop = ctx.createLinearGradient(0, 0, 0, vigSize);
  vigTop.addColorStop(0, 'rgba(60,40,10,0.5)');
  vigTop.addColorStop(1, 'rgba(60,40,10,0)');
  ctx.fillStyle = vigTop;
  ctx.fillRect(-bevW, -bevW, w + bevW * 2, vigSize + bevW);
  // Bottom inner edge
  const vigBot = ctx.createLinearGradient(0, h, 0, h - vigSize);
  vigBot.addColorStop(0, 'rgba(20,10,0,0.6)');
  vigBot.addColorStop(1, 'rgba(20,10,0,0)');
  ctx.fillStyle = vigBot;
  ctx.fillRect(-bevW, h - vigSize, w + bevW * 2, vigSize + bevW);

  ctx.restore();

  // ── 5. Crisp outline — thicker, warm-toned for cardboard feel ────────────
  ctx.save();
  ctx.translate(x, y);

  if (options.snapGlow) {
    ctx.strokeStyle = `rgba(60,210,60,${(0.9 * glowAlpha).toFixed(2)})`;
    ctx.lineWidth = 3.5;
    ctx.stroke(path);
  }

  // Main outline: warm dark brown, thicker than before
  ctx.strokeStyle = piece.isSelected
    ? 'rgba(60,100,255,0.8)'
    : 'rgba(50,35,15,0.55)';
  ctx.lineWidth = piece.isSelected ? 2.5 : 1.8;
  ctx.stroke(path);

  // Inner highlight stroke — subtle light edge on top-left
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 0.8;
  ctx.stroke(path);

  ctx.restore();
}
