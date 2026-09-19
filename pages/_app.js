import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/', label: 'Send email' },
    { href: '/inbox', label: 'Inbox' },
    { href: '/outbox', label: 'Outbox' },
  ];

  const showNav = isReady && isAuthenticated && router.pathname !== '/login';

  return (
    <>
      {showNav ? (
        <nav style={styles.navbar} aria-label="Main navigation">
          <div style={styles.brand}>Email</div>
          <div style={styles.navLinks}>
            {navItems.map((item) => {
              const isActive = router.pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...styles.navLink,
                    ...(isActive ? styles.navLinkActive : {}),
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div style={styles.pageShell}>
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
    background: '#0f172a',
    borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    flexWrap: 'wrap',
    gap: 12,
  },
  brand: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  navLink: {
    color: '#cbd5e1',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s ease',
  },
  navLinkActive: {
    background: '#1e293b',
    color: '#f8fafc',
  },
  pageShell: {
    minHeight: 'calc(100vh - 68px)',
    background: '#07111f',
    padding: '24px 16px 40px',
  },
};
