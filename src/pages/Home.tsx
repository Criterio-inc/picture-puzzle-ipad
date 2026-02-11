import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Puzzle, Upload, LogOut, Image } from "lucide-react";
import { toast } from "sonner";

const Home = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

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
      const dataUrl = reader.result as string;
      // Store image in sessionStorage and navigate to puzzle
      sessionStorage.setItem("puzzleImage", dataUrl);
      navigate("/puzzle");
    };
    reader.onerror = () => {
      toast.error("Kunde inte läsa bilden");
      setProcessing(false);
    };
    reader.readAsDataURL(file);
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
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

      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-accent">
            <Image className="h-12 w-12 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Nytt pussel</h1>
          <p className="max-w-md text-muted-foreground">
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
      </main>
    </div>
  );
};

export default Home;
