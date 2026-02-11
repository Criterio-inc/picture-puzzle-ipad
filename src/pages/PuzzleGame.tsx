import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PuzzlePiece, splitImage } from "@/lib/puzzle";
import PuzzleHeader from "@/components/puzzle/PuzzleHeader";
import PuzzleBoard from "@/components/puzzle/PuzzleBoard";
import PieceTray from "@/components/puzzle/PieceTray";
import { toast } from "sonner";

const COLS = 24;
const ROWS = 24;

const PuzzleGame = () => {
  const navigate = useNavigate();
  const [trayPieces, setTrayPieces] = useState<PuzzlePiece[]>([]);
  const [boardPieces, setBoardPieces] = useState<PuzzlePiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [trayExpanded, setTrayExpanded] = useState(false);
  const originalImageRef = useRef<string>("");

  useEffect(() => {
    const imageData = sessionStorage.getItem("puzzleImage");
    if (!imageData) {
      navigate("/");
      return;
    }
    originalImageRef.current = imageData;

    splitImage(imageData, COLS, ROWS).then((pieces) => {
      setTrayPieces(pieces);
      setLoading(false);
    }).catch(() => {
      toast.error("Kunde inte skapa pussel");
      navigate("/");
    });
  }, [navigate]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sendToBoard = useCallback(() => {
    if (selectedIds.size === 0) return;

    const toMove = trayPieces.filter((p) => selectedIds.has(p.id));
    const remaining = trayPieces.filter((p) => !selectedIds.has(p.id));

    // Place pieces randomly on the board
    const placed = toMove.map((p, i) => ({
      ...p,
      selected: false,
      x: 50 + Math.random() * 300,
      y: 50 + Math.random() * 300,
    }));

    setTrayPieces(remaining);
    setBoardPieces((prev) => [...prev, ...placed]);
    setSelectedIds(new Set());
    toast.success(`${toMove.length} bitar skickade till bordet`);
  }, [selectedIds, trayPieces]);

  const clearStrayPieces = useCallback(() => {
    // Move unconnected pieces back to tray
    const returned = boardPieces.map((p) => ({ ...p, x: null, y: null, selected: false }));
    setTrayPieces((prev) => [...prev, ...returned]);
    setBoardPieces([]);
    toast.info("Alla bitar flyttade tillbaka till lådan");
  }, [boardPieces]);

  const giveUp = useCallback(() => {
    sessionStorage.removeItem("puzzleImage");
    navigate("/");
  }, [navigate]);

  const updatePiecePosition = useCallback((id: number, x: number, y: number) => {
    setBoardPieces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x, y } : p))
    );
  }, []);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Skapar pussel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <PuzzleHeader
        totalPieces={COLS * ROWS}
        boardCount={boardPieces.length}
        trayCount={trayPieces.length}
        onClearStray={clearStrayPieces}
        onGiveUp={giveUp}
      />
      <PuzzleBoard
        pieces={boardPieces}
        onUpdatePosition={updatePiecePosition}
        cols={COLS}
        rows={ROWS}
      />
      <PieceTray
        pieces={trayPieces}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onSendToBoard={sendToBoard}
        expanded={trayExpanded}
        onToggleExpand={() => setTrayExpanded(!trayExpanded)}
      />
    </div>
  );
};

export default PuzzleGame;
