/**
 * DrawerTray — bottom-sliding piece tray.
 *
 * Rests at the bottom of the screen showing an 80px "peek" handle bar.
 * Drag the handle upward to reveal the full piece grid (≈52% of screen height).
 *
 * Pieces can be:
 *  - Tapped / dragged upward to lift onto the board (calls onPieceLift)
 *  - Sorted by color hue (toggleable)
 *
 * The drawer uses only CSS transform for animation so it stays GPU-composited
 * and never drops frames.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { PieceDef, buildPiecePath, KNOB_SCALE } from './generator';
import { drawPiece } from './renderer';
import { clearHueCache } from './colorSort';

// ─── constants ───────────────────────────────────────────────────────────────
const PEEK_HEIGHT = 80;           // px visible when closed (handle bar)
const OPEN_FRACTION = 0.52;       // fraction of screen height when open
const SNAP_THRESHOLD = 0.28;      // open if released > this far along travel
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // springy open
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';  // snappy close
const COLS = 3;
const CELL_MAX_W = 108;
const CELL_MAX_H = 108;

// ─── TrayPieceItem ────────────────────────────────────────────────────────────
const TrayPieceItem = memo(function TrayPieceItem({
  piece,
  boardImage,
  boardW,
  boardH,
  onPointerDown,
}: {
  piece: PieceDef;
  boardImage: HTMLCanvasElement;
  boardW: number;
  boardH: number;
  onPointerDown: (e: React.PointerEvent, piece: PieceDef) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const pad = Math.min(piece.width, piece.height) * KNOB_SCALE * 1.1;
    const natW = piece.width + pad * 2;
    const natH = piece.height + pad * 2;

    const scale = Math.min(1, CELL_MAX_W / natW, CELL_MAX_H / natH);
    const cssW = natW * scale;
    const cssH = natH * scale;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${Math.round(cssW)}px`;
    canvas.style.height = `${Math.round(cssH)}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, natW, natH);
    drawPiece(ctx, { ...piece, x: pad, y: pad }, boardImage, boardW, boardH);
  }, [piece, boardImage, boardW, boardH]);

  return (
    <div
      className="flex items-center justify-center select-none"
      style={{ touchAction: 'pan-y', padding: '4px', cursor: 'grab' }}
      onPointerDown={e => onPointerDown(e, piece)}
    >
      <canvas
        ref={ref}
        style={{ display: 'block', touchAction: 'pan-y', pointerEvents: 'none' }}
      />
    </div>
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────
export interface DrawerTrayProps {
  pieces: PieceDef[];
  boardImage: HTMLCanvasElement;
  boardW: number;
  boardH: number;
  /**
   * Called when user DRAGS a piece out of the tray (drag-lift).
   * PuzzleCanvas takes over the pointer immediately.
   */
  onPieceLift: (piece: PieceDef, clientX: number, clientY: number, pointerId: number) => void;
  /**
   * Called when user TAPS a piece (quick tap, no significant movement).
   * PuzzleCanvas places the piece freely on the board without drag.
   */
  onPieceTap: (piece: PieceDef) => void;
  /** When the parent is dragging a board piece, auto-close the drawer. */
  isDragging: boolean;
  /** Guide toggle — displayed in the handle bar */
  showGuide: boolean;
  onToggleGuide: () => void;
  /** Shuffle/restart */
  onShuffle: () => void;
}

