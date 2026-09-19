import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem('email_theme');
    const preferredMode = savedTheme === 'light' ? false : true;
    setIsDarkMode(preferredMode);

    const session = localStorage.getItem('email_session');
    const isLoggedIn = Boolean(session);
    const isLoginPage = router.pathname === '/login';

    setIsAuthenticated(isLoggedIn);
    setIsReady(true);

    if (!isLoggedIn && !isLoginPage) {
      router.replace('/login');
      return;
    }

    if (isLoggedIn && isLoginPage) {
      router.replace('/dashboard');
    }
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
  ];

  const showNav = isReady && isAuthenticated && router.pathname !== '/login';
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
          aria-label="Main navigation"
        >
          <div className="app-nav-brand" style={{ ...styles.brand, color: theme.navText }}>Email</div>

          <div className="app-nav-actions" style={styles.navActions}>
            <div className="app-nav-links" style={styles.navLinks}>
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
          </div>
        </nav>
      ) : null}

      <div className="page-shell" style={{ ...styles.pageShell, background: theme.pageBackground }}>
        <Component {...pageProps} />
      </div>
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
  pageShell: {
    minHeight: 'calc(100vh - 68px)',
    padding: '24px 16px 40px',
  },
};
