// @ts-nocheck
import { useState, useMemo } from 'react';
import type { Task, CalendarEvent } from '../types';
import { isToday, isTomorrow } from '../utils/priority';

type InsightType = 'urgent' | 'delay' | 'prepare' | 'relax' | null;

interface Props {
  tasks?: Task[];
  calendarEvents?: CalendarEvent[];
}

const RELAX_TIPS = [
  {
    text: 'תרגיל נשימה: שאפי 4 שניות, עצרי 4, שחרורי 4. חזרי 4 פעמים.',
    links: [
      { label: '🫁 נשימת קופסה', url: 'https://www.youtube.com/watch?v=tEmt1Znux58' },
      { label: '😌 מדיטציה 5 דקות', url: 'https://www.youtube.com/watch?v=inpok4MKVLM' },
    ],
  },
  {
    text: 'ירידת אנרגיה בצהריים היא ביולוגית לגמרי. 10 דקות שכיבה עוזרות יותר מקפה.',
    links: [
      { label: '😴 שינה פלאית 10 דק׳', url: 'https://www.youtube.com/watch?v=gh4G0eu8U1E' },
      { label: '🚶 הליכה קצרה בחוץ', url: 'https://www.youtube.com/watch?v=GQuYCKJNpM0' },
    ],
  },
  {
    text: 'ערב טוב לסגור את היום. פומודורו אחרון — 25 דק׳ עבודה, ואז סגרי הכל.',
    links: [
      { label: '⏱️ טיימר פומודורו', url: 'https://www.youtube.com/watch?v=mNBmG24djoY' },
      { label: '🧘 מתיחות קצרות', url: 'https://www.youtube.com/watch?v=tAUf7aajBWE' },
    ],
  },
];

function todayStr() { return new Date().toISOString().split('T')[0]; }

