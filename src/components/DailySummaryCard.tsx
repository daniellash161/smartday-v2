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
  return new Date().toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

const DailySummaryCard = ({ tasks, calendarEvents }: DailySummaryCardProps) => {
  const data = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

    const todayEvents = calendarEvents
      .filter(e => e.date === todayStr && e.source !== 'demo')
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // Next event = future events only; fall back to last event if all are past
    const futureEvents = todayEvents.filter(e => timeToMinutes(e.startTime) > nowMins);
    const nextEvent = futureEvents[0] ?? null;
    const laterEvents = futureEvents.slice(1);

    const openTasks = tasks.filter(t => !t.completed && t.status !== 'done');
    const urgentTasks = openTasks.filter(t =>
      t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical'
    );
    const todayTasks = openTasks.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? ''));
    const tomorrowTasks = openTasks.filter(t => isTomorrow(t.dueDate) || isTomorrow(t.deadlineDate ?? ''));

    // Top tasks to surface: urgent first, then today deadline
    const topTasks = [
      ...urgentTasks.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? '')),
      ...urgentTasks.filter(t => !isToday(t.dueDate) && !isToday(t.deadlineDate ?? '')),
      ...todayTasks.filter(t => !urgentTasks.includes(t)),
    ].slice(0, 3);

    return {
      todayEvents, nextEvent, laterEvents,
      openTasks, urgentTasks, todayTasks, tomorrowTasks, topTasks,
    };
  }, [tasks, calendarEvents]);

  const hasAnyData = data.openTasks.length > 0 || data.todayEvents.length > 0;

  return (
    <section className="ds2-card">
      {/* Date + Greeting */}
      <div className="ds2-top">
        <span className="ds2-greeting">{greetingByHour()}</span>
        <span className="ds2-date">{formatTodayDate()}</span>
      </div>

      {!hasAnyData ? (
        <p className="ds2-empty">
          חברי לוח שנה ומשימות לקבלת סיכום מותאם ליום 📋
        </p>
      ) : (
        <div className="ds2-body">
          {/* Next event */}
          {data.nextEvent ? (
            <div className="ds2-section">
              <div className="ds2-section-label">⏰ הבא בלוח</div>
              <div className="ds2-event-row">
                <span className="ds2-event-time">{data.nextEvent.startTime}</span>
                <span className="ds2-event-title">{data.nextEvent.title}</span>
                {data.laterEvents.length > 0 && (
                  <span className="ds2-more-badge">+{data.laterEvents.length} עוד</span>
                )}
              </div>
            </div>
          ) : data.todayEvents.length > 0 ? (
            <div className="ds2-section">
              <div className="ds2-section-label">📅 אירועי היום הסתיימו</div>
              <div className="ds2-hint">היו {data.todayEvents.length} אירועים היום</div>
            </div>
          ) : null}

          {/* Top tasks for today */}
          {data.topTasks.length > 0 && (
            <div className="ds2-section">
              <div className="ds2-section-label">
                {data.urgentTasks.length > 0 ? '🔥 דחוף לטיפול' : '✅ משימות להיום'}
              </div>
              <div className="ds2-task-list">
                {data.topTasks.map(t => {
                  const isUrgent = t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent';
                  const dueToday = isToday(t.dueDate) || isToday(t.deadlineDate ?? '');
                  return (
                    <div key={t.id} className="ds2-task-row">
                      <span className={`ds2-task-dot ${isUrgent ? 'ds2-dot--red' : 'ds2-dot--blue'}`} />
                      <span className="ds2-task-title">{t.title}</span>
                      {dueToday && <span className="ds2-task-badge">היום</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="ds2-stats-row">
            {data.urgentTasks.length > 0 && (
              <span className="ds2-chip ds2-chip--red">🔴 {data.urgentTasks.length} דחופות</span>
            )}
            {data.todayTasks.length > 0 && (
              <span className="ds2-chip ds2-chip--amber">📌 {data.todayTasks.length} להיום</span>
            )}
            {data.tomorrowTasks.length > 0 && (
              <span className="ds2-chip">🔜 {data.tomorrowTasks.length} למחר</span>
            )}
            {data.openTasks.length > 0 && (
              <span className="ds2-chip ds2-chip--muted">📂 {data.openTasks.length} פתוחות</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default DailySummaryCard;
