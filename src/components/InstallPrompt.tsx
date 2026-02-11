import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share, MoreVertical, PlusSquare } from "lucide-react";

const DISMISSED_KEY = "pwa-install-dismissed";

export function InstallPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) {
      // Show after a short delay so it doesn't feel jarring
      const timer = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setOpen(false);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Lägg till på hemskärmen</DialogTitle>
          <DialogDescription className="text-center">
            Installera Pussel som en app för snabb åtkomst
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isIOS ? (
            <div className="space-y-3">
              <Step
                step={1}
                icon={<Share className="h-5 w-5" />}
                text='Tryck på "Dela"-ikonen i Safari (rutan med pil uppåt)'
              />
              <Step
                step={2}
                icon={<PlusSquare className="h-5 w-5" />}
                text='Scrolla ner och välj "Lägg till på hemskärmen"'
              />
              <Step
                step={3}
                icon={null}
                text='Tryck "Lägg till" uppe till höger'
              />
            </div>
          ) : (
            <div className="space-y-3">
              <Step
                step={1}
                icon={<MoreVertical className="h-5 w-5" />}
                text="Tryck på treprickarna (⋮) uppe till höger i webbläsaren"
              />
              <Step
                step={2}
                icon={<PlusSquare className="h-5 w-5" />}
                text='Välj "Lägg till på startskärmen" eller "Installera app"'
              />
              <Step
                step={3}
                icon={null}
                text='Bekräfta genom att trycka "Installera"'
              />
            </div>
          )}
        </div>

        <Button className="w-full" onClick={handleDismiss}>
          Jag förstår!
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Step({ step, icon, text }: { step: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step}
      </div>
      <div className="flex items-start gap-2 pt-0.5">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <p className="text-sm text-foreground">{text}</p>
      </div>
    </div>
  );
}
