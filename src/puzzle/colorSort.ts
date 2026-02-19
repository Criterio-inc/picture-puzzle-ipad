/**
 * Color-based piece sorting.
 * Computes the average hue of each piece's image region and returns a value 0–360.
 * Results are cached so sorting is instant after the first call.
 */

import { PieceDef } from './generator';

// Per-game cache keyed by piece id
const hueCache = new Map<string, number>();

/** Call this when a new puzzle is started to clear stale cache entries. */
export function clearHueCache(): void {
  hueCache.clear();
}

/**
 * Get the average hue (0–360) of the piece's image region.
 * Uses a single getImageData call for the full piece bounding box,
 * then samples a 5×5 grid within it — fast and accurate enough for sorting.
 */
export function getPieceHue(
  piece: PieceDef,
  boardImage: HTMLCanvasElement,
  boardW: number,
  boardH: number,
): number {
  const cached = hueCache.get(piece.id);
  if (cached !== undefined) return cached;

  const ctx = boardImage.getContext('2d');
  if (!ctx) { hueCache.set(piece.id, 0); return 0; }

  const sx = Math.round(piece.solvedX);
  const sy = Math.round(piece.solvedY);
  const sw = Math.min(Math.round(piece.width), boardW - sx);
  const sh = Math.min(Math.round(piece.height), boardH - sy);

  if (sw <= 0 || sh <= 0) { hueCache.set(piece.id, 0); return 0; }

  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const data = imageData.data;

  const SAMPLES = 5;
  let sumH = 0;
  let sumWeight = 0;

  for (let ix = 1; ix <= SAMPLES; ix++) {
    for (let iy = 1; iy <= SAMPLES; iy++) {
      const px = Math.min(Math.round((ix / (SAMPLES + 1)) * sw), sw - 1);
      const py = Math.min(Math.round((iy / (SAMPLES + 1)) * sh), sh - 1);
      const idx = (py * sw + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const { h, s } = rgbToHsl(r, g, b);
      // Down-weight near-grey pixels so they don't skew the hue
      const weight = Math.max(0.05, s);
      sumH += h * weight;
      sumWeight += weight;
    }
  }

  const hue = sumWeight > 0 ? sumH / sumWeight : 0;
  hueCache.set(piece.id, hue);
  return hue;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h: h * 360, s, l };
}
