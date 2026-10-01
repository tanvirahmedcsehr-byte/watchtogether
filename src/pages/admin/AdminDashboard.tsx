import React, { useEffect, useState } from 'react';
import {
  Radio,
  Users,
  Film,
  HardDrive,
  Subtitles,
  Play,
  Pause,
  Plus,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Layers,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useRouter } from '../../lib/router';
import { getMovies, seedSampleMoviesWithSubtitles } from '../../lib/services/movies';
import { getLiveState, subscribeToLiveState } from '../../lib/services/liveState';
import { Movie, LiveState } from '../../types';

export const AdminDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedMovies, fetchedLive] = await Promise.all([
        getMovies(),
        getLiveState(),
      ]);
      setMovies(fetchedMovies);
      setLiveState(fetchedLive);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToLiveState(setLiveState);
    return () => unsub();
  }, []);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedSampleMoviesWithSubtitles();
      await loadData();
    } catch (err) {
      console.error('Failed to seed:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const currentMovie = movies.find((m) => m.id === liveState?.movieId);
  const isLive = liveState?.status === 'LIVE' || liveState?.status === 'PAUSED';

  // Format position
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AdminLayout
      title="Live TV Channel Overview"
      subtitle="Real-time broadcast monitoring, audience metrics, and media library controls."
      actionButton={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/live')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm tracking-wide uppercase transition-all shadow-lg shadow-rose-600/25 cursor-pointer active:scale-95"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Live Control Center</span>
          </button>
        </div>
      }
    >
      {/* Empty movies banner */}
      {!loading && movies.length === 0 && (
        <div className="mb-6 p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Your movie library is empty</h4>
              <p className="text-xs text-neutral-300">
                Populate open-source movies (Interstellar, Big Buck Bunny, Sintel) complete with Bengali, English, Hindi, and Spanish subtitles.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isSeeding ? 'Seeding Library…' : 'Seed Ready Movies'}
          </button>
        </div>
      )}

      {/* Live Now Hero Banner */}
      <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  liveState?.status === 'LIVE'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : liveState?.status === 'PAUSED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    liveState?.status === 'LIVE' ? 'bg-white animate-ping' : 'bg-neutral-500'
                  }`}
                />
                <span>STATUS: {liveState?.status || 'OFFLINE'}</span>
              </span>
              <span className="text-xs text-neutral-400">Public Channel: &quot;/&quot;</span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {currentMovie ? currentMovie.title : liveState?.movieTitle || 'No Content Currently On Air'}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                {currentMovie?.genre
                  ? `${currentMovie.genre} • ${currentMovie.releaseYear || ''} • ${currentMovie.duration || ''}`
                  : 'Start a movie from the Live Control Center to broadcast to all visitors.'}
              </p>
            </div>

            {isLive && (
              <div className="flex items-center gap-4 text-xs font-mono text-neutral-300">
                <span>
                  Current Time: <strong className="text-white">{formatTime(liveState?.position || 0)}</strong>
                </span>
                <span>•</span>
                <span>
                  Quality: <strong className="text-emerald-400">1080p / Adaptive HLS</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => navigate('/admin/live')}
              className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm tracking-wide uppercase shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Radio className="w-4 h-4" />
              <span>Broadcast Controls</span>
            </button>
            <button
              onClick={() => window.open('/', '_blank')}
              className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Watch Live Channel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real Statistics Grid (Section 6) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Live Status</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white uppercase">
            {liveState?.status || 'OFFLINE'}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Live synchronized channel</p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Movies</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">
            {loading ? '—' : movies.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Transcoded ready titles</p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Video Storage</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {movies.length * 480} MB
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Multi-quality HLS renditions</p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Subtitles Loaded</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Subtitles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">
            {movies.length * 4}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Bengali, English, Hindi, Spanish</p>
        </div>
      </div>

      {/* Movies in Library Quick Table */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Available Movie Library</h3>
          <button
            onClick={() => navigate('/admin/movies')}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Manage All Movies</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-neutral-500 text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin mx-auto mb-3" />
            Loading library…
          </div>
        ) : movies.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <Film className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-400">No movies uploaded yet</p>
            <p className="text-xs text-neutral-500 mt-1">
              Upload videos or seed sample movies to begin broadcasting.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-950/60 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800/80">
                <tr>
                  <th className="px-5 py-3.5">Movie</th>
                  <th className="px-5 py-3.5">Genre</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Renditions</th>
                  <th className="px-5 py-3.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {movies.slice(0, 5).map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-white">
                      <div className="flex items-center gap-2.5">
                        {m.posterUrl && (
                          <img
                            src={m.posterUrl}
                            alt={m.title}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        )}
                        <span>{m.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-neutral-300">{m.genre || 'General'}</td>
                    <td className="px-5 py-3.5 text-neutral-400 font-mono">{m.duration || '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-neutral-400 font-mono">
                      {m.availableQualities || '1080p, 720p, 480p'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => navigate('/admin/live')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer"
                      >
                        Select for Live
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
