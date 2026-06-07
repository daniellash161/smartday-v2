import { useState, useEffect } from 'react';
import { getUserPreference, setUserPreference, PREF } from '../utils/userPreferences';

const Header = () => {
  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (getUserPreference(PREF.THEME, 'light') as 'light' | 'dark') || 'light'
  );

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setUserPreference(PREF.THEME, newTheme);
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
          <div className="header-avatar">ד</div>
        </div>
      </div>
    </header>
  );
};

export default Header;
