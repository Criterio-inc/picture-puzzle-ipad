/**
 * LandingScreen — shown after sign-in.
 * Lists saved puzzles from Firestore with a "Nytt pussel" button.
 *
 * Thumbnails are stored as base64 data URLs directly in Firestore (tiny, ~10 KB).
 * The full image lives in IndexedDB on this device — if it's missing the card
 * shows a warning instead of the thumbnail.
 */

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { loadUserSaves, deletePuzzleSave, PuzzleSaveRecord } from '../lib/puzzleSave';
import { removeImage } from '../lib/imageStore';

interface Props {
  userId: string;
  displayName: string;
  onNewPuzzle: () => void;
  onResumePuzzle: (save: PuzzleSaveRecord) => void;
}

export default function LandingScreen({ userId, displayName, onNewPuzzle, onResumePuzzle }: Props) {
  const [saves, setSaves] = useState<PuzzleSaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await loadUserSaves(userId);
        if (!cancelled) setSaves(data);
      } catch (e) {
        if (!cancelled) setError('Kunde inte ladda sparade pussel');
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function handleDelete(saveId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(saveId);
    try {
      await deletePuzzleSave(userId, saveId);
      // Also clean up local image from IndexedDB
      await removeImage(saveId);
      setSaves(prev => prev.filter(s => s.id !== saveId));
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeletingId(null);
    }
  }

  const firstName = displayName.split(' ')[0] || 'du';

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#f0e6d4' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Bildpussel</h1>
          <p className="text-stone-500 text-sm mt-0.5">Hej {firstName}!</p>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="text-xs text-stone-400 underline underline-offset-2 active:text-stone-600"
        >
          Logga ut
        </button>
      </div>

      {/* New puzzle button */}
      <div className="px-5 pb-4 shrink-0">
        <button
          onClick={onNewPuzzle}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 bg-amber-700 text-white font-semibold text-base shadow-md active:scale-[0.98] transition-transform"
        >
          <span className="text-xl leading-none">＋</span>
          Nytt pussel
        </button>
      </div>

      {/* Saves list */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {loading && (
          <div className="flex items-center justify-center pt-16">
            <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-stone-500 pt-12 text-sm">{error}</p>
        )}

        {!loading && !error && saves.length === 0 && (
          <div className="text-center pt-14">
            <div className="text-5xl mb-4">🧩</div>
            <p className="text-stone-500 text-sm">Du har inga sparade pussel ännu.</p>
            <p className="text-stone-400 text-xs mt-1">Starta ett nytt pussel ovan!</p>
          </div>
        )}

        {!loading && saves.length > 0 && (
          <>
            <p className="text-stone-500 text-xs font-medium mb-3 uppercase tracking-wide">
              Fortsätt pussla
            </p>
            <div className="grid grid-cols-2 gap-3">
              {saves.map(save => (
                <SaveCard
                  key={save.id}
                  save={save}
                  isDeleting={deletingId === save.id}
                  onResume={() => onResumePuzzle(save)}
                  onDelete={e => handleDelete(save.id, e)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Save card ────────────────────────────────────────────────────────────────

interface CardProps {
  save: PuzzleSaveRecord;
  isDeleting: boolean;
  onResume: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SaveCard({ save, isDeleting, onResume, onDelete }: CardProps) {
  const pct = save.total > 0 ? Math.round((save.placedCount / save.total) * 100) : 0;
  const date = save.updatedAt.toLocaleDateString('sv-SE', {
    day: 'numeric', month: 'short',
  });

  return (
    <div
      onClick={onResume}
      className="relative rounded-2xl overflow-hidden bg-white shadow-sm active:scale-[0.97] transition-transform cursor-pointer border border-stone-100"
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
        {save.thumbnailDataUrl ? (
          <img
            src={save.thumbnailDataUrl}
            alt="Pusselminiatyr"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl">
            🧩
          </div>
        )}

        {/* Completed badge */}
        {save.isCompleted && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
            ✓ Klart
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-stone-500">{save.cols}×{save.rows}</span>
          <span className="text-xs text-stone-400">{date}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-stone-400 mt-1">{save.placedCount}/{save.total} bitar</p>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 text-white active:bg-black/50 transition-colors"
        aria-label="Ta bort"
      >
        {isDeleting ? (
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        )}
      </button>
    </div>
  );
}
