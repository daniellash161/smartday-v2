/**
 * NewsModal — Full width modal showing all morning news updates
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens when user clicks "פתח עדכוני בוקר" from the dashboard card.
 * Displays full list of news items with categories.
 */

import type { NewsItem } from '../services/newsService';

interface NewsModalProps {
  items: NewsItem[];
  demoMode: boolean;
  onAddTask?: (task: any) => void;
  existingTaskTitles?: Set<string>;
  onClose: () => void;
}

function fmtRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'עכשיו';
    if (m < 60) return `לפני ${m} דקות`;
    if (h < 24) return `לפני ${h} שעות`;
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  } catch { return ''; }
}

const NewsModal = ({ items, demoMode, onClose }: NewsModalProps) => {
  return (
    <div className="news-modal-overlay">
      <div className="news-modal-panel">
        <header className="news-modal-header">
          <div>
            <h2>📰 עדכוני בוקר</h2>
            <p>חדשות ועדכונים חשובים שיכולים להשפיע על היום שלך</p>
          </div>
          <button
            className="news-modal-close"
            onClick={onClose}
            aria-label="סגור"
          >
            ×
          </button>
        </header>

        <div className="news-modal-body">
          {items.length === 0 ? (
            <div className="news-empty-state">אין עדכונים זמינים.</div>
          ) : (
            <div className="news-modal-items">
              {items.map((item) => (
                <div key={item.id} className="news-modal-item">
                  <h3 className="news-modal-item-title">{item.title}</h3>
                  <div className="news-modal-item-meta">
                    <span>{item.source}</span>
                    {item.importance === 'high' && (
                      <span className="news-importance-badge">חשוב להיום</span>
                    )}
                    {demoMode && item.isDemo && (
                      <span className="news-demo-badge">נתוני דוגמה</span>
                    )}
                    <span>{fmtRelative(item.publishedAt)}</span>
                  </div>
                  {item.summary && (
                    <p className="news-modal-item-summary">{item.summary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsModal;
