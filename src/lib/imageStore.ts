/**
 * imageStore — persist puzzle images in IndexedDB on the local device.
 *
 * Images are stored as JPEG Blobs keyed by saveId.
 * This means puzzle state in Firestore works across sign-outs,
 * but the image is only available on the device it was originally picked on.
 *
 * Key format:  "puzzle_img_{saveId}"
 */

import { get, set, del } from 'idb-keyval';

const KEY = (saveId: string) => `puzzle_img_${saveId}`;

/** Compress + store an HTMLImageElement as JPEG in IndexedDB. */
export async function storeImage(saveId: string, image: HTMLImageElement): Promise<void> {
  const MAX_W = 1200;
  const scale = Math.min(1, MAX_W / image.naturalWidth);
  const w = Math.round(image.naturalWidth * scale);
  const h = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(image, 0, 0, w, h);

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
  await set(KEY(saveId), blob);
}

/**
 * Load an image from IndexedDB.
 * Returns an HTMLImageElement, or null if not found (e.g. different device).
 */
export async function loadImage(saveId: string): Promise<HTMLImageElement | null> {
  const blob = await get<Blob>(KEY(saveId));
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Keep the object URL alive — it will be revoked when the puzzle session ends
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from IndexedDB'));
    };
    img.src = url;
  });
}

/** Remove a stored image (called when deleting a save). */
export async function removeImage(saveId: string): Promise<void> {
  await del(KEY(saveId));
}

/** Copy image from one saveId key to another (used when a tmp id gets a real id). */
export async function copyImage(fromSaveId: string, toSaveId: string): Promise<void> {
  const blob = await get<Blob>(KEY(fromSaveId));
  if (blob) {
    await set(KEY(toSaveId), blob);
    await del(KEY(fromSaveId));
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('canvas.toBlob failed')),
      type,
      quality,
    );
  });
}
