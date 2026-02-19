/**
 * Puzzle save / load — Firestore only, no Firebase Storage.
 *
 * Images live in IndexedDB on the device (see imageStore.ts).
 * Firestore stores everything else: piece positions, progress, metadata.
 *
 * Pieces use board-relative fractional coordinates:
 *   fx = (piece.x - boardX) / boardW
 *   fy = (piece.y - boardY) / boardH
 *
 * Firestore path:  users/{userId}/puzzle_saves/{saveId}
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { PieceDef } from '../puzzle/generator';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SavedPieceState {
  id: string;
  fx: number;
  fy: number;
  isPlaced: boolean;
  zIndex: number;
}

export interface PuzzleSaveRecord {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  /** 'local' for uploaded images, picsum URL for demo images */
  imageSource: 'local' | string;
  imageIsPicsum: boolean;
  /** Only set for picsum images — the full URL */
  picsumUrl: string | null;
  cols: number;
  rows: number;
  puzzleSeed: number;
  piecesState: SavedPieceState[];
  trayIds: string[];
  placedCount: number;
  total: number;
  isCompleted: boolean;
  /** Small base64 thumbnail stored directly in Firestore (~10–15 KB) */
  thumbnailDataUrl: string | null;
}

// ─── Thumbnail (stored inline in Firestore, no Storage needed) ────────────────

/**
 * Generate a tiny thumbnail (120px wide) as a base64 data URL.
 * At JPEG q=0.6 this is roughly 8–15 KB — well within Firestore's 1 MB doc limit.
 */
export async function generateThumbnail(boardImageCanvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const THUMB_W = 120;
    const aspect = boardImageCanvas.height / boardImageCanvas.width;
    const THUMB_H = Math.round(THUMB_W * aspect);

    const thumb = document.createElement('canvas');
    thumb.width = THUMB_W;
    thumb.height = THUMB_H;
    const ctx = thumb.getContext('2d')!;
    ctx.fillStyle = '#f0e6d4';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);
    ctx.drawImage(boardImageCanvas, 0, 0, THUMB_W, THUMB_H);
    return thumb.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}

// ─── Save ──────────────────────────────────────────────────────────────────────

export interface PuzzleSaveInput {
  userId: string;
  imageIsPicsum: boolean;
  picsumUrl: string | null;
  cols: number;
  rows: number;
  seed: number;
  pieces: PieceDef[];
  trayIds: string[];
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  placedCount: number;
  total: number;
  isCompleted: boolean;
  existingSaveId?: string;
  thumbnailDataUrl?: string | null;
}

/** Save or update a puzzle in Firestore. Returns the save ID. */
export async function savePuzzle(input: PuzzleSaveInput): Promise<string> {
  const piecesState: SavedPieceState[] = input.pieces.map(p => ({
    id: p.id,
    fx: (p.x - input.boardX) / input.boardW,
    fy: (p.y - input.boardY) / input.boardH,
    isPlaced: p.isPlaced,
    zIndex: p.zIndex,
  }));

  const savesCol = collection(db, 'users', input.userId, 'puzzle_saves');
  const saveRef = input.existingSaveId
    ? doc(savesCol, input.existingSaveId)
    : doc(savesCol);

  await setDoc(saveRef, {
    userId:           input.userId,
    imageSource:      input.imageIsPicsum ? input.picsumUrl : 'local',
    imageIsPicsum:    input.imageIsPicsum,
    picsumUrl:        input.picsumUrl ?? null,
    cols:             input.cols,
    rows:             input.rows,
    puzzleSeed:       input.seed,
    piecesState,
    trayIds:          input.trayIds,
    placedCount:      input.placedCount,
    total:            input.total,
    isCompleted:      input.isCompleted,
    thumbnailDataUrl: input.thumbnailDataUrl ?? null,
    updatedAt:        serverTimestamp(),
    ...(input.existingSaveId ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });

  return saveRef.id;
}

// ─── Load ──────────────────────────────────────────────────────────────────────

export async function loadUserSaves(userId: string): Promise<PuzzleSaveRecord[]> {
  const savesCol = collection(db, 'users', userId, 'puzzle_saves');
  const q = query(savesCol, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => firestoreDocToRecord(d.id, d.data()));
}

function firestoreDocToRecord(id: string, data: Record<string, unknown>): PuzzleSaveRecord {
  function toDate(v: unknown): Date {
    if (v instanceof Timestamp) return v.toDate();
    if (v instanceof Date) return v;
    return new Date();
  }
  return {
    id,
    userId:           data.userId as string,
    createdAt:        toDate(data.createdAt),
    updatedAt:        toDate(data.updatedAt),
    imageSource:      (data.imageSource as string) ?? 'local',
    imageIsPicsum:    (data.imageIsPicsum as boolean) ?? false,
    picsumUrl:        (data.picsumUrl as string | null) ?? null,
    cols:             data.cols as number,
    rows:             data.rows as number,
    puzzleSeed:       data.puzzleSeed as number,
    piecesState:      (data.piecesState ?? []) as SavedPieceState[],
    trayIds:          (data.trayIds ?? []) as string[],
    placedCount:      (data.placedCount as number) ?? 0,
    total:            (data.total as number) ?? 0,
    isCompleted:      (data.isCompleted as boolean) ?? false,
    thumbnailDataUrl: (data.thumbnailDataUrl as string | null) ?? null,
  };
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deletePuzzleSave(userId: string, saveId: string): Promise<void> {
  const saveRef = doc(db, 'users', userId, 'puzzle_saves', saveId);
  await deleteDoc(saveRef);
}
