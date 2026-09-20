import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AppSessionContext = createContext({
  user: null,
  role: null,
  displayName: '',
  isAuthenticated: false,
  isReady: false,
  refresh: async () => {},
});

export function AppSessionProvider({ children }) {
  const [session, setSession] = useState({ user: null, role: null, displayName: '', isAuthenticated: false });
  const [isReady, setIsReady] = useState(false);

  const load = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = response.ok ? await response.json() : { authenticated: false };
      setSession({
        user: data.user || null,
        role: data.user?.role || null,
        displayName: data.user?.displayName || data.user?.display_name || '',
        isAuthenticated: Boolean(data.authenticated),
      });
    } catch (error) {
      setSession({ user: null, role: null, displayName: '', isAuthenticated: false });
    } finally {
      setIsReady(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const value = useMemo(() => ({ ...session, isReady, refresh: load }), [session, isReady]);
  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  return useContext(AppSessionContext);
}
