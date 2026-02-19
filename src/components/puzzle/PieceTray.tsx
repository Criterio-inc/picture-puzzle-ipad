import { PuzzlePiece } from "@/lib/puzzle";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Send, Square, Grid2x2, ArrowUpDown } from "lucide-react";
import { useState, useMemo } from "react";

interface PieceTrayProps {
  pieces: PuzzlePiece[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onSendToBoard: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

type SortMode = "default" | "edge-first" | "position";
type FilterMode = "all" | "edges" | "corners" | "inner";

function isEdgePiece(piece: PuzzlePiece, totalRows: number, totalCols: number): boolean {
  return piece.row === 0 || piece.row === totalRows - 1 || piece.col === 0 || piece.col === totalCols - 1;
}

function isCornerPiece(piece: PuzzlePiece, totalRows: number, totalCols: number): boolean {
  return (
    (piece.row === 0 && piece.col === 0) ||
    (piece.row === 0 && piece.col === totalCols - 1) ||
    (piece.row === totalRows - 1 && piece.col === 0) ||
    (piece.row === totalRows - 1 && piece.col === totalCols - 1)
  );
}

const PieceTray = ({
  pieces,
  selectedIds,
  onToggleSelect,
  onSendToBoard,
  expanded,
  onToggleExpand,
}: PieceTrayProps) => {
  const selectedCount = selectedIds.size;
  const [sortMode, setSortMode] = useState<SortMode>("default");  // Changed to "default" for random order
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  // Calculate grid dimensions from pieces
  const totalRows = useMemo(() => {
    if (pieces.length === 0) return 0;
    return Math.max(...pieces.map(p => p.row)) + 1;
  }, [pieces]);

  const totalCols = useMemo(() => {
    if (pieces.length === 0) return 0;
    return Math.max(...pieces.map(p => p.col)) + 1;
  }, [pieces]);

  // Sort and filter pieces
  const displayedPieces = useMemo(() => {
    let filtered = [...pieces];

    // Apply filter
    if (filterMode === "edges") {
      filtered = filtered.filter(p => isEdgePiece(p, totalRows, totalCols));
    } else if (filterMode === "corners") {
      filtered = filtered.filter(p => isCornerPiece(p, totalRows, totalCols));
    } else if (filterMode === "inner") {
      filtered = filtered.filter(p => !isEdgePiece(p, totalRows, totalCols));
    }

    // Apply sort
    if (sortMode === "edge-first") {
      filtered.sort((a, b) => {
        const aIsEdge = isEdgePiece(a, totalRows, totalCols);
        const bIsEdge = isEdgePiece(b, totalRows, totalCols);
        if (aIsEdge && !bIsEdge) return -1;
        if (!aIsEdge && bIsEdge) return 1;

        const aIsCorner = isCornerPiece(a, totalRows, totalCols);
        const bIsCorner = isCornerPiece(b, totalRows, totalCols);
        if (aIsCorner && !bIsCorner) return -1;
        if (!aIsCorner && bIsCorner) return 1;

        return a.id - b.id;
      });
    } else if (sortMode === "position") {
      filtered.sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
    }

    return filtered;
  }, [pieces, sortMode, filterMode, totalRows, totalCols]);

  return (
    <div
      className={`flex flex-col border-t border-tray-border bg-tray/95 backdrop-blur-sm transition-all duration-300 ${
        expanded ? "h-[60dvh]" : "h-[52px]"
      }`}
    >
      {/* Toggle bar */}
      <button
        onClick={onToggleExpand}
        className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground active:bg-muted shrink-0"
      >
        {expanded ? (
          <>
            <ChevronDown className="h-5 w-5" />
            <span>Dölj brickan</span>
          </>
        ) : (
          <>
            <ChevronUp className="h-5 w-5" />
            <span>{pieces.length} bitar kvar — dra upp</span>
          </>
        )}
      </button>

      {/* Sort and filter controls */}
      {expanded && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 border-b border-tray-border bg-tray/50 shrink-0">
          <div className="flex gap-1">
            <Button
              variant={filterMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("all")}
              className="h-7 text-xs"
            >
              Alla ({pieces.length})
            </Button>
            <Button
              variant={filterMode === "corners" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("corners")}
              className="h-7 text-xs"
            >
              <Square className="h-3 w-3 mr-1" />
              Hörn
            </Button>
            <Button
              variant={filterMode === "edges" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("edges")}
              className="h-7 text-xs"
            >
              <Grid2x2 className="h-3 w-3 mr-1" />
              Kanter
            </Button>
          </div>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortMode === "default") setSortMode("edge-first");
              else if (sortMode === "edge-first") setSortMode("position");
              else setSortMode("default");
            }}
            className="h-7 text-xs"
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {sortMode === "default" ? "Blandat" : sortMode === "edge-first" ? "Kanter först" : "Position"}
          </Button>
        </div>
      )}

      {/* Scrollable piece grid */}
      {expanded && (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {displayedPieces.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Inga bitar matchar filtret
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 justify-center">
              {displayedPieces.map((piece) => {
                const isSelected = selectedIds.has(piece.id);
                const pieceIsEdge = isEdgePiece(piece, totalRows, totalCols);
                const pieceIsCorner = isCornerPiece(piece, totalRows, totalCols);

                // Render pieces at ~70-90px size
                const size = Math.max(piece.displayWidth * 0.55, 70);
                const h = size * (piece.displayHeight / piece.displayWidth);

                return (
                  <button
                    key={piece.id}
                    className={`relative rounded-sm border-2 transition-colors shrink-0 ${
                      isSelected
                        ? "border-piece-selected bg-piece-hover"
                        : pieceIsCorner
                          ? "border-amber-400/40"
                          : pieceIsEdge
                            ? "border-blue-400/30"
                            : "border-transparent"
                    }`}
                    style={{ width: size, height: h }}
                    onClick={() => onToggleSelect(piece.id)}
                  >
                    <img
                      src={piece.imageDataUrl}
                      alt=""
                      className="block h-full w-full object-contain"
                      draggable={false}
                    />
                    {/* Corner indicator */}
                    {pieceIsCorner && !isSelected && (
                      <div className="absolute top-0 left-0 flex h-4 w-4 items-center justify-center rounded-br-md bg-amber-500/80">
                        <Square className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    {/* Edge indicator */}
                    {pieceIsEdge && !pieceIsCorner && !isSelected && (
                      <div className="absolute top-0 left-0 flex h-4 w-4 items-center justify-center rounded-br-md bg-blue-500/70">
                        <Grid2x2 className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    {/* Selection checkmark */}
                    {isSelected && (
                      <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-tl-md bg-primary">
                        <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sticky send button */}
      {expanded && selectedCount > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-tray-border shrink-0 bg-tray">
          <Button className="w-full gap-2" onClick={onSendToBoard}>
            <Send className="h-4 w-4" />
            Skicka ({selectedCount} av {pieces.length})
          </Button>
        </div>
      )}
    </div>
  );
};

export default PieceTray;
