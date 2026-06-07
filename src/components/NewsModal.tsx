/**
 * NewsModal — Full news list with filters
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens when user clicks "פתח עדכוני בוקר" from the dashboard card.
 * Shows up to 5 news items with category filters.
 */

import { useState, useMemo } from 'react';
import type { Task, TaskUrgency, TaskCategory, TaskStatus } from '../types';
import type {
  NewsItem,
  NewsCategory,
} from '../services/newsService';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface NewsModalProps {
  items:              NewsItem[];
  demoMode:           boolean;
  onAddTask?:         (task: Omit<Task, 'id' | 'createdAt'>) => void;
  existingTaskTitles?: Set<string>;
  onClose:            () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category display
// ─────────────────────────────────────────────────────────────────────────────

const CAT_LABEL: Record<NewsCategory | 'all', string> = {
  all:        'הכל',
  general:    'חדשות',
  business:   'כלכלה',
  technology: 'טכנולוגיה',
  transport:  'תחבורה',
  weather:    'מזג אוויר',
  emergency:  'חירום',
};

const CAT_CLASS: Record<NewsCategory, string> = {
  general:    'news-chip--general',
  business:   'news-chip--business',
  technology: 'news-chip--tech',
  transport:  'news-chip--transport',
  weather:    'news-chip--weather',
  emergency:  'news-chip--emergency',
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// NewsModalItem
// ─────────────────────────────────────────────────────────────────────────────

interface NewsModalItemProps {
  item:       NewsItem;
  taskAdded:  boolean;
  onAddTask?: () => void;
}

function NewsModalItem({ item, taskAdded, onAddTask }: NewsModalItemProps) {
  return (
    <div className="nm-item">
      {/* Header: category, importance, time */}
      <div className="nm-item-meta">
        <span className={`news-chip ${CAT_CLASS[item.category]}`}>
          {CAT_LABEL[item.category]}
        </span>
        {item.importance === 'high' && (
          <span className="news-importance-badge">חשוב להיום</span>
        )}
        {item.isDemo && (
          <span className="news-demo-badge">נתוני הדגמה</span>
        )}
        <span className="nm-time">{fmtRelative(item.publishedAt)}</span>
      </div>

      {/* Title */}
      <h3 className="nm-item-title">{item.title}</h3>

      {/* Summary */}
      {item.summary && (
        <p className="nm-item-summary">{item.summary}</p>
      )}

      {/* Source & time */}
      <div className="nm-source-row">
        <span className="nm-source">{item.source}</span>
        <span className="nm-source-time">{fmtTime(item.publishedAt)}</span>
      </div>

      {/* Actions */}
      <div className="nm-item-actions">
        {item.url && item.url !== '#' && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="nm-read-btn"
          >
            קראי עוד ↗
          </a>
        )}
        {onAddTask && (
          <button
            className={`nm-task-btn${taskAdded ? ' nm-task-btn--done' : ''}`}
            onClick={onAddTask}
            disabled={taskAdded}
          >
            {taskAdded ? '✓ נוסף למשימות' : '+ הוסף למשימות'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NewsModal
// ─────────────────────────────────────────────────────────────────────────────

const NewsModal = ({
  items, demoMode, onAddTask, existingTaskTitles = new Set(), onClose,
}: NewsModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'all'>('all');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const categories = useMemo((): (NewsCategory | 'all')[] => {
    return ['all', 'general', 'business', 'technology', 'transport', 'weather', 'emergency'];
  }, []);

  const filtered = useMemo(() => {
    return selectedCategory === 'all'
      ? items
      : items.filter(i => i.category === selectedCategory);
  }, [items, selectedCategory]);

  const handleAddTask = (item: NewsItem) => {
    if (!onAddTask) return;
    const title = `לבדוק עדכון חדשות: ${item.title.slice(0, 60)}`;
    if (addedIds.has(item.id) || existingTaskTitles.has(title)) return;
    onAddTask({
      title,
      description:  item.summary.slice(0, 200) || undefined,
      category:     'news' as TaskCategory,
      urgency:      (item.importance === 'high' ? 'high' : 'medium') as TaskUrgency,
      deadlineDate: new Date().toISOString().split('T')[0],
      status:       'open' as TaskStatus,
      source:       'news' as Task['source'],
    });
    setAddedIds(prev => new Set(prev).add(item.id));
  };

  return (
    <div className="nm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nm-modal" dir="rtl">
        {/* Header */}
        <div className="nm-header">
          <div className="nm-header-text">
            <h2 className="nm-title">עדכוני בוקר</h2>
            <p className="nm-subtitle">כל העדכונים החשובים במקום אחד</p>
          </div>
          <button className="nm-close-btn" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        {/* Category filters */}
        <div className="nm-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`nm-filter-chip${selectedCategory === cat ? ' nm-filter-chip--active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {CAT_LABEL[cat]}
            </button>
          ))}
        </div>

        {/* Items list */}
        <div className="nm-body">
          {filtered.length === 0 ? (
            <div className="nm-empty">
              <p>אין עדכונים בקטגוריה זו.</p>
            </div>
          ) : (
            <div className="nm-list">
              {filtered.map(item => (
                <NewsModalItem
                  key={item.id}
                  item={item}
                  taskAdded={addedIds.has(item.id) || existingTaskTitles.has(`לבדוק עדכון חדשות: ${item.title.slice(0, 60)}`)}
                  onAddTask={onAddTask ? () => handleAddTask(item) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer disclaimer */}
        {(demoMode || items.some(i => i.isDemo)) && (
          <p className="nm-disclaimer">
            ⓘ {demoMode ? 'מצב הדגמה בלבד.' : 'חלק מהעדכונים הם נתוני הדגמה.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default NewsModal;
