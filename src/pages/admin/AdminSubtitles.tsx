import React, { useEffect, useState } from 'react';
import {
  Subtitles,
  Plus,
  Trash2,
  Film,
  Check,
  AlertCircle,
  FileText,
  Upload,
  Globe,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Movie, Subtitle } from '../../types';
import { getMovies } from '../../lib/services/movies';
import {
  getSubtitlesForMovie,
  addSubtitle,
  deleteSubtitle,
  createVttDataUri,
  generateSampleVtt,
} from '../../lib/services/subtitles';

const COMMON_LANGUAGES = [
  { code: 'en', name: 'English', label: 'English' },
  { code: 'bn', name: 'Bengali', label: 'বাংলা (Bengali)' },
  { code: 'hi', name: 'Hindi', label: 'हिंदी (Hindi)' },
  { code: 'es', name: 'Spanish', label: 'Español (Spanish)' },
  { code: 'ar', name: 'Arabic', label: 'العربية (Arabic)' },
  { code: 'fr', name: 'French', label: 'Français (French)' },
  { code: 'de', name: 'German', label: 'Deutsch (German)' },
  { code: 'ja', name: 'Japanese', label: '日本語 (Japanese)' },
];

export const AdminSubtitles: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [langCode, setLangCode] = useState('bn');
  const [langName, setLangName] = useState('Bengali');
  const [trackLabel, setTrackLabel] = useState('বাংলা (Bengali)');
  const [vttContent, setVttContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    getMovies().then((data) => {
      setMovies(data);
      if (data.length > 0) {
        setSelectedMovieId(data[0].id);
      }
      setLoading(false);
    });
  }, []);

  const fetchSubtitles = async (movieId: string) => {
    if (!movieId) return;
    setLoadingSubs(true);
    try {
      const subs = await getSubtitlesForMovie(movieId);
      setSubtitles(subs || []);
    } catch (e) {
      console.error('Failed to fetch subtitles:', e);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    if (selectedMovieId) {
      fetchSubtitles(selectedMovieId);
    }
  }, [selectedMovieId]);

  const handleLanguagePresetChange = (code: string) => {
    const found = COMMON_LANGUAGES.find((l) => l.code === code);
    if (found) {
      setLangCode(found.code);
      setLangName(found.name);
      setTrackLabel(found.label);
      const selectedMovie = movies.find((m) => m.id === selectedMovieId);
      setVttContent(generateSampleVtt(found.name, selectedMovie?.title || 'Movie'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let content = (event.target?.result as string) || '';
      // If SRT format, convert simple SRT to WebVTT
      if (!content.startsWith('WEBVTT')) {
        content = 'WEBVTT\n\n' + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }
      setVttContent(content);
    };
    reader.readAsText(file);
  };

  const handleAddSubtitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovieId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    if (!vttContent.trim()) {
      setErrorMsg('WebVTT content is required. You can upload a file or generate sample cues.');
      return;
    }

    setIsSaving(true);
    try {
      const fileUrl = createVttDataUri(vttContent);
      await addSubtitle(selectedMovieId, {
        languageCode: langCode,
        languageName: langName,
        label: trackLabel,
        fileUrl,
        isDefault,
      });

      setSuccessMsg(`Subtitle (${langName}) added successfully!`);
      setShowAddForm(false);
      setVttContent('');
      await fetchSubtitles(selectedMovieId);
    } catch (err: any) {
      console.error('Failed to add subtitle:', err);
      setErrorMsg(err?.message || 'Failed to save subtitle.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (subtitleId: string) => {
    try {
      await deleteSubtitle(selectedMovieId, subtitleId);
      await fetchSubtitles(selectedMovieId);
    } catch (e) {
      console.error('Failed to delete subtitle:', e);
    }
  };

  const selectedMovie = movies.find((m) => m.id === selectedMovieId);

  return (
    <AdminLayout
      title="Subtitle Management"
      subtitle="Manage closed captions and multi-language subtitle tracks (.vtt / .srt) for your movie library."
      actionButton={
        <button
          onClick={() => {
            setShowAddForm(true);
            handleLanguagePresetChange('bn');
          }}
          disabled={!selectedMovieId}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-rose-600/25 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subtitle Track</span>
        </button>
      }
    >
      {/* Movie Selector */}
      <div className="mb-6 p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Select Movie to Manage Subtitles
          </label>
          <select
            value={selectedMovieId}
            onChange={(e) => setSelectedMovieId(e.target.value)}
            className="w-full sm:max-w-md px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 cursor-pointer"
          >
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.releaseYear || 'Feature'})
              </option>
            ))}
          </select>
        </div>

        {selectedMovie && (
          <div className="text-xs text-neutral-400">
            Current Movie: <span className="font-semibold text-white">{selectedMovie.title}</span>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add Subtitle Modal / Form */}
      {showAddForm && (
        <div className="mb-8 p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl">
          <h3 className="text-base font-bold text-white mb-1">Add Subtitle Track</h3>
          <p className="text-xs text-neutral-400 mb-6">
            Supports WebVTT (.vtt) and SubRip (.srt) files. Viewers can independently toggle and select this language on the public live stream.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAddSubtitle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Preset Language
                </label>
                <select
                  value={langCode}
                  onChange={(e) => handleLanguagePresetChange(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  {COMMON_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name} - {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Language Name
                </label>
                <input
                  type="text"
                  value={langName}
                  onChange={(e) => setLangName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Menu Label
                </label>
                <input
                  type="text"
                  value={trackLabel}
                  onChange={(e) => setTrackLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>

            {/* Upload File or Edit VTT */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  WebVTT Content (.vtt / .srt)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 cursor-pointer font-medium">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .vtt or .srt file</span>
                  <input
                    type="file"
                    accept=".vtt,.srt,text/vtt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={6}
                value={vttContent}
                onChange={(e) => setVttContent(e.target.value)}
                placeholder="WEBVTT&#10;&#10;00:00:02.000 --> 00:00:06.000&#10;Subtitle text here..."
                className="w-full font-mono text-xs p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-rose-500 leading-relaxed"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="defaultSub"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
              />
              <label htmlFor="defaultSub" className="text-xs text-neutral-300 cursor-pointer">
                Set as default subtitle track for this movie
              </label>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                {isSaving ? 'Saving Track…' : 'Save Subtitle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtitles List */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Configured Subtitle Tracks</h3>
          <span className="text-xs text-neutral-400 font-mono">
            {subtitles.length} {subtitles.length === 1 ? 'track' : 'tracks'}
          </span>
        </div>

        {loadingSubs ? (
          <div className="p-12 text-center text-xs text-neutral-500">Loading subtitles…</div>
        ) : subtitles.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <Subtitles className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-400">No subtitles configured for this movie</p>
            <p className="text-xs text-neutral-500 mt-1">
              Add Bengali, English, Hindi, Spanish, or other tracks above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/60">
            {subtitles.map((sub) => (
              <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-neutral-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center text-indigo-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{sub.languageName}</span>
                      <span className="text-xs font-mono text-neutral-400">({sub.languageCode})</span>
                      {sub.isDefault && (
                        <span className="px-2 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">Label: {sub.label}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(sub.id)}
                  className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                  title="Delete Subtitle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
