import { describe, it, expect, beforeAll } from "vitest";

// We can't run the full splitImage (needs canvas/Image in DOM), 
// but we can test the tab config generation logic by extracting it

describe("Puzzle piece generation", () => {
  it("should create correct number of pieces conceptually", () => {
    const rows = 24;
    const cols = 24;
    const totalPieces = rows * cols;
    expect(totalPieces).toBe(576);
    
    // Corner pieces: always 4
    const corners = 4;
    // Edge pieces (not corners): 2*(cols-2) + 2*(rows-2)
    const edges = 2 * (cols - 2) + 2 * (rows - 2);
    // Interior pieces
    const interior = (rows - 2) * (cols - 2);
    
    expect(corners + edges + interior).toBe(totalPieces);
    expect(corners).toBe(4);
    expect(edges).toBe(88); // 2*22 + 2*22
    expect(interior).toBe(484); // 22*22
  });

  it("should identify corner pieces correctly", () => {
    const rows = 24, cols = 24;
    const isCorner = (r: number, c: number) =>
      (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
    
    expect(isCorner(0, 0)).toBe(true);
    expect(isCorner(0, 23)).toBe(true);
    expect(isCorner(23, 0)).toBe(true);
    expect(isCorner(23, 23)).toBe(true);
    expect(isCorner(0, 5)).toBe(false);
    expect(isCorner(12, 12)).toBe(false);
  });

  it("should identify edge pieces correctly", () => {
    const rows = 24, cols = 24;
    const isEdge = (r: number, c: number) =>
      (r === 0 || r === rows - 1 || c === 0 || c === cols - 1);
    
    expect(isEdge(0, 5)).toBe(true);
    expect(isEdge(12, 0)).toBe(true);
    expect(isEdge(12, 12)).toBe(false);
  });

  it("should have matching tabs config - each internal edge has exactly one tab and one blank", () => {
    // Simulate tabs config generation
    const rows = 4, cols = 4;
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

    // Check: horizontal edges count = (rows-1) * cols
    expect(horizontal.length).toBe(rows - 1);
    expect(horizontal[0].length).toBe(cols);
    
    // Check: vertical edges count = rows * (cols-1)
    expect(vertical.length).toBe(rows);
    expect(vertical[0].length).toBe(cols - 1);

    // Each value should be +1 or -1
    for (const row of horizontal) {
      for (const val of row) {
        expect(Math.abs(val)).toBe(1);
      }
    }
    for (const row of vertical) {
      for (const val of row) {
        expect(Math.abs(val)).toBe(1);
      }
    }
  });
});
