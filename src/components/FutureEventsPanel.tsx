/**
 * FutureEventsPanel — mini calendar modal
 * ─────────────────────────────────────────────────────────────────────────────
 * Month-grid or week-grid view of future events. Clicking a day opens
 * the day-detail panel. Category override is available in the detail panel.
 */

import { useState, useMemo, useCallback } from 'react';
import type { CalendarEvent, EventCategory } from '../types';
import {
  CATEGORY_DISPLAY,
  CATEGORY_OPTIONS,
  saveCategoryOverride,
} from '../utils/calendarCategorize';
import { getUserPreference, setUserPreference, PREF } from '../utils/userPreferences';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HE_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];
// Sunday-first (Israeli week), displayed RTL so first = rightmost
const HE_DAY_SHORT = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
const HE_DAY_FULL  = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

const TODAY_ISO = new Date().toISOString().split('T')[0];

// Category → chip CSS class
const CAT_CHIP_CLASS: Record<EventCategory, string> = {
  academic: 'cal-chip--academic',
  exam:     'cal-chip--exam',
  work:     'cal-chip--work',
  personal: 'cal-chip--personal',
  meeting:  'cal-chip--meeting',
  holiday:  'cal-chip--holiday',
};

const SOURCE_LABEL: Record<string, string> = {
  googleCalendar: 'Google',
  appleCalendar:  'Apple',
  gmail:          'Gmail',
  manual:         'ידני',
  demo:           'דמו',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Array of ISO strings (or null = padding) for the month grid */
function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Array of 7 ISO strings for a week starting on `sundayDate` */
function buildWeekDays(sunday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(d.getDate() + i);
    return toISO(d);
  });
}

