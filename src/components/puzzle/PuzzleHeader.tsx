import { Button } from "@/components/ui/button";
import { ArrowLeft, Eraser, Flag } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PuzzleHeaderProps {
  totalPieces: number;
  boardCount: number;
  trayCount: number;
  onClearStray: () => void;
  onGiveUp: () => void;
}

const PuzzleHeader = ({ totalPieces, boardCount, trayCount, onClearStray, onGiveUp }: PuzzleHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
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
