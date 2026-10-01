import React, { useEffect, useState, useRef } from 'react';
import {
  Film,
  ArrowLeft,
  Check,
  AlertCircle,
  Play,
  HardDrive,
  Link,
  Shield,
  FileVideo,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useRouter } from '../../lib/router';
import { Movie, ProcessingStatus, VideoSourceType, ValidationStatus } from '../../types';
import { getMovie, createMovie, updateMovie } from '../../lib/services/movies';
import { checkAdminAuth } from '../../lib/auth/AuthContext';
import {
  detectSourceType,
  getSourceTypeLabel,
  validateVideoSource,
  SourceValidationResult,
  resolveGoogleDriveStreamCandidate,
} from '../../lib/video/sourceDetector';

export const AdminMovieForm: React.FC<{ movieId?: string }> = ({ movieId }) => {
  const { navigate } = useRouter();
  const isEditing = Boolean(movieId);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    posterUrl: '',
    googleDriveFileId: '',
    streamUrl: '',
    originalFileUrl: '',
    genre: '',
    duration: '1h 30m',
    releaseYear: String(new Date().getFullYear()),
    language: 'English',
    rating: 'PG-13',
    status: 'active' as 'active' | 'inactive',
    processingStatus: 'READY' as ProcessingStatus,
    availableQualities: '1080p,720p,480p,360p',
    sourceType: 'unknown' as VideoSourceType,
    validationStatus: 'READY' as ValidationStatus,
    validationMessage: '',
  });

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Realtime source validation state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<SourceValidationResult | null>(null);
  const validationDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (movieId) {
      getMovie(movieId)
        .then((m) => {
          if (m) {
            setFormData({
              title: m.title || '',
              description: m.description || '',
              posterUrl: m.posterUrl || '',
              googleDriveFileId: m.googleDriveFileId || '',
              streamUrl: m.streamUrl || '',
              originalFileUrl: m.originalFileUrl || '',
              genre: m.genre || '',
              duration: m.duration || '1h 30m',
              releaseYear: m.releaseYear || String(new Date().getFullYear()),
              language: m.language || 'English',
              rating: m.rating || 'PG-13',
              status: m.status || 'active',
              processingStatus: m.processingStatus || 'READY',
              availableQualities: m.availableQualities || '1080p,720p,480p,360p',
              sourceType: m.sourceType || detectSourceType(m.streamUrl || ''),
              validationStatus: m.validationStatus || 'READY',
              validationMessage: m.validationMessage || '',
            });

            if (m.streamUrl) {
              handleValidateSource(m.streamUrl, false);
            }
          }
        })
        .finally(() => setLoading(false));
    }
  }, [movieId]);

  // Live validator on URL change
  const handleValidateSource = async (urlToValidate: string, showPending: boolean = true) => {
    const clean = urlToValidate.trim();
    if (!clean) {
      setValidationResult(null);
      setFormData((prev) => ({
        ...prev,
        sourceType: 'unknown',
        validationStatus: 'INVALID_URL',
        validationMessage: 'Stream URL is empty',
      }));
      return;
    }

    const detected = detectSourceType(clean);
    setFormData((prev) => ({ ...prev, sourceType: detected }));

    if (showPending) {
      setValidating(true);
    }

    try {
      const result = await validateVideoSource(clean);
      setValidationResult(result);
      setFormData((prev) => ({
        ...prev,
        sourceType: result.sourceType,
        validationStatus: result.status,
        validationMessage: result.message,
        availableQualities:
          result.levels && result.levels.length > 0
            ? result.levels.join(',')
            : prev.availableQualities,
      }));
    } catch (e: any) {
      setValidationResult({
        status: 'SOURCE_UNAVAILABLE',
        sourceType: detected,
        resolvedStreamUrl: clean,
        isStreamable: false,
        message: e?.message || 'Source validation probe failed.',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleStreamUrlChange = (newUrl: string) => {
    setFormData((prev) => ({ ...prev, streamUrl: newUrl }));

    if (validationDebounceRef.current) {
      window.clearTimeout(validationDebounceRef.current);
    }

    validationDebounceRef.current = window.setTimeout(() => {
      handleValidateSource(newUrl, true);
    }, 700);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const authCheck = checkAdminAuth();
    if (!authCheck.authenticated) {
      setErrorMsg(authCheck.error || 'Admin authentication required. Please log in.');
      return;
    }

    if (!formData.title.trim()) {
      setErrorMsg('Movie title is required.');
      return;
    }
    if (!formData.streamUrl.trim()) {
      setErrorMsg('Video Stream URL is required.');
      return;
    }

    // Block saving confirmed invalid/unsupported sources unless admin acknowledges
    if (validationResult && !validationResult.isStreamable) {
      if (validationResult.status === 'UNSUPPORTED_SOURCE' || validationResult.status === 'INVALID_URL') {
        setErrorMsg(
          `Cannot save movie: ${validationResult.message} Please provide a direct, browser-playable video stream.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const detected = detectSourceType(formData.streamUrl);
      const payload: Partial<Movie> = {
        ...formData,
        sourceType: detected,
        validationStatus: validationResult?.status || 'READY',
        validationMessage: validationResult?.message || '',
      };

      if (isEditing && movieId) {
        await updateMovie(movieId, payload);
        setSuccessMsg('Movie updated successfully!');
      } else {
        await createMovie(payload as Omit<Movie, 'id'>);
        setSuccessMsg('Movie added to channel successfully!');
      }

      setTimeout(() => {
        navigate('/admin/movies');
      }, 1200);
    } catch (err: any) {
      console.error('Error saving movie:', err);
      setErrorMsg(err?.message || 'Failed to save movie.');
    } finally {
      setSubmitting(false);
    }
  };

  const detectedType = detectSourceType(formData.streamUrl);

  const getStatusBadge = (status: ValidationStatus) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>READY</span>
          </span>
        );
      case 'CHECKING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>CHECKING SOURCE…</span>
          </span>
        );
      case 'CORS_BLOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>CORS BLOCKED</span>
          </span>
        );
      case 'UNSUPPORTED_SOURCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>UNSUPPORTED SOURCE</span>
          </span>
        );
      case 'HLS_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>HLS ERROR</span>
          </span>
        );
      case 'MEDIA_FORMAT_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>MEDIA/FORMAT ERROR</span>
          </span>
        );
      case 'SOURCE_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>SOURCE UNAVAILABLE</span>
          </span>
        );
      case 'INVALID_URL':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>INVALID URL</span>
          </span>
        );
    }
  };

  return (
    <AdminLayout
      title={isEditing ? 'Edit Movie' : 'Add Movie to Channel'}
      subtitle="Universal Video Source: Enter any browser-playable video URL (.m3u8, .mp4, .webm, .ogg) with real-time format detection and playback validation."
      actionButton={
        <button
          onClick={() => navigate('/admin/movies')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Library</span>
        </button>
      }
    >
      <div className="max-w-3xl">
        {loading ? (
          <div className="p-16 text-center text-neutral-500">
            <div className="w-8 h-8 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin mx-auto mb-3" />
            Loading movie details…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 rounded-3xl bg-neutral-900/70 border border-neutral-800 shadow-xl space-y-6"
          >
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Movie Title */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Movie Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Interstellar, Big Buck Bunny, Tears of Steel"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all font-medium"
                required
              />
            </div>

            {/* Video URL Input & Universal Source Validator Card */}
            <div className="p-5 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Video Stream URL <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleValidateSource(formData.streamUrl, true)}
                    disabled={validating || !formData.streamUrl}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${validating ? 'animate-spin' : ''}`} />
                    <span>Test & Validate Source</span>
                  </button>
                </div>

                <div className="relative">
                  <FileVideo className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="url"
                    value={formData.streamUrl}
                    onChange={(e) => handleStreamUrlChange(e.target.value)}
                    placeholder="https://.../master.m3u8, https://.../movie.mp4, or https://.../stream.webm"
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
                    required
                  />
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  Accepts direct HLS (.m3u8), MP4 (.mp4), WebM (.webm), and Ogg (.ogg) video stream URLs.
                </p>
              </div>

              {/* Requirement 7: Clearly Display Video Source Type, Video URL, Source Validation Status */}
              <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Video Source Type */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400">
                      Video Source Type:
                    </span>
                    <span className="font-mono text-white font-semibold flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-rose-400" />
                      <span>{getSourceTypeLabel(detectedType)}</span>
                    </span>
                  </div>

                  {/* Source Validation Status */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400">
                      Source Validation Status:
                    </span>
                    <div>
                      {validating
                        ? getStatusBadge('CHECKING')
                        : getStatusBadge(validationResult?.status || formData.validationStatus)}
                    </div>
                  </div>
                </div>

                {/* Validation Status Message & Detailed Diagnostics */}
                {validationResult?.message && (
                  <div
                    className={`p-3 rounded-lg text-xs leading-relaxed ${
                      validationResult.status === 'READY'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : validationResult.status === 'CORS_BLOCKED' ||
                          validationResult.status === 'UNSUPPORTED_SOURCE'
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{validationResult.message}</p>
                        {validationResult.details && (
                          <p className="text-[11px] opacity-80 mt-1 font-mono">
                            {validationResult.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Poster URL */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Poster Image URL (Optional)
              </label>
              <input
                type="url"
                value={formData.posterUrl}
                onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                placeholder="https://images.unsplash.com/... or poster URL"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
              />
            </div>

            {/* Grid: Genre, Duration, Year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Genre
                </label>
                <input
                  type="text"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  placeholder="e.g. Sci-Fi, Drama, Action"
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="e.g. 1h 45m"
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Release Year
                </label>
                <input
                  type="text"
                  value={formData.releaseYear}
                  onChange={(e) => setFormData({ ...formData, releaseYear: e.target.value })}
                  placeholder="2024"
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Synopsis */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Synopsis
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief movie summary for viewers on the channel…"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/movies')}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs sm:text-sm font-semibold text-neutral-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? 'Saving Movie…' : isEditing ? 'Update Movie' : 'Save Movie'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};
