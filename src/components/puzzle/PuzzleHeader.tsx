import { Button } from "@/components/ui/button";
import { ArrowLeft, Eraser, Flag, Image, Eye, EyeOff } from "lucide-react";

interface PuzzleHeaderProps {
  totalPieces: number;
  boardCount: number;
  trayCount: number;
  onClearStray: () => void;
  onGiveUp: () => void;
  onBack: () => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  showGuide?: boolean;
  onToggleGuide?: () => void;
}

const PuzzleHeader = ({
  totalPieces,
  boardCount,
  trayCount,
  onClearStray,
  onGiveUp,
  onBack,
  showPreview = false,
  onTogglePreview,
  showGuide = true,
  onToggleGuide,
}: PuzzleHeaderProps) => {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card/90 backdrop-blur-sm px-3 py-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{boardCount}</span>
          <span>på bordet</span>
          <span className="mx-1">·</span>
          <span className="font-medium text-foreground">{trayCount}</span>
          <span>i lådan</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onTogglePreview && (
          <Button
            variant={showPreview ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onTogglePreview}
            title="Visa originalbild"
          >
            <Image className="h-3.5 w-3.5" />
            Förhandsvisa
          </Button>
        )}
        {onToggleGuide && (
          <Button
            variant={showGuide ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onToggleGuide}
            title="Visa/dölj pusselguide"
          >
            {showGuide ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Guide
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onClearStray}
        >
          <Eraser className="h-3.5 w-3.5" />
          Rensa bitar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-destructive"
          onClick={onGiveUp}
        >
          <Flag className="h-3.5 w-3.5" />
          Ge upp
        </Button>
      </div>
    </header>
  );
};

export default PuzzleHeader;
