import { PuzzlePiece } from "@/lib/puzzle";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Send } from "lucide-react";

interface PieceTrayProps {
  pieces: PuzzlePiece[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onSendToBoard: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
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

  return (
    <div
      className={`flex flex-col border-t border-tray-border bg-tray transition-all duration-300 ${
        expanded ? "h-[70dvh]" : "h-[52px]"
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

      {/* Scrollable piece grid */}
      {expanded && (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="flex flex-wrap gap-1 justify-center">
            {pieces.map((piece) => {
              const isSelected = selectedIds.has(piece.id);
              // Render pieces at ~70-90px size
              const size = Math.max(piece.displayWidth * 0.55, 70);
              const h = size * (piece.displayHeight / piece.displayWidth);
              return (
                <button
                  key={piece.id}
                  className={`relative rounded-sm border-2 transition-colors shrink-0 ${
                    isSelected
                      ? "border-piece-selected bg-piece-hover"
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
