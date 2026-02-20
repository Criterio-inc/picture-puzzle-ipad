/**
 * PuzzleCanvas — full-screen puzzle board.
 *
 * Layout:
 *   - Canvas fills 100% of the viewport (position: absolute, inset: 0)
 *   - Board is centered within the canvas, with bottom padding for the drawer
 *   - DrawerTray slides up from the bottom over the canvas
 *   - PuzzleHUD floats at the top (pointer-events: none)
 *   - Back button is owned by App.tsx at z-index: 65
 *
 * Drag flow:
 *   Tray → board:  DrawerTray calls onPieceLiftFromDrawer → global listeners track drag
 *   Board → tray:  drop piece in bottom DRAWER_PEEK_HEIGHT zone → returns to tray
 *   Board → board: any placed piece can be re-lifted and moved
 *
 * Save/restore:
 *   - seed prop reproduces the same piece shapes deterministically
 *   - loadedPiecesState restores piece positions (fractional board-relative coords)
 *   - loadedTrayIds restores which pieces are in the tray
 *   - onSave callback is called by App.tsx when the user backs out
 *   - onRegisterSaveTrigger gives App.tsx a handle to trigger save
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { generatePuzzle, PieceDef, buildPiecePath, KNOB_SCALE } from './generator';
import { drawPiece } from './renderer';
import DrawerTray, { DRAWER_PEEK_HEIGHT } from './DrawerTray';
import PuzzleHUD from './PuzzleHUD';
import { SavedPieceState } from '../lib/puzzleSave';

// Snap distance as fraction of piece's smaller dimension.
const SNAP_FRACTION = 0.28;  // slightly more forgiving for group snapping
const BOARD_PAD_TOP = 6;
const BOARD_PAD_SIDE = 6;
const BOARD_PAD_BOTTOM = DRAWER_PEEK_HEIGHT + 4;

// Path2D cache — keyed by piece object identity, cleared on new puzzle
const pathCache = new WeakMap<PieceDef, Path2D>();
function getCachedPath(piece: PieceDef): Path2D {
  let p = pathCache.get(piece);
  if (!p) { p = buildPiecePath(piece, KNOB_SCALE); pathCache.set(piece, p); }
  return p;
}

interface Props {
  image: HTMLImageElement;
  cols: number;
  rows: number;
  seed: number;
  loadedPiecesState?: SavedPieceState[];
  loadedTrayIds?: string[];
  onComplete?: () => void;
  onCalmMode?: (calm: boolean) => void;
  /**
   * Called when App.tsx wants to persist the puzzle.
   * Returns the new/updated save ID.
   */
  onSave?: (
    pieces: PieceDef[],
    trayIds: string[],
    boardX: number,
    boardY: number,
    boardW: number,
    boardH: number,
    placedCount: number,
    total: number,
    isCompleted: boolean,
    boardImageCanvas: HTMLCanvasElement,
  ) => Promise<string>;
  /**
   * Called once after mount so App.tsx can trigger a save before navigating away.
   */
  onRegisterSaveTrigger?: (fn: () => Promise<void>) => void;
  /**
   * Gives App.tsx a handle to trigger a new puzzle (shuffle/restart).
   */
  onRegisterNewPuzzleTrigger?: (fn: () => void) => void;
}

interface BoardState {
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  boardImage: HTMLCanvasElement;
  pieces: PieceDef[];
  /** Maps piece.id → group ID (shared string among connected pieces) */
  groups: Map<string, string>;
}

