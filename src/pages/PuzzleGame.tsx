import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PuzzlePiece, splitImage, trySnap, trySnapToGuide, getGuideRect, serializePieces, deserializePieces, placeAroundPuzzle, EnhancedTabsConfig } from "@/lib/puzzle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PuzzleHeader from "@/components/puzzle/PuzzleHeader";
import PuzzleBoard from "@/components/puzzle/PuzzleBoard";
import PieceTray from "@/components/puzzle/PieceTray";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

const PuzzleGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [COLS, setCOLS] = useState(Number(searchParams.get("cols")) || 24);
  const [ROWS, setROWS] = useState(Number(searchParams.get("rows")) || 24);
  const [trayPieces, setTrayPieces] = useState<PuzzlePiece[]>([]);
  const [boardPieces, setBoardPieces] = useState<PuzzlePiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [trayExpanded, setTrayExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [gameId, setGameId] = useState<string | null>(searchParams.get("id"));
  const allPiecesRef = useRef<PuzzlePiece[]>([]);
  const imageDataRef = useRef<string>("");
  const tabsConfigRef = useRef<EnhancedTabsConfig | null>(null);
  const savingRef = useRef(false);
  const boardPiecesRef = useRef<PuzzlePiece[]>([]);
  const trayPiecesRef = useRef<PuzzlePiece[]>([]);
  const gameIdRef = useRef<string | null>(gameId);
  const loadedRef = useRef(false);
  // Keep refs in sync
  useEffect(() => { boardPiecesRef.current = boardPieces; }, [boardPieces]);
  useEffect(() => { trayPiecesRef.current = trayPieces; }, [trayPieces]);
  useEffect(() => { gameIdRef.current = gameId; }, [gameId]);

  const autoSave = useCallback(async () => {
    if (!user) {
      console.warn("Cannot save: User not logged in");
      return;
    }

    if (savingRef.current) {
      console.warn("Already saving, skipping duplicate save");
      return;
    }

    savingRef.current = true;

    const boardData = serializePieces(boardPiecesRef.current) as unknown as Json;
    const trayData = serializePieces(trayPiecesRef.current) as unknown as Json;
    const tabsData = tabsConfigRef.current as unknown as Json;

    try {
      if (gameIdRef.current) {
        console.log("Saving game:", gameIdRef.current);
        const { error } = await supabase
          .from("puzzle_games")
          .update({
            board_pieces: boardData,
            tray_pieces: trayData,
            pieces_data: tabsData,
            updated_at: new Date().toISOString()
          })
          .eq("id", gameIdRef.current);

        if (error) {
          console.error("Failed to save game:", error);
        } else {
          console.log("Game saved successfully");
        }
      } else {
        console.log("Creating new game");
        const { data, error } = await supabase
          .from("puzzle_games")
          .insert({
            user_id: user.id,
            image_url: imageDataRef.current,
            board_pieces: boardData,
            tray_pieces: trayData,
            pieces_data: tabsData,
            cols: COLS,
            rows: ROWS,
          })
          .select("id")
          .single();

        if (error) {
          console.error("Failed to create game:", error);
        } else if (data) {
          console.log("Game created:", data.id);
          setGameId(data.id);
          gameIdRef.current = data.id;
        }
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      savingRef.current = false;
    }
  }, [user, COLS, ROWS]);

  // Auto-save on page hide / unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        autoSave();
      }
    };
    const handleBeforeUnload = () => {
      autoSave();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [autoSave]);

  const handleBack = useCallback(async () => {
    await autoSave();
    navigate("/");
  }, [autoSave, navigate]);

  useEffect(() => {
    if (loadedRef.current) return;
    const loadGame = async () => {
      if (gameId && user) {
        const { data } = await supabase
          .from("puzzle_games")
          .select("*")
          .eq("id", gameId)
          .maybeSingle();

        if (data) {
          loadedRef.current = true;
          imageDataRef.current = data.image_url;
          const gameCols = data.cols || COLS;
          const gameRows = data.rows || ROWS;
          setCOLS(gameCols);
          setROWS(gameRows);
          const savedTabsConfig = data.pieces_data as unknown as EnhancedTabsConfig | null;

          const result = await splitImage(data.image_url, gameCols, gameRows, savedTabsConfig || undefined);
          allPiecesRef.current = result.pieces;
          tabsConfigRef.current = result.tabs;

          const savedBoard = data.board_pieces as any[];
          const savedTray = data.tray_pieces as any[];

          setBoardPieces(deserializePieces(savedBoard, result.pieces));
          setTrayPieces(deserializePieces(savedTray, result.pieces));
          setLoading(false);
          return;
        }
      }

      const imageData = sessionStorage.getItem("puzzleImage");
      if (!imageData) {
        navigate("/");
        return;
      }
      imageDataRef.current = imageData;
      loadedRef.current = true;

      splitImage(imageData, COLS, ROWS).then((result) => {
        allPiecesRef.current = result.pieces;
        tabsConfigRef.current = result.tabs;
        setTrayPieces(result.pieces);
        setLoading(false);
      }).catch(() => {
        toast.error("Kunde inte skapa pussel");
        navigate("/");
      });
    };

    loadGame();
  }, [navigate, gameId, user]);

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

    // Use smart placement instead of random
    setBoardPieces((prev) => {
      const placed = placeAroundPuzzle(toMove, prev, COLS, ROWS);
      return [...prev, ...placed];
    });

    setTrayPieces(remaining);
    setSelectedIds(new Set());
    toast.success(`${toMove.length} bitar skickade till bordet`);
  }, [selectedIds, trayPieces, COLS, ROWS]);

  const clearStrayPieces = useCallback(() => {
    const groupCounts = new Map<number, number>();
    for (const p of boardPieces) {
      groupCounts.set(p.groupId, (groupCounts.get(p.groupId) || 0) + 1);
    }
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
    setBoardPieces((prev) => {
      const groupLocked = prev.some((p) => p.groupId === groupId && p.locked);
      if (groupLocked) return prev;
      return prev.map((p) =>
        p.groupId === groupId && p.x !== null && p.y !== null
          ? { ...p, x: p.x + dx, y: p.y + dy }
          : p
      );
    });
  }, []);

  const [snappedGroupId, setSnappedGroupId] = useState<number | null>(null);

  const handlePieceDrop = useCallback((_id: number) => {
    setBoardPieces((prev) => {
      const snapResult = trySnap(prev);
      const guideResult = trySnapToGuide(snapResult.pieces, COLS, ROWS);

      if (snapResult.snapped || guideResult.snapped) {
        const gid = guideResult.snappedGroupId ?? snapResult.snappedGroupId;
        setSnappedGroupId(gid);
        setTimeout(() => setSnappedGroupId(null), 600);
        toast.success("Klick! ✨", { duration: 1000 });
      }

      const groups = new Set(guideResult.pieces.map((p) => p.groupId));
      if (groups.size === 1 && guideResult.pieces.length === COLS * ROWS) {
        setTimeout(() => toast.success("🎉 Pusslet är klart!"), 300);
      }
      return guideResult.pieces;
    });
  }, [COLS, ROWS]);

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
        onBack={handleBack}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(!showPreview)}
        showGuide={showGuide}
        onToggleGuide={() => setShowGuide(!showGuide)}
      />
      <PuzzleBoard
        pieces={boardPieces}
        onUpdateGroupPosition={updateGroupPosition}
        onPieceDrop={handlePieceDrop}
        cols={COLS}
        rows={ROWS}
        guideRect={getGuideRect(allPiecesRef.current, COLS, ROWS)}
        snappedGroupId={snappedGroupId}
        showPreview={showPreview}
        showGuide={showGuide}
        imageUrl={imageDataRef.current}
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
