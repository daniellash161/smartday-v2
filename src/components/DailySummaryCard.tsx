import { useState } from 'react';
import { aiDailySummary } from '../data/mockData';

const DailySummaryCard = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="daily-summary-card">
      {/* Header */}
      <header className="daily-summary-header" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        <div className="daily-summary-header-content">
          <h2 className="daily-summary-title">סיכום יומי חכם</h2>
          <p className="daily-summary-subtitle">מה חשוב לדעת לפני שמתחילים את היום</p>
        </div>
        <span className="daily-summary-icon">📊</span>
      </header>

      {/* Collapsed view - show compact summary */}
      {!expanded && (
        <div className="daily-summary-compact">
          <p className="daily-summary-compact-text">
            {aiDailySummary.split('\n')[0]}
          </p>
          <button
            className="daily-summary-expand-btn"
            onClick={() => setExpanded(true)}
            type="button"
          >
            פתח סיכום מלא
          </button>
        </div>
      )}

      {/* Expanded view - show full content */}
      {expanded && (
        <div className="daily-summary-body">
          <p className="daily-summary-text">{aiDailySummary}</p>

          <div className="daily-summary-chips">
            <div className="daily-summary-chip daily-summary-chip-urgent">
              <span className="daily-summary-chip-icon">🔥</span>
              <span>2 משימות דחופות</span>
            </div>
            <div className="daily-summary-chip daily-summary-chip-events">
              <span className="daily-summary-chip-icon">📅</span>
              <span>2 אירועים היום</span>
            </div>
            <div className="daily-summary-chip daily-summary-chip-alerts">
              <span className="daily-summary-chip-icon">🔔</span>
              <span>4 התראות</span>
            </div>
          </div>

          <button
            className="daily-summary-collapse-btn"
            onClick={() => setExpanded(false)}
            type="button"
          >
            כווץ סיכום
          </button>
        </div>
      )}
    </section>
  );
};

export default DailySummaryCard;
