/**
 * NewsModal — Morning news updates modal
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens when user clicks "פתח עדכוני בוקר" from the dashboard card.
 * Displays full list of news items in a centered modal.
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
    <div className="morningNewsModalOverlay" role="dialog" aria-modal="true" dir="rtl" onClick={onClose}>
      <div className="morningNewsModalPanel" onClick={(e) => e.stopPropagation()}>
        <header className="morningNewsModalHeader">
          <div>
            <h2>עדכוני בוקר</h2>
            <p>חדשות ועדכונים חשובים שיכולים להשפיע על היום שלך</p>
          </div>
          <button
            type="button"
            className="morningNewsModalClose"
            onClick={onClose}
            aria-label="סגור"
            title="סגור"
          >
            ×
          </button>
        </header>

        <main className="morningNewsModalBody">
          {items.length === 0 ? (
            <div className="morningNewsEmpty">אין עדכונים חשובים כרגע.</div>
          ) : (
            <div>
              {items.map((item) => (
                <div key={item.id} className="morningNewsItem">
                  <h3 className="morningNewsItemTitle">{item.title}</h3>
                  <div className="morningNewsItemMeta">
                    <span>{item.source}</span>
                    {item.importance === 'high' && (
                      <span style={{ color: '#c0645a', fontWeight: 700 }}>דחוף</span>
                    )}
                    {demoMode && item.isDemo && (
                      <span style={{ color: '#667085', fontWeight: 600 }}>נתוני דוגמה</span>
                    )}
                    <span style={{ color: '#a0aab5', fontSize: '0.8rem' }}>{fmtRelative(item.publishedAt)}</span>
                  </div>
                  {item.summary && (
                    <p style={{ marginTop: '8px', color: '#667085', fontSize: '0.92rem', lineHeight: 1.5 }}>
                      {item.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default NewsModal;
