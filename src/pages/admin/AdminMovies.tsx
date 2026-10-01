import React, { useEffect, useState } from 'react';
import {
  Film,
  Plus,
  Search,
  Trash2,
  Edit2,
  Clock,
  Sparkles,
  Play,
  Calendar,
  Layers,
  Radio,
  Subtitles,
  AlertCircle,
  Check,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useRouter } from '../../lib/router';
import { Movie } from '../../types';
import { getMovies, deleteMovie, updateMovie, seedSampleMoviesWithSubtitles } from '../../lib/services/movies';
import { startLiveMovie } from '../../lib/services/liveState';
import { useAuth } from '../../lib/auth/AuthContext';

export const AdminMovies: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await getMovies();
      setMovies(data);
    } catch (e: any) {
      console.error('Error fetching movies:', e);
      setActionError(e?.message || 'Error fetching movies. Please verify your administrator login.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteMovie(deleteId);
      setDeleteId(null);
      setActionSuccess('Movie deleted successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
      await fetchList();
    } catch (e: any) {
      console.error('Failed to delete movie:', e);
      setActionError(e?.message || 'Failed to delete movie.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (movie: Movie) => {
    const nextStatus = movie.status === 'active' ? 'inactive' : 'active';
    setActionError(null);
    try {
      await updateMovie(movie.id, { status: nextStatus });
      setMovies((prev) =>
        prev.map((m) => (m.id === movie.id ? { ...m, status: nextStatus } : m))
      );
    } catch (e: any) {
      console.error('Failed to toggle status:', e);
      setActionError(e?.message || 'Failed to update movie status.');
    }
  };

  const handleInstantGoLive = async (movie: Movie) => {
    setActionError(null);
    try {
      await startLiveMovie(movie.id, movie.title, user?.uid || 'admin');
      navigate('/admin/live');
    } catch (e: any) {
      console.error('Failed to go live:', e);
      setActionError(e?.message || 'Failed to broadcast movie live.');
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setActionError(null);
    try {
      await seedSampleMoviesWithSubtitles();
      setActionSuccess('Sample movies seeded successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchList();
    } catch (e: any) {
      console.error('Failed to seed:', e);
      setActionError(
        e?.message ||
          'Failed to seed movies. Please make sure you are signed in with an authorized administrator account.'
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const genres = Array.from(new Set(movies.map((m) => m.genre).filter(Boolean)));

  const filteredMovies = movies.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description?.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || m.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  return (
    <AdminLayout
      title="Movie Library"
      subtitle="Manage your film repository, adaptive streaming qualities, and subtitle assets."
      actionButton={
        <div className="flex items-center gap-2">
          {movies.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>{isSeeding ? 'Seeding…' : 'Seed Ready Movies'}</span>
            </button>
          )}
          <button
            onClick={() => navigate('/admin/movies/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-rose-600/25 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Import Movie</span>
          </button>
        </div>
      }
    >
      {actionError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-200">Action Failed: </span>
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-neutral-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-3">
          <Check className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movies by title, actor, or description…"
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
          />
        </div>

        {genres.length > 0 && (
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs sm:text-sm text-neutral-300 focus:outline-none focus:border-rose-500 cursor-pointer"
          >
            <option value="all">All Genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Movies Grid */}
      {loading ? (
        <div className="p-16 text-center text-neutral-500 text-sm">
          <div className="w-8 h-8 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin mx-auto mb-3" />
          Loading movies…
        </div>
      ) : filteredMovies.length === 0 ? (
        <div className="p-16 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center text-neutral-500">
          <Film className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-300">No movies found</h3>
          <p className="text-xs text-neutral-400 mt-1 mb-4">
            Upload your first video asset or seed sample open-source movies.
          </p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Seed Sample Movies
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMovies.map((movie) => (
            <div
              key={movie.id}
              className="rounded-2xl bg-neutral-900/80 border border-neutral-800 overflow-hidden shadow-lg hover:border-neutral-700 transition-all flex flex-col group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-neutral-950 overflow-hidden">
                {movie.posterUrl ? (
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600">
                    <Film className="w-10 h-10" />
                  </div>
                )}

                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${
                      movie.processingStatus === 'READY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {movie.processingStatus}
                  </span>

                  <button
                    onClick={() => handleToggleStatus(movie)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md cursor-pointer ${
                      movie.status === 'active'
                        ? 'bg-neutral-800 text-neutral-200'
                        : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {movie.status}
                  </button>
                </div>

                {movie.duration && (
                  <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[11px] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span>{movie.duration}</span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors">
                    {movie.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-neutral-400">
                    {movie.genre && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[11px]">
                        {movie.genre}
                      </span>
                    )}
                    {movie.releaseYear && (
                      <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {movie.releaseYear}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                      <Film className="w-2.5 h-2.5 text-rose-400" />
                      <span>{movie.sourceType ? movie.sourceType.toUpperCase() : 'DIRECT/HLS'}</span>
                    </span>
                    {movie.validationStatus && movie.validationStatus !== 'READY' && (
                      <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold uppercase">
                        {movie.validationStatus}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                    {movie.description || 'No description provided.'}
                  </p>

                  {movie.googleDriveFileId && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-400/90 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-lg">
                      <span>Drive ID: {movie.googleDriveFileId.substring(0, 16)}…</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between">
                  <button
                    onClick={() => handleInstantGoLive(movie)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Broadcast Live</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate('/admin/subtitles')}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                      title="Manage Subtitles"
                    >
                      <Subtitles className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/movies/${movie.id}`)}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Movie"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(movie.id)}
                      className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                      title="Delete Movie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-sm w-full p-6 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl">
            <h4 className="text-base font-bold text-white mb-2">Delete Movie?</h4>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              Are you sure you want to remove this movie from your catalog?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
