import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  Film,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import { useRouter } from '../../lib/router';

export const AdminLogin: React.FC = () => {
  const { user, isAdmin, loginWithCredentials, loading, authReady } = useAuth();
  const { navigate } = useRouter();

  const [username, setUsername] = useState('Tanvir');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (authReady && user && isAdmin) {
      navigate('/admin');
    }
  }, [user, isAdmin, authReady, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim()) {
      setErrorMsg('ইউজারনেম লিখুন (Tanvir)');
      return;
    }
    if (!password) {
      setErrorMsg('পাসওয়ার্ড লিখুন (Movie)');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithCredentials(username, password);
      navigate('/admin');
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || 'লগইন ব্যর্থ হয়েছে। ইউজারনেম ও পাসওয়ার্ড সঠিক কিনা পরীক্ষা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-5 border border-rose-500/30 shadow-inner">
            <Film className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">CineLive Admin Login</h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
            লাইভ ব্রডকাস্ট ও মুভি লাইব্রেরি পরিচালনা করতে ইউজারনেম এবং পাসওয়ার্ড দিয়ে লগইন করুন।
          </p>
        </div>

        {errorMsg && (
          <div className="mt-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Username / Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tanvir"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Movie"
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Username: <strong className="text-white font-mono">Tanvir</strong></span>
            <span>Password: <strong className="text-white font-mono">Movie</strong></span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-98"
          >
            <span>{isSubmitting ? 'লগইন হচ্ছে...' : 'Login as Admin'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
