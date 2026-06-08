import { useState, useMemo, useEffect } from 'react';
import type { CalendarEvent, EventCategory, EventSource, Task } from '../types';
import { mockEvents } from '../data/mockData';
import { isToday, isTomorrow } from '../utils/priority';
import { isGoogleConfigured } from '../config/google';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fetchGoogleCalendarEvents,
} from '../services/googleCalendarService';
import {
  parseICSText,
  loadAppleEvents,
  saveAppleEvents,
  clearAppleEvents,
} from '../services/appleCalendarService';
import { usePersistentState, PREF } from '../utils/userPreferences';
import ManualEventModal from './ManualEventModal';

// ---------------------------------------------------------------------------
// Group definitions
// ---------------------------------------------------------------------------

interface ScheduleGroup {
  key: string;
  label: string;
  icon: string;
  categories: EventCategory[];
  accentColor: string;
}

const GROUPS: ScheduleGroup[] = [
  { key: 'academic', label: 'לו״ז אקדמי',   icon: '📚', categories: ['academic', 'exam'],    accentColor: '#4A7A96' },
  { key: 'personal', label: 'אישי',          icon: '🌟', categories: ['personal', 'meeting'], accentColor: '#5A8C6A' },
  { key: 'holiday',  label: 'חגים ומועדים', icon: '🎉', categories: ['holiday'],              accentColor: '#7B60A8' },
  { key: 'work',     label: 'עבודה',         icon: '💼', categories: ['work'],                accentColor: '#8B5E3C' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const importanceMeta: Record<string, { label: string; bg: string; color: string } | null> = {
  urgent:    { label: 'דחוף', bg: '#FBF0EF', color: '#C0645A' },
  important: { label: 'חשוב', bg: '#FBF5E6', color: '#C49A3C' },
  normal:    null,
};

const sourceLabelMap: Record<EventSource, string> = {
  demo:           'דמו',
  manual:         'ידני',
  googleCalendar: 'Google',
  appleCalendar:  'Apple',
  gmail:          'Gmail',
};

const sourceExtraClass: Record<EventSource, string> = {
  demo: '',
  manual: 'source-manual',
  googleCalendar: 'source-gcal',
  appleCalendar: 'source-apple',
  gmail: 'source-gmail',
};

// ---------------------------------------------------------------------------
// EventRow — compact row inside a subcategory box
// ---------------------------------------------------------------------------

const EventRow = ({ event, isNext }: { event: CalendarEvent; isNext: boolean }) => {
  const timeRange = event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
  const imp       = importanceMeta[event.importance];

  return (
    <div className={`sched-event-row${isNext ? ' sched-event-next' : ''}`}>
      <div className="sched-event-top">
        <span className="sched-event-title">{event.title}</span>
        {isNext && <span className="sched-next-badge">► הבא</span>}
      </div>
      <div className="sched-event-meta">
        <span>🕐 {timeRange}</span>
        {event.location && <span>📍 {event.location}</span>}
      </div>
      <div className="sched-event-tags">
        {imp && (
          <span className="sched-importance-badge" style={{ background: imp.bg, color: imp.color }}>
            {imp.label}
          </span>
        )}
        <span className={`sched-source-badge ${sourceExtraClass[event.source]}`}>
          {sourceLabelMap[event.source]}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SubcategoryBox — one of the 4 columns inside a day section
// ---------------------------------------------------------------------------

interface SubcategoryBoxProps {
  group: ScheduleGroup;
  events: CalendarEvent[];
  nextEventId: string | undefined;
}

const SubcategoryBox = ({ group, events, nextEventId }: SubcategoryBoxProps) => (
  <div className="sched-cat-box" style={{ borderTopColor: group.accentColor }}>
    <div className="sched-cat-header">
      <span className="sched-cat-icon">{group.icon}</span>
      <span className="sched-cat-name" style={{ color: group.accentColor }}>{group.label}</span>
      <span className="sched-cat-count" style={{ background: group.accentColor }}>
        {events.length}
      </span>
    </div>
    <div className="sched-cat-body">
      {events.length === 0 ? (
        <p className="sched-empty">אין אירועים</p>
      ) : (
        events.map(e => (
          <EventRow key={e.id} event={e} isNext={nextEventId === e.id} />
        ))
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// DaySection — full-width horizontal row with 4 subcategory columns
// ---------------------------------------------------------------------------

interface DaySectionProps {
  label: string;
  events: CalendarEvent[];
  nextEventId: string | undefined;
}

const DaySection = ({ label, events, nextEventId }: DaySectionProps) => (
  <div className="sched-day-section">
    <div className="sched-day-header">
      <span className="sched-day-label">{label}</span>
      <span className="sched-day-count">{events.length} אירועים</span>
    </div>
    <div className="sched-day-grid">
      {GROUPS.map(group => (
        <SubcategoryBox
          key={group.key}
          group={group}
          events={events.filter(e => (group.categories as string[]).includes(e.category))}
          nextEventId={nextEventId}
        />
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// SmartRecommendations — contextual, per-event recommendation cards
// ---------------------------------------------------------------------------

interface Rec {
  id: string;
  icon: string;
  title: string;
  reason: string;
  action: string;
  taskTitle: string;
  dueDate: string;
}

function buildRecs(
  allEvents: CalendarEvent[],
): Rec[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const todayStr = now.toISOString().split('T')[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0];

  // Filter events to current week (today through next 7 days)
  const weekEvents = allEvents.filter(e => {
    if (!e.date) return false;
    return e.date >= todayStr && e.date <= sevenDaysStr;
  });

  const recs: Rec[] = [];
  const processedEventIds = new Set<string>();

  // Helper to format time for display
  const formatTimeForDisplay = (startTime: string): string => {
    if (!startTime || startTime === '00:00' || startTime === '') {
      return 'כל היום';
    }
    return `ב־${startTime}`;
  };

  // Generate recommendations from week events
  weekEvents.forEach(event => {
    if (processedEventIds.has(event.id)) return;

    let rec: Rec | null = null;

    // Work events
    if (event.category === 'work') {
      rec = {
        id: `work-${event.id}`,
        icon: '💼',
        title: 'להתכונן למשמרת',
        reason: `משמרת עבודה: ${event.title} ${formatTimeForDisplay(event.startTime)}`,
        action: 'להכין אוכל לעבודה, בגדים ולבדוק זמן יציאה',
        taskTitle: 'הכנה למשמרת',
        dueDate: event.date,
      };
    }

    // Academic events
    else if (event.category === 'academic') {
      rec = {
        id: `academic-${event.id}`,
        icon: '📚',
        title: 'להגיע מוכנ/ה לשיעור',
        reason: `שיעור: ${event.title} ${formatTimeForDisplay(event.startTime)}`,
        action: 'להכין מחשב / מחברת ולעבור על החומר הקודם',
        taskTitle: `מעבר על חומר לפני ${event.title}`,
        dueDate: event.date,
      };
    }

    // Exam events
    else if (event.category === 'exam') {
      rec = {
        id: `exam-${event.id}`,
        icon: '📝',
        title: 'להתכונן לבחינה',
        reason: `בחינה: ${event.title} ${formatTimeForDisplay(event.startTime)}`,
        action: 'לפתור מבחן לדוגמה ולהכין ציוד למבחן',
        taskTitle: `חזרה לבחינה: ${event.title}`,
        dueDate: event.date,
      };
    }

    // Meeting events
    else if (event.category === 'meeting') {
      rec = {
        id: `meeting-${event.id}`,
        icon: '🤝',
        title: 'להתכונן לפגישה',
        reason: `פגישה: ${event.title} ${formatTimeForDisplay(event.startTime)}`,
        action: 'לעבור על נושאי הפגישה ולהכין שאלות',
        taskTitle: `הכנה לפגישה: ${event.title}`,
        dueDate: event.date,
      };
    }

    // Holiday events
    else if (event.category === 'holiday') {
      rec = {
        id: `holiday-${event.id}`,
        icon: '🎉',
        title: 'להתכונן לחג',
        reason: `חג: ${event.title}`,
        action: 'לבדוק שעות פתיחה ולהכין מה שצריך',
        taskTitle: `הכנות לחג: ${event.title}`,
        dueDate: event.date,
      };
    }

    if (rec) {
      recs.push(rec);
      processedEventIds.add(event.id);
    }
  });

  return recs.slice(0, 10);
}

// Single recommendation card
const RecCard = ({
  rec,
  isAdded,
  onAdd,
}: { rec: Rec; isAdded: boolean; onAdd: () => void }) => (
  <div className={`smart-rec-card${isAdded ? ' smart-rec-added' : ''}`}>
    <div className="smart-rec-top">
      <span className="smart-rec-icon">{rec.icon}</span>
      <span className="smart-rec-title">{rec.title}</span>
    </div>
    <p className="smart-rec-reason">{rec.reason}</p>
    <p className="smart-rec-action">💡 {rec.action}</p>
    {isAdded ? (
      <span className="smart-rec-done">✓ נוסף למשימות שלך</span>
    ) : (
      <button className="smart-rec-btn" onClick={onAdd}>
        הוסף למשימות שלי
      </button>
    )}
  </div>
);

// Recommendations panel
interface SmartRecsProps {
  allEvents: CalendarEvent[];
  existingTaskTitles: Set<string>;
  onAddTasks: (tasks: Omit<Task, 'id'>[]) => void;
}

const SmartRecommendations = ({
  allEvents, existingTaskTitles, onAddTasks,
}: SmartRecsProps) => {
  const recs = useMemo(
    () => buildRecs(allEvents),
    [allEvents],
  );
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  if (recs.length === 0) {
    return (
      <div className="smart-recs">
        <div className="smart-recs-header">
          <span className="smart-recs-sparkle">✨</span>
          <span className="smart-recs-title">המלצות חכמות</span>
        </div>
        <div className="smart-recs-empty">אין המלצות חכמות כרגע.</div>
      </div>
    );
  }

  const visibleRecommendations = showAllRecommendations
    ? recs
    : recs.slice(0, 2);

  const hiddenCount = recs.length - visibleRecommendations.length;

  const handleAdd = (rec: Rec) => {
    onAddTasks([{
      title: rec.taskTitle,
      priority: 'medium',
      dueDate: rec.dueDate,
      completed: false,
      category: 'לוח זמנים',
    }]);
    setAddedIds(prev => new Set(prev).add(rec.id));
  };

  return (
    <div className="smart-recs">
      <div className="smart-recs-header">
        <span className="smart-recs-sparkle">✨</span>
        <span className="smart-recs-title">המלצות חכמות</span>
        <span className="smart-recs-sub">מבוסס על לוח הזמנים שלך</span>
      </div>
      <div className="smart-recs-list">
        {visibleRecommendations.map(rec => (
          <RecCard
            key={rec.id}
            rec={rec}
            isAdded={addedIds.has(rec.id) || existingTaskTitles.has(rec.taskTitle)}
            onAdd={() => handleAdd(rec)}
          />
        ))}
      </div>
      {recs.length > 2 && (
        <button
          type="button"
          className="smart-recs-toggle"
          onClick={() => setShowAllRecommendations(prev => !prev)}
        >
          {showAllRecommendations
            ? 'צמצם המלצות'
            : `הצג עוד ${hiddenCount} המלצות`}
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// EventsCard
// ---------------------------------------------------------------------------

interface EventsCardProps {
  events?: CalendarEvent[];
  onAddTasks: (tasks: Omit<Task, 'id'>[]) => void;
  existingTaskTitles: Set<string>;
  onCalendarEventsUpdate?: (events: CalendarEvent[]) => void;
  onOpenFutureEvents?: () => void;
}

// Load manual events from localStorage
function loadManualEvents(): CalendarEvent[] {
  try {
    const stored = localStorage.getItem('smartday-manual-calendar-events');
    if (stored) {
      const events = JSON.parse(stored) as CalendarEvent[];
      return events;
    }
  } catch {
    // Silently fail
  }
  return [];
}

// Save manual events to localStorage
function saveManualEvents(events: CalendarEvent[]): void {
  try {
    localStorage.setItem('smartday-manual-calendar-events', JSON.stringify(events));
  } catch {
    // Silently fail
  }
}

const EventsCard = ({ events = mockEvents, onAddTasks, existingTaskTitles, onCalendarEventsUpdate, onOpenFutureEvents }: EventsCardProps) => {
  // Calendar source selection with persistence
  const [calendarSource, setCalendarSource] = usePersistentState<'google' | 'apple'>(PREF.CALENDAR_SOURCE, 'google');

  // Google Calendar state
  const [gcalEvents,   setGcalEvents]   = useState<CalendarEvent[]>([]);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [gcalError,    setGcalError]    = useState<string | null>(null);

  // Apple Calendar state
  const [appleEvents,  setAppleEvents]  = useState<CalendarEvent[]>(() => loadAppleEvents());
  const [appleError,   setAppleError]   = useState<string | null>(null);

  // Manual events state
  const [manualEvents, setManualEvents] = useState<CalendarEvent[]>(() => loadManualEvents());
  const [showManualEventModal, setShowManualEventModal] = useState(false);

  const now = new Date();

  // Select events based on calendar source
  const sourceEvents = calendarSource === 'google' ? gcalEvents : appleEvents;

  // Check if calendar source is connected/imported
  const isSourceConnected = calendarSource === 'google' ? isConnected : appleEvents.length > 0;

  // Use source events if connected, otherwise show empty state (NOT mockEvents)
  // This prevents demo recommendations from showing when a real source is selected
  const allEvents = useMemo(() => {
    const selected = isSourceConnected ? sourceEvents : [];
    // Always include manual events
    return [...selected, ...manualEvents];
  }, [sourceEvents, isSourceConnected, manualEvents]);

  // Notify parent about calendar events for alert generation and future view
  useEffect(() => {
    onCalendarEventsUpdate?.(allEvents);
  }, [allEvents, onCalendarEventsUpdate]);

  const sorted = [...allEvents].sort(
    (a, b) =>
      new Date(`${a.date}T${a.startTime}`).getTime() -
      new Date(`${b.date}T${b.startTime}`).getTime(),
  );

  const todayEvents    = sorted.filter(e => isToday(e.date));
  const tomorrowEvents = sorted.filter(e => isTomorrow(e.date));
  const nextEvent      = todayEvents.find(e => new Date(`${e.date}T${e.startTime}`) > now);

  const handleConnect = async () => {
    if (!isGoogleConfigured) {
      setGcalError('חיבור Google Calendar עדיין לא הוגדר בסביבת הפיתוח.');
      return;
    }
    setIsLoading(true);
    setGcalError(null);
    try {
      await connectGoogleCalendar();
      const fetched = await fetchGoogleCalendarEvents();
      setGcalEvents(fetched);
      setIsConnected(true);
    } catch (err) {
      setGcalError(err instanceof Error ? err.message : 'שגיאה לא ידועה בהתחברות.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleCalendar();
    setGcalEvents([]);
    setIsConnected(false);
    setGcalError(null);
  };

  const handleAppleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setAppleError(null);
    try {
      const allImportedEvents: CalendarEvent[] = [];

      for (const file of files) {
        const text = await file.text();
        const parsed = parseICSText(text, file.name.replace('.ics', ''));
        allImportedEvents.push(...parsed);
      }

      // Remove duplicates by ID
      const uniqueMap = new Map<string, CalendarEvent>();
      allImportedEvents.forEach(e => uniqueMap.set(e.id, e));
      const uniqueEvents = Array.from(uniqueMap.values());

      saveAppleEvents(uniqueEvents);
      setAppleEvents(uniqueEvents);
      setCalendarSource('apple');
    } catch (err) {
      setAppleError(err instanceof Error ? err.message : 'לא הצלחנו לקרוא את קובץ Apple Calendar. ודאי שזה קובץ ICS תקין.');
    }
  };

  const handleClearApple = () => {
    clearAppleEvents();
    setAppleEvents([]);
    setAppleError(null);
    if (calendarSource === 'apple') {
      setCalendarSource('google');
    }
  };

  const handleAddManualEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: `manual-${Date.now()}`,
    };
    const updated = [...manualEvents, newEvent];
    setManualEvents(updated);
    saveManualEvents(updated);
  };

  return (
    <div className="card">
      {/* ── Header ── */}
      <div className="card-header events-card-header">
        <div className="card-title-row">
          <span className="card-icon">📅</span>
          <h2 className="card-title">לוח זמנים חכם</h2>
          <span className="badge">{todayEvents.length + tomorrowEvents.length}</span>
        </div>
        <p className="events-card-subtitle">האירועים החשובים שלך להיום ולמחר</p>
      </div>

      {/* ── Calendar Source Selector ── */}
      <div className="events-source-selector">
        <div className="events-source-pills">
          <button
            className={`events-source-pill ${calendarSource === 'google' ? 'active' : ''}`}
            onClick={() => setCalendarSource('google')}
            type="button"
          >
            Google Calendar
          </button>
          <button
            className={`events-source-pill ${calendarSource === 'apple' ? 'active' : ''}`}
            onClick={() => setCalendarSource('apple')}
            type="button"
          >
            Apple Calendar
          </button>
        </div>
      </div>

      {/* ── Google Calendar Connection ── */}
      {calendarSource === 'google' && (
        <>
          <div className="events-connection-bar">
            <div className="events-connection-status">
              <span className={`events-connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
              <span className="events-connection-text">
                {isConnected ? 'מחובר ל־Google Calendar' : 'לא מחובר ל־Google Calendar'}
              </span>
            </div>
            {isConnected ? (
              <button className="events-gcal-btn events-gcal-btn--disconnect" onClick={handleDisconnect} type="button">
                התנתק
              </button>
            ) : (
              <button
                className="events-gcal-btn"
                onClick={handleConnect}
                disabled={isLoading}
                type="button"
              >
                {isLoading ? 'מתחבר...' : 'התחברות ל־Google Calendar'}
              </button>
            )}
          </div>

          {gcalError && (
            <div className="events-gcal-msg events-gcal-msg--error">
              <span>⚠️ {gcalError}</span>
              <button className="events-gcal-msg-close" onClick={() => setGcalError(null)} aria-label="סגור" type="button">✕</button>
            </div>
          )}
        </>
      )}

      {/* ── Apple Calendar Import ── */}
      {calendarSource === 'apple' && (
        <>
          <div className="events-connection-bar">
            <div className="events-connection-status">
              <span className={`events-connection-dot ${appleEvents.length > 0 ? 'connected' : 'disconnected'}`} />
              <span className="events-connection-text">
                {appleEvents.length > 0 ? `${appleEvents.length} אירועים מיובאים` : 'לא יובאו לוחות Apple Calendar'}
              </span>
            </div>
            <label className="events-apple-import">
              <input
                type="file"
                multiple
                accept=".ics,text/calendar"
                onChange={handleAppleImport}
                style={{ display: 'none' }}
              />
              <span className="events-gcal-btn">ייבוא Apple Calendar</span>
            </label>
            {appleEvents.length > 0 && (
              <button className="events-gcal-btn events-gcal-btn--disconnect" onClick={handleClearApple} type="button">
                ניקוי
              </button>
            )}
          </div>

          {appleError && (
            <div className="events-gcal-msg events-gcal-msg--error">
              <span>⚠️ {appleError}</span>
              <button className="events-gcal-msg-close" onClick={() => setAppleError(null)} aria-label="סגור" type="button">✕</button>
            </div>
          )}
        </>
      )}

      {/* ── Future Calendar and Add Event Buttons ── */}
      {isSourceConnected && (
        <div className="events-future-btn-bar" style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="events-future-btn"
            onClick={onOpenFutureEvents}
            type="button"
          >
            📅 לוח קדימה
          </button>
          <button
            className="events-add-btn"
            onClick={() => setShowManualEventModal(true)}
            type="button"
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '8px 14px',
              background: '#ffffff',
              color: '#3fafa3',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '13px',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#3fafa3',
            }}
          >
            + הוסף אירוע
          </button>
        </div>
      )}

      {/* ── Empty State when no source connected ── */}
      {!isSourceConnected && (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: '#7c8798' }}>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            {calendarSource === 'google'
              ? 'לא מחובר ל-Google Calendar'
              : 'לא יובאו לוחות Apple Calendar'}
          </p>
        </div>
      )}

      {/* ── Day sections (only if source connected) ── */}
      {isSourceConnected && (
        <div className="sched-body">
          <DaySection label="היום"  events={todayEvents}    nextEventId={nextEvent?.id} />
          <DaySection label="מחר"   events={tomorrowEvents} nextEventId={undefined} />
        </div>
      )}

      {/* ── Smart recommendations (only if source connected) ── */}
      {isSourceConnected && (
        <SmartRecommendations
          allEvents={allEvents}
          existingTaskTitles={existingTaskTitles}
          onAddTasks={onAddTasks}
        />
      )}

      {/* ── Manual Event Modal ── */}
      {showManualEventModal && (
        <ManualEventModal
          onClose={() => setShowManualEventModal(false)}
          onAddEvent={handleAddManualEvent}
        />
      )}
    </div>
  );
};

export default EventsCard;
