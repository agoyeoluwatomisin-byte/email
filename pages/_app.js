import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppSessionProvider, useAppSession } from '../context/AppSessionProvider';
import ToastProvider from '../components/ui/Toast';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return <AppSessionProvider><ToastProvider><AppContent Component={Component} pageProps={pageProps} /></ToastProvider></AppSessionProvider>;
}

function AppContent({ Component, pageProps }) {
  const router = useRouter();
  const { user, role, displayName, isAuthenticated, isReady } = useAppSession();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem('email_theme');
    const preferredMode = savedTheme
      ? savedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(preferredMode);

    if (!isReady) return;
    const isLoginPage = router.pathname === '/login';
    if (!isAuthenticated && !isLoginPage) router.replace('/login');
    if (isAuthenticated && isLoginPage) router.replace('/dashboard');
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
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.body.dataset.theme = isDarkMode ? 'dark' : 'light';
    localStorage.setItem('email_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Unable to register app service worker:', error);
    });
  }, []);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/', label: 'Send email' },
    { href: '/inbox', label: 'Inbox' },
    { href: '/outbox', label: 'Outbox' },
    { href: '/drafts', label: 'Drafts' },
    { href: '/settings', label: 'Settings' },
    { href: '/contacts', label: 'Contacts' },
    { href: '/users', label: 'Users' },
  ];

  const showNav = isReady && isAuthenticated && router.pathname !== '/login';

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('email_session');
    setIsAuthenticated(false);
    router.push('/login');
  };
  const theme = isDarkMode
    ? {
        navBackground: '#0f172a',
        navBorder: 'rgba(148, 163, 184, 0.25)',
        navText: '#f8fafc',
        navLink: '#cbd5e1',
        navLinkActive: '#1e293b',
        pageBackground: '#07111f',
        toggleBackground: '#1e293b',
        toggleText: '#f8fafc',
      }
    : {
        navBackground: '#f8fafc',
        navBorder: 'rgba(148, 163, 184, 0.45)',
        navText: '#0f172a',
        navLink: '#334155',
        navLinkActive: '#dbeafe',
        pageBackground: '#f1f5f9',
        toggleBackground: '#e2e8f0',
        toggleText: '#0f172a',
      };

  return (
    <>
      <Head>
        <title>Agosoft Email Portal</title>
        <meta name="description" content="Agosoft email inbox, outbox, and analytics portal." />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Email Portal" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" />
      </Head>
      {showNav ? (
        <nav
          style={{
            ...styles.navbar,
            background: theme.navBackground,
            borderBottom: `1px solid ${theme.navBorder}`,
          }}
          className="app-nav"
          data-mobile-menu-open={isMobileMenuOpen ? 'true' : 'false'}
          aria-label="Main navigation"
        >
          <div className="app-nav-brand" style={{ ...styles.brand, color: theme.navText }}>
            Email
          </div>

          <button
            type="button"
            className="app-menu-toggle"
            style={{ ...styles.mobileMenuToggle, background: theme.toggleBackground, color: theme.toggleText }}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="primary-navigation"
          >
            <span aria-hidden="true">☰</span>
            <span className="sr-only">Menu</span>
          </button>

          <div className="app-nav-actions" style={styles.navActions}>
            <div id="primary-navigation" className="app-nav-links" style={styles.navLinks}>
              {navItems.map((item) => {
                const isActive = router.pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      ...styles.navLink,
                      color: isActive ? theme.navText : theme.navLink,
                      background: isActive ? theme.navLinkActive : 'transparent',
                    }}
                    className="app-nav-link"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsDarkMode((current) => !current)}
              style={{
                ...styles.themeToggle,
                background: theme.toggleBackground,
                color: theme.toggleText,
              }}
              className="app-theme-toggle"
            >
              {isDarkMode ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{ ...styles.themeToggle, background: theme.toggleBackground, color: theme.toggleText }}
            >
              Logout
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof Notification !== 'undefined' && Notification.permission === 'default')
                  Notification.requestPermission();
                fetch('/api/notifications', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({}),
                }).then(() => setUnreadNotifications(0));
              }}
              style={{ ...styles.themeToggle, background: theme.toggleBackground, color: theme.toggleText }}
              aria-label="Mark notifications read"
            >
              Bell{unreadNotifications ? ` (${unreadNotifications})` : ''}
            </button>
          </div>
        </nav>
      ) : null}

      <div className="page-shell" style={{ ...styles.pageShell, background: theme.pageBackground }}>
        <Component {...pageProps} />
      </div>
      {isCommandPaletteOpen && (
        <div style={styles.paletteBackdrop} onClick={() => setIsCommandPaletteOpen(false)}>
          <div style={styles.palette} onClick={(event) => event.stopPropagation()}>
            <strong>Command palette</strong>
            {navItems.map((item) => (
              <button
                key={item.href}
                type="button"
                style={styles.paletteItem}
                onClick={() => {
                  setIsCommandPaletteOpen(false);
                  router.push(item.href);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  navbar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    flexWrap: 'wrap',
    gap: 12,
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  navLink: {
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s ease',
  },
  themeToggle: {
    border: 'none',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  paletteBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    background: 'rgba(2, 6, 23, 0.65)',
    display: 'grid',
    placeItems: 'start center',
    paddingTop: 100,
  },
  palette: {
    width: 'min(92vw, 420px)',
    background: '#102033',
    border: '1px solid #36536e',
    borderRadius: 10,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    color: '#e5eef8',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  },
  paletteItem: {
    textAlign: 'left',
    border: '1px solid #29415b',
    background: '#0d1a2a',
    color: '#d7e5f2',
    borderRadius: 6,
    padding: 9,
    cursor: 'pointer',
  },
  mobileMenuToggle: {
    display: 'none',
    border: 'none',
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    fontSize: 20,
    cursor: 'pointer',
  },
  pageShell: {
    minHeight: 'calc(100vh - 68px)',
    padding: '24px 16px 40px',
  },
};
