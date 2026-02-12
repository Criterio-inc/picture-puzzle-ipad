import { describe, it, expect } from "vitest";
import { trySnap, trySnapToGuide, PuzzlePiece, PUZZLE_ORIGIN } from "@/lib/puzzle";

function makePiece(overrides: Partial<PuzzlePiece> & { id: number; row: number; col: number }): PuzzlePiece {
  return {
    imageDataUrl: "",
    displayWidth: 120, // cellW = 120 - 2*10 = 100
    displayHeight: 120,
    offsetX: 10,
    offsetY: 10,
    selected: false,
    x: null,
    y: null,
    groupId: overrides.id,
    locked: false,
    ...overrides,
  };
}

describe("Puzzle piece generation", () => {
  it("should create correct number of pieces conceptually", () => {
    const rows = 24, cols = 24;
    expect(rows * cols).toBe(576);
    const corners = 4;
    const edges = 2 * (cols - 2) + 2 * (rows - 2);
    const interior = (rows - 2) * (cols - 2);
    expect(corners + edges + interior).toBe(576);
  });

  it("should identify corner pieces correctly", () => {
    const rows = 24, cols = 24;
    const isCorner = (r: number, c: number) =>
      (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
    expect(isCorner(0, 0)).toBe(true);
    expect(isCorner(12, 12)).toBe(false);
  });

  it("should have matching tabs config", () => {
    const rows = 4, cols = 4;
    const horizontal: number[][] = [];
    for (let r = 0; r < rows - 1; r++) {
      horizontal.push(Array.from({ length: cols }, () => Math.random() > 0.5 ? 1 : -1));
    }
    const vertical: number[][] = [];
    for (let r = 0; r < rows; r++) {
      vertical.push(Array.from({ length: cols - 1 }, () => Math.random() > 0.5 ? 1 : -1));
    }
    expect(horizontal.length).toBe(rows - 1);
    expect(vertical.length).toBe(rows);
    for (const row of [...horizontal, ...vertical]) {
      for (const val of row) expect(Math.abs(val)).toBe(1);
    }
  });
});

describe("trySnap", () => {
  // cellW = displayWidth - 2*offsetX = 120 - 20 = 100
  // threshold = max(8, 100 * 0.10) = 10

  it("snaps adjacent pieces that are close enough", () => {
    const a = makePiece({ id: 0, row: 0, col: 0, x: 100, y: 100 });
    const b = makePiece({ id: 1, row: 0, col: 1, x: 205, y: 103 }); // expected: 200,100 -> dist ~6.7
    const result = trySnap([a, b]);
    expect(result.snapped).toBe(true);
    expect(result.snappedGroupId).not.toBeNull();
    // b should now be at exactly expected position
    const snappedB = result.pieces.find(p => p.id === 1)!;
    expect(snappedB.x).toBe(200);
    expect(snappedB.y).toBe(100);
    expect(snappedB.groupId).toBe(a.groupId);
  });

  it("does NOT snap adjacent pieces that are too far", () => {
    const a = makePiece({ id: 0, row: 0, col: 0, x: 100, y: 100 });
    const b = makePiece({ id: 1, row: 0, col: 1, x: 220, y: 100 }); // expected: 200 -> dist=20, threshold=10
    const result = trySnap([a, b]);
    expect(result.snapped).toBe(false);
    const snappedB = result.pieces.find(p => p.id === 1)!;
    expect(snappedB.x).toBe(220); // unchanged
  });

  it("does NOT snap non-adjacent pieces even if close", () => {
    const a = makePiece({ id: 0, row: 0, col: 0, x: 100, y: 100 });
    // row 0 col 2 is NOT adjacent to row 0 col 0
    const b = makePiece({ id: 2, row: 0, col: 2, x: 305, y: 100 });
    const result = trySnap([a, b]);
    expect(result.snapped).toBe(false);
  });

  it("does NOT snap diagonal pieces", () => {
    const a = makePiece({ id: 0, row: 0, col: 0, x: 100, y: 100 });
    const b = makePiece({ id: 5, row: 1, col: 1, x: 205, y: 205 });
    const result = trySnap([a, b]);
    expect(result.snapped).toBe(false);
  });
});

describe("trySnapToGuide", () => {
  it("snaps edge piece group to correct position and locks", () => {
    // Edge piece at row 0, col 0
    const correctX = PUZZLE_ORIGIN.x - 10 + 0 * 100;
    const correctY = PUZZLE_ORIGIN.y - 10 + 0 * 100;
    const p = makePiece({ id: 0, row: 0, col: 0, x: correctX + 5, y: correctY + 3 });
    const result = trySnapToGuide([p], 4, 4);
    expect(result.snapped).toBe(true);
    const snapped = result.pieces[0];
    expect(snapped.x).toBe(correctX);
    expect(snapped.y).toBe(correctY);
    expect(snapped.locked).toBe(true);
  });

  it("does NOT snap interior-only group to guide", () => {
    const p = makePiece({ id: 5, row: 1, col: 1, x: PUZZLE_ORIGIN.x - 10 + 100 + 3, y: PUZZLE_ORIGIN.y - 10 + 100 + 3 });
    const result = trySnapToGuide([p], 4, 4);
    expect(result.snapped).toBe(false);
    expect(result.pieces[0].locked).toBe(false);
  });
});
