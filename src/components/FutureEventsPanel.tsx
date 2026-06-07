/**
 * FutureEventsPanel — Future events modal
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean modal showing upcoming events in week/month view.
 * Week shows next 7 days, month shows current month.
 */

import { useState, useMemo } from 'react';
import type { CalendarEvent } from '../types';
import { getUserPreference, setUserPreference, PREF } from '../utils/userPreferences';

const HE_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];

const HE_DAY_FULL = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

const CATEGORY_COLOR: Record<string, string> = {
  academic: '#4A7A96',
  exam: '#C0645A',
  work: '#8B5E3C',
  personal: '#5A8C6A',
  meeting: '#7B60A8',
  holiday: '#F4B27C',
};

type ViewMode = 'week' | 'month';

export interface FutureEventsPanelProps {
  allEvents: CalendarEvent[];
  hasCalendar: boolean;
  onClose: () => void;
}

const FutureEventsPanel = ({ allEvents, hasCalendar, onClose }: FutureEventsPanelProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState<ViewMode>(
    () => getUserPreference(PREF.MINI_CAL_VIEW, 'month') as ViewMode
  );
  const [monthYear, setMonthYear] = useState({ year: today.getFullYear(), month: today.getMonth() });

  // Filter out demo events and sort by date
  const futureEvents = useMemo(() => {
    return allEvents
      .filter(e => e.source !== 'demo')
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.startTime}`);
        const dateB = new Date(`${b.date}T${b.startTime}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [allEvents]);

  // Group events by date for display
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of futureEvents) {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date)!.push(event);
    }
    return map;
  }, [futureEvents]);

  const handleViewChange = (newView: ViewMode) => {
    setView(newView);
    setUserPreference(PREF.MINI_CAL_VIEW, newView);
  };

  const prevMonth = () => {
    setMonthYear(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  };

  const nextMonth = () => {
    setMonthYear(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  };

  const rangeLabel = view === 'month'
    ? `${HE_MONTHS[monthYear.month]} ${monthYear.year}`
    : 'השבוע הקרוב';

  return (
    <div className="futureCalendarModalOverlay" role="dialog" aria-modal="true" dir="rtl" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="futureCalendarModalPanel">
        {/* Header */}
        <header className="futureCalendarModalHeader">
          <div>
            <h2>לוח אירועים קדימה</h2>
            <p>ראי שיעורים, משמרות, הגשות ואירועים מעבר להיום ומחר</p>
          </div>
          <button
            type="button"
            className="futureCalendarModalClose"
            onClick={onClose}
            aria-label="סגור"
          >
            ×
          </button>
        </header>

        {/* Toolbar */}
        <div className="futureCalendarModalToolbar">
          <div className="futureCalendarViewTabs">
            <button
              className={`futureCalendarTab${view === 'week' ? ' futureCalendarTab--active' : ''}`}
              onClick={() => handleViewChange('week')}
              type="button"
            >
              שבוע
            </button>
            <button
              className={`futureCalendarTab${view === 'month' ? ' futureCalendarTab--active' : ''}`}
              onClick={() => handleViewChange('month')}
              type="button"
            >
              חודש
            </button>
          </div>

          <div className="futureCalendarNav">
            <button className="futureCalendarNavBtn" onClick={prevMonth} type="button">›</button>
            <span className="futureCalendarNavLabel">{rangeLabel}</span>
            <button className="futureCalendarNavBtn" onClick={nextMonth} type="button">‹</button>
          </div>
        </div>

        {/* Body */}
        <main className="futureCalendarModalBody">
          {!hasCalendar || futureEvents.length === 0 ? (
            <div className="futureCalendarEmpty">
              <p>אין אירועים עתידיים להצגה.</p>
            </div>
          ) : (
            <div className="futureCalendarEventsList">
              {futureEvents.map((event) => {
                const eventDate = new Date(`${event.date}T${event.startTime}`);
                const dateStr = eventDate.toLocaleDateString('he-IL', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                });
                const color = CATEGORY_COLOR[event.category] || '#7c8798';

                return (
                  <div key={event.id} className="futureCalendarEventRow">
                    <div className="futureCalendarEventDate">
                      <span className="futureCalendarEventDateValue">{dateStr}</span>
                      <span className="futureCalendarEventTime">{event.startTime}</span>
                    </div>

                    <div className="futureCalendarEventContent">
                      <h3 className="futureCalendarEventTitle">{event.title}</h3>
                      {event.location && (
                        <p className="futureCalendarEventLocation">📍 {event.location}</p>
                      )}
                      {event.description && (
                        <p className="futureCalendarEventDescription">{event.description}</p>
                      )}
                    </div>

                    <div className="futureCalendarEventMeta">
                      <span
                        className="futureCalendarEventCategory"
                        style={{ backgroundColor: color }}
                      >
                        {event.category}
                      </span>
                      <span className="futureCalendarEventSource">{event.source}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default FutureEventsPanel;
