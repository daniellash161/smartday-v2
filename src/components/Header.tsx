import { useState, useEffect, useRef } from 'react';
import { getUserPreference, setUserPreference, PREF } from '../utils/userPreferences';
import {
  getUser,
  emailLocalPart,
  logout,
  disconnectGmailAccount,
  disconnectCalendarAccount,
  resetPreferences,
  fullReset,
} from '../utils/onboarding';

interface HeaderProps {
  onExitToOnboarding?: () => void;
}

const Header = ({ onExitToOnboarding }: HeaderProps) => {
  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const user = getUser();
  const name = user ? emailLocalPart(user.email) : '';
  const avatarInitial = name ? name.charAt(0).toUpperCase() : '👤';

  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (getUserPreference(PREF.THEME, 'light') as 'light' | 'dark') || 'light'
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setUserPreference(PREF.THEME, newTheme);
  };

  // ── Account actions ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    onExitToOnboarding?.();
  };

  const handleDisconnectGmail = () => {
    disconnectGmailAccount();
    setMenuOpen(false);
    // Force a refresh so cards re-read connection state
    window.location.reload();
  };

  const handleDisconnectCalendar = () => {
    disconnectCalendarAccount();
    setMenuOpen(false);
    window.location.reload();
  };

  const handleResetPreferences = () => {
    resetPreferences();
    setMenuOpen(false);
    window.location.reload();
  };

  const handleFullReset = () => {
    fullReset();
    setMenuOpen(false);
    onExitToOnboarding?.();
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <h1 className="header-wordmark">
            <span className="header-wordmark-smart">Smart</span><span className="header-wordmark-day">Day</span>
          </h1>
          <span className="header-tagline">הלוח החכם שלך</span>
        </div>
        <div className="header-meta">
          {name && <span className="header-greeting">שלום, {name}</span>}
          <span className="header-date">{today}</span>
          <button
            type="button"
            className="header-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'לילה' : 'יום'}
            aria-label={theme === 'light' ? 'לילה' : 'יום'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <div className="header-profile" ref={menuRef}>
            <button
              type="button"
              className="header-avatar"
              onClick={() => setMenuOpen(o => !o)}
              title="חשבון והגדרות"
              aria-label="חשבון והגדרות"
            >
              {avatarInitial}
            </button>
            {menuOpen && (
              <div className="header-menu">
                {user && (
                  <div className="header-menu-name">
                    {name}
                    <span className="header-menu-email">{user.email}</span>
                  </div>
                )}
                <button type="button" className="header-menu-item" onClick={handleLogout}>
                  ⎋ התנתקות
                </button>
                <button type="button" className="header-menu-item" onClick={handleDisconnectGmail}>
                  ✉️ ניתוק Gmail
                </button>
                <button type="button" className="header-menu-item" onClick={handleDisconnectCalendar}>
                  📅 ניתוק יומן
                </button>
                <button type="button" className="header-menu-item" onClick={handleResetPreferences}>
                  ↺ איפוס העדפות
                </button>
                <button type="button" className="header-menu-item header-menu-item--danger" onClick={handleFullReset}>
                  🗑 מחיקת פרופיל מקומי
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
