/**
 * App — top-level routing with Firebase Auth.
 *
 * Screen flow:
 *   (not signed in)  → SignInScreen
 *   (signed in)      → LandingScreen  (saved puzzles list)
 *                    → StartScreen    (pick image + difficulty)
 *                    → PuzzleCanvas   (play)
 *
 * Image storage strategy:
 *   - User-uploaded images: stored in IndexedDB on this device (imageStore.ts)
 *   - Picsum images: stored as URL only (no local storage needed)
 *   - Firestore: stores piece state, progress, thumbnail (base64, ~10 KB inline)
 *
 * When the user backs out of PuzzleCanvas the puzzle is auto-saved to Firestore.
 * The image is saved to IndexedDB at the moment the game starts.
 */

import { useState, useRef, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import { storeImage, loadImage, copyImage } from './lib/imageStore';
import {
  savePuzzle,
  generateThumbnail,
  loadUserSaves,
  PuzzleSaveRecord,
  SavedPieceState,
} from './lib/puzzleSave';
import LandingScreen from './screens/LandingScreen';
import StartScreen from './puzzle/StartScreen';
import PuzzleCanvas from './puzzle/PuzzleCanvas';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'landing' | 'start' | 'puzzle';

interface GameSession {
  image: HTMLImageElement;
  imageIsPicsum: boolean;
  picsumUrl: string | null;
  cols: number;
  rows: number;
  seed: number;
  saveId?: string;
  loadedPiecesState?: SavedPieceState[];
  loadedTrayIds?: string[];
}

// ─── Floating piece decoration ────────────────────────────────────────────────

const FLOAT_PIECES = [
  { size: 72,  top:  '6%',  left:  '5%',  rotate: -25, delay: '0s',    duration: '7s'  },
  { size: 52,  top:  '8%',  right: '8%',  rotate:  18, delay: '1.2s',  duration: '9s'  },
  { size: 44,  top: '22%',  left:  '2%',  rotate:  42, delay: '0.5s',  duration: '11s' },
  { size: 60,  top: '18%',  right: '3%',  rotate: -10, delay: '2s',    duration: '8s'  },
  { size: 48,  top: '72%',  left:  '4%',  rotate:  30, delay: '0.8s',  duration: '10s' },
  { size: 56,  top: '78%',  right: '6%',  rotate: -35, delay: '1.5s',  duration: '7s'  },
  { size: 38,  top: '60%',  left:  '8%',  rotate:  55, delay: '2.5s',  duration: '12s' },
  { size: 42,  top: '55%',  right: '2%',  rotate: -50, delay: '0.3s',  duration: '9s'  },
  { size: 34,  top: '40%',  left:  '1%',  rotate:  15, delay: '1.8s',  duration: '13s' },
  { size: 36,  top: '88%',  left: '40%',  rotate: -20, delay: '0.6s',  duration: '8s'  },
  { size: 30,  top:  '3%',  left: '45%',  rotate:  38, delay: '2.2s',  duration: '10s' },
  { size: 40,  top: '85%',  right:'18%',  rotate: -42, delay: '1s',    duration: '11s' },
];

// ─── Sign-in screen ───────────────────────────────────────────────────────────

function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      setError('Could not sign in. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center h-full overflow-hidden select-none"
      style={{ background: 'linear-gradient(160deg, #f5edd9 0%, #e8d5b0 100%)' }}
    >
      {/* Animated background pieces */}
      <style>{`
        @keyframes floatPiece {
          0%   { transform: translateY(0px)   rotate(var(--r)); opacity: 0.13; }
          50%  { transform: translateY(-18px) rotate(var(--r)); opacity: 0.20; }
          100% { transform: translateY(0px)   rotate(var(--r)); opacity: 0.13; }
        }
      `}</style>

      {FLOAT_PIECES.map((p, i) => (
        <img
          key={i}
          src="/picture_pussel.png"
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            top: p.top,
            left: 'left' in p ? p.left : undefined,
            right: 'right' in p ? p.right : undefined,
            '--r': `${p.rotate}deg`,
            animation: `floatPiece ${p.duration} ease-in-out ${p.delay} infinite`,
            pointerEvents: 'none',
            userSelect: 'none',
          } as React.CSSProperties}
          alt=""
          draggable={false}
        />
      ))}

      {/* Card */}
      <div
        className="relative z-10 flex flex-col items-center gap-7 px-10 py-12 rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 48px rgba(100,70,20,0.15)',
          border: '1px solid rgba(255,255,255,0.7)',
          maxWidth: 340,
          width: '90%',
        }}
      >
        <img
          src="/picture_pussel.png"
          alt="Puzzle piece"
          style={{ width: 88, height: 88, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.18))' }}
          draggable={false}
        />

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#3d2e1a' }}>
            Picture Puzzle
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8a7055' }}>
            Sign in to save your progress
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 px-6 font-semibold text-base transition-transform active:scale-95 disabled:opacity-60"
          style={{
            background: '#fff',
            color: '#3d2e1a',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {error && (
          <p className="text-red-500 text-sm text-center -mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>('landing');
  const [game, setGame] = useState<GameSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const triggerSaveRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#f0e6d4' }}>
        <div className="w-9 h-9 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <SignInScreen />;

  // ── Landing ──────────────────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <LandingScreen
        userId={user.uid}
        displayName={user.displayName ?? user.email ?? 'du'}
        onNewPuzzle={() => setScreen('start')}
        onResumePuzzle={async (save: PuzzleSaveRecord) => {
          let img: HTMLImageElement | null = null;

          if (save.imageIsPicsum && save.picsumUrl) {
            // Picsum — load from URL
            img = await loadImageFromUrl(save.picsumUrl);
          } else {
            // Local — load from IndexedDB
            img = await loadImage(save.id);
          }

          if (!img) {
            // Image missing from this device — signal LandingScreen to show error
            // We re-fetch saves so LandingScreen can show the "image missing" state
            // by passing null image. For now alert the user gracefully.
            alert('Bilden saknas på den här enheten. Pusslet kan inte laddas.');
            return;
          }

          setGame({
            image: img,
            imageIsPicsum: save.imageIsPicsum,
            picsumUrl: save.picsumUrl,
            cols: save.cols,
            rows: save.rows,
            seed: save.puzzleSeed,
            saveId: save.id,
            loadedPiecesState: save.piecesState,
            loadedTrayIds: save.trayIds,
          });
          setScreen('puzzle');
        }}
      />
    );
  }

  // ── Start ────────────────────────────────────────────────────────────────
  if (screen === 'start') {
    return (
      <StartScreen
        onBack={() => setScreen('landing')}
        onStart={async (image, cols, rows, _imageUrl, imageIsPicsum) => {
          const seed = Date.now();
          const tempId = `tmp_${seed}`;

          if (!imageIsPicsum) {
            // Store image locally in IndexedDB under temp key
            // Will be migrated to real saveId after first save
            await storeImage(tempId, image);
          }

          setGame({
            image,
            imageIsPicsum,
            picsumUrl: imageIsPicsum ? `https://picsum.photos/seed/puzzle/1200/800` : null,
            cols,
            rows,
            seed,
            saveId: tempId, // will be replaced after first real save
          });
          setScreen('puzzle');
        }}
      />
    );
  }

  // ── Puzzle ────────────────────────────────────────────────────────────────
  if (screen === 'puzzle' && game) {
    async function handleBack() {
      if (triggerSaveRef.current) {
        setIsSaving(true);
        try {
          await triggerSaveRef.current();
        } catch (e) {
          console.error('Auto-save failed', e);
        } finally {
          setIsSaving(false);
        }
      }
      setGame(null);
      setScreen('landing');
    }

    async function handleSave(
      pieces: import('./puzzle/generator').PieceDef[],
      trayIds: string[],
      boardX: number, boardY: number, boardW: number, boardH: number,
      placedCount: number,
      total: number,
      isCompleted: boolean,
      boardImageCanvas: HTMLCanvasElement,
    ): Promise<string> {
      const isTempId = game!.saveId?.startsWith('tmp_');

      const thumbnailDataUrl = await generateThumbnail(boardImageCanvas);

      const saveId = await savePuzzle({
        userId:          user!.uid,
        imageIsPicsum:   game!.imageIsPicsum,
        picsumUrl:       game!.picsumUrl,
        cols:            game!.cols,
        rows:            game!.rows,
        seed:            game!.seed,
        pieces,
        trayIds,
        boardX, boardY, boardW, boardH,
        placedCount,
        total,
        isCompleted,
        existingSaveId:  isTempId ? undefined : game!.saveId,
        thumbnailDataUrl,
      });

      // If this was a temp image key, migrate it to the real saveId
      if (!game!.imageIsPicsum && isTempId && game!.saveId) {
        await copyImage(game!.saveId, saveId);
      }

      setGame(prev => prev ? { ...prev, saveId } : prev);
      return saveId;
    }

    return (
      <div className="w-full h-full relative">
        <PuzzleCanvas
          image={game.image}
          cols={game.cols}
          rows={game.rows}
          seed={game.seed}
          loadedPiecesState={game.loadedPiecesState}
          loadedTrayIds={game.loadedTrayIds}
          onSave={handleSave}
          onRegisterSaveTrigger={fn => { triggerSaveRef.current = fn; }}
          onComplete={() => {}}
        />

        <button
          onClick={handleBack}
          disabled={isSaving}
          className="absolute top-3 left-3 bg-white/75 backdrop-blur-sm rounded-full p-2 shadow-sm active:scale-95 transition-transform text-stone-600 disabled:opacity-60"
          style={{ zIndex: 65 }}
          title="Spara och gå tillbaka"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-stone-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
            </svg>
          )}
        </button>
      </div>
    );
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
