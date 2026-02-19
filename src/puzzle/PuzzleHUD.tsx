/**
 * PuzzleHUD — minimal floating HUD overlay.
 * Sits at the top of the screen with pointer-events: none so it never
 * blocks touches on the puzzle canvas.
 */

interface PuzzleHUDProps {
  placedCount: number;
  total: number;
}

export default function PuzzleHUD({ placedCount, total }: PuzzleHUDProps) {
  const pct = total > 0 ? Math.round((placedCount / total) * 100) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 999,
          padding: '5px 18px',
          fontSize: 13,
          fontWeight: 600,
          color: '#6b5a45',
          boxShadow: '0 1px 8px rgba(0,0,0,0.10)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{placedCount} / {total}</span>
        {placedCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#9a7a50',
            }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}
