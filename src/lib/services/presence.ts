import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';

export function setupViewerPresence(
  sessionId: string,
  displayLabel: string,
  onViewerCountChange?: (count: number) => void
): () => void {
  const presenceRef = doc(db, 'viewerPresence', sessionId);

  const ping = async () => {
    try {
      await setDoc(
        presenceRef,
        {
          sessionId,
          displayLabel,
          lastActive: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Presence ping warning:', e);
    }
  };

  ping();
  const interval = setInterval(ping, 25000);

  const cleanup = async () => {
    clearInterval(interval);
    try {
      await deleteDoc(presenceRef);
    } catch (e) {
      // ignore on unload
    }
  };

  const handleBeforeUnload = () => {
    cleanup();
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Subscribe to all active presences
  const presencesRef = collection(db, 'viewerPresence');
  const unsubscribeSnapshot = onSnapshot(
    presencesRef,
    (snap) => {
      const threshold = Date.now() - 60000;
      let count = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.lastActive && data.lastActive > threshold) {
          count++;
        }
      });
      onViewerCountChange?.(Math.max(1, count));
    },
    (err) => {
      console.warn('Presence snapshot warning:', err);
    }
  );

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    cleanup();
    unsubscribeSnapshot();
  };
}
