import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import AppRail from '../components/AppRail';
import AppTopBar from '../components/AppTopBar';
import ToastProvider from '../components/ui/Toast';
import { AppSessionProvider, useAppSession } from '../context/AppSessionProvider';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <AppSessionProvider>
      <ToastProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </ToastProvider>
    </AppSessionProvider>
  );
}

function AppContent({ Component, pageProps }) {
  const router = useRouter();
  const { role, displayName, isAuthenticated, isReady, refresh } = useAppSession();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTheme = localStorage.getItem('email_theme');
    setIsDarkMode(savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
    setRailCollapsed(localStorage.getItem('app_rail_collapsed') === 'true');
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const publicPath = ['/login', '/reset-password', '/csat'].includes(router.pathname);
    if (!isAuthenticated && !publicPath) router.replace('/login');
    if (isAuthenticated && router.pathname === '/login') router.replace('/inbox');
    if (isAuthenticated && router.pathname === '/') router.replace('/inbox');
  }, [isAuthenticated, isReady, router]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const loadNotifications = () =>
      fetch('/api/notifications')
        .then((response) => (response.ok ? response.json() : { unread: 0 }))
        .then((data) => setUnreadNotifications(data.unread || 0))
        .catch(() => {});
    loadNotifications();
    const timer = setInterval(loadNotifications, 15000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    const handleCommand = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleCommand);
    return () => window.removeEventListener('keydown', handleCommand);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.body.dataset.theme = isDarkMode ? 'dark' : 'light';
    localStorage.setItem('email_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  const showShell = isReady && isAuthenticated && !['/login', '/reset-password', '/csat'].includes(router.pathname);
  const toggleRail = () =>
    setRailCollapsed((current) => {
      const next = !current;
      localStorage.setItem('app_rail_collapsed', String(next));
      return next;
    });
  const markNotificationsRead = () => {
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(() => setUnreadNotifications(0));
  };
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
    router.push('/login');
  };
  const paletteItems = [
    { label: 'Open inbox', href: '/inbox' },
    { label: 'Compose email', href: '/compose' },
    { label: 'Open dashboard', href: '/dashboard' },
    { label: 'Open contacts', href: '/contacts' },
    { label: 'Open settings', href: '/settings' },
    ...(role === 'admin' ? [{ label: 'Open users', href: '/users' }] : []),
  ].filter((item) => item.label.toLowerCase().includes(paletteQuery.toLowerCase()));

  return (
    <>
      <Head>
        <title>Agosoft Email Portal</title>
        <meta name="description" content="Agosoft email inbox, outbox, and analytics portal." />
        <meta name="theme-color" content="#102033" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Email Portal" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" />
      </Head>
      {showShell && (
        <>
          <a className="skip-link" href="#main-content">Skip to content</a>
          <AppRail collapsed={railCollapsed} onToggle={toggleRail} unreadCount={unreadNotifications} isAdmin={role === 'admin'} />
          <div className="app-frame" data-rail-collapsed={railCollapsed}>
            <AppTopBar
              displayName={displayName}
              role={role}
              unreadCount={unreadNotifications}
              onThemeToggle={() => setIsDarkMode((current) => !current)}
              isDarkMode={isDarkMode}
              onCommand={() => setIsCommandPaletteOpen(true)}
              onNotifications={() => setNotificationsOpen((open) => !open)}
              onLogout={handleLogout}
            />
            {notificationsOpen && (
              <div className="app-notification-popover">
                <div className="app-popover-header">
                  <strong>Notifications</strong>
                  <button type="button" onClick={markNotificationsRead}>Mark all read</button>
                </div>
                <p className="app-popover-empty">
                  {unreadNotifications ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}.` : 'You are all caught up.'}
                </p>
              </div>
            )}
            <main id="main-content" className="page-shell"><Component {...pageProps} /></main>
          </div>
        </>
      )}
      {!showShell && <main id="main-content" className="page-shell"><Component {...pageProps} /></main>}
      {isCommandPaletteOpen && (
        <div className="palette-backdrop" onClick={() => setIsCommandPaletteOpen(false)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
            <input autoFocus value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search actions and pages" aria-label="Search actions and pages" />
            <div className="command-palette-list">
              {paletteItems.map((item) => (
                <button key={item.href} type="button" onClick={() => { setIsCommandPaletteOpen(false); router.push(item.href); }}>
                  {item.label}
                </button>
              ))}
              {!paletteItems.length && <p>No matching actions.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
