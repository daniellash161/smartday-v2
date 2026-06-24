import { useMemo } from 'react';
import type { Task, CalendarEvent } from '../types';
import { isToday, isTomorrow } from '../utils/priority';

interface DailySummaryCardProps {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  newsCount: number;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 6)  return 'לילה טוב 🌙';
  if (h < 12) return 'בוקר טוב ☀️';
  if (h < 17) return 'צהריים טובים 🌤️';
  if (h < 21) return 'ערב טוב 🌆';
  return 'לילה טוב 🌙';
}

const DailySummaryCard = ({ tasks, calendarEvents }: DailySummaryCardProps) => {
  const today = todayStr();

  const data = useMemo(() => {
    const todayEvents = calendarEvents
      .filter(e => e.date === today && e.source !== 'demo')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const openTasks = tasks.filter(t => !t.completed && t.status !== 'done');
    const urgentTasks = openTasks.filter(t =>
      t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent'
    );
    const todayTasks = openTasks.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? ''));
    const nextEvent = todayEvents[0] ?? null;
    const topTask = urgentTasks[0] ?? todayTasks[0] ?? openTasks[0] ?? null;

    return { todayEvents, openTasks, urgentTasks, todayTasks, nextEvent, topTask };
  }, [tasks, calendarEvents, today]);

  const hasData = data.todayEvents.length > 0 || data.openTasks.length > 0;

  return (
    <section className="ds2-card">
      <div className="ds2-greeting">{greetingByHour()}</div>

      {!hasData ? (
        <p className="ds2-empty">
          אין נתונים כרגע — חברי לוח שנה ומשימות לקבלת סיכום מותאם אישית.
        </p>
      ) : (
        <div className="ds2-rows">
          {/* Next calendar event today */}
          {data.nextEvent && (
            <div className="ds2-row ds2-row--event">
              <span className="ds2-row-icon">📅</span>
              <div className="ds2-row-body">
                <span className="ds2-row-label">הבא בלוח</span>
                <span className="ds2-row-value">{data.nextEvent.title} — {data.nextEvent.startTime}</span>
              </div>
              {data.todayEvents.length > 1 && (
                <span className="ds2-badge">+{data.todayEvents.length - 1}</span>
              )}
            </div>
          )}

          {/* Top urgent task */}
          {data.topTask && (
            <div className="ds2-row ds2-row--task">
              <span className="ds2-row-icon">🔥</span>
              <div className="ds2-row-body">
                <span className="ds2-row-label">
                  {data.urgentTasks.length > 0 ? 'משימה דחופה' : 'משימה הבאה'}
                </span>
                <span className="ds2-row-value">{data.topTask.title}</span>
              </div>
              {data.urgentTasks.length > 1 && (
                <span className="ds2-badge ds2-badge--red">+{data.urgentTasks.length - 1} דחופות</span>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="ds2-stats">
            {data.todayEvents.length > 0 && (
              <span className="ds2-stat">
                <strong>{data.todayEvents.length}</strong> אירועים היום
              </span>
            )}
            {data.todayTasks.length > 0 && (
              <span className="ds2-stat ds2-stat--warn">
                <strong>{data.todayTasks.length}</strong> למשימות היום
              </span>
            )}
            {data.openTasks.length > 0 && (
              <span className="ds2-stat">
                <strong>{data.openTasks.length}</strong> פתוחות סה״כ
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default DailySummaryCard;
