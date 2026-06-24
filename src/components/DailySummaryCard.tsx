import { useMemo } from 'react';
import type { Task, CalendarEvent } from '../types';
import { isToday, isTomorrow } from '../utils/priority';

interface DailySummaryCardProps {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  newsCount?: number;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 6)  return 'לילה טוב 🌙';
  if (h < 12) return 'בוקר טוב ☀️';
  if (h < 17) return 'צהריים טובים 🌤️';
  if (h < 21) return 'ערב טוב 🌆';
  return 'לילה טוב 🌙';
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

const EXAM_RE  = /מבחן|בחינה|exam|test|quiz/i;
const INTER_RE = /ראיון|interview/i;
const DEAD_RE  = /הגשה|דדליין|deadline/i;

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

const DailySummaryCard = ({ tasks, calendarEvents }: DailySummaryCardProps) => {
  const data = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowMins  = new Date().getHours() * 60 + new Date().getMinutes();

    const todayEvents = calendarEvents
      .filter(e => e.date === todayStr && e.source !== 'demo')
      .sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));

    const futureEvents = todayEvents.filter(e => timeToMins(e.startTime) > nowMins);
    const nextEvent    = futureEvents[0] ?? null;
    const moreCount    = futureEvents.length - 1;

    // Only tasks DUE today
    const todayTasks = tasks.filter(t =>
      !t.completed && t.status !== 'done' &&
      (isToday(t.dueDate) || isToday(t.deadlineDate ?? ''))
    );

    // Smart context: scan next 14 days for exams / interviews / deadlines
    const upcoming = calendarEvents
      .filter(e => e.source !== 'demo' && e.date >= todayStr)
      .map(e => ({ ...e, days: daysUntil(e.date) }))
      .filter(e => e.days >= 0 && e.days <= 14)
      .sort((a, b) => a.days - b.days);

    const exams      = upcoming.filter(e => EXAM_RE.test(e.title));
    const interviews = upcoming.filter(e => INTER_RE.test(e.title));
    const deadlines  = upcoming.filter(e => DEAD_RE.test(e.title));

    // Context message logic
    let contextMsg: string | null = null;
    let contextEmoji = '💬';

    if (exams.length >= 2) {
      contextMsg = `נראה שאת בתקופת מבחנים — ${exams.length} מבחנים בקרוב. מאחלת לך המון הצלחה! 🍀`;
      contextEmoji = '📚';
    } else if (exams.length === 1) {
      const e = exams[0];
      if (e.days === 0) {
        contextMsg = `היום יש לך ${e.title} — בהצלחה, את יכולה לעשות את זה! 💪`;
      } else if (e.days === 1) {
        contextMsg = `מחר יש ${e.title} — חזרה אחרונה הערב ושינה טובה. בהצלחה! 🌟`;
      } else {
        contextMsg = `${e.title} ב-${formatDate(e.date)} — עוד ${e.days} ימים. בהצלחה בהכנות! 📖`;
      }
      contextEmoji = '📚';
    } else if (interviews.length > 0) {
      const i = interviews[0];
      contextMsg = i.days === 0
        ? `ראיון היום! ${i.title} — שתנשמי עמוק ותאמיני בעצמך. בהצלחה! ✨`
        : `ראיון ב-${formatDate(i.date)} — ${i.days} ימים. הכנה טובה שווה הכל. 💼`;
      contextEmoji = '💼';
    } else if (deadlines.length > 0) {
      const d = deadlines[0];
      contextMsg = d.days === 0
        ? `הגשה היום! ${d.title} — קדימה, אחת לפני לסוף! 🏁`
        : `הגשה ב-${formatDate(d.date)} — עוד ${d.days} ימים. לא להשאיר לרגע האחרון. 📝`;
      contextEmoji = '📝';
    }

    return { todayEvents, nextEvent, moreCount, todayTasks, contextMsg, contextEmoji };
  }, [tasks, calendarEvents]);

  return (
    <section className="ds2-card">
      {/* Date + Greeting */}
      <div className="ds2-top">
        <span className="ds2-greeting">{greetingByHour()}</span>
        <span className="ds2-date">{formatTodayDate()}</span>
      </div>

      {/* Smart context banner */}
      {data.contextMsg && (
        <div className="ds2-context-banner">
          <span className="ds2-context-emoji">{data.contextEmoji}</span>
          <span className="ds2-context-text">{data.contextMsg}</span>
        </div>
      )}

      <div className="ds2-body">
        {/* Next event */}
        {data.nextEvent ? (
          <div className="ds2-section">
            <div className="ds2-section-label">⏰ הבא בלוח</div>
            <div className="ds2-event-row">
              <span className="ds2-event-time">{data.nextEvent.startTime}</span>
              <span className="ds2-event-title">{data.nextEvent.title}</span>
              {data.moreCount > 0 && (
                <span className="ds2-more-badge">+{data.moreCount} עוד</span>
              )}
            </div>
          </div>
        ) : data.todayEvents.length > 0 ? (
          <div className="ds2-section">
            <div className="ds2-section-label ds2-label--muted">✅ כל אירועי היום הסתיימו</div>
          </div>
        ) : null}

        {/* Today's tasks only */}
        {data.todayTasks.length > 0 ? (
          <div className="ds2-section">
            <div className="ds2-section-label">📌 משימות להיום</div>
            <div className="ds2-task-list">
              {data.todayTasks.slice(0, 4).map(t => {
                const isUrgent = t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent';
                return (
                  <div key={t.id} className="ds2-task-row">
                    <span className={`ds2-task-dot ${isUrgent ? 'ds2-dot--red' : 'ds2-dot--blue'}`} />
                    <span className="ds2-task-title">{t.title}</span>
                    {isUrgent && <span className="ds2-task-badge">דחוף</span>}
                  </div>
                );
              })}
              {data.todayTasks.length > 4 && (
                <div className="ds2-task-row ds2-task-row--more">
                  <span className="ds2-task-dot" style={{ background: 'var(--text-muted)' }} />
                  <span className="ds2-task-title" style={{ color: 'var(--text-muted)' }}>
                    ועוד {data.todayTasks.length - 4} משימות להיום
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ds2-section">
            <div className="ds2-section-label ds2-label--muted">
              {data.todayEvents.length > 0 || data.contextMsg
                ? '✓ אין משימות מתוכננות להיום'
                : 'אין אירועים או משימות להיום — יום חופשי 🎉'}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DailySummaryCard;
