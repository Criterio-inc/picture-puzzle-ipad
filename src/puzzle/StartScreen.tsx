import { useRef, useState } from 'react';

const DIFFICULTIES = [
  { label: 'Medel', cols: 5, rows: 4, desc: '20 bitar' },
  { label: 'Svår', cols: 8, rows: 6, desc: '48 bitar' },
  { label: 'Expert', cols: 12, rows: 9, desc: '108 bitar' },
  { label: 'Mästare', cols: 20, rows: 20, desc: '400 bitar' },
];

interface Props {
  onBack: () => void;
  onStart: (
    image: HTMLImageElement,
    cols: number,
    rows: number,
    imageUrl: string,
    imageIsPicsum: boolean,
  ) => void;
}

export default function StartScreen({ onBack, onStart }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageIsPicsum, setImageIsPicsum] = useState(false);
  const [difficulty, setDifficulty] = useState(1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function loadImageFrom(src: string, isPicsum: boolean, originalUrl: string) {
    setLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setPreview(src);
      setImageEl(img);
      setImageUrl(originalUrl);
      setImageIsPicsum(isPicsum);
      setLoading(false);
    };
    img.onerror = () => setLoading(false);
    img.src = src;
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const blobUrl = URL.createObjectURL(file);
    // For user-uploaded files, imageUrl starts as the blob URL.
    // App.tsx will upload it to Supabase Storage before starting the game.
    loadImageFrom(blobUrl, false, blobUrl);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function startGame() {
    if (!imageEl) return;
    const d = DIFFICULTIES[difficulty];
    onStart(imageEl, d.cols, d.rows, imageUrl, imageIsPicsum);
  }

  function useDemoImage() {
    const url = 'https://picsum.photos/seed/puzzle/1200/800';
    loadImageFrom(url, true, url);
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: '#f0e6d4' }}
    >
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-2 shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 text-stone-600 active:scale-95 transition-transform shadow-sm"
          aria-label="Tillbaka"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-stone-800 tracking-tight">Nytt pussel</h1>
          <p className="text-stone-500 text-xs mt-0.5">Välj bild och svårighetsgrad</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center gap-6 px-5 py-4 pb-8">

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="relative w-full max-w-sm aspect-[4/3] rounded-2xl border-2 border-dashed border-stone-300 bg-white/60 flex items-center justify-center cursor-pointer overflow-hidden active:bg-stone-100 transition-colors"
        >
          {preview ? (
            <img src={preview} className="w-full h-full object-cover" alt="Preview" />
          ) : (
            <div className="text-center p-6">
              <div className="text-4xl mb-3">🖼️</div>
              <p className="text-stone-500 text-sm">Tryck för att ladda upp bild</p>
              <p className="text-stone-400 text-xs mt-1">eller dra & släpp</p>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {!preview && (
          <button
            onClick={useDemoImage}
            className="text-amber-700 text-sm underline underline-offset-2 -mt-2"
          >
            Använd exempelbild
          </button>
        )}

        {/* Difficulty */}
        <div className="w-full max-w-sm">
          <p className="text-stone-600 text-sm font-medium mb-3 text-center">Svårighetsgrad</p>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map((d, i) => (
              <button
                key={d.label}
                onClick={() => setDifficulty(i)}
                className={`rounded-xl py-3 px-1 text-center transition-all ${
                  difficulty === i
                    ? 'bg-amber-700 text-white shadow-md scale-105'
                    : 'bg-white/70 text-stone-600 border border-stone-200'
                }`}
              >
                <div className="font-semibold text-sm">{d.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={startGame}
          disabled={!imageEl}
          className={`w-full max-w-sm rounded-full py-4 text-base font-semibold shadow-lg transition-all ${
            imageEl
              ? 'bg-amber-700 text-white active:scale-95 hover:bg-amber-800'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          Starta pussel
        </button>
      </div>
    </div>
  );
}
