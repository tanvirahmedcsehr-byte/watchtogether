import React, { useEffect, useState, useRef } from 'react';
import {
  Radio,
  Users,
  Film,
  Calendar,
  Clock,
  Globe,
  Subtitles,
  Tv,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useRouter } from '../lib/router';
import { Movie, Subtitle, ChatMessage } from '../types';
import { getMovie } from '../lib/services/movies';
import { getSubtitlesForMovie } from '../lib/services/subtitles';
import { getOrCreateViewerSession } from '../lib/session';
import { VideoPlayer, VideoPlayerRef } from '../components/video/VideoPlayer';
import { usePlaybackSync } from '../hooks/usePlaybackSync';
import { LiveChat } from '../components/chat/LiveChat';
import { setupViewerPresence } from '../lib/services/presence';
import { subscribeToChatMessages } from '../lib/services/chat';
import { getPlatformSettings } from '../lib/services/settings';

export const HomePage: React.FC = () => {
  const { navigate } = useRouter();
  const videoRef = useRef<VideoPlayerRef | null>(null);

  const [session] = useState(() => getOrCreateViewerSession());
  const [movie, setMovie] = useState<Movie | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatEnabled, setChatEnabled] = useState<boolean>(true);

  // Global Live Playback Sync Hook
  const {
    liveState,
    isSyncing,
    syncStatus,
    autoplayBlocked,
    unlockAutoplay,
  } = usePlaybackSync({
    isAdmin: false,
    videoRef,
  });

  // Fetch current movie details when liveState.movieId changes
  useEffect(() => {
    if (liveState?.movieId) {
      getMovie(liveState.movieId).then((m) => {
        setMovie(m);
      });
      getSubtitlesForMovie(liveState.movieId).then((subs) => {
        setSubtitles(subs || []);
      });
    } else {
      setMovie(null);
      setSubtitles([]);
    }
  }, [liveState?.movieId]);

  // Load platform settings (chat enabled/disabled)
  useEffect(() => {
    getPlatformSettings().then((s) => {
      setChatEnabled(s.chatEnabled);
    });
  }, []);

  // Setup presence tracking for current viewer on Live Channel
  useEffect(() => {
    const cleanup = setupViewerPresence(
      session.sessionId,
      session.displayLabel,
      (count) => setViewerCount(count)
    );
    return () => cleanup();
  }, [session]);

  // Subscribe to live channel chat
  useEffect(() => {
    const unsub = subscribeToChatMessages(setMessages);
    return () => unsub();
  }, []);

  const isLive = liveState?.status === 'LIVE' || liveState?.status === 'PAUSED';
  const isEnded = liveState?.status === 'ENDED';
  const isOffline = !liveState || liveState.status === 'OFFLINE' || !liveState.movieId;

  const availableQualities = movie?.availableQualities
    ? movie.availableQualities.split(',').map((q) => q.trim())
    : ['1080p', '720p', '480p', '360p'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* Top Live Channel Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {isLive ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-bold tracking-wide uppercase shadow-lg shadow-rose-600/20">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>LIVE BROADCAST</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-neutral-500" />
              <span>CHANNEL OFFLINE</span>
            </div>
          )}

          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {movie?.title || 'CineLive Private Channel'}
          </h1>
        </div>

        {/* Viewers Counter */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300">
            <Users className="w-3.5 h-3.5 text-rose-500" />
            <span className="font-mono">{viewerCount}</span>
            <span>watching live</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Video Player or Offline Interstitial */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {isOffline ? (
            <div className="w-full aspect-video rounded-3xl bg-neutral-900/80 border border-neutral-800/80 flex flex-col items-center justify-center p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-600/5 blur-[90px] rounded-full pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 text-neutral-500 flex items-center justify-center mb-4 border border-neutral-700/60 shadow-inner">
                <Tv className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Currently Offline</h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-md leading-relaxed">
                No movie is currently playing on the channel. Please stay tuned or check back when the host goes live!
              </p>
              <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-950 border border-neutral-800 text-xs text-neutral-400">
                <Radio className="w-3.5 h-3.5 text-neutral-600" />
                <span>Live stream will resume automatically when host broadcasts</span>
              </div>
            </div>
          ) : isEnded ? (
            <div className="w-full aspect-video rounded-3xl bg-neutral-900/80 border border-neutral-800 flex flex-col items-center justify-center p-8 text-center shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Movie Ended</h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-md leading-relaxed">
                {movie?.title ? `"${movie.title}" has finished broadcasting.` : 'The film has concluded.'} The host will start another presentation soon.
              </p>
            </div>
          ) : movie?.streamUrl ? (
            <div className="relative">
              <VideoPlayer
                ref={videoRef}
                src={movie.streamUrl}
                poster={movie.posterUrl}
                title={movie.title}
                isAdmin={false}
                isSyncing={isSyncing}
                syncStatus={syncStatus}
                autoplayBlocked={autoplayBlocked}
                subtitles={subtitles}
                availableQualities={availableQualities}
                onAutoplayUnlock={unlockAutoplay}
              />
            </div>
          ) : (
            <div className="w-full aspect-video rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
              <div className="flex flex-col items-center gap-2">
                <Film className="w-8 h-8 text-neutral-600 animate-pulse" />
                <span className="text-sm">Connecting to live video stream…</span>
              </div>
            </div>
          )}

          {/* Current Movie Details */}
          {movie && (
            <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {movie.title}
                    </h2>
                    {movie.rating && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {movie.rating}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-400">
                    {movie.genre && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
                        {movie.genre}
                      </span>
                    )}
                    {movie.duration && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        {movie.duration}
                      </span>
                    )}
                    {movie.releaseYear && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        {movie.releaseYear}
                      </span>
                    )}
                    {movie.language && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-neutral-500" />
                        {movie.language}
                      </span>
                    )}
                    {subtitles.length > 0 && (
                      <span className="flex items-center gap-1 text-indigo-400">
                        <Subtitles className="w-3.5 h-3.5" />
                        {subtitles.length} Subtitles Available
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {movie.description && (
                <p className="mt-3 text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  {movie.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Global Chat */}
        <div className="lg:col-span-4 h-[550px] lg:h-[620px] sticky top-20">
          <LiveChat
            sessionId={session.sessionId}
            displayLabel={session.displayLabel}
            isHost={false}
            chatEnabled={chatEnabled}
            messages={messages}
          />
        </div>
      </div>
    </div>
  );
};
