import Link from 'next/link';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  const navItems = [
    { href: '/', label: 'Send email' },
    { href: '/inbox', label: 'Inbox' },
  ];

  return (
    <>
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
    background: '#f8fafc',
  },
};
