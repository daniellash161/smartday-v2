/**
 * NewsUpdatesCard — Compact dashboard news summary
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows 1 main headline on the dashboard + button to open full modal.
 * Real news via Google News RSS (no API key required).
 */

import { useState, useEffect } from 'react';
import {
  fetchMorningNews,
  DEMO_NEWS,
  type NewsItem,
} from '../services/newsService';
import { getUserPreference, setUserPreference, PREF } from '../utils/userPreferences';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface NewsUpdatesCardProps {
  compact?:            boolean;
  onOpenModal?:        () => void;
  onItemsLoaded?:      (items: NewsItem[]) => void;
  demoMode?:           boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return 'עכשיו';
    if (m < 60) return `לפני ${m} דקות`;
    if (h < 24) return `לפני ${h} שעות`;
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  } catch { return ''; }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// NewsUpdatesCard
// ─────────────────────────────────────────────────────────────────────────────

type Status = 'loading' | 'success' | 'error' | 'demo';

const NewsUpdatesCard = ({ compact = false, onOpenModal, onItemsLoaded, demoMode: propDemoMode }: NewsUpdatesCardProps) => {
  const [status,   setStatus]   = useState<Status>('loading');
  const [items,    setItems]    = useState<NewsItem[]>([]);
  const [demoMode, setDemoMode] = useState<boolean>(
    () => propDemoMode ?? getUserPreference(PREF.NEWS_DEMO_ENABLED, false),
  );
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch news on mount or when demo mode changes
  useEffect(() => {
    if (demoMode) {
      setItems(DEMO_NEWS);
      setStatus('demo');
      onItemsLoaded?.(DEMO_NEWS);
      return;
    }

    setStatus('loading');
    fetchMorningNews()
      .then(data => {
        setItems(data);
        onItemsLoaded?.(data);
        setStatus(data.length === 0 ? 'error' : 'success');
      })
      .catch(() => {
        setItems([]);
        onItemsLoaded?.([]);
        setStatus('error');
      });
  }, [demoMode, onItemsLoaded]);

  const enableDemo = () => {
    setUserPreference(PREF.NEWS_DEMO_ENABLED, true);
    setDemoMode(true);
  };

  const retryFetch = () => {
    setStatus('loading');
    setRefreshError(null);
    fetchMorningNews()
      .then(data => {
        setItems(data);
        onItemsLoaded?.(data);
        setLastUpdated(new Date().toISOString());
        setStatus(data.length === 0 ? 'error' : 'success');
      })
      .catch(() => {
        setItems([]);
        onItemsLoaded?.([]);
        setStatus('error');
      });
  };

  const refreshNews = () => {
    if (demoMode) {
      setLastUpdated(new Date().toISOString());
      return;
    }
    setIsRefreshing(true);
    setRefreshError(null);
    fetchMorningNews()
      .then(data => {
        if (data.length > 0) {
          setItems(data);
          onItemsLoaded?.(data);
          setLastUpdated(new Date().toISOString());
          setStatus('success');
        } else {
          setRefreshError('לא זוהו עדכונים חדשים כרגע.');
        }
        setIsRefreshing(false);
      })
      .catch(() => {
        setRefreshError('לא הצלחנו לרענן כרגע. המידע הקודם עדיין זמין.');
        setIsRefreshing(false);
      });
  };

  const mainItem = items.find(i => i.importance === 'high') ?? items[0];
  const remainingCount = items.length - 1;

  return (
    <div className="card news-card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon">📰</span>
          <h2 className="card-title">עדכוני בוקר</h2>
        </div>
        <p className="news-subtitle">מה שחשוב לדעת לפני שמתחילים את היום</p>
      </div>

      {/* ── Compact Mode (main dashboard) ── */}
      {compact && (
        <div className="news-compact-view">
          {status === 'loading' && (
            <div className="news-state-msg">⏳ טוענים עדכוני בוקר...</div>
          )}

          {status === 'error' && (
            <div className="news-state-block">
              <p>לא הצלחנו למשוך עדכונים כרגע.</p>
              <div className="news-compact-actions">
                <button className="news-action-btn" onClick={retryFetch}>נסה שוב</button>
                <button className="news-action-btn news-action-btn--secondary" onClick={enableDemo}>הפעל הדגמה</button>
              </div>
            </div>
          )}

          {(status === 'success' || status === 'demo') && mainItem && (
            <div className="news-compact-item">
              {mainItem.importance === 'high' && (
                <span className="news-importance-badge">חשוב להיום</span>
              )}
              <p className="news-compact-title">{mainItem.title}</p>
              <div className="news-compact-footer">
                <span className="news-compact-source">{mainItem.source}</span>
                <span className="news-compact-time">{fmtRelative(mainItem.publishedAt)}</span>
              </div>
              {remainingCount > 0 && (
                <p className="news-compact-remaining">עוד {remainingCount} עדכונים זמינים</p>
              )}
            </div>
          )}

          {/* Refresh error message */}
          {refreshError && (
            <p className="news-refresh-error">{refreshError}</p>
          )}

          {/* Last updated time */}
          {(status === 'success' || status === 'demo' || status === 'error') && (
            <p className="news-last-updated">עודכן לאחרונה: {fmtTime(lastUpdated)}</p>
          )}

          {/* Buttons row */}
          {(status === 'success' || status === 'demo' || status === 'error') && (
            <div className="news-compact-buttons">
              <button className="news-open-btn" onClick={onOpenModal}>
                פתח עדכוני בוקר
              </button>
              <button
                className="news-refresh-btn"
                onClick={refreshNews}
                disabled={isRefreshing}
                title="רענן חדשות"
              >
                {isRefreshing ? '⟳' : '↻'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Full Mode (for modal, if ever needed) ── */}
      {!compact && (
        <div className="news-full-view">
          {status === 'loading' && (
            <div className="news-state-msg">⏳ טוענים עדכוני בוקר...</div>
          )}

          {status === 'error' && (
            <div className="news-state-block">
              <p>לא הצלחנו למשוך עדכונים כרגע.</p>
              <div className="news-compact-actions">
                <button className="news-action-btn" onClick={retryFetch}>נסה שוב</button>
                <button className="news-action-btn news-action-btn--secondary" onClick={enableDemo}>הפעל הדגמה</button>
              </div>
            </div>
          )}

          {(status === 'success' || status === 'demo') && (
            <p className="news-state-msg">{items.length} עדכונים זמינים</p>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsUpdatesCard;
