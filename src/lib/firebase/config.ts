import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import rawConfig from '../../../firebase-applet-config.json';

const isPlaceholder = (val: string | undefined): boolean =>
  !val || val.startsWith('your_') || val.includes('placeholder');

// Priority: Real Environment Variables > JSON Config File
const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

const firebaseConfig = {
  apiKey: !isPlaceholder(envApiKey) ? envApiKey : rawConfig.apiKey,
  authDomain: !isPlaceholder(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
    ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    : rawConfig.authDomain,
  projectId: !isPlaceholder(envProjectId) ? envProjectId : rawConfig.projectId,
  storageBucket: !isPlaceholder(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)
    ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    : rawConfig.storageBucket,
  messagingSenderId: !isPlaceholder(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)
    ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    : rawConfig.messagingSenderId,
  appId: !isPlaceholder(import.meta.env.VITE_FIREBASE_APP_ID)
    ? import.meta.env.VITE_FIREBASE_APP_ID
    : rawConfig.appId,
  firestoreDatabaseId: !isPlaceholder(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID)
    ? import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
    : (rawConfig.firestoreDatabaseId || '(default)'),
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    'Missing critical Firebase configuration. Please check firebase-applet-config.json or environment variables.'
  );
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline: check network or configuration.');
    }
  }
}

testConnection();
