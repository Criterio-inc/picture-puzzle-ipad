import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PuzzlePiece, splitImage, trySnap, serializePieces, deserializePieces } from "@/lib/puzzle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PuzzleHeader from "@/components/puzzle/PuzzleHeader";
import PuzzleBoard from "@/components/puzzle/PuzzleBoard";
import PieceTray from "@/components/puzzle/PieceTray";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

const COLS = 8;
const ROWS = 8;

const PuzzleGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [trayPieces, setTrayPieces] = useState<PuzzlePiece[]>([]);
  const [boardPieces, setBoardPieces] = useState<PuzzlePiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [trayExpanded, setTrayExpanded] = useState(false);
  const [gameId, setGameId] = useState<string | null>(searchParams.get("id"));
  const [saving, setSaving] = useState(false);
  const allPiecesRef = useRef<PuzzlePiece[]>([]);
  const imageDataRef = useRef<string>("");

  useEffect(() => {
    const loadGame = async () => {
      // Check if resuming a saved game
      if (gameId && user) {
        const { data } = await supabase
          .from("puzzle_games")
          .select("*")
          .eq("id", gameId)
          .single();

        if (data) {
          imageDataRef.current = data.image_url;
          // Re-split the image to get imageDataUrls
          const allPieces = await splitImageDeterministic(data.image_url, COLS, ROWS, data.pieces_data as any);
          allPiecesRef.current = allPieces;

          const savedBoard = data.board_pieces as any[];
          const savedTray = data.tray_pieces as any[];

          setBoardPieces(deserializePieces(savedBoard, allPieces));
          setTrayPieces(deserializePieces(savedTray, allPieces));
          setLoading(false);
          return;
        }
      }

      // New game
      const imageData = sessionStorage.getItem("puzzleImage");
      if (!imageData) {
        navigate("/");
        return;
      }
      imageDataRef.current = imageData;

      splitImage(imageData, COLS, ROWS).then((pieces) => {
        allPiecesRef.current = pieces;
        setTrayPieces(pieces);
        setLoading(false);
      }).catch(() => {
        toast.error("Kunde inte skapa pussel");
        navigate("/");
      });
    };

    loadGame();
  }, [navigate, gameId, user]);

  // Re-split with same tab config for saved games
  async function splitImageDeterministic(
    imageDataUrl: string,
    cols: number,
    rows: number,
    piecesData: { tabsH: number[][]; tabsV: number[][] }
  ): Promise<PuzzlePiece[]> {
    // For saved games we just re-split normally - the pieces_data stores which pieces
    // are where, and the image splitting is deterministic per image
    return splitImage(imageDataUrl, cols, rows);
  }

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

    const placed = toMove.map((p) => ({
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
    // Count pieces per group
    const groupCounts = new Map<number, number>();
    for (const p of boardPieces) {
      groupCounts.set(p.groupId, (groupCounts.get(p.groupId) || 0) + 1);
    }

    // Only return solo pieces (group size = 1)
    const solos = boardPieces.filter((p) => groupCounts.get(p.groupId) === 1);
    const kept = boardPieces.filter((p) => groupCounts.get(p.groupId)! > 1);

    if (solos.length === 0) {
      toast.info("Inga singelbitar att rensa");
      return;
    }

    const returned = solos.map((p) => ({ ...p, x: null, y: null, selected: false, groupId: p.id }));
    setTrayPieces((prev) => [...prev, ...returned]);
    setBoardPieces(kept);
    toast.info(`${solos.length} singelbitar flyttade till lådan`);
  }, [boardPieces]);

  const giveUp = useCallback(() => {
    sessionStorage.removeItem("puzzleImage");
    navigate("/");
  }, [navigate]);

  const updateGroupPosition = useCallback((groupId: number, dx: number, dy: number) => {
    setBoardPieces((prev) =>
      prev.map((p) =>
        p.groupId === groupId && p.x !== null && p.y !== null
          ? { ...p, x: p.x + dx, y: p.y + dy }
          : p
      )
    );
  }, []);

  const handlePieceDrop = useCallback((_id: number) => {
    setBoardPieces((prev) => {
      const snapped = trySnap(prev);
      const groups = new Set(snapped.map((p) => p.groupId));
      if (groups.size === 1 && snapped.length === COLS * ROWS) {
        setTimeout(() => toast.success("🎉 Pusslet är klart!"), 300);
      }
      return snapped;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    const boardData = serializePieces(boardPieces) as unknown as Json;
    const trayData = serializePieces(trayPieces) as unknown as Json;

    try {
      if (gameId) {
        await supabase
          .from("puzzle_games")
          .update({
            board_pieces: boardData,
            tray_pieces: trayData,
          })
          .eq("id", gameId);
      } else {
        const { data } = await supabase
          .from("puzzle_games")
          .insert({
            user_id: user.id,
            image_url: imageDataRef.current,
            board_pieces: boardData,
            tray_pieces: trayData,
            cols: COLS,
            rows: ROWS,
          })
          .select("id")
          .single();

        if (data) setGameId(data.id);
      }
      toast.success("Spelet sparat!");
    } catch {
      toast.error("Kunde inte spara");
    }
    setSaving(false);
  }, [user, boardPieces, trayPieces, gameId]);

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
        onSave={handleSave}
        saving={saving}
      />
      <PuzzleBoard
        pieces={boardPieces}
        onUpdateGroupPosition={updateGroupPosition}
        onPieceDrop={handlePieceDrop}
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
