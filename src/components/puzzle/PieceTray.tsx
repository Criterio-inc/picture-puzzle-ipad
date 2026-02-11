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
        expanded ? "h-[55dvh]" : "h-[140px]"
      }`}
    >
      {/* Handle bar */}
      <button
        onClick={onToggleExpand}
        className="flex items-center justify-center py-1.5 text-muted-foreground active:bg-muted"
      >
        {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
      </button>

      {/* Pieces grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="grid grid-cols-8 gap-1">
          {pieces.map((piece) => {
            const isSelected = selectedIds.has(piece.id);
            return (
              <button
                key={piece.id}
                className={`relative rounded-sm border-2 transition-colors ${
                  isSelected
                    ? "border-piece-selected bg-piece-hover"
                    : "border-transparent"
                }`}
                onClick={() => onToggleSelect(piece.id)}
              >
                <img
                  src={piece.imageDataUrl}
                  alt=""
                  className="block w-full"
                  draggable={false}
                />
                {isSelected && (
                  <div className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl-md bg-primary">
                    <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Send button */}
      {selectedCount > 0 && (
        <div className="px-3 pb-3">
          <Button
            className="w-full gap-2"
            onClick={onSendToBoard}
          >
            <Send className="h-4 w-4" />
            Skicka ({selectedCount})
          </Button>
        </div>
      )}
    </div>
  );
};

export default PieceTray;
