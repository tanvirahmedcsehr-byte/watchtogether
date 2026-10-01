import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { LiveState, LiveStatus } from '../../types';
import { isApplicationAdminLoggedIn, ADMIN_AUTH_KEY } from '../auth/AuthContext';

export const DEFAULT_OFFLINE_STATE: LiveState = {
  movieId: null,
  movieTitle: '',
  isPlaying: false,
  position: 0,
  updatedAtMillis: Date.now(),
  status: 'OFFLINE',
};

function assertAdminSession(action: string) {
  if (!isApplicationAdminLoggedIn() && !auth.currentUser) {
    throw new Error(`Unable to ${action}: You must be logged in as an administrator (Username: Tanvir, Password: Movie).`);
  }
}

export async function getLiveState(): Promise<LiveState> {
  try {
    const snap = await getDoc(doc(db, 'liveState', 'current'));
    if (!snap.exists()) {
      return DEFAULT_OFFLINE_STATE;
    }
    return snap.data() as LiveState;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'liveState/current');
  }
}

export async function setLiveState(state: Partial<LiveState>): Promise<void> {
  assertAdminSession('modify global live playback');
  const ref = doc(db, 'liveState', 'current');
  const now = Date.now();
  const payload = {
    ...state,
    adminAuthKey: ADMIN_AUTH_KEY,
    updatedAtMillis: now,
  };

  try {
    await updateDoc(ref, payload);
  } catch (error) {
    try {
      await setDoc(ref, {
        ...DEFAULT_OFFLINE_STATE,
        ...payload,
      });
    } catch (createErr) {
      handleFirestoreError(createErr, OperationType.WRITE, 'liveState/current');
    }
  }
}

export async function startLiveMovie(
  movieId: string,
  movieTitle: string,
  controllerId: string = 'admin'
): Promise<void> {
  const now = Date.now();
  await setLiveState({
    movieId,
    movieTitle,
    isPlaying: true,
    position: 0,
    status: 'LIVE',
    startedAtMillis: now,
    updatedAtMillis: now,
    controllerId,
  });
}

export async function pauseLive(currentPosition: number, controllerId: string = 'admin'): Promise<void> {
  await setLiveState({
    isPlaying: false,
    position: Math.max(0, currentPosition),
    status: 'PAUSED',
    controllerId,
  });
}

export async function resumeLive(currentPosition: number, controllerId: string = 'admin'): Promise<void> {
  await setLiveState({
    isPlaying: true,
    position: Math.max(0, currentPosition),
    status: 'LIVE',
    controllerId,
  });
}

export async function seekLive(
  targetPosition: number,
  isCurrentlyPlaying: boolean = true,
  controllerId: string = 'admin'
): Promise<void> {
  await setLiveState({
    position: Math.max(0, targetPosition),
    isPlaying: isCurrentlyPlaying,
    status: isCurrentlyPlaying ? 'LIVE' : 'PAUSED',
    controllerId,
  });
}

export async function restartLive(controllerId: string = 'admin'): Promise<void> {
  await setLiveState({
    position: 0,
    isPlaying: true,
    status: 'LIVE',
    controllerId,
  });
}

export async function stopLive(controllerId: string = 'admin'): Promise<void> {
  await setLiveState({
    isPlaying: false,
    position: 0,
    status: 'OFFLINE',
    controllerId,
  });
}

export async function endLiveMovie(controllerId: string = 'admin'): Promise<void> {
  await setLiveState({
    isPlaying: false,
    status: 'ENDED',
    controllerId,
  });
}

export function subscribeToLiveState(
  onUpdate: (state: LiveState) => void,
  onError?: (err: any) => void
): () => void {
  const ref = doc(db, 'liveState', 'current');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_OFFLINE_STATE);
      } else {
        onUpdate(snap.data() as LiveState);
      }
    },
    (error) => {
      console.error('Live state listener error:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'liveState/current');
    }
  );
}

/**
 * Calculates current expected video playback position in seconds based on authoritative timestamp
 */
export function calculateLiveExpectedPosition(state: LiveState | null, duration?: number): number {
  if (!state) return 0;
  if (!state.isPlaying || state.status !== 'LIVE') {
    return Math.max(0, state.position);
  }
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - (state.updatedAtMillis || now)) / 1000);
  const calculated = Math.max(0, state.position + elapsedSeconds);
  if (duration && duration > 0) {
    return Math.min(calculated, duration);
  }
  return calculated;
}