interface DragState {
  piece: PieceDef;
  startX: number;
  startY: number;
  pieceStartX: number;
  pieceStartY: number;
  pointerId: number;
  fromTray: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PuzzleCanvas({
  image,
  cols,
  rows,
  seed,
  loadedPiecesState,
  loadedTrayIds,
  onComplete,
  onSave,
  onRegisterSaveTrigger,
  onRegisterNewPuzzleTrigger,
  onCalmMode,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<BoardState | null>(null);
  const animRef = useRef<number>(0);
  const snapGlowRef = useRef<{ id: string; until: number } | null>(null);
  const showGuideRef = useRef(false);
  const hitCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPointerYRef = useRef(0);

  const dragRef = useRef<DragState | null>(null);
  // Mirror of trayPieces state — readable synchronously inside the RAF loop
  const trayIdsRef = useRef<Set<string>>(new Set());
  // When dragging near a valid snap position, stores the target coords for ghost preview
  const snapPreviewRef = useRef<{ x: number; y: number; pieceId: string } | null>(null);

  // Track placed count + isComplete in refs for use inside save callback
  const placedCountRef = useRef(0);
  const isCompleteRef = useRef(false);

  const [boardReady, setBoardReady] = useState<BoardState | null>(null);
  const [trayPieces, setTrayPieces] = useState<PieceDef[]>([]);
  const [placedCount, setPlacedCount] = useState(0);
  const [total, setTotal] = useState(cols * rows);
  const [showGuide, setShowGuide] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [calmMode, setCalmMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [, tick] = useState(0);

  // ─── Celebration → calm mode transition ─────────────────────────────────
  useEffect(() => {
    if (!isComplete || calmMode) return;
    setShowCelebration(true);
    const timer = setTimeout(() => {
      setShowCelebration(false);
      setCalmMode(true);
      onCalmMode?.(true);
    }, 4500);
    return () => clearTimeout(timer);
  }, [isComplete, calmMode, onCalmMode]);

  // ─── Tray helper — keeps ref in sync with state ─────────────────────────
  function setTray(pieces: PieceDef[] | ((prev: PieceDef[]) => PieceDef[])) {
    setTrayPieces(prev => {
      const next = typeof pieces === 'function' ? pieces(prev) : pieces;
      trayIdsRef.current = new Set(next.map(p => p.id));
      return next;
    });
  }

  // ─── Hit-test context ───────────────────────────────────────────────────
  function getHitCtx() {
    if (!hitCtxRef.current) {
      const o = document.createElement('canvas');
      o.width = 2; o.height = 2;
      hitCtxRef.current = o.getContext('2d')!;
    }
    return hitCtxRef.current;
  }

  // ─── Build board ─────────────────────────────────────────────────────────
  const buildBoard = useCallback((canvasW: number, canvasH: number) => {
    const boardMaxW = canvasW - BOARD_PAD_SIDE * 2;
    const boardMaxH = canvasH - BOARD_PAD_TOP - BOARD_PAD_BOTTOM;
    const aspect = image.naturalWidth / image.naturalHeight;
    const boardW = Math.min(boardMaxW, boardMaxH * aspect);
    const boardH = boardW / aspect;
    const boardX = Math.round((canvasW - boardW) / 2);
    const boardY = Math.round(BOARD_PAD_TOP + (boardMaxH - boardH) / 2);

    // Pre-render image at board resolution
    const off = document.createElement('canvas');
    off.width = Math.round(boardW);
    off.height = Math.round(boardH);
    off.getContext('2d')!.drawImage(image, 0, 0, Math.round(boardW), Math.round(boardH));

    // Use the provided seed for reproducible pieces
    const layout = generatePuzzle(boardW, boardH, cols, rows, seed);

    // Build a lookup of saved state for quick restoration
    const savedMap = new Map<string, SavedPieceState>(
      (loadedPiecesState ?? []).map(s => [s.id, s]),
    );
    const savedTraySet = new Set<string>(loadedTrayIds ?? []);

    // Figure out whether we're restoring or starting fresh
    const isRestoring = loadedPiecesState && loadedPiecesState.length > 0;

    for (const p of layout.pieces) {
      const saved = savedMap.get(p.id);
      if (isRestoring && saved) {
        // Restore position from fractional coords
        p.x = boardX + saved.fx * boardW;
        p.y = boardY + saved.fy * boardH;
        p.isPlaced = saved.isPlaced;
        p.zIndex = saved.zIndex;
      } else {
        // Start at solved position (will be put in tray)
        p.x = boardX + p.solvedX;
        p.y = boardY + p.solvedY;
        p.isPlaced = false;
      }
    }

    // Each piece starts in its own group (singleton)
    const groups = new Map<string, string>();
    for (const p of layout.pieces) {
      groups.set(p.id, p.id);
    }

    const state: BoardState = { boardX, boardY, boardW, boardH, boardImage: off, pieces: layout.pieces, groups };
    boardRef.current = state;
    setBoardReady(state);

    // Determine tray pieces
    // Fisher-Yates shuffle using the same seed (offset so it differs from piece generation)
    function shuffleArray<T>(arr: T[], shuffleSeed: number): T[] {
      const a = [...arr];
      let s = (shuffleSeed ^ 0xdeadbeef) >>> 0;
      for (let i = a.length - 1; i > 0; i--) {
        s = Math.imul(s ^ (s >>> 15), s | 1);
        s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
        const j = ((s ^ (s >>> 14)) >>> 0) % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    let trayPieceList: PieceDef[];
    if (isRestoring) {
      trayPieceList = layout.pieces.filter(p => savedTraySet.has(p.id));
    } else {
      trayPieceList = shuffleArray(layout.pieces, seed);
    }

    // Set ref first (synchronously), then state
    trayIdsRef.current = new Set(trayPieceList.map(p => p.id));
    setTrayPieces(trayPieceList);

    const placed = layout.pieces.filter(p => p.isPlaced).length;
    setTotal(layout.pieces.length);
    setPlacedCount(placed);
    placedCountRef.current = placed;

    const completed = placed === layout.pieces.length;
    setIsComplete(completed);
    isCompleteRef.current = completed;

    snapGlowRef.current = null;
    dragRef.current = null;
  }, [image, cols, rows, seed, loadedPiecesState, loadedTrayIds]);

  // ─── Register new-puzzle trigger with App.tsx ────────────────────────────
  useEffect(() => {
    if (!onRegisterNewPuzzleTrigger) return;
    onRegisterNewPuzzleTrigger(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      buildBoard(rect.width, rect.height);
    });
  }, [onRegisterNewPuzzleTrigger, buildBoard]);

  // ─── Register save trigger with App.tsx ──────────────────────────────────
  useEffect(() => {
    if (!onRegisterSaveTrigger || !onSave) return;
    onRegisterSaveTrigger(async () => {
      const board = boardRef.current;
      if (!board) return;
      await onSave(
        board.pieces,
        [...trayIdsRef.current],
        board.boardX,
        board.boardY,
        board.boardW,
        board.boardH,
        placedCountRef.current,
        board.pieces.length,
        isCompleteRef.current,
        board.boardImage,
      );
    });
  }, [onRegisterSaveTrigger, onSave]);

  // ─── Canvas setup & resize ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function init() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 10) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildBoard(rect.width, rect.height);
    }

    const ro = new ResizeObserver(() => {
      const rect = canvas!.getBoundingClientRect();
      if (rect.width < 10) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const newW = Math.round(rect.width * dpr);
      if (Math.abs(newW - canvas!.width) > 4) {
        init();
      }
    });
    ro.observe(canvas);
    requestAnimationFrame(init);

    return () => ro.disconnect();
  }, [buildBoard]);

  // ─── Render loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let running = true;
    // Cache the background gradient so we don't recreate it every frame
    let bgGrad: CanvasGradient | null = null;
    let bgGradH = 0;

    function loop() {
      if (!running) return;
      const board = boardRef.current;
      const ctx = canvas!.getContext('2d');
      if (!ctx || !board) { animRef.current = requestAnimationFrame(loop); return; }

      const rect = canvas!.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      if (cw < 10) { animRef.current = requestAnimationFrame(loop); return; }

      const { boardX: bx, boardY: by, boardW: bw, boardH: bh, boardImage, pieces } = board;
      const now = Date.now();

      // Snap glow: compute fade-out alpha (1 → 0 over last 250ms of 700ms)
      let glowId: string | null = null;
      let glowAlpha = 1;
      if (snapGlowRef.current) {
        const remaining = snapGlowRef.current.until - now;
        if (remaining > 0) {
          glowId = snapGlowRef.current.id;
          glowAlpha = Math.min(1, remaining / 250); // fade out in last 250ms
        }
      }

      // Background — reuse gradient unless canvas height changed
      ctx.clearRect(0, 0, cw, ch);
      if (!bgGrad || bgGradH !== ch) {
        bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
        bgGrad.addColorStop(0, '#f0e6d4');
        bgGrad.addColorStop(1, '#dfd0b4');
        bgGradH = ch;
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      // Board shadow + bg
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.14)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#f5edd9';
      ctx.beginPath();
      ctx.roundRect(bx - 8, by - 8, bw + 16, bh + 16, 12);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(140,110,70,0.20)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx - 8, by - 8, bw + 16, bh + 16, 12);
      ctx.stroke();

      // Guide outlines — show solved position for every piece not yet snapped in
      if (showGuideRef.current) {
        for (const p of pieces) {
          if (p.isPlaced) continue;
          ctx.save();
          ctx.translate(bx + p.solvedX, by + p.solvedY);
          ctx.globalAlpha = 0.14;
          ctx.strokeStyle = '#6b5030';
          ctx.lineWidth = 1;
          ctx.stroke(getCachedPath(p));
          ctx.restore();
        }
      }

      // Single sort — split into placed / floating / drag in one pass
      const sorted = [...pieces].sort((a, b) => a.zIndex - b.zIndex);
      const drag = dragRef.current;
      const tray = trayIdsRef.current;

      for (const p of sorted) {
        if (!p.isPlaced) continue;
        drawPiece(ctx, p, boardImage, bw, bh, { snapGlow: p.id === glowId, snapGlowAlpha: glowAlpha });
      }
      for (const p of sorted) {
        if (p.isPlaced || tray.has(p.id) || drag?.piece === p) continue;
        drawPiece(ctx, p, boardImage, bw, bh, { snapGlow: p.id === glowId, snapGlowAlpha: glowAlpha });
      }

      // Snap preview ghost
      const preview = snapPreviewRef.current;
      if (preview && drag) {
        ctx.save();
        ctx.translate(preview.x, preview.y);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke(getCachedPath(drag.piece));
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Active drag piece (always topmost)
      if (drag) {
        drawPiece(ctx, drag.piece, boardImage, bw, bh, { snapGlow: false });
      }

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [image]);

  // ─── Coordinate helpers ──────────────────────────────────────────────────
  function canvasCSSCoords(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ─── Snap helpers ─────────────────────────────────────────────────────────
  function snapDist(piece: PieceDef): number {
    return Math.min(piece.width, piece.height) * SNAP_FRACTION;
  }

  /**
   * Get all pieces in the same group as `piece`.
   */
  function getGroup(board: BoardState, piece: PieceDef): PieceDef[] {
    const gid = board.groups.get(piece.id);
    if (!gid) return [piece];
    return board.pieces.filter(p => board.groups.get(p.id) === gid);
  }

  /**
   * Merge two groups together (union-find style, simple version).
   * All pieces with groupB's id get groupA's id.
   */
  function mergeGroups(board: BoardState, pieceA: PieceDef, pieceB: PieceDef) {
    const gidA = board.groups.get(pieceA.id) ?? pieceA.id;
    const gidB = board.groups.get(pieceB.id) ?? pieceB.id;
    if (gidA === gidB) return;
    for (const [pid, gid] of board.groups) {
      if (gid === gidB) board.groups.set(pid, gidA);
    }
  }

  /**
   * Try to snap `piece` to:
   * 1. A neighbouring piece already on the board (group snap — anywhere on board)
   * 2. Its solved position on the board (classic snap)
   *
   * Returns true if any snap occurred.
   */
  function trySnap(piece: PieceDef): boolean {
    const board = boardRef.current;
    if (!board) return false;
    const dist = snapDist(piece);
    const traySet = trayIdsRef.current;
    const dragGroup = getGroup(board, piece);
    const dragGroupIds = new Set(dragGroup.map(p => p.id));

    // ── 1. Neighbour snap: check all 4 adjacent positions ──────────────────
    // For each piece on the board (not in tray, not in drag group),
    // check if piece can snap to its left/right/top/bottom side.
    const neighbours: { dc: number; dr: number; dx: number; dy: number }[] = [
      { dc:  1, dr:  0, dx:  piece.width,  dy: 0           }, // piece is to the LEFT of neighbour
      { dc: -1, dr:  0, dx: -piece.width,  dy: 0           }, // piece is to the RIGHT of neighbour
      { dc:  0, dr:  1, dx:  0,            dy: piece.height }, // piece is ABOVE neighbour
      { dc:  0, dr: -1, dx:  0,            dy: -piece.height}, // piece is BELOW neighbour
    ];

    for (const candidate of board.pieces) {
      if (traySet.has(candidate.id)) continue;
      if (dragGroupIds.has(candidate.id)) continue;
      if (candidate.isSelected) continue;

      for (const nb of neighbours) {
        // Does piece (col,row) + (dc,dr) = candidate (col,row)?
        if (piece.col + nb.dc !== candidate.col) continue;
        if (piece.row + nb.dr !== candidate.row) continue;

        // Expected position of piece if it were correctly placed next to candidate
        const expectedX = candidate.x - nb.dx;
        const expectedY = candidate.y - nb.dy;

        const dx = piece.x - expectedX;
        const dy = piece.y - expectedY;
        if (Math.sqrt(dx * dx + dy * dy) < dist) {
          // Snap the entire drag group by the same offset
          const offsetX = expectedX - piece.x;
          const offsetY = expectedY - piece.y;
          for (const gp of dragGroup) {
            gp.x += offsetX;
            gp.y += offsetY;
            gp.isSelected = false;
          }

          // Merge groups
          mergeGroups(board, piece, candidate);

          // After merging, check if the full merged group aligns with solved positions
          const mergedGroup = getGroup(board, piece);
          checkAndPlaceGroup(board, mergedGroup);

          snapPreviewRef.current = null;
          snapGlowRef.current = { id: piece.id, until: Date.now() + 700 };
          const placed = board.pieces.filter(p => p.isPlaced).length;
          setPlacedCount(placed);
          placedCountRef.current = placed;
          if (placed === board.pieces.length) {
            setIsComplete(true);
            isCompleteRef.current = true;
            onComplete?.();
          }
          return true;
        }
      }
    }

    // ── 2. Classic solved-position snap ─────────────────────────────────────
    const tx = board.boardX + piece.solvedX;
    const ty = board.boardY + piece.solvedY;
    const dx = piece.x - tx;
    const dy = piece.y - ty;
    if (Math.sqrt(dx * dx + dy * dy) < dist) {
      // Snap entire drag group so this piece lands at its solved position
      const offsetX = tx - piece.x;
      const offsetY = ty - piece.y;
      for (const gp of dragGroup) {
        gp.x += offsetX;
        gp.y += offsetY;
        gp.isSelected = false;
      }

      // After snapping to solved position, check which group members are in place
      const mergedGroup = getGroup(board, piece);
      checkAndPlaceGroup(board, mergedGroup);

      snapPreviewRef.current = null;
      snapGlowRef.current = { id: piece.id, until: Date.now() + 700 };
      const placed = board.pieces.filter(p => p.isPlaced).length;
      setPlacedCount(placed);
      placedCountRef.current = placed;
      if (placed === board.pieces.length) {
        setIsComplete(true);
        isCompleteRef.current = true;
        onComplete?.();
      }
      return true;
    }

    return false;
  }

  /**
   * Mark pieces in a group as `isPlaced` if every piece in the group is
   * within snap distance of its solved position.
   */
  function checkAndPlaceGroup(board: BoardState, group: PieceDef[]) {
    const allAligned = group.every(p => {
      const tx = board.boardX + p.solvedX;
      const ty = board.boardY + p.solvedY;
      const dx = p.x - tx;
      const dy = p.y - ty;
      return Math.sqrt(dx * dx + dy * dy) < snapDist(p) * 1.5;
    });
    if (allAligned) {
      for (const p of group) {
        p.x = board.boardX + p.solvedX;
        p.y = board.boardY + p.solvedY;
        p.isPlaced = true;
        p.isSelected = false;
        p.zIndex = -1;
      }
    }
  }

  function updateSnapPreview(piece: PieceDef) {
    const board = boardRef.current;
    if (!board) { snapPreviewRef.current = null; return; }
    const traySet = trayIdsRef.current;
    const dragGroup = getGroup(board, piece);
    const dragGroupIds = new Set(dragGroup.map(p => p.id));
    const dist = snapDist(piece) * 2;

    // Check neighbour snap preview
    const neighbours: { dc: number; dr: number; dx: number; dy: number }[] = [
      { dc:  1, dr:  0, dx:  piece.width,  dy: 0           },
      { dc: -1, dr:  0, dx: -piece.width,  dy: 0           },
      { dc:  0, dr:  1, dx:  0,            dy: piece.height },
      { dc:  0, dr: -1, dx:  0,            dy: -piece.height},
    ];
    for (const candidate of board.pieces) {
      if (traySet.has(candidate.id)) continue;
      if (dragGroupIds.has(candidate.id)) continue;
      if (candidate.isSelected) continue;
      for (const nb of neighbours) {
        if (piece.col + nb.dc !== candidate.col) continue;
        if (piece.row + nb.dr !== candidate.row) continue;
        const expectedX = candidate.x - nb.dx;
        const expectedY = candidate.y - nb.dy;
        const dx = piece.x - expectedX;
        const dy = piece.y - expectedY;
        if (Math.sqrt(dx * dx + dy * dy) < dist) {
          snapPreviewRef.current = { x: expectedX, y: expectedY, pieceId: piece.id };
          return;
        }
      }
    }

    // Classic solved-position preview
    const tx = board.boardX + piece.solvedX;
    const ty = board.boardY + piece.solvedY;
    const dx = piece.x - tx;
    const dy = piece.y - ty;
    if (Math.sqrt(dx * dx + dy * dy) < dist) {
      snapPreviewRef.current = { x: tx, y: ty, pieceId: piece.id };
    } else {
      snapPreviewRef.current = null;
    }
  }

  // ─── Shared pointer move/up ──────────────────────────────────────────────
  function handlePointerMove(clientX: number, clientY: number, pointerId: number) {
    if (!dragRef.current || dragRef.current.pointerId !== pointerId) return;
    lastPointerYRef.current = clientY;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;

    // Move the dragged piece
    const newX = dragRef.current.pieceStartX + dx;
    const newY = dragRef.current.pieceStartY + dy;
    const ddx = newX - dragRef.current.piece.x;
    const ddy = newY - dragRef.current.piece.y;
    dragRef.current.piece.x = newX;
    dragRef.current.piece.y = newY;

    // Move all other pieces in the same group by the same delta
    const board = boardRef.current;
    if (board && (ddx !== 0 || ddy !== 0)) {
      const group = getGroup(board, dragRef.current.piece);
      for (const gp of group) {
        if (gp === dragRef.current.piece) continue;
        gp.x += ddx;
        gp.y += ddy;
      }
    }

    updateSnapPreview(dragRef.current.piece);
  }

  function handlePointerUp(pointerId: number) {
    if (!dragRef.current || dragRef.current.pointerId !== pointerId) return;
    const { piece, fromTray } = dragRef.current;
    piece.isSelected = false;
    snapPreviewRef.current = null;

    const board = boardRef.current;
    const inDrawerZone = lastPointerYRef.current > window.innerHeight - DRAWER_PEEK_HEIGHT - 10;
    const dragGroup = board ? getGroup(board, piece) : [piece];

    const snapped = trySnap(piece);
    if (snapped) {
      // Remove all drag-group pieces from tray (they're now on the board)
      const groupIds = new Set(dragGroup.map(p => p.id));
      setTray(prev => prev.filter(p => !groupIds.has(p.id)));
    } else if (inDrawerZone && dragGroup.length === 1) {
      // Only return to tray if it's a single piece (not a group)
      piece.isPlaced = false;
      setTray(prev => prev.some(p => p.id === piece.id) ? prev : [...prev, piece]);
    } else {
      // Leave floating on board
      for (const gp of dragGroup) {
        gp.isPlaced = false;
        gp.isSelected = false;
      }
      if (fromTray && dragGroup.length === 1) {
        piece.isPlaced = false;
      }
    }

    dragRef.current = null;
    setIsDragging(false);
    tick(n => n + 1);
  }

  // ─── Attach global drag listeners ────────────────────────────────────────
  function attachGlobalListeners(pointerId: number) {
    function onMove(ev: PointerEvent) {
      if (ev.pointerId === pointerId) handlePointerMove(ev.clientX, ev.clientY, pointerId);
    }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      handlePointerUp(pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // ─── Tray piece lift (called by DrawerTray) ──────────────────────────────
  function onPieceLiftFromDrawer(
    piece: PieceDef,
    clientX: number,
    clientY: number,
    pointerId: number,
  ) {
    if (dragRef.current) return;
    const board = boardRef.current;
    if (!board) return;

    const pt = canvasCSSCoords(clientX, clientY);
    piece.x = pt.x - piece.width / 2;
    piece.y = pt.y - piece.height / 2;
    piece.isSelected = true;
    piece.isPlaced = false;
    const maxZ = Math.max(0, ...board.pieces.map(p => p.zIndex));
    piece.zIndex = maxZ + 1;

    dragRef.current = {
      piece,
      startX: clientX,
      startY: clientY,
      pieceStartX: piece.x,
      pieceStartY: piece.y,
      pointerId,
      fromTray: true,
    };

    setTray(prev => prev.filter(p => p.id !== piece.id));
    setIsDragging(true);
    lastPointerYRef.current = clientY;

    attachGlobalListeners(pointerId);
  }

  // ─── Canvas pointer down (board pieces) ─────────────────────────────────
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (dragRef.current) return;
    const board = boardRef.current;
    if (!board) return;

    const pt = canvasCSSCoords(e.clientX, e.clientY);
    const hctx = getHitCtx();

    const candidates = board.pieces.filter(p => {
      if (trayIdsRef.current.has(p.id)) return false;
      if (p.isPlaced) return false;
      return true;
    });

    const sorted = [...candidates].sort((a, b) => b.zIndex - a.zIndex);
    let hit: PieceDef | null = null;

    for (const p of sorted) {
      const lx = pt.x - p.x;
      const ly = pt.y - p.y;
      const pad = Math.min(p.width, p.height) * KNOB_SCALE * 1.2;
      if (lx < -pad || lx > p.width + pad || ly < -pad || ly > p.height + pad) continue;
      if (hctx.isPointInPath(buildPiecePath(p, KNOB_SCALE), lx, ly)) {
        hit = p;
        break;
      }
    }
    if (!hit) return;

    const maxZ = Math.max(0, ...board.pieces.map(p => p.zIndex));
    // Elevate all pieces in the same group
    const hitGroup = getGroup(board, hit);
    for (const gp of hitGroup) {
      gp.zIndex = maxZ + 1;
      gp.isSelected = gp === hit;
      gp.isPlaced = false; // un-place so group can move freely
    }

    dragRef.current = {
      piece: hit,
      startX: e.clientX,
      startY: e.clientY,
      pieceStartX: hit.x,
      pieceStartY: hit.y,
      pointerId: e.pointerId,
      fromTray: false,
    };
    lastPointerYRef.current = e.clientY;
    setIsDragging(true);

    attachGlobalListeners(e.pointerId);
  }

  // ─── Tap-to-stage: place piece freely on board (no drag) ─────────────────
  function onPieceTap(piece: PieceDef) {
    const board = boardRef.current;
    if (!board) return;

    const floatingCount = board.pieces.filter(
      p => !p.isPlaced && !trayIdsRef.current.has(p.id),
    ).length;

    const cx = board.boardX + board.boardW / 2;
    const cy = board.boardY + board.boardH / 2;
    const angle = floatingCount * 2.4;
    const radius = 40 + floatingCount * 28;
    const tx = cx + Math.cos(angle) * radius - piece.width / 2;
    const ty = cy + Math.sin(angle) * radius - piece.height / 2;

    piece.x = Math.max(board.boardX, Math.min(board.boardX + board.boardW - piece.width, tx));
    piece.y = Math.max(board.boardY, Math.min(board.boardY + board.boardH - piece.height, ty));
    piece.isPlaced = false;
    piece.isSelected = false;
    const maxZ = Math.max(0, ...board.pieces.map(p => p.zIndex));
    piece.zIndex = maxZ + 1;

    setTray(prev => prev.filter(p => p.id !== piece.id));
    tick(n => n + 1);
  }

  function handleShuffle() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    buildBoard(rect.width, rect.height);
  }

  function handleToggleGuide() {
    showGuideRef.current = !showGuideRef.current;
    setShowGuide(v => !v);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full h-full relative overflow-hidden select-none"
      style={{ background: '#f0e6d4' }}
    >
      {/* Full-screen board canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
        }}
        onPointerDown={onCanvasPointerDown}
      />

      {/* Drag intercept overlay (prevents drawer receiving events during drag) */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            touchAction: 'none',
            cursor: 'grabbing',
          }}
        />
      )}

