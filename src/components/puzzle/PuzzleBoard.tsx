import { useRef, useCallback, useState } from "react";
import { PuzzlePiece } from "@/lib/puzzle";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface GuideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PuzzleBoardProps {
  pieces: PuzzlePiece[];
  onUpdateGroupPosition: (groupId: number, dx: number, dy: number) => void;
  onPieceDrop: (id: number) => void;
  cols: number;
  rows: number;
  guideRect: GuideRect | null;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2;

const PuzzleBoard = ({ pieces, onUpdateGroupPosition, onPieceDrop, guideRect }: PuzzleBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<number | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Zoom & pan state
  const [zoom, setZoom] = useState(0.4);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, piece: PuzzlePiece) => {
    e.stopPropagation();
    if (piece.locked) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (piece.x === null || piece.y === null) return;

    // Check if any piece in this group is locked
    const groupLocked = pieces.some((p) => p.groupId === piece.groupId && p.locked);
    if (groupLocked) return;

    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setDraggingId(piece.id);
    setDraggingGroupId(piece.groupId);
  }, [pieces]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingGroupId === null) return;
    e.preventDefault();

    const dx = (e.clientX - lastPointerRef.current.x) / zoom;
    const dy = (e.clientY - lastPointerRef.current.y) / zoom;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    onUpdateGroupPosition(draggingGroupId, dx, dy);
  }, [draggingGroupId, onUpdateGroupPosition, zoom]);

  const handlePointerUp = useCallback(() => {
    if (draggingId !== null) {
      onPieceDrop(draggingId);
    }
    setDraggingId(null);
    setDraggingGroupId(null);
    setIsPanning(false);
  }, [draggingId, onPieceDrop]);

  // Board pan (two-finger or pointer on empty area)
  const handleBoardPointerDown = useCallback((e: React.PointerEvent) => {
    if (draggingGroupId !== null) return;
    setIsPanning(true);
    lastPanRef.current = { x: e.clientX, y: e.clientY };
  }, [draggingGroupId]);

  const handleBoardPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning || draggingGroupId !== null) return;
    const dx = e.clientX - lastPanRef.current.x;
    const dy = e.clientY - lastPanRef.current.y;
    lastPanRef.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [isPanning, draggingGroupId]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)));
  }, []);

  // Touch pinch-to-zoom
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (pinchDistRef.current !== null) {
        const scale = dist / pinchDistRef.current;
        setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * scale)));
      }
      pinchDistRef.current = dist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchDistRef.current = null;
  }, []);

  const resetView = useCallback(() => {
    setZoom(0.4);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={boardRef}
      className="relative flex-1 overflow-hidden bg-board border-b border-board-border touch-none"
      onPointerDown={handleBoardPointerDown}
      onPointerMove={(e) => {
        handlePointerMove(e);
        handleBoardPointerMove(e);
      }}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-50 flex flex-col gap-1">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.3))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.7))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={resetView}
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-2 right-2 z-50 text-xs text-muted-foreground bg-background/70 px-2 py-0.5 rounded">
        {Math.round(zoom * 100)}%
      </div>

      {/* Transformed board surface */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          width: "6000px",
          height: "6000px",
        }}
      >
        {/* Guide rectangle - puzzle border */}
        {guideRect && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: guideRect.x,
              top: guideRect.y,
              width: guideRect.width,
              height: guideRect.height,
              border: "2px dashed rgba(255,255,255,0.35)",
              borderRadius: 2,
            }}
          />
        )}

        {pieces.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground" style={{ transform: `scale(${1 / zoom})` }}>
              Skicka bitar från lådan till bordet
            </p>
          </div>
        )}
        {pieces.map((piece) => {
          const isDraggingGroup = draggingGroupId !== null && piece.groupId === draggingGroupId;
          return (
            <div
              key={piece.id}
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                left: piece.x ?? 0,
                top: piece.y ?? 0,
                zIndex: isDraggingGroup ? 100 : 1,
                transition: isDraggingGroup ? "none" : "filter 0.15s",
                filter: isDraggingGroup
                  ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))"
                  : "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
              }}
              onPointerDown={(e) => handlePointerDown(e, piece)}
            >
              <img
                src={piece.imageDataUrl}
                alt=""
                className="pointer-events-none block"
                style={{ width: piece.displayWidth, height: piece.displayHeight }}
                draggable={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PuzzleBoard;
