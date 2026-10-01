import React, { createContext, useContext, useEffect, useState } from 'react';

export interface RouteMatch {
  name:
    | 'home'
    | 'admin-login'
    | 'admin-dashboard'
    | 'admin-live'
    | 'admin-movies'
    | 'admin-movies-new'
    | 'admin-movies-edit'
    | 'admin-subtitles'
    | 'admin-settings'
    | 'not-found';
  params: Record<string, string>;
  path: string;
}

interface RouterContextType {
  route: RouteMatch;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  route: { name: 'home', params: {}, path: '/' },
  navigate: () => {},
});

function parseRoute(pathname: string, hash: string): RouteMatch {
  let targetPath = pathname;
  if (hash.startsWith('#/')) {
    targetPath = hash.slice(1);
  } else if (hash.startsWith('#')) {
    targetPath = hash.slice(1);
  }

  if (!targetPath || targetPath === '') targetPath = '/';
  targetPath = targetPath.split('?')[0];

  // Admin routes
  if (targetPath === '/admin/login') {
    return { name: 'admin-login', params: {}, path: targetPath };
  }
  if (targetPath === '/admin' || targetPath === '/admin/') {
    return { name: 'admin-dashboard', params: {}, path: targetPath };
  }
  if (targetPath === '/admin/live') {
    return { name: 'admin-live', params: {}, path: targetPath };
  }
  if (targetPath === '/admin/movies/new') {
    return { name: 'admin-movies-new', params: {}, path: targetPath };
  }
  const movieEditMatch = targetPath.match(/^\/admin\/movies\/([a-zA-Z0-9_-]+)/);
  if (movieEditMatch) {
    return {
      name: 'admin-movies-edit',
      params: { id: movieEditMatch[1] },
      path: targetPath,
    };
  }
  if (targetPath === '/admin/movies') {
    return { name: 'admin-movies', params: {}, path: targetPath };
  }
  if (targetPath === '/admin/subtitles') {
    return { name: 'admin-subtitles', params: {}, path: targetPath };
  }
  if (targetPath === '/admin/settings') {
    return { name: 'admin-settings', params: {}, path: targetPath };
  }

  // Home route (Viewer Live TV)
  if (targetPath === '/' || targetPath === '/watch' || targetPath === '/live') {
    return { name: 'home', params: {}, path: '/' };
  }

  return { name: 'not-found', params: {}, path: targetPath };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<RouteMatch>(() =>
    parseRoute(window.location.pathname, window.location.hash)
  );

  useEffect(() => {
    const handlePop = () => {
      setRoute(parseRoute(window.location.pathname, window.location.hash));
    };

    window.addEventListener('popstate', handlePop);
    window.addEventListener('hashchange', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('hashchange', handlePop);
    };
  }, []);

  const navigate = (to: string) => {
    try {
      window.history.pushState({}, '', to);
      setRoute(parseRoute(to, ''));
      window.scrollTo(0, 0);
    } catch (e) {
      window.location.hash = to;
    }
  };

  return (
    <RouterContext.Provider value={{ route, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => useContext(RouterContext);
