/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider } from './lib/auth/AuthContext';
import { RouterProvider, useRouter } from './lib/router';
import { Navbar } from './components/common/Navbar';
import { HomePage } from './pages/HomePage';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLiveControl } from './pages/admin/AdminLiveControl';
import { AdminMovies } from './pages/admin/AdminMovies';
import { AdminMovieForm } from './pages/admin/AdminMovieForm';
import { AdminSubtitles } from './pages/admin/AdminSubtitles';
import { AdminSettings } from './pages/admin/AdminSettings';
import { NotFoundPage } from './pages/NotFoundPage';

const AppContent: React.FC = () => {
  const { route } = useRouter();

  const renderCurrentRoute = () => {
    switch (route.name) {
      case 'home':
        return <HomePage />;
      case 'admin-login':
        return <AdminLogin />;
      case 'admin-dashboard':
        return <AdminDashboard />;
      case 'admin-live':
        return <AdminLiveControl />;
      case 'admin-movies':
        return <AdminMovies />;
      case 'admin-movies-new':
        return <AdminMovieForm />;
      case 'admin-movies-edit':
        return <AdminMovieForm movieId={route.params.id} />;
      case 'admin-subtitles':
        return <AdminSubtitles />;
      case 'admin-settings':
        return <AdminSettings />;
      default:
        return <NotFoundPage />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-rose-600 selection:text-white">
      <Navbar />
      <main className="flex-1">{renderCurrentRoute()}</main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <AppContent />
      </RouterProvider>
    </AuthProvider>
  );
}
