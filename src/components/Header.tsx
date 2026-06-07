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
          <h1 className="header-wordmark">
            <span className="header-wordmark-smart">Smart</span><span className="header-wordmark-day">Day</span>
          </h1>
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
