import { useState, useMemo } from 'react';
import type { CalendarEvent, EventCategory, EventSource, Task } from '../types';
import { mockEvents } from '../data/mockData';
import { isToday, isTomorrow } from '../utils/priority';
import { isGoogleConfigured } from '../config/google';

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
};

const sourceExtraClass: Record<EventSource, string> = {
  demo: '', manual: 'source-manual', googleCalendar: 'source-gcal',
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
  todayEvents: CalendarEvent[],
  tomorrowEvents: CalendarEvent[],
): Rec[] {
  const todayStr    = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  const recs: Rec[] = [];

  // 1. Work today
  const workToday = todayEvents.find(e => e.category === 'work');
  if (workToday) recs.push({
    id: 'work-today', icon: '💼',
    title: 'להתכונן למשמרת',
    reason: `משמרת עבודה היום ב־${workToday.startTime}`,
    action: 'להכין אוכל לעבודה, בגדים ולבדוק זמן יציאה',
    taskTitle: 'הכנה למשמרת — אוכל ובגדים',
    dueDate: todayStr,
  });

  // 2. Academic today
  const academicToday = todayEvents.find(e => e.category === 'academic');
  if (academicToday) recs.push({
    id: 'academic-today', icon: '📚',
    title: 'להגיע מוכנ/ה להרצאה',
    reason: `הרצאה היום ב־${academicToday.startTime}`,
    action: 'להכין מחשב / מחברת ולעבור על החומר הקודם',
    taskTitle: 'הכנה להרצאה — חומרים וסיכומים',
    dueDate: todayStr,
  });

  // 3. Meeting today or tomorrow
  const meetingToday = todayEvents.find(e => e.category === 'meeting');
  const meetingTmr   = tomorrowEvents.find(e => e.category === 'meeting');
  const meetingEv    = meetingToday ?? meetingTmr;
  if (meetingEv) {
    const isMtgToday = !!meetingToday;
    recs.push({
      id: 'meeting', icon: '🤝',
      title: 'להתכונן לפגישה',
      reason: `${meetingEv.title} — ${isMtgToday ? 'היום' : 'מחר'} ב־${meetingEv.startTime}`,
      action: 'לעבור על נושאי הפגישה ולהכין שאלות',
      taskTitle: `הכנה לפגישה: ${meetingEv.title}`,
      dueDate: isMtgToday ? todayStr : tomorrowStr,
    });
  }

  // 4. Exam today or tomorrow
  const examToday = todayEvents.find(e => e.category === 'exam');
  const examTmr   = tomorrowEvents.find(e => e.category === 'exam');
  const examEv    = examToday ?? examTmr;
  if (examEv) {
    const isExToday = !!examToday;
    recs.push({
      id: 'exam', icon: '📝',
      title: 'לחזור על חומר לבחינה',
      reason: `${examEv.title} — ${isExToday ? 'היום' : 'מחר'} ב־${examEv.startTime}`,
      action: 'לפתור מבחן לדוגמה ולהכין ציוד למבחן',
      taskTitle: `חזרה לבחינה: ${examEv.title}`,
      dueDate: isExToday ? todayStr : tomorrowStr,
    });
  }

  // 5. Holiday tomorrow
  const holidayTmr = tomorrowEvents.find(e => e.category === 'holiday');
  if (holidayTmr) recs.push({
    id: 'holiday-tmr', icon: '🎉',
    title: 'להתכונן לחג',
    reason: `מחר: ${holidayTmr.title}`,
    action: 'לבדוק שעות פתיחה ולהכין מה שצריך',
    taskTitle: `הכנות לחג: ${holidayTmr.title}`,
    dueDate: tomorrowStr,
  });

  return recs.slice(0, 5);
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
  todayEvents: CalendarEvent[];
  tomorrowEvents: CalendarEvent[];
  existingTaskTitles: Set<string>;
  onAddTasks: (tasks: Omit<Task, 'id'>[]) => void;
}

const SmartRecommendations = ({
  todayEvents, tomorrowEvents, existingTaskTitles, onAddTasks,
}: SmartRecsProps) => {
  const recs = useMemo(
    () => buildRecs(todayEvents, tomorrowEvents),
    [todayEvents, tomorrowEvents],
  );
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  if (recs.length === 0) return null;

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
        {recs.map(rec => (
          <RecCard
            key={rec.id}
            rec={rec}
            isAdded={addedIds.has(rec.id) || existingTaskTitles.has(rec.taskTitle)}
            onAdd={() => handleAdd(rec)}
          />
        ))}
      </div>
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
}

const EventsCard = ({ events = mockEvents, onAddTasks, existingTaskTitles }: EventsCardProps) => {
  const [showGcalMsg, setShowGcalMsg] = useState(false);
  const isConnected = false; // TODO (Phase 2): drive from googleCalendarService auth state
  const now = new Date();

  const sorted = [...events].sort(
    (a, b) =>
      new Date(`${a.date}T${a.startTime}`).getTime() -
      new Date(`${b.date}T${b.startTime}`).getTime(),
  );

  const todayEvents    = sorted.filter(e => isToday(e.date));
  const tomorrowEvents = sorted.filter(e => isTomorrow(e.date));
  const nextEvent      = todayEvents.find(e => new Date(`${e.date}T${e.startTime}`) > now);

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

      {/* ── Google Calendar bar ── */}
      <div className="events-connection-bar">
        <div className="events-connection-status">
          <span className={`events-connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="events-connection-text">
            {isConnected ? 'מחובר ל־Google Calendar' : 'לא מחובר ל־Google Calendar'}
          </span>
        </div>
        <button className="events-gcal-btn" onClick={() => setShowGcalMsg(v => !v)}>
          התחברות ל־Google Calendar
        </button>
      </div>

      {showGcalMsg && (
        <div className="events-gcal-msg">
          {isGoogleConfigured ? (
            /* TODO (Phase 2): replace this message with the real OAuth button */
            <span>בשלב הבא נחבר את SmartDay ל־Google Calendar ונייבא אירועים אמיתיים.</span>
          ) : (
            <span>⚠️ חיבור Google Calendar עדיין לא הוגדר בסביבת הפיתוח.</span>
          )}
          <button className="events-gcal-msg-close" onClick={() => setShowGcalMsg(false)} aria-label="סגור">✕</button>
        </div>
      )}

      {/* ── Day sections ── */}
      <div className="sched-body">
        <DaySection label="היום"  events={todayEvents}    nextEventId={nextEvent?.id} />
        <DaySection label="מחר"   events={tomorrowEvents} nextEventId={undefined} />
      </div>

      {/* ── Smart recommendations ── */}
      <SmartRecommendations
        todayEvents={todayEvents}
        tomorrowEvents={tomorrowEvents}
        existingTaskTitles={existingTaskTitles}
        onAddTasks={onAddTasks}
      />
    </div>
  );
};

export default EventsCard;