function dueDateLabel(t: Task): string {
  if (isToday(t.dueDate) || isToday(t.deadlineDate ?? '')) return 'היום';
  if (isTomorrow(t.dueDate) || isTomorrow(t.deadlineDate ?? '')) return 'מחר';
  const d = t.dueDate || t.deadlineDate;
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

function urgencyColor(t: Task): string {
  if (t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical') return '#e8738f';
  if (t.priority === 'medium' || t.urgency === 'medium') return '#f4c76b';
  return '#7ec98f';
}

function urgencyText(t: Task): string {
  if (t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical') return 'דחוף';
  if (t.priority === 'medium' || t.urgency === 'medium') return 'בינוני';
  return 'רגיל';
}

const AiAssistant = ({ tasks = [], calendarEvents = [] }: Props) => {
  const [selectedInsight, setSelectedInsight] = useState<InsightType>(null);

  const data = useMemo(() => {
    const today = todayStr();
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

    const open = tasks.filter(t => !t.completed && t.status !== 'done');
    const urgentTasks = open.filter(t =>
      t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical'
    );
    const todayTasks = open.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? ''));
    const deferrable = open.filter(t =>
      t.priority !== 'high' && t.urgency !== 'high' && t.urgency !== 'urgent' && t.urgency !== 'critical' &&
      !isToday(t.dueDate) && !isToday(t.deadlineDate ?? '')
    );

    const todayEvents = calendarEvents
      .filter(e => e.date === today && e.source !== 'demo')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const futureEvents = todayEvents.filter(e => {
      const [h, m] = e.startTime.split(':').map(Number);
      return (h * 60 + (m || 0)) > nowMins;
    });

    const hour = new Date().getHours();
    const relaxTip = hour >= 14 && hour < 17 ? RELAX_TIPS[1] : hour >= 20 ? RELAX_TIPS[2] : RELAX_TIPS[0];

    return { open, urgentTasks, todayTasks, deferrable, todayEvents, futureEvents, relaxTip };
  }, [tasks, calendarEvents]);

  const toggle = (t: InsightType) => setSelectedInsight(prev => prev === t ? null : t);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderUrgent = () => {
    const { urgentTasks, todayTasks, futureEvents } = data;
    const allUrgent = [
      ...urgentTasks.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? '')),
      ...urgentTasks.filter(t => !isToday(t.dueDate) && !isToday(t.deadlineDate ?? '')),
      ...todayTasks.filter(t => !urgentTasks.includes(t)),
    ].slice(0, 5);

    if (allUrgent.length === 0 && futureEvents.length === 0) {
      return <p className="qi-empty-msg">אין משימות דחופות כרגע — יום פנוי 🎉</p>;
    }

    return (
      <div className="qi-list">
        {futureEvents.slice(0, 2).map(e => (
          <div key={e.id} className="qi-item qi-item--event">
            <span className="qi-item-dot" style={{ background: '#93c5fd' }} />
            <span className="qi-item-title">{e.title}</span>
            <span className="qi-item-meta">{e.startTime}</span>
          </div>
        ))}
        {allUrgent.map(t => (
          <div key={t.id} className="qi-item">
            <span className="qi-item-dot" style={{ background: urgencyColor(t) }} />
            <span className="qi-item-title">{t.title}</span>
            <div className="qi-item-badges">
              <span className="qi-badge" style={{ background: urgencyColor(t) + '22', color: urgencyColor(t) }}>
                {urgencyText(t)}
              </span>
              {dueDateLabel(t) && (
                <span className="qi-badge qi-badge--date">{dueDateLabel(t)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDelay = () => {
    const { deferrable } = data;
    if (deferrable.length === 0) {
      return <p className="qi-empty-msg">כל המשימות הפתוחות דחופות — אין מה לדחות כרגע.</p>;
    }
    return (
      <div className="qi-list">
        <p className="qi-list-hint">אלה יכולות לחכות לשבוע הבא:</p>
        {deferrable.slice(0, 5).map(t => (
          <div key={t.id} className="qi-item qi-item--muted">
            <span className="qi-item-dot" style={{ background: '#94a3b8' }} />
            <span className="qi-item-title">{t.title}</span>
            {dueDateLabel(t) && (
              <span className="qi-badge qi-badge--date">{dueDateLabel(t)}</span>
            )}
          </div>
        ))}
        {deferrable.length > 5 && (
          <p className="qi-list-more">ועוד {deferrable.length - 5} נוספות</p>
        )}
      </div>
    );
  };

  const renderPrepare = () => {
    const { futureEvents, urgentTasks, todayTasks, open } = data;

    if (futureEvents.length === 0 && open.length === 0) {
      return <p className="qi-empty-msg">אין אירועים או משימות לסנכרן היום.</p>;
    }

    // Build an interleaved agenda: events + urgent tasks sorted
    const agendaItems: { type: 'event' | 'task'; title: string; meta?: string; color?: string }[] = [];

    futureEvents.slice(0, 3).forEach(e => {
      agendaItems.push({ type: 'event', title: e.title, meta: `${e.startTime}`, color: '#93c5fd' });
    });

    const tasksToShow = [
      ...urgentTasks.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? '')),
      ...urgentTasks.filter(t => !isToday(t.dueDate) && !isToday(t.deadlineDate ?? '')),
      ...todayTasks.filter(t => !urgentTasks.includes(t)),
    ].slice(0, 3);

    tasksToShow.forEach(t => {
      agendaItems.push({ type: 'task', title: t.title, meta: dueDateLabel(t), color: urgencyColor(t) });
    });

    return (
      <div className="qi-list">
        {futureEvents.length === 0 && (
          <p className="qi-list-hint">אין אירועים ביומן — יום פנוי לעבודה:</p>
        )}
        {agendaItems.map((item, i) => (
          <div key={i} className={`qi-item ${item.type === 'event' ? 'qi-item--event' : ''}`}>
            <span className="qi-item-dot" style={{ background: item.color }} />
            <span className="qi-item-icon">{item.type === 'event' ? '📅' : '✅'}</span>
            <span className="qi-item-title">{item.title}</span>
            {item.meta && <span className="qi-badge qi-badge--date">{item.meta}</span>}
          </div>
        ))}
        {agendaItems.length === 0 && <p className="qi-empty-msg">הכל בסדר! 🎉</p>}
      </div>
    );
  };

  return (
    <section className="quick-insights-card">
      <header className="quick-insights-header">
        <div>
          <h3>תובנות מהירות</h3>
          <p>לחצי שאלה לתשובה מותאמת ליום שלך</p>
        </div>
        <span className="quick-insights-icon">✦</span>
      </header>

      <div className="quick-insights-actions">
        {(['urgent', 'delay', 'prepare', 'relax'] as const).map(type => (
          <button
            key={type}
            className={`quick-insight-btn ${type === 'relax' ? 'quick-insight-btn--relax' : ''} ${selectedInsight === type ? 'quick-insight-btn--active' : ''}`}
            onClick={() => toggle(type)}
          >
            {type === 'urgent' && '🔥 מה דחוף היום?'}
            {type === 'delay'  && '⏸️ מה אפשר לדחות?'}
            {type === 'prepare' && '🗓️ אג׳נדה להיום'}
            {type === 'relax'  && '🌬️ רגע של רוגע'}
          </button>
        ))}
      </div>

      {selectedInsight === 'urgent'  && <div className="quick-insights-result">{renderUrgent()}</div>}
      {selectedInsight === 'delay'   && <div className="quick-insights-result">{renderDelay()}</div>}
      {selectedInsight === 'prepare' && <div className="quick-insights-result">{renderPrepare()}</div>}
      {selectedInsight === 'relax'   && (
        <div className="quick-insights-result quick-insights-relax">
          <p>{data.relaxTip.text}</p>
          <div className="qi-actions">
            {data.relaxTip.links.map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="qi-action-chip">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
      {!selectedInsight && (
        <div className="quick-insights-empty">
          לחצי על שאלה כדי לקבל תובנה מותאמת אישית על היום שלך.
        </div>
      )}
    </section>
  );
};

export default AiAssistant;
