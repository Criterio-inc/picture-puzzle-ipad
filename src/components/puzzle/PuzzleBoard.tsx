import { useRef, useCallback, useState } from "react";
import { PuzzlePiece } from "@/lib/puzzle";

interface PuzzleBoardProps {
  pieces: PuzzlePiece[];
  onUpdatePosition: (id: number, x: number, y: number) => void;
  cols: number;
  rows: number;
}

const PuzzleBoard = ({ pieces, onUpdatePosition }: PuzzleBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent, piece: PuzzlePiece) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || piece.x === null || piece.y === null) return;

    offsetRef.current = {
      x: touch.clientX - (rect.left + piece.x),
      y: touch.clientY - (rect.top + piece.y),
    };
    setDraggingId(piece.id);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (draggingId === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left - offsetRef.current.x;
    const y = touch.clientY - rect.top - offsetRef.current.y;
    onUpdatePosition(draggingId, Math.max(0, x), Math.max(0, y));
  }, [draggingId, onUpdatePosition]);

  const handleTouchEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  // Mouse support for desktop testing
  const handleMouseDown = useCallback((e: React.MouseEvent, piece: PuzzlePiece) => {
    e.stopPropagation();
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || piece.x === null || piece.y === null) return;

    offsetRef.current = {
      x: e.clientX - (rect.left + piece.x),
      y: e.clientY - (rect.top + piece.y),
    };
    setDraggingId(piece.id);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingId === null) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left - offsetRef.current.x;
    const y = e.clientY - rect.top - offsetRef.current.y;
    onUpdatePosition(draggingId, Math.max(0, x), Math.max(0, y));
  }, [draggingId, onUpdatePosition]);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  return (
    <div
      ref={boardRef}
      className="relative flex-1 overflow-hidden bg-board border-b border-board-border"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {pieces.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Skicka bitar från lådan till bordet</p>
        </div>
      )}
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: piece.x ?? 0,
            top: piece.y ?? 0,
            zIndex: draggingId === piece.id ? 100 : 1,
            transition: draggingId === piece.id ? "none" : "box-shadow 0.15s",
            boxShadow: draggingId === piece.id ? "0 4px 20px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.1)",
          }}
          onTouchStart={(e) => handleTouchStart(e, piece)}
          onMouseDown={(e) => handleMouseDown(e, piece)}
        >
          <img
            src={piece.imageDataUrl}
            alt=""
            className="pointer-events-none block"
            style={{ width: piece.width / 3, height: piece.height / 3 }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
};

export default PuzzleBoard;
