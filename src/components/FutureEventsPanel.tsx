/**
 * FutureEventsPanel — Mini calendar modal showing future events
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows upcoming events in month or week grid view with day selection and detail panel.
 */

import { useState, useMemo } from 'react';
import type { CalendarEvent, EventCategory } from '../types';
import { getUserPreference, setUserPreference, PREF } from '../utils/userPreferences';

const HE_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];

const HE_DAY_SHORT = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
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
    () => (getUserPreference(PREF.MINI_CAL_VIEW, 'month') as ViewMode) || 'month'
  );
  const [monthYear, setMonthYear] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(
    today.toISOString().split('T')[0]
  );

  // Filter real events (no demo) and sort by date
  const realEvents = useMemo(() => {
    return allEvents
      .filter(e => e.source !== 'demo')
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.startTime || '00:00'}`);
        const dateB = new Date(`${b.date}T${b.startTime || '00:00'}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [allEvents]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of realEvents) {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date)!.push(event);
    }
    return map;
  }, [realEvents]);

  // Month grid generation
  const monthDays = useMemo(() => {
    const firstDay = new Date(monthYear.year, monthYear.month, 1).getDay();
    const daysInMonth = new Date(monthYear.year, monthYear.month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    while (days.length % 7) days.push(null);
    return days;
  }, [monthYear]);

  // Week generation
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

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

  const getDateString = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getDayEventsForMonth = (day: number): CalendarEvent[] => {
    const dateStr = getDateString(monthYear.year, monthYear.month, day);
    return eventsByDate.get(dateStr) || [];
  };

  const getDayEventsForWeek = (dateStr: string): CalendarEvent[] => {
    return eventsByDate.get(dateStr) || [];
  };

  const isToday = (dateStr: string) => dateStr === today.toISOString().split('T')[0];
  const isSelected = (dateStr: string) => dateStr === selectedDay;

  const selectedDayEvents = selectedDay ? getDayEventsForWeek(selectedDay) : [];
  const selectedDayObj = selectedDay ? new Date(selectedDay) : null;

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
            <span className="futureCalendarNavLabel">
              {view === 'month'
                ? `${HE_MONTHS[monthYear.month]} ${monthYear.year}`
                : `שבוע ${weekStart.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' })}`}
            </span>
            <button className="futureCalendarNavBtn" onClick={nextMonth} type="button">‹</button>
          </div>
        </div>

        {/* Body */}
        <main className="futureCalendarModalBody">
          {!hasCalendar || realEvents.length === 0 ? (
            <div className="futureCalendarEmpty">
              <p>אין אירועים עתידיים להצגה.</p>
            </div>
          ) : view === 'month' ? (
            <div className="futureCalendarContent">
              {/* Month Grid */}
              <div className="futureCalendarGrid">
                {/* Day headers */}
                {HE_DAY_SHORT.map((d, i) => (
                  <div key={`dow-${i}`} className="futureCalendarDowHeader">{d}</div>
                ))}

                {/* Day cells */}
                {monthDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="futureCalendarDayCell futureCalendarDayCell--empty" />;

                  const dateStr = getDateString(monthYear.year, monthYear.month, day);
                  const dayEvents = getDayEventsForMonth(day);
                  const isCurrentDay = isToday(dateStr);
                  const isCurrentSelected = isSelected(dateStr);

                  return (
                    <div
                      key={`day-${day}`}
                      className={`futureCalendarDayCell${isCurrentDay ? ' futureCalendarDayCell--today' : ''}${isCurrentSelected ? ' futureCalendarDayCell--selected' : ''}`}
                      onClick={() => setSelectedDay(dateStr)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="futureCalendarDayNumber">{day}</div>
                      <div className="futureCalendarDayEvents">
                        {dayEvents.slice(0, 2).map(event => (
                          <div
                            key={event.id}
                            className="futureCalendarEventChip"
                            style={{ backgroundColor: CATEGORY_COLOR[event.category] || '#ccc' }}
                            title={event.title}
                          >
                            {event.title.slice(0, 12)}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="futureCalendarMoreChip">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="futureCalendarContent">
              {/* Week Grid */}
              <div className="futureCalendarWeekGrid">
                {weekDays.map(dateStr => {
                  const d = new Date(dateStr);
                  const dow = HE_DAY_FULL[d.getDay()];
                  const dayNum = d.getDate();
                  const dayEvents = getDayEventsForWeek(dateStr);
                  const isCurrentDay = isToday(dateStr);
                  const isCurrentSelected = isSelected(dateStr);

                  return (
                    <div
                      key={dateStr}
                      className={`futureCalendarWeekDay${isCurrentDay ? ' futureCalendarWeekDay--today' : ''}${isCurrentSelected ? ' futureCalendarWeekDay--selected' : ''}`}
                      onClick={() => setSelectedDay(dateStr)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="futureCalendarWeekDayHeader">
                        <div className="futureCalendarWeekDayName">{dow}</div>
                        <div className="futureCalendarWeekDayNumber">{dayNum}</div>
                      </div>
                      <div className="futureCalendarWeekDayEvents">
                        {dayEvents.length === 0 ? (
                          <div className="futureCalendarWeekDayEmpty">אין</div>
                        ) : (
                          dayEvents.map(event => (
                            <div
                              key={event.id}
                              className="futureCalendarWeekEventChip"
                              style={{ borderLeftColor: CATEGORY_COLOR[event.category] || '#ccc' }}
                              title={event.title}
                            >
                              <div className="futureCalendarWeekEventTitle">{event.title.slice(0, 20)}</div>
                              {event.startTime && <div className="futureCalendarWeekEventTime">{event.startTime}</div>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Day Panel */}
          {selectedDay && selectedDayObj && (
            <div className="futureCalendarSelectedDayPanel">
              <h3>
                {HE_DAY_FULL[selectedDayObj.getDay()]} {selectedDayObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p>אין אירועים ביום זה.</p>
              ) : (
                <div className="futureCalendarSelectedDayEvents">
                  {selectedDayEvents.map(event => (
                    <div key={event.id} className="futureCalendarSelectedDayEvent">
                      <div className="futureCalendarSelectedDayEventTitle">{event.title}</div>
                      {event.startTime && <div className="futureCalendarSelectedDayEventTime">🕐 {event.startTime}</div>}
                      {event.location && <div className="futureCalendarSelectedDayEventLocation">📍 {event.location}</div>}
                      <div className="futureCalendarSelectedDayEventMeta">
                        <span className="futureCalendarSelectedDayEventCategory">{event.category}</span>
                        <span className="futureCalendarSelectedDayEventSource">{event.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default FutureEventsPanel;
