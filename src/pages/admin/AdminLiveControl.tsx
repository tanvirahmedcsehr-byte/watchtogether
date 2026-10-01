import React, { useEffect, useState, useRef } from 'react';
import {
  Radio,
  Users,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Square,
  Sparkles,
  AlertTriangle,
  Film,
  Clock,
  Check,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useRouter } from '../../lib/router';
import { Movie, LiveState, Subtitle, ChatMessage, ValidationStatus } from '../../types';
import { getMovies, getMovie, seedSampleMoviesWithSubtitles } from '../../lib/services/movies';
import { getSubtitlesForMovie } from '../../lib/services/subtitles';
import { startLiveMovie, stopLive, subscribeToLiveState } from '../../lib/services/liveState';
import { VideoPlayer, VideoPlayerRef } from '../../components/video/VideoPlayer';
import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { LiveChat } from '../../components/chat/LiveChat';
import { setupViewerPresence } from '../../lib/services/presence';
import { subscribeToChatMessages } from '../../lib/services/chat';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  detectSourceType,
  getSourceTypeLabel,
  validateVideoSource,
  SourceValidationResult,
} from '../../lib/video/sourceDetector';

export const AdminLiveControl: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<VideoPlayerRef | null>(null);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState<boolean>(true);
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [currentMovie, setCurrentMovie] = useState<Movie | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Pre-live source validation state
  const [modalValidation, setModalValidation] = useState<SourceValidationResult | null>(null);
  const [isValidatingModal, setIsValidatingModal] = useState<boolean>(false);

  // Authoritative Playback Sync Hook (Host mode)
  const {
    liveState,
    isSyncing,
    syncStatus,
    adminPlay,
    adminPause,
    adminSeek,
    adminRestart,
    adminStop,
  } = usePlaybackSync({
    isAdmin: true,
    adminId: user?.uid || 'host_admin',
    videoRef,
  });

  // Load active movies
  const fetchMoviesList = async () => {
    setLoadingMovies(true);
    try {
      const data = await getMovies();
      const readyMovies = data.filter((m) => m.processingStatus === 'READY' && m.status === 'active');
      setMovies(readyMovies);
      if (readyMovies.length > 0 && !selectedMovieId) {
        setSelectedMovieId(readyMovies[0].id);
      }
    } catch (e) {
      console.error('Failed to load movies for live control:', e);
    } finally {
      setLoadingMovies(false);
    }
  };

  useEffect(() => {
    fetchMoviesList();
  }, []);

  // Fetch current live movie details
  useEffect(() => {
    if (liveState?.movieId) {
      getMovie(liveState.movieId).then(setCurrentMovie);
      getSubtitlesForMovie(liveState.movieId).then((subs) => setSubtitles(subs || []));
    } else {
      setCurrentMovie(null);
      setSubtitles([]);
    }
  }, [liveState?.movieId]);

  // Host presence tracking
  useEffect(() => {
    const cleanup = setupViewerPresence(
      user?.uid || 'admin_host',
      'Host',
      (count) => setViewerCount(count)
    );
    return () => cleanup();
  }, [user]);

  // Subscribe to live chat
  useEffect(() => {
    const unsub = subscribeToChatMessages(setMessages);
    return () => unsub();
  }, []);

  // Validate the target movie source before opening Go Live modal
  const handleOpenGoLiveModal = async () => {
    const targetMovie = movies.find((m) => m.id === selectedMovieId);
    if (!targetMovie) return;

    setConfirmModalOpen(true);
    setIsValidatingModal(true);

    try {
      const result = await validateVideoSource(targetMovie.streamUrl);
      setModalValidation(result);
    } catch (e: any) {
      setModalValidation({
        status: 'SOURCE_UNAVAILABLE',
        sourceType: detectSourceType(targetMovie.streamUrl),
        resolvedStreamUrl: targetMovie.streamUrl,
        isStreamable: false,
        message: e?.message || 'Could not validate source.',
      });
    } finally {
      setIsValidatingModal(false);
    }
  };

  const handleStartLiveConfirm = async () => {
    if (!selectedMovieId) return;
    const targetMovie = movies.find((m) => m.id === selectedMovieId);
    if (!targetMovie) return;

    setIsStarting(true);
    try {
      await startLiveMovie(targetMovie.id, targetMovie.title, user?.uid || 'admin');
      setConfirmModalOpen(false);
    } catch (e) {
      console.error('Failed to start live stream:', e);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSeed = async () => {
    setLoadingMovies(true);
    try {
      await seedSampleMoviesWithSubtitles();
      await fetchMoviesList();
    } catch (e) {
      console.error('Failed to seed:', e);
    } finally {
      setLoadingMovies(false);
    }
  };

  const isLive = liveState?.status === 'LIVE' || liveState?.status === 'PAUSED';
  const targetMovie = movies.find((m) => m.id === selectedMovieId);

  const renderStatusBadge = (status: ValidationStatus) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>READY</span>
          </span>
        );
      case 'CORS_BLOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>CORS BLOCKED</span>
          </span>
        );
      case 'UNSUPPORTED_SOURCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>UNSUPPORTED SOURCE</span>
          </span>
        );
      case 'HLS_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-semibold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>HLS ERROR</span>
          </span>
        );
      case 'MEDIA_FORMAT_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-semibold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>MEDIA/FORMAT ERROR</span>
          </span>
        );
      case 'SOURCE_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-semibold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>SOURCE UNAVAILABLE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-semibold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>INVALID URL</span>
          </span>
        );
    }
  };

  return (
    <AdminLayout
      title="Live Channel Control Center"
      subtitle="Authoritative broadcast controller — Select movies, validate source compatibility, and command global synchronized playback."
      actionButton={
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('/', '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Public Stream</span>
          </button>
        </div>
      }
    >
      {/* Broadcast Switcher Bar */}
      <div className="mb-6 p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Broadcast Content Switcher
          </label>
          {loadingMovies ? (
            <div className="text-xs text-neutral-500">Loading movie library…</div>
          ) : movies.length === 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">No ready movies found.</span>
              <button
                onClick={handleSeed}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
              >
                Seed Ready Movies
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedMovieId}
                onChange={(e) => setSelectedMovieId(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                {movies.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.sourceType ? m.sourceType.toUpperCase() : 'DIRECT/HLS'}) • {m.duration}
                  </option>
                ))}
              </select>

              <button
                onClick={handleOpenGoLiveModal}
                disabled={!selectedMovieId}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Switch & Go Live</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Channel Quick Status */}
        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-neutral-800 pt-3 md:pt-0 md:pl-5">
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400">Channel Status</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isLive ? 'bg-rose-500 animate-ping' : 'bg-neutral-600'
                }`}
              />
              <span className="text-sm font-bold text-white">
                {liveState?.status || 'OFFLINE'}
              </span>
            </div>
          </div>

          {isLive && (
            <button
              onClick={adminStop}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-rose-950 text-neutral-300 hover:text-rose-400 border border-neutral-700 hover:border-rose-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ml-2"
              title="Stop Broadcast"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Authoritative Master Monitor */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative">
            {currentMovie ? (
              <VideoPlayer
                ref={videoRef}
                src={currentMovie.streamUrl}
                poster={currentMovie.posterUrl}
                title={currentMovie.title}
                isAdmin={true}
                isSyncing={isSyncing}
                syncStatus={syncStatus}
                subtitles={subtitles}
                availableQualities={
                  currentMovie.availableQualities
                    ? currentMovie.availableQualities.split(',').map((q) => q.trim())
                    : ['1080p', '720p', '480p', '360p']
                }
                onAdminPlay={adminPlay}
                onAdminPause={adminPause}
                onAdminSeek={adminSeek}
                onAdminRestart={adminRestart}
              />
            ) : (
              <div className="w-full aspect-video rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center p-6 text-center text-neutral-500">
                <Radio className="w-12 h-12 text-neutral-700 mb-3" />
                <h4 className="text-base font-semibold text-neutral-300">Channel Offline</h4>
                <p className="text-xs text-neutral-500 max-w-sm mt-1 mb-4">
                  No movie is currently on air. Select a movie from the switcher above and click &quot;Switch & Go Live&quot;.
                </p>
                {movies.length > 0 && (
                  <button
                    onClick={handleOpenGoLiveModal}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-rose-600/20"
                  >
                    Start Broadcast
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Info & Active Movie Metadata */}
          {currentMovie && (
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Now On Air (Authoritative Source)
                </div>
                <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                  <span>{currentMovie.title}</span>
                  <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300 font-mono">
                    {getSourceTypeLabel(detectSourceType(currentMovie.streamUrl))}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-neutral-400 font-mono">
                <span>{currentMovie.genre}</span>
                <span>•</span>
                <span>{currentMovie.duration}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Chat Moderation & Channel Details */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Channel Info Card */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-500" />
                <span className="text-sm font-semibold text-white">Live Audience</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold">
                {viewerCount} active viewers
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              All connected viewers are locked to your authoritative playback time within ±400ms.
            </p>
          </div>

          {/* Live Chat Panel */}
          <div className="h-[480px]">
            <LiveChat
              sessionId={user?.uid || 'admin_host'}
              displayLabel="Host"
              isHost={true}
              chatEnabled={true}
              messages={messages}
            />
          </div>
        </div>
      </div>

      {/* Requirement 6: Pre-Live Source Validation & Confirmation Modal */}
      {confirmModalOpen && targetMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 sm:p-7 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Start Live Broadcast?</h4>
                  <p className="text-[11px] text-neutral-400">Validate video source before going live</p>
                </div>
              </div>
            </div>

            {/* Target Movie & Source Diagnostics */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-start gap-3">
                {targetMovie.posterUrl && (
                  <img
                    src={targetMovie.posterUrl}
                    alt={targetMovie.title}
                    className="w-14 h-20 object-cover rounded-lg shrink-0 border border-neutral-800"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h5 className="font-bold text-white text-sm truncate">{targetMovie.title}</h5>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    {targetMovie.duration} • {targetMovie.genre || 'Film'}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 text-[10px] font-mono border border-neutral-800">
                      {getSourceTypeLabel(detectSourceType(targetMovie.streamUrl))}
                    </span>
                    {isValidatingModal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold animate-pulse">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        <span>Validating…</span>
                      </span>
                    ) : modalValidation ? (
                      renderStatusBadge(modalValidation.status)
                    ) : null}
                  </div>
                </div>
              </div>

              {/* URL preview */}
              <div className="pt-2 border-t border-neutral-900">
                <div className="text-[10px] uppercase font-semibold text-neutral-500 mb-1">
                  Target Stream URL:
                </div>
                <div className="font-mono text-[11px] text-rose-300/90 truncate bg-neutral-900/60 p-2 rounded-lg">
                  {targetMovie.streamUrl}
                </div>
              </div>

              {/* Validation Message Box */}
              {modalValidation && (
                <div
                  className={`p-2.5 rounded-xl text-xs ${
                    modalValidation.status === 'READY'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  }`}
                >
                  <p className="font-medium text-[11px]">{modalValidation.message}</p>
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              All viewers on the channel will immediately switch to this movie and synchronize playback from 00:00.
            </p>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs sm:text-sm font-semibold text-neutral-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartLiveConfirm}
                disabled={isStarting || isValidatingModal}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs sm:text-sm font-bold text-white transition-all cursor-pointer shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                <Radio className="w-4 h-4" />
                <span>{isStarting ? 'Broadcasting…' : 'Yes, Go Live Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
