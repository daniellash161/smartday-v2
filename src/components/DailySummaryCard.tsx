import { useState } from 'react';
import { aiDailySummary } from '../data/mockData';

const DailySummaryCard = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card summary-card">
      <div className="card-header" onClick={() => setExpanded((e) => !e)} style={{ cursor: 'pointer' }}>
        <div className="card-title-row">
          <span className="card-icon">🤖</span>
          <h2 className="card-title">סיכום יומי חכם</h2>
        </div>
        <span className="card-toggle">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="summary-body">
          <p className="summary-text">{aiDailySummary}</p>
          <div className="summary-stats">
            <div className="stat-pill stat-red">
              <span>🔥</span>
              <span>2 משימות דחופות</span>
            </div>
            <div className="stat-pill stat-yellow">
              <span>📅</span>
              <span>2 אירועים היום</span>
            </div>
            <div className="stat-pill stat-blue">
              <span>🔔</span>
              <span>4 התראות</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySummaryCard;
