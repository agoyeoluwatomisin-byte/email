import { useState } from 'react';
import { useRouter } from 'next/router';
import MailIcon from './MailIcon';
import Link from 'next/link';

export default function AppTopBar({ displayName, role, unreadCount, onThemeToggle, isDarkMode, onCommand, onNotifications, onLogout }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const label = displayName || 'Account';

  return (
    <header className="app-topbar">
      <div className="app-breadcrumb">
        <span className="app-breadcrumb-title">{pageTitle(router.pathname)}</span>
      </div>
      <div className="app-topbar-actions">
        <button type="button" className="app-command-trigger" onClick={onCommand} aria-label="Open command palette">
          <MailIcon name="search" size={16} />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="app-notification-wrap">
          <button type="button" className="app-topbar-icon" onClick={onNotifications} aria-label="Open notifications">
            <MailIcon name="bell" />
            {unreadCount > 0 && <span className="app-notification-dot" />}
          </button>
        </div>
        <button type="button" className="app-topbar-icon" onClick={onThemeToggle} aria-label="Toggle theme" title={isDarkMode ? 'Use light theme' : 'Use dark theme'}>
          <MailIcon name={isDarkMode ? 'sun' : 'moon'} />
        </button>
        <div className="app-user-wrap">
          <button type="button" className="app-user-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            <span className="app-avatar">{label.slice(0, 1).toUpperCase()}</span>
            <span className="app-user-copy"><strong>{label}</strong><small>{role || 'Member'}</small></span>
            <MailIcon name="chevron-down" size={14} />
          </button>
          {menuOpen && (
            <div className="app-user-menu" role="menu">
              <Link href="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>Settings</Link>
              <Link href="/settings?section=security" role="menuitem" onClick={() => setMenuOpen(false)}>Security</Link>
              <button type="button" role="menuitem" onClick={onLogout}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function pageTitle(pathname) {
  if (pathname === '/inbox' || pathname === '/outbox') return 'Inbox';
  if (pathname === '/compose' || pathname === '/') return 'Compose';
  return pathname.slice(1).split('/')[0].replace(/-/g, ' ') || 'Mailroom';
}
