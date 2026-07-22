import { initializeApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// getDatabase() throws synchronously if databaseURL is missing, so it's only
// called when Firebase is actually configured. App.tsx shows a setup screen
// instead of the game when firebaseConfigured is false.
export const firebaseConfigured = Boolean(firebaseConfig.databaseURL);
const app = initializeApp(firebaseConfig);
export const db: Database | null = firebaseConfigured ? getDatabase(app) : null;
