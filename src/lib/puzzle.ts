export interface PuzzlePiece {
  id: number;
  row: number;
  col: number;
  imageDataUrl: string;
  width: number;
  height: number;
  selected: boolean;
  // Position on the board (null if in tray)
  x: number | null;
  y: number | null;
}

export function splitImage(
  imageDataUrl: string,
  cols: number,
  rows: number
): Promise<PuzzlePiece[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const pieceW = Math.floor(img.width / cols);
      const pieceH = Math.floor(img.height / rows);
      const pieces: PuzzlePiece[] = [];

      const canvas = document.createElement("canvas");
      canvas.width = pieceW;
      canvas.height = pieceH;
      const ctx = canvas.getContext("2d")!;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, pieceW, pieceH);
          ctx.drawImage(
            img,
            c * pieceW, r * pieceH, pieceW, pieceH,
            0, 0, pieceW, pieceH
          );
          pieces.push({
            id: r * cols + c,
            row: r,
            col: c,
            imageDataUrl: canvas.toDataURL("image/jpeg", 0.7),
            width: pieceW,
            height: pieceH,
            selected: false,
            x: null,
            y: null,
          });
        }
      }

      // Shuffle
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }

      resolve(pieces);
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}
