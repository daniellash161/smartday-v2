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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial load of news
  const loadNews = async () => {
    if (demoMode) {
      setItems(DEMO_NEWS);
      setStatus('demo');
      onItemsLoaded?.(DEMO_NEWS);
      setLoadError(null);
      return;
    }

    setStatus('loading');
    setLoadError(null);

    try {
      const data = await fetchMorningNews();
      setItems(data);
      onItemsLoaded?.(data);
      setStatus(data.length === 0 ? 'error' : 'success');
      setLoadError(null);
    } catch {
      setItems([]);
      onItemsLoaded?.([]);
      setStatus('error');
      setLoadError('לא הצלחנו למשוך עדכונים כרגע.');
    }
  };

  // Fetch news on mount or when demo mode changes
  useEffect(() => {
    loadNews();
  }, [demoMode, onItemsLoaded]);

  // Refresh existing news — same function as initial load
  const refreshNews = async () => {
    if (demoMode) {
      setLastUpdated(new Date().toISOString());
      return;
    }

    setIsRefreshing(true);
    setLoadError(null);

    try {
      const data = await fetchMorningNews();
      if (data.length > 0) {
        setItems(data);
        onItemsLoaded?.(data);
        setLastUpdated(new Date().toISOString());
        setStatus('success');
        setLoadError(null);
      } else {
        setLoadError('לא זוהו עדכונים חדשים כרגע.');
      }
    } catch (error) {
      console.error('News refresh error:', error);
      setLoadError('הרענון נכשל, מוצגים העדכונים האחרונים שנשמרו.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const mainItem = items.find(i => i.importance === 'high') ?? items[0];
  const remainingCount = items.length - 1;

  if (!compact) return null;

  return (
    <div className="news-updates-card">
      {/* Header */}
      <div className="news-updates-header">
        <div>
          <h3>📰 עדכוני בוקר</h3>
          <p>מה שחשוב לדעת לפני שמתחילים את היום</p>
        </div>
      </div>

      {/* Loading state — on initial load OR during refresh (if no items yet) */}
      {(status === 'loading' || isRefreshing) && items.length === 0 && (
        <div className="news-empty-state">⏳ טוענים עדכוני בוקר...</div>
      )}

      {/* Error state — only if no items loaded */}
      {status === 'error' && items.length === 0 && !loadError && (
        <div className="news-error-state">
          <p>לא הצלחנו למשוך עדכונים כרגע.</p>
        </div>
      )}

      {/* Refresh error — show if refresh fails but keep existing items visible */}
      {loadError && (
        <div className="news-error-state">
          <p>{loadError}</p>
        </div>
      )}

      {/* No items state */}
      {items.length === 0 && status !== 'loading' && status !== 'error' && !isRefreshing && !loadError && (
        <div className="news-empty-state">אין עדכונים חשובים כרגע.</div>
      )}

      {/* Show main news item if available */}
      {mainItem && (
        <div className="news-main-item">
          <p className="news-main-item-title">{mainItem.title}</p>
          <div className="news-main-item-meta">
            <span>{mainItem.source}</span>
            <span>{fmtRelative(mainItem.publishedAt)}</span>
          </div>
          {remainingCount > 0 && (
            <p style={{ marginTop: '8px', color: '#7c8798', fontSize: '0.9rem' }}>
              עוד {remainingCount} עדכונים זמינים
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="news-actions">
        <button
          className="news-open-button"
          onClick={onOpenModal}
          type="button"
        >
          פתח עדכוני בוקר
        </button>
        <button
          className="news-refresh-button"
          onClick={refreshNews}
          disabled={isRefreshing}
          type="button"
          title="רענן חדשות"
        >
          {isRefreshing ? 'מרענן...' : 'רענן'}
        </button>
      </div>
    </div>
  );
};

export default NewsUpdatesCard;