      {/* HUD — hidden in calm mode */}
      {!calmMode && <PuzzleHUD placedCount={placedCount} total={total} />}

      {/* Drawer tray — hidden in calm mode */}
      {boardReady && !calmMode && (
        <DrawerTray
          pieces={trayPieces}
          boardImage={boardReady.boardImage}
          boardW={boardReady.boardW}
          boardH={boardReady.boardH}
          onPieceLift={onPieceLiftFromDrawer}
          onPieceTap={onPieceTap}
          isDragging={isDragging}
          showGuide={showGuide}
          onToggleGuide={handleToggleGuide}
        />
      )}

      {/* Confetti celebration overlay */}
      {showCelebration && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 70,
            overflow: 'hidden',
            pointerEvents: 'none',
            animation: 'celebrationBg 4.5s ease-out forwards',
          }}
        >
          <style>{`
            @keyframes celebrationBg {
              0%   { background: rgba(0,0,0,0); }
              10%  { background: rgba(0,0,0,0.3); }
              80%  { background: rgba(0,0,0,0.3); }
              100% { background: rgba(0,0,0,0); }
            }
            @keyframes confettiFall {
              0%   { top: -20px; opacity: 1; transform: rotate(0deg) translateX(0); }
              50%  { opacity: 1; }
              100% { top: 110vh; opacity: 0; transform: rotate(720deg) translateX(var(--drift)); }
            }
            @keyframes celebrationTextAnim {
              0%   { opacity: 0; transform: scale(0.8); }
              15%  { opacity: 1; transform: scale(1); }
              75%  { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(1.05); }
            }
          `}</style>
          {/* Confetti particles */}
          {Array.from({ length: 60 }, (_, i) => {
            const colors = ['#f94144','#f3722c','#f8961e','#f9c74f','#90be6d','#43aa8b','#577590','#a855f7','#ec4899','#06b6d4'];
            const x = Math.sin(i * 1.618 * Math.PI) * 50 + 50;
            const delay = (i * 0.033) % 2;
            const duration = 2 + (i % 5) * 0.5;
            const size = 6 + (i % 4) * 3;
            const drift = ((i % 7) - 3) * 12;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: -20,
                  width: size,
                  height: size * 0.6,
                  backgroundColor: colors[i % colors.length],
                  borderRadius: i % 2 === 0 ? '50%' : 2,
                  animation: `confettiFall ${duration}s ${delay}s linear forwards`,
                  '--drift': `${drift}px`,
                } as React.CSSProperties}
              />
            );
          })}
          {/* Centered text */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'celebrationTextAnim 4.5s ease-out forwards',
            }}
          >
            <h1 style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              color: '#fff',
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}>
              Grattis!
            </h1>
            <p style={{
              fontSize: '1.25rem',
              color: '#fff',
              textShadow: '0 1px 10px rgba(0,0,0,0.4)',
              marginTop: 8,
            }}>
              Pusslet är klart
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
