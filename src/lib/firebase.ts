/**
 * Firebase client — Auth + Firestore only.
 * Images are stored locally in IndexedDB (see imageStore.ts).
 *
 * Config values come from VITE_ env vars.
 * Replace the placeholders in .env with your real Firebase project config.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app             = initializeApp(firebaseConfig);
export const auth            = getAuth(app);
export const db              = getFirestore(app);
export const googleProvider  = new GoogleAuthProvider();