// ─── DrawerTray ───────────────────────────────────────────────────────────────
export default function DrawerTray({
  pieces,
  boardImage,
  boardW,
  boardH,
  onPieceLift,
  onPieceTap,
  isDragging,
  showGuide,
  onToggleGuide,
  onShuffle,
}: DrawerTrayProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Gesture refs — no re-renders during drag
  const gestureDragging = useRef(false);
  const gestureStartY = useRef(0);
  const gestureStartTranslate = useRef(0);
  const currentTranslate = useRef<number | null>(null); // null = not yet computed

  // Safe-area inset (home bar on modern iPads) — updated on rotation/resize
  const safeBottom = useRef(0);
  useEffect(() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:0;pointer-events:none;visibility:hidden';
    document.body.appendChild(el);
    function update() { safeBottom.current = el.getBoundingClientRect().height; }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      document.body.removeChild(el);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  function getDrawerH(): number {
    return drawerRef.current?.getBoundingClientRect().height ?? window.innerHeight * OPEN_FRACTION;
  }

  function closedTranslate(): number {
    return getDrawerH() - PEEK_HEIGHT - safeBottom.current;
  }

  // Init position
  useEffect(() => {
    const t = closedTranslate();
    currentTranslate.current = t;
    if (drawerRef.current) {
      drawerRef.current.style.transition = 'none';
      drawerRef.current.style.transform = `translateY(${t}px)`;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-close when a board-piece drag is in progress
  useEffect(() => {
    if (isDragging) snapClosed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  // Clear color cache when puzzle is reset (pieces array length changes)
  useEffect(() => {
    clearHueCache();
  }, [boardImage]);

  // ─── Snap helpers ─────────────────────────────────────────────────────────
  function snapOpen() {
    currentTranslate.current = 0;
    if (drawerRef.current) {
      drawerRef.current.style.transition = `transform 0.40s ${SPRING}`;
      drawerRef.current.style.transform = `translateY(0px)`;
    }
    setIsOpen(true);
  }

  function snapClosed() {
    const t = closedTranslate();
    currentTranslate.current = t;
    if (drawerRef.current) {
      drawerRef.current.style.transition = `transform 0.28s ${EASE_OUT}`;
      drawerRef.current.style.transform = `translateY(${t}px)`;
    }
    setIsOpen(false);
  }

  // ─── Handle bar gesture ───────────────────────────────────────────────────
  function onHandlePointerDown(e: React.PointerEvent) {
    // Don't start handle drag while a piece is being dragged on the board
    if (isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    gestureDragging.current = true;
    gestureStartY.current = e.clientY;
    gestureStartTranslate.current = currentTranslate.current ?? closedTranslate();

    // Disable CSS transition during live gesture
    if (drawerRef.current) drawerRef.current.style.transition = 'none';

    // Pointer capture routes all subsequent events to this element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!gestureDragging.current) return;
    const dy = e.clientY - gestureStartY.current;
    const maxT = closedTranslate();
    const newT = Math.max(0, Math.min(maxT, gestureStartTranslate.current + dy));
    currentTranslate.current = newT;
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${newT}px)`;
    }
  }

  function onHandlePointerUp() {
    if (!gestureDragging.current) return;
    gestureDragging.current = false;
    const maxT = closedTranslate();
    const t = currentTranslate.current ?? maxT;
    // How far along the open travel are we? 0 = closed, 1 = fully open
    const progress = maxT > 0 ? 1 - t / maxT : 0;
    if (progress > SNAP_THRESHOLD) {
      snapOpen();
    } else {
      snapClosed();
    }
  }

  // ─── Piece interaction: tap = stage on board, drag = lift & follow finger ──
  function onTrayPiecePointerDown(e: React.PointerEvent, piece: PieceDef) {
    // No preventDefault, no setPointerCapture yet — let browser see if it's a scroll.
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startTime = Date.now();
    const pid = e.pointerId;
    const target = e.currentTarget as HTMLElement;
    const DRAG_THRESHOLD = 10;   // px total movement → piece drag
    const SCROLL_BIAS = 1.5;     // vertical must be > SCROLL_BIAS × horizontal to scroll
    const TAP_TIME = 280;        // ms — quick release = tap

    let decided = false;

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pid || decided) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) return; // too small to decide yet

      if (absDy > absDx * SCROLL_BIAS) {
        // Clearly scrolling down — abandon, let native scroll work
        decided = true;
        cleanup();
        return;
      }

      if (dist > DRAG_THRESHOLD) {
        // Horizontal/diagonal move → piece drag
        decided = true;
        ev.preventDefault();
        // Only now capture the pointer so we own all future move/up events
        target.setPointerCapture(pid);
        snapClosed();
        onPieceLift(piece, ev.clientX, ev.clientY, pid);
        cleanup();
      }
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pid) return;
      if (!decided) {
        const elapsed = Date.now() - startTime;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DRAG_THRESHOLD || elapsed < TAP_TIME) {
          onPieceTap(piece);
        }
      }
      cleanup();
    }

    function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    // Listen on window so we get events even if finger slides off the cell
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // Pieces are always shown in their original (shuffled) order — never sorted
  const displayPieces = pieces;

  const drawerHeightPx = Math.round(window.innerHeight * OPEN_FRACTION);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={drawerRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${drawerHeightPx}px`,
        // Initial transform set by effect; fallback here in case effect hasn't run yet
        transform: `translateY(${drawerHeightPx - PEEK_HEIGHT}px)`,
        zIndex: 50,
        borderRadius: '18px 18px 0 0',
        background: 'rgba(252, 247, 240, 0.97)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 -4px 28px rgba(0,0,0,0.16), 0 -1px 0 rgba(150,120,80,0.14)',
        display: 'flex',
        flexDirection: 'column',
        willChange: 'transform',
        // Only block touch on the handle; piece grid uses pan-y for native scroll
        touchAction: 'pan-x',
      }}
    >
      {/* ── Handle bar ── */}
      <div
        style={{
          height: `${PEEK_HEIGHT}px`,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: isOpen ? 'row-resize' : 'n-resize',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        {/* Drag pill */}
        <div
          style={{
            width: 44,
            height: 5,
            borderRadius: 3,
            background: 'rgba(100,75,45,0.25)',
            flexShrink: 0,
          }}
        />

        {/* Controls row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Piece count badge */}
          <div
            style={{
              background: 'rgba(140,105,55,0.12)',
              borderRadius: 999,
              padding: '3px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#7a5c38',
            }}
          >
            {pieces.length} bitar kvar
          </div>

          {/* Guide toggle */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={onToggleGuide}
            style={controlBtnStyle(showGuide)}
          >
            {showGuide ? '🗺 Guide på' : '🗺 Guide'}
          </button>

          {/* Shuffle */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={onShuffle}
            style={controlBtnStyle(false)}
          >
            🔄 Ny
          </button>
        </div>
      </div>

      {/* ── Piece grid ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          touchAction: 'pan-y', // allow native scroll between pieces
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {displayPieces.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#a08060',
              fontSize: 14,
              fontWeight: 500,
              padding: 24,
              textAlign: 'center',
            }}
          >
            🎉 Alla bitar är placerade på brädet!
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              padding: `6px 8px calc(20px + env(safe-area-inset-bottom, 0px))`,
              gap: 4,
            }}
          >
            {displayPieces.map(piece => (
              <TrayPieceItem
                key={piece.id}
                piece={piece}
                boardImage={boardImage}
                boardW={boardW}
                boardH={boardH}
                onPointerDown={onTrayPiecePointerDown}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function controlBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 500,
    color: active ? '#7a3f10' : '#9a7a50',
    background: active ? 'rgba(140,80,30,0.12)' : 'none',
    border: 'none',
    borderRadius: 999,
    padding: '4px 10px',
    cursor: 'pointer',
    touchAction: 'none',
    transition: 'background 0.15s',
  };
}

/** Height of the closed peek handle bar, exported for board padding calculation. */
export { PEEK_HEIGHT as DRAWER_PEEK_HEIGHT };
