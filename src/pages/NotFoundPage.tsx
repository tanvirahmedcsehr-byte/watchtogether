import React from 'react';
import { Tv, ArrowLeft } from 'lucide-react';
import { useRouter } from '../lib/router';

export const NotFoundPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-4">
          <Tv className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-xs sm:text-sm text-neutral-400 mb-6 leading-relaxed">
          The requested page does not exist. Tune into the public Live TV channel below.
        </p>
        <button
          onClick={() => navigate('/')}
          className="w-full py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Watch Live Channel</span>
        </button>
      </div>
    </div>
  );
};
