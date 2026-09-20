import Link from 'next/link';
import { useRouter } from 'next/router';
import MailIcon from './MailIcon';

const primaryItems = [
  { href: '/inbox', label: 'Inbox', icon: 'inbox' },
  { href: '/compose', label: 'Compose', icon: 'send' },
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/contacts', label: 'Contacts', icon: 'contacts' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function AppRail({ collapsed, onToggle, unreadCount = 0, isAdmin = false }) {
  const router = useRouter();
  const items = isAdmin ? [...primaryItems, { href: '/users', label: 'Users', icon: 'users' }] : primaryItems;
  const isActive = (href) => router.pathname === href || (href === '/inbox' && router.pathname === '/outbox');

  return (
    <>
      <aside className="app-rail" data-collapsed={collapsed} aria-label="Application navigation">
        <div className="app-rail-brand">
          <Link href="/inbox" aria-label="Open inbox" className="app-rail-logo">
            <MailIcon name="mail" size={20} />
          </Link>
          {!collapsed && <span className="app-rail-wordmark">Mailroom</span>}
        </div>
        <nav className="app-rail-nav" aria-label="Primary">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="app-rail-link"
              aria-current={isActive(item.href) ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className="app-rail-icon">
                <MailIcon name={item.icon} />
                {item.href === '/inbox' && unreadCount > 0 && <span className="app-rail-badge">{unreadCount}</span>}
              </span>
              <span className="app-rail-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <button type="button" className="app-rail-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          <MailIcon name={collapsed ? 'chevron-right' : 'chevron-left'} />
          <span className="app-rail-label">{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
      </aside>
      <nav className="app-bottom-nav" aria-label="Mobile navigation">
        {items.slice(0, 3).map((item) => (
          <Link key={item.href} href={item.href} className="app-bottom-link" aria-current={isActive(item.href) ? 'page' : undefined}>
            <MailIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <Link href="/settings" className="app-bottom-link" aria-current={router.pathname.startsWith('/settings') ? 'page' : undefined}>
          <MailIcon name="more" />
          <span>More</span>
        </Link>
      </nav>
    </>
  );
}
