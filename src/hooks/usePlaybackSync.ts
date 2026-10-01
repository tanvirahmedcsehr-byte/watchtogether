import { useEffect, useRef, useState, useCallback } from 'react';
import { LiveState } from '../types';
import {
  subscribeToLiveState,
  calculateLiveExpectedPosition,
  pauseLive,
  resumeLive,
  seekLive,
  restartLive,
  stopLive,
  getLiveState,
} from '../lib/services/liveState';
import { VideoPlayerRef } from '../components/video/VideoPlayer';

interface UsePlaybackSyncOptions {
  isAdmin?: boolean;
  adminId?: string;
  videoRef: React.RefObject<VideoPlayerRef | null>;
}

export function usePlaybackSync({
  isAdmin = false,
  adminId = 'admin',
  videoRef,
}: UsePlaybackSyncOptions) {
  const [liveState, setLiveStateLocal] = useState<LiveState | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'reconnecting'>('synced');
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);

  const isApplyingRemoteSyncRef = useRef<boolean>(false);
  const lastHandledUpdateMillisRef = useRef<number>(0);
  const driftIntervalRef = useRef<number | null>(null);

  // Apply state from server to local video player
  const applyStateToPlayer = useCallback(
    async (state: LiveState) => {
      const player = videoRef.current;
      if (!player) return;

      isApplyingRemoteSyncRef.current = true;
      setIsSyncing(true);

      const expectedPos = calculateLiveExpectedPosition(state, player.getDuration());
      const currentPos = player.getCurrentTime();
      const diff = Math.abs(currentPos - expectedPos);

      // Seek if difference is greater than 400ms (drift tolerance)
      if (diff > 0.4) {
        player.seek(expectedPos);
      }

      if (state.isPlaying && state.status === 'LIVE') {
        if (player.isPaused()) {
          try {
            await player.play();
            setAutoplayBlocked(false);
          } catch (e: any) {
            if (e?.name === 'NotAllowedError' || String(e).includes('interact')) {
              setAutoplayBlocked(true);
            }
          }
        }
      } else {
        if (!player.isPaused()) {
          player.pause();
        }
        if (Math.abs(player.getCurrentTime() - state.position) > 0.2) {
          player.seek(state.position);
        }
      }

      setTimeout(() => {
        isApplyingRemoteSyncRef.current = false;
        setIsSyncing(false);
        setSyncStatus('synced');
      }, 300);
    },
    [videoRef]
  );

  // Realtime subscription to global live channel state
  useEffect(() => {
    let isSubscribed = true;

    const unsubscribe = subscribeToLiveState(
      (remoteState) => {
        if (!isSubscribed || !remoteState) return;

        setLiveStateLocal(remoteState);
        setSyncStatus('synced');

        if (remoteState.updatedAtMillis !== lastHandledUpdateMillisRef.current) {
          lastHandledUpdateMillisRef.current = remoteState.updatedAtMillis;
          applyStateToPlayer(remoteState);
        }
      },
      (error) => {
        console.warn('Live playback listener issue:', error);
        setSyncStatus('reconnecting');
      }
    );

    // Online / Offline reconnect handling
    const handleOnline = async () => {
      setSyncStatus('syncing');
      try {
        const freshState = await getLiveState();
        if (freshState && isSubscribed) {
          setLiveStateLocal(freshState);
          await applyStateToPlayer(freshState);
          setSyncStatus('synced');
        }
      } catch (e) {
        console.error('Failed to sync on network restore:', e);
      }
    };

    const handleOffline = () => {
      setSyncStatus('reconnecting');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isSubscribed = false;
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [applyStateToPlayer]);

  // Periodic subtle drift check for connected viewers (<500ms sync)
  useEffect(() => {
    driftIntervalRef.current = window.setInterval(() => {
      if (!liveState || !liveState.isPlaying || liveState.status !== 'LIVE' || isApplyingRemoteSyncRef.current) return;
      const player = videoRef.current;
      if (!player) return;

      const expected = calculateLiveExpectedPosition(liveState, player.getDuration());
      const current = player.getCurrentTime();
      const drift = current - expected;

      if (Math.abs(drift) > 0.6) {
        player.seek(expected);
      }
    }, 3000);

    return () => {
      if (driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current);
      }
    };
  }, [liveState, videoRef]);

  // Admin Controller Handlers
  const adminPlay = useCallback(async () => {
    if (!isAdmin) return;
    const player = videoRef.current;
    const current = player ? player.getCurrentTime() : (liveState?.position || 0);
    try {
      await resumeLive(current, adminId);
      if (player && player.isPaused()) {
        await player.play();
      }
    } catch (e) {
      console.error('Failed to trigger play:', e);
    }
  }, [isAdmin, adminId, videoRef, liveState]);

  const adminPause = useCallback(async () => {
    if (!isAdmin) return;
    const player = videoRef.current;
    const current = player ? player.getCurrentTime() : (liveState?.position || 0);
    try {
      await pauseLive(current, adminId);
      if (player && !player.isPaused()) {
        player.pause();
      }
    } catch (e) {
      console.error('Failed to trigger pause:', e);
    }
  }, [isAdmin, adminId, videoRef, liveState]);

  const adminSeek = useCallback(
    async (seconds: number) => {
      if (!isAdmin) return;
      const isCurrentlyPlaying = liveState ? liveState.isPlaying : true;
      try {
        await seekLive(seconds, isCurrentlyPlaying, adminId);
        const player = videoRef.current;
        if (player) {
          player.seek(seconds);
        }
      } catch (e) {
        console.error('Failed to seek:', e);
      }
    },
    [isAdmin, adminId, liveState, videoRef]
  );

  const adminRestart = useCallback(async () => {
    if (!isAdmin) return;
    try {
      await restartLive(adminId);
      const player = videoRef.current;
      if (player) {
        player.seek(0);
        await player.play();
      }
    } catch (e) {
      console.error('Failed to restart:', e);
    }
  }, [isAdmin, adminId, videoRef]);

  const adminStop = useCallback(async () => {
    if (!isAdmin) return;
    try {
      await stopLive(adminId);
      const player = videoRef.current;
      if (player) {
        player.pause();
        player.seek(0);
      }
    } catch (e) {
      console.error('Failed to stop:', e);
    }
  }, [isAdmin, adminId, videoRef]);

  const unlockAutoplay = useCallback(async () => {
    setAutoplayBlocked(false);
    const player = videoRef.current;
    if (player && liveState) {
      const expected = calculateLiveExpectedPosition(liveState, player.getDuration());
      player.seek(expected);
      if (liveState.isPlaying && liveState.status === 'LIVE') {
        try {
          await player.play();
        } catch (e) {
          console.warn('Unlock play error:', e);
        }
      }
    }
  }, [liveState, videoRef]);

  return {
    liveState,
    isSyncing,
    syncStatus,
    autoplayBlocked,
    unlockAutoplay,
    adminPlay,
    adminPause,
    adminSeek,
    adminRestart,
    adminStop,
  };
}