/** Sunday of the week containing `date` */
function weekSunday(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtMonthYear(year: number, month: number): string {
  return `${HE_MONTHS[month]} ${year}`;
}

function fmtWeekRange(sunday: Date): string {
  const sat = new Date(sunday); sat.setDate(sat.getDate() + 6);
  const s = sunday.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  const e = sat.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  return `${s} – ${e}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EventChip — compact chip shown inside a calendar cell
// ─────────────────────────────────────────────────────────────────────────────

function EventChip({
  event,
  effectiveCat,
  onClick,
}: {
  event: CalendarEvent;
  effectiveCat: EventCategory;
  onClick: () => void;
}) {
  const cls = CAT_CHIP_CLASS[effectiveCat] ?? '';
  const time = event.allDay ? 'כל היום' : event.startTime;
  return (
    <button className={`cal-chip ${cls}`} onClick={onClick} title={event.title}>
      <span className="cal-chip-time">{time}</span>
      <span className="cal-chip-title">{event.title.slice(0, 20)}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DayDetail panel — shown when a day is selected
// ─────────────────────────────────────────────────────────────────────────────

interface DayDetailProps {
  iso:              string;
  events:           CalendarEvent[];
  categoryOverrides: Record<string, EventCategory>;
  onOverride:       (id: string, cat: EventCategory) => void;
}

function DayDetail({ iso, events, categoryOverrides, onOverride }: DayDetailProps) {
  const [openCatMenuId, setOpenCatMenuId] = useState<string | null>(null);
  const d   = isoToDate(iso);
  const dow = HE_DAY_FULL[d.getDay()];
  const dateStr = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="cal-detail-panel">
      <div className="cal-detail-header">
        <span className="cal-detail-dow">{dow}</span>
        <span className="cal-detail-date">{dateStr}</span>
        <span className="cal-detail-count">{events.length} אירועים</span>
      </div>

      {events.length === 0 ? (
        <p className="cal-detail-empty">אין אירועים ביום זה.</p>
      ) : (
        <div className="cal-detail-events">
          {events.map(ev => {
            const cat = categoryOverrides[ev.id] ?? ev.category;
            const catDisplay = CATEGORY_DISPLAY[cat];
            const chipCls = CAT_CHIP_CLASS[cat] ?? '';
            const catOpen = openCatMenuId === ev.id;

            return (
              <div key={ev.id} className="cal-detail-event">
                <div className="cal-detail-event-time">
                  {ev.allDay ? 'כל היום' : ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime}
                </div>
                <div className="cal-detail-event-body">
                  <div className="cal-detail-event-title">{ev.title}</div>
                  {ev.location && (
                    <div className="cal-detail-event-loc">📍 {ev.location}</div>
                  )}
                  <div className="cal-detail-event-badges">
                    <span className={`cal-chip ${chipCls} cal-chip--badge`}>
                      {catDisplay.icon} {catDisplay.label}
                    </span>
                    <span className="cal-detail-src-badge">
                      {SOURCE_LABEL[ev.source] ?? ev.source}
                    </span>
                    {ev.source === 'appleCalendar' && ev.calendarName && (
                      <span className="cal-detail-cal-name">{ev.calendarName}</span>
                    )}
                    {/* Category override — only in detail panel */}
                    <div className="cal-override-wrap">
                      <button
                        className="cal-override-btn"
                        onClick={() => setOpenCatMenuId(catOpen ? null : ev.id)}
                      >
                        שנה ✎
                      </button>
                      {catOpen && (
                        <div className="cal-override-menu">
                          {CATEGORY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              className={`cal-override-opt${opt.value === cat ? ' cal-override-opt--active' : ''}`}
                              onClick={() => {
                                onOverride(ev.id, opt.value);
                                setOpenCatMenuId(null);
                              }}
                            >
                              {CATEGORY_DISPLAY[opt.value].icon} {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MonthGrid
// ─────────────────────────────────────────────────────────────────────────────

interface MonthGridProps {
  year:              number;
  month:             number;
  allEvents:         CalendarEvent[];
  categoryOverrides: Record<string, EventCategory>;
  selectedDay:       string | null;
  onSelectDay:       (iso: string) => void;
}

function MonthGrid({ year, month, allEvents, categoryOverrides, selectedDay, onSelectDay }: MonthGridProps) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const eventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      if (ev.source === 'demo') continue;
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date)!.push(ev);
    }
    return map;
  }, [allEvents]);

  return (
    <div className="cal-month-grid">
      {/* Day-of-week headers */}
      {HE_DAY_SHORT.map((d, i) => (
        <div key={i} className="cal-dow-header">{d}</div>
      ))}

      {/* Day cells */}
      {cells.map((iso, idx) => {
        if (!iso) return <div key={`pad-${idx}`} className="cal-month-cell cal-month-cell--pad" />;

        const dayEvs = (eventsMap.get(iso) ?? [])
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const visible = dayEvs.slice(0, 2);
        const overflow = dayEvs.length - 2;
        const isToday    = iso === TODAY_ISO;
        const isSelected = iso === selectedDay;
        const isPast     = iso < TODAY_ISO;

        return (
          <div
            key={iso}
            className={[
              'cal-month-cell',
              isToday    ? 'cal-month-cell--today'    : '',
              isSelected ? 'cal-month-cell--selected'  : '',
              isPast     ? 'cal-month-cell--past'      : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelectDay(iso)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onSelectDay(iso)}
          >
            <span className="cal-cell-day-num">{parseInt(iso.split('-')[2], 10)}</span>
            <div className="cal-cell-events">
              {visible.map(ev => (
                <EventChip
                  key={ev.id}
                  event={ev}
                  effectiveCat={categoryOverrides[ev.id] ?? ev.category}
                  onClick={() => onSelectDay(iso)}
                />
              ))}
              {overflow > 0 && (
                <button className="cal-more-btn" onClick={() => onSelectDay(iso)}>
                  +{overflow} נוספים
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WeekGrid
// ─────────────────────────────────────────────────────────────────────────────

interface WeekGridProps {
  weekDays:          string[];  // 7 ISO dates
  allEvents:         CalendarEvent[];
  categoryOverrides: Record<string, EventCategory>;
  selectedDay:       string | null;
  onSelectDay:       (iso: string) => void;
}

function WeekGrid({ weekDays, allEvents, categoryOverrides, selectedDay, onSelectDay }: WeekGridProps) {
  const eventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      if (ev.source === 'demo') continue;
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date)!.push(ev);
    }
    return map;
  }, [allEvents]);

  return (
    <div className="cal-week-grid">
      {weekDays.map(iso => {
        const d = isoToDate(iso);
        const dowShort = HE_DAY_SHORT[d.getDay()];
        const dayNum   = parseInt(iso.split('-')[2], 10);
        const dayEvs   = (eventsMap.get(iso) ?? [])
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const isToday    = iso === TODAY_ISO;
        const isSelected = iso === selectedDay;

        return (
          <div
            key={iso}
            className={[
              'cal-week-col',
              isToday    ? 'cal-week-col--today'    : '',
              isSelected ? 'cal-week-col--selected'  : '',
            ].filter(Boolean).join(' ')}
          >
            <button
              className="cal-week-col-header"
              onClick={() => onSelectDay(iso)}
            >
              <span className="cal-week-dow">{dowShort}</span>
              <span className={`cal-week-day-num${isToday ? ' cal-week-day-num--today' : ''}`}>
                {dayNum}
              </span>
            </button>
            <div className="cal-week-events">
              {dayEvs.length === 0 ? (
                <div className="cal-week-empty" />
              ) : (
                dayEvs.map(ev => (
                  <EventChip
                    key={ev.id}
                    event={ev}
                    effectiveCat={categoryOverrides[ev.id] ?? ev.category}
                    onClick={() => onSelectDay(iso)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FutureEventsPanel — main export
// ─────────────────────────────────────────────────────────────────────────────

export interface FutureEventsPanelProps {
  allEvents:          CalendarEvent[];
  categoryOverrides:  Record<string, EventCategory>;
  onCategoryOverride: (id: string, cat: EventCategory) => void;
  hasCalendar:        boolean;
  onClose:            () => void;
}

type ViewMode = 'month' | 'week';

const FutureEventsPanel = ({
  allEvents, categoryOverrides, onCategoryOverride, hasCalendar, onClose,
}: FutureEventsPanelProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState<ViewMode>(
    () => getUserPreference(PREF.MINI_CAL_VIEW, 'month') as ViewMode,
  );
  const [monthYear, setMonthYear] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [weekSun,   setWeekSun]   = useState<Date>(weekSunday(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(TODAY_ISO);

  // Navigation
  const prevMonth = () =>
    setMonthYear(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
  const nextMonth = () =>
    setMonthYear(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );
  const prevWeek = () => setWeekSun(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekSun(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  const weekDays = useMemo(() => buildWeekDays(weekSun), [weekSun]);

  const handleOverride = useCallback((id: string, cat: EventCategory) => {
    saveCategoryOverride(id, cat);
    onCategoryOverride(id, cat);
  }, [onCategoryOverride]);

  // Events for the selected day detail panel
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return allEvents
      .filter(e => e.source !== 'demo' && e.date === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [allEvents, selectedDay]);

  const rangeLabel = view === 'month'
    ? fmtMonthYear(monthYear.year, monthYear.month)
    : fmtWeekRange(weekSun);

  return (
    <div className="cal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cal-modal" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="cal-modal-header">
          <div className="cal-modal-titles">
            <h2 className="cal-modal-title">לוח אירועים קדימה</h2>
            <p className="cal-modal-sub">ראי שיעורים, משמרות, הגשות ואירועים מעבר להיום ומחר</p>
          </div>
          <button className="cal-close-btn" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        {/* ── Controls row ────────────────────────────────────────────────── */}
        <div className="cal-controls">
          {/* View toggle */}
          <div className="cal-view-tabs">
            <button
              className={`cal-view-tab${view === 'month' ? ' cal-view-tab--active' : ''}`}
              onClick={() => { setView('month'); setUserPreference(PREF.MINI_CAL_VIEW, 'month'); setMonthYear({ year: today.getFullYear(), month: today.getMonth() }); }}
            >
              חודש
            </button>
            <button
              className={`cal-view-tab${view === 'week' ? ' cal-view-tab--active' : ''}`}
              onClick={() => { setView('week'); setUserPreference(PREF.MINI_CAL_VIEW, 'week'); setWeekSun(weekSunday(today)); }}
            >
              שבוע
            </button>
          </div>

          {/* Navigation */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={view === 'month' ? prevMonth : prevWeek}>›</button>
            <span className="cal-nav-label">{rangeLabel}</span>
            <button className="cal-nav-btn" onClick={view === 'month' ? nextMonth : nextWeek}>‹</button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="cal-body">
          {!hasCalendar ? (
            <div className="cal-empty-state">
              <p className="cal-empty-icon">📅</p>
              <p className="cal-empty-title">חברי Google Calendar או ייבאי Apple Calendar</p>
              <p className="cal-empty-sub">כדי לראות אירועים קדימה, יש לחבר לוח שנה.</p>
            </div>
          ) : (
            <div className="cal-main">
              {/* Grid area */}
              <div className="cal-grid-area">
                {view === 'month' ? (
                  <MonthGrid
                    year={monthYear.year}
                    month={monthYear.month}
                    allEvents={allEvents}
                    categoryOverrides={categoryOverrides}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                  />
                ) : (
                  <WeekGrid
                    weekDays={weekDays}
                    allEvents={allEvents}
                    categoryOverrides={categoryOverrides}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                  />
                )}
              </div>

              {/* Day detail panel */}
              {selectedDay && (
                <DayDetail
                  iso={selectedDay}
                  events={selectedDayEvents}
                  categoryOverrides={categoryOverrides}
                  onOverride={handleOverride}
                />
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default FutureEventsPanel;
