import React, { useEffect, useState } from 'react';
import { Settings, Check, AlertCircle } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { PlatformSettings } from '../../types';
import { getPlatformSettings, updatePlatformSettings } from '../../lib/services/settings';

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSettings>({
    platformName: 'CineLive',
    logoUrl: '',
    chatEnabled: true,
    defaultQuality: 'Auto',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getPlatformSettings()
      .then((data) => {
        if (data) setSettings(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setErrorMsg(null);
    try {
      await updatePlatformSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      setErrorMsg(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Platform Settings"
      subtitle="Configure Live TV broadcast defaults, global chat availability, and branding."
    >
      <div className="max-w-2xl">
        {loading ? (
          <div className="p-16 text-center text-neutral-500">
            <div className="w-8 h-8 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin mx-auto mb-3" />
            Loading settings…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 rounded-3xl bg-neutral-900/70 border border-neutral-800 shadow-xl space-y-6"
          >
            {success && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <Check className="w-4 h-4 shrink-0" />
                <span>Platform settings updated successfully!</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Platform Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Channel / Platform Name
              </label>
              <input
                type="text"
                value={settings.platformName}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
                required
              />
            </div>

            {/* Logo URL */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Custom Logo URL (Optional)
              </label>
              <input
                type="url"
                value={settings.logoUrl || ''}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
              />
            </div>

            {/* Broadcast Options */}
            <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-4">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Live Channel Options
              </h4>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Enable Global Live Chat</div>
                  <div className="text-[11px] text-neutral-400">
                    Allow anonymous viewer comments during the live stream
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.chatEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, chatEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Default Streaming Quality</div>
                  <div className="text-[11px] text-neutral-400">
                    Default rendition for newly connected viewers
                  </div>
                </div>
                <select
                  value={settings.defaultQuality}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultQuality: e.target.value })
                  }
                  className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="Auto">Auto (Adaptive Bitrate)</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};
