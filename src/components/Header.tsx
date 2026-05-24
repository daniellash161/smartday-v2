const Header = () => {
  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="header-logo">🌅</span>
          <h1 className="header-title">SmartDay</h1>
          <span className="header-tagline">הלוח החכם שלך</span>
        </div>
        <div className="header-meta">
          <span className="header-date">{today}</span>
          <div className="header-avatar">ד</div>
        </div>
      </div>
    </header>
  );
};

export default Header;
