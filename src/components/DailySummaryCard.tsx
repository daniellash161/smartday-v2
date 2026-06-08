import { useState, useMemo } from 'react';
import type { Task, CalendarEvent } from '../types';
import { isToday } from '../utils/priority';

interface DailySummaryCardProps {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  newsCount: number;
}

const DailySummaryCard = ({ tasks, calendarEvents, newsCount }: DailySummaryCardProps) => {
  const [expanded, setExpanded] = useState(true);

  // Calculate real statistics
  const stats = useMemo(() => {
    // Count urgent tasks (high priority, not completed)
    const urgentTasks = tasks.filter(t => t.priority === 'high' && !t.completed);

    // Count today's calendar events
    const todayEvents = calendarEvents.filter(e => isToday(e.date));

    // Count alerts (approximate: urgent tasks + today events with importance)
    const alerts = [
      ...urgentTasks,
      ...todayEvents.filter(e => e.importance === 'important' || e.importance === 'urgent'),
    ].length;

    return {
      urgentTasks: urgentTasks.length,
      todayEvents: todayEvents.length,
      alerts: Math.min(alerts, 10), // Cap at 10 for display
      todayEventsList: todayEvents.slice(0, 2), // First 2 events for summary
      urgentTasksList: urgentTasks.slice(0, 2), // First 2 urgent tasks
    };
  }, [tasks, calendarEvents]);

  // Generate summary text based on real data
  const generateSummary = (): string => {
    // If no data at all
    if (stats.todayEvents === 0 && stats.urgentTasks === 0 && newsCount === 0) {
      return 'יש לך היום כמה עדכונים זמינים. חברי לוח שנה, משימות ומיילים כדי לקבל סיכום יומי מלא יותר.';
    }

    const parts: string[] = [];

    // Add today's events summary
    if (stats.todayEvents > 0) {
      const eventTitles = stats.todayEventsList
        .map(e => `${e.title} ב־${e.startTime}`)
        .join(', ');
      parts.push(`יש לך היום ${stats.todayEvents} אירוע בלוח הזמנים: ${eventTitles}.`);
    }

    // Add urgent tasks summary
    if (stats.urgentTasks > 0) {
      const taskTitles = stats.urgentTasksList
        .map(t => t.title)
        .join(', ');
      parts.push(`${stats.urgentTasks} משימות דחופות בהמתנה: ${taskTitles}.`);
    }

    // Add news summary if available
    if (newsCount > 0) {
      parts.push(`יש ${newsCount} עדכוני בוקר חשובים לדעת.`);
    }

    // Add recommendation
    if (stats.todayEvents > 0 || stats.urgentTasks > 0) {
      if (stats.todayEvents > 0) {
        parts.push('מומלץ להתחיל מהאירועים הקרובים ולתכנן את יום כדי להספיק לכל המשימות.');
      } else if (stats.urgentTasks > 0) {
        parts.push('מומלץ להתחיל מהמשימות הדחופות ולהקצות זמן מספיק להשלמתן.');
      }
    }

    return parts.join(' ');
  };

  const summaryText = generateSummary();

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
            {summaryText.split('.')[0] + '.'}
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
          <p className="daily-summary-text">{summaryText}</p>

          <div className="daily-summary-chips">
            {stats.urgentTasks > 0 && (
              <div className="daily-summary-chip daily-summary-chip-urgent">
                <span className="daily-summary-chip-icon">🔥</span>
                <span>{stats.urgentTasks} משימות דחופות</span>
              </div>
            )}
            {stats.todayEvents > 0 && (
              <div className="daily-summary-chip daily-summary-chip-events">
                <span className="daily-summary-chip-icon">📅</span>
                <span>{stats.todayEvents} אירועים היום</span>
              </div>
            )}
            {stats.alerts > 0 && (
              <div className="daily-summary-chip daily-summary-chip-alerts">
                <span className="daily-summary-chip-icon">🔔</span>
                <span>{stats.alerts} התראות</span>
              </div>
            )}
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
