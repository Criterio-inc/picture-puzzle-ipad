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
const SNAP_FRACTION = 0.22;
const BOARD_PAD_TOP = 6;
const BOARD_PAD_SIDE = 6;
const BOARD_PAD_BOTTOM = DRAWER_PEEK_HEIGHT + 4;

interface Props {
  image: HTMLImageElement;
  cols: number;
  rows: number;
  seed: number;
  loadedPiecesState?: SavedPieceState[];
  loadedTrayIds?: string[];
  onComplete?: () => void;
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
}

interface BoardState {
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  boardImage: HTMLCanvasElement;
  pieces: PieceDef[];
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
  const [isDragging, setIsDragging] = useState(false);
  const [, tick] = useState(0);

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

    const state: BoardState = { boardX, boardY, boardW, boardH, boardImage: off, pieces: layout.pieces };
    boardRef.current = state;
    setBoardReady(state);

    // Determine tray pieces
    let trayPieceList: PieceDef[];
    if (isRestoring) {
      trayPieceList = layout.pieces.filter(p => savedTraySet.has(p.id));
    } else {
      trayPieceList = [...layout.pieces];
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
      const glowId = snapGlowRef.current && now < snapGlowRef.current.until
        ? snapGlowRef.current.id
        : null;

      // Background
      ctx.clearRect(0, 0, cw, ch);
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, '#f0e6d4');
      grad.addColorStop(1, '#dfd0b4');
      ctx.fillStyle = grad;
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
          ctx.stroke(buildPiecePath(p, KNOB_SCALE));
          ctx.restore();
        }
      }

      // Sorted pieces
      const sorted = [...pieces].sort((a, b) => a.zIndex - b.zIndex);

      // Placed pieces first
      for (const p of sorted) {
        if (!p.isPlaced) continue;
        drawPiece(ctx, p, boardImage, bw, bh, { snapGlow: p.id === glowId });
      }

      // Floating board pieces (not placed, not in tray, not the active drag piece)
      for (const p of sorted) {
        if (p.isPlaced) continue;
        if (trayIdsRef.current.has(p.id)) continue;
        if (dragRef.current?.piece === p) continue;
        drawPiece(ctx, p, boardImage, bw, bh, { snapGlow: p.id === glowId });
      }

      // Snap preview ghost — faint outline at target position while dragging nearby
      const preview = snapPreviewRef.current;
      if (preview && dragRef.current) {
        const dragPiece = dragRef.current.piece;
        ctx.save();
        ctx.translate(preview.x, preview.y);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke(buildPiecePath(dragPiece, KNOB_SCALE));
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Active drag piece (always topmost)
      if (dragRef.current) {
        drawPiece(ctx, dragRef.current.piece, boardImage, bw, bh, { snapGlow: false });
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

  function trySnap(piece: PieceDef): boolean {
    const board = boardRef.current;
    if (!board) return false;
    const tx = board.boardX + piece.solvedX;
    const ty = board.boardY + piece.solvedY;
    const pCX = piece.x + piece.width / 2;
    const pCY = piece.y + piece.height / 2;
    const tCX = tx + piece.width / 2;
    const tCY = ty + piece.height / 2;
    const dist = snapDist(piece);
    const dx = pCX - tCX;
    const dy = pCY - tCY;
    if (Math.sqrt(dx * dx + dy * dy) < dist) {
      piece.x = tx;
      piece.y = ty;
      piece.isPlaced = true;
      piece.isSelected = false;
      piece.zIndex = -1;
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

  function updateSnapPreview(piece: PieceDef) {
    const board = boardRef.current;
    if (!board) { snapPreviewRef.current = null; return; }
    const tx = board.boardX + piece.solvedX;
    const ty = board.boardY + piece.solvedY;
    const pCX = piece.x + piece.width / 2;
    const pCY = piece.y + piece.height / 2;
    const tCX = tx + piece.width / 2;
    const tCY = ty + piece.height / 2;
    const dx = pCX - tCX;
    const dy = pCY - tCY;
    if (Math.sqrt(dx * dx + dy * dy) < snapDist(piece) * 2) {
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
    dragRef.current.piece.x = dragRef.current.pieceStartX + dx;
    dragRef.current.piece.y = dragRef.current.pieceStartY + dy;
    updateSnapPreview(dragRef.current.piece);
  }

  function handlePointerUp(pointerId: number) {
    if (!dragRef.current || dragRef.current.pointerId !== pointerId) return;
    const { piece, fromTray } = dragRef.current;
    piece.isSelected = false;
    snapPreviewRef.current = null;

    const inDrawerZone = lastPointerYRef.current > window.innerHeight - DRAWER_PEEK_HEIGHT - 10;

    const snapped = trySnap(piece);
    if (snapped) {
      setTray(prev => prev.filter(p => p.id !== piece.id));
    } else if (inDrawerZone) {
      piece.isPlaced = false;
      setTray(prev => prev.some(p => p.id === piece.id) ? prev : [...prev, piece]);
    } else if (fromTray) {
      piece.isPlaced = false;
    } else {
      piece.isPlaced = false;
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
    hit.zIndex = maxZ + 1;
    hit.isSelected = true;

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

      {/* HUD */}
      <PuzzleHUD placedCount={placedCount} total={total} />

      {/* Drawer tray */}
      {boardReady && (
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
          onShuffle={handleShuffle}
        />
      )}

      {/* Completion overlay */}
      {isComplete && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 70,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              padding: '36px 32px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
              maxWidth: 320,
            }}
          >
            <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#3d2e1a', marginBottom: 8 }}>
              Klart!
            </h2>
            <p style={{ color: '#9a8470', marginBottom: 28 }}>
              Du löste pusslet!
            </p>
            <button
              onClick={handleShuffle}
              style={{
                background: '#92400e',
                color: '#fff',
                borderRadius: 999,
                padding: '12px 36px',
                fontSize: 15,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Spela igen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
