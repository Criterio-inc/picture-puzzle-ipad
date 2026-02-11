import { useRef, useCallback, useState } from "react";
import { PuzzlePiece } from "@/lib/puzzle";

interface PuzzleBoardProps {
  pieces: PuzzlePiece[];
  onUpdateGroupPosition: (groupId: number, dx: number, dy: number) => void;
  onPieceDrop: (id: number) => void;
  cols: number;
  rows: number;
}

const PuzzleBoard = ({ pieces, onUpdateGroupPosition, onPieceDrop }: PuzzleBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<number | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent, piece: PuzzlePiece) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (piece.x === null || piece.y === null) return;

    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setDraggingId(piece.id);
    setDraggingGroupId(piece.groupId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingGroupId === null) return;
    e.preventDefault();

    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    onUpdateGroupPosition(draggingGroupId, dx, dy);
  }, [draggingGroupId, onUpdateGroupPosition]);

  const handlePointerUp = useCallback(() => {
    if (draggingId !== null) {
      onPieceDrop(draggingId);
    }
    setDraggingId(null);
    setDraggingGroupId(null);
  }, [draggingId, onPieceDrop]);

  return (
    <div
      ref={boardRef}
      className="relative flex-1 overflow-hidden bg-board border-b border-board-border touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {pieces.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Skicka bitar från lådan till bordet</p>
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
  );
};

export default PuzzleBoard;
