import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Puzzle, Upload, LogOut, Image, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { InstallPrompt } from "@/components/InstallPrompt";

interface SavedGame {
  id: string;
  created_at: string;
  updated_at: string;
  image_url: string;
  completed: boolean;
  board_pieces: any[];
  tray_pieces: any[];
}

const Home = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("puzzle_games")
      .select("id, created_at, updated_at, image_url, completed, board_pieces, tray_pieces")
      .eq("completed", false)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSavedGames(data as SavedGame[]);
        setLoadingGames(false);
      });
  }, [user]);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Välj en bildfil");
      return;
    }
    setProcessing(true);
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem("puzzleImage", reader.result as string);
      navigate("/puzzle");
    };
    reader.onerror = () => {
      toast.error("Kunde inte läsa bilden");
      setProcessing(false);
    };
    reader.readAsDataURL(file);
  }, [navigate]);

  const resumeGame = (id: string, imageUrl: string) => {
    sessionStorage.setItem("puzzleImage", imageUrl);
    navigate(`/puzzle?id=${id}`);
  };

  const deleteGame = async (id: string) => {
    await supabase.from("puzzle_games").delete().eq("id", id);
    setSavedGames((prev) => prev.filter((g) => g.id !== id));
    toast.success("Spelet borttaget");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <InstallPrompt />
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Puzzle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Pussel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 p-6 overflow-y-auto">
        {/* Saved games */}
        {!loadingGames && savedGames.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Påbörjade pussel</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {savedGames.map((game) => {
                const totalPieces = (game.board_pieces?.length || 0) + (game.tray_pieces?.length || 0);
                const boardCount = game.board_pieces?.length || 0;
                return (
                  <div
                    key={game.id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <div className="aspect-square overflow-hidden bg-muted">
                      <img
                        src={game.image_url}
                        alt="Pussel"
                        className="h-full w-full object-cover opacity-60"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground">
                        {boardCount} av {totalPieces} bitar placerade
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(game.updated_at).toLocaleDateString("sv-SE")}
                      </p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/20 group-hover:opacity-100">
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => resumeGame(game.id, game.image_url)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Fortsätt
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => deleteGame(game.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* New puzzle */}
        <section className="flex flex-col items-center gap-6 py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent">
              <Image className="h-10 w-10 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Nytt pussel</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Välj en bild från ditt bildbibliotek så skapas ett pussel med ca 576 bitar
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          <Button
            size="lg"
            className="gap-2 px-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
          >
            <Upload className="h-5 w-5" />
            {processing ? "Bearbetar bild..." : "Välj bild"}
          </Button>
        </section>
      </main>
    </div>
  );
};

export default Home;
