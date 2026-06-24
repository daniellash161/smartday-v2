// @ts-nocheck
import { useState, useMemo } from 'react';
import type { Task, CalendarEvent } from '../types';
import { isToday } from '../utils/priority';

type InsightType = 'urgent' | 'delay' | 'prepare' | 'relax' | null;

interface Props {
  tasks?: Task[];
  calendarEvents?: CalendarEvent[];
}

const RELAX_TIPS = [
  {
    text: 'תרגיל נשימה: שאפי 4 שניות, עצרי 4, שחרורי 4.',
    links: [
      { label: '🫁 נשימת קופסה', url: 'https://www.youtube.com/watch?v=tEmt1Znux58' },
      { label: '😌 מדיטציה 5 דקות', url: 'https://www.youtube.com/watch?v=inpok4MKVLM' },
    ],
  },
  {
    text: 'ירידת אנרגיה בצהריים היא ביולוגית. 10-20 דקות שינה קצרה עוזרת.',
    links: [
      { label: '😴 שינה פלאית 10 דק׳', url: 'https://www.youtube.com/watch?v=gh4G0eu8U1E' },
      { label: '🚶 הליכה קצרה בחוץ', url: 'https://www.youtube.com/watch?v=GQuYCKJNpM0' },
    ],
  },
  {
    text: 'עבדת הרבה? פומודורו — 25 דקות עבודה, 5 דקות הפסקה.',
    links: [
      { label: '⏱️ טיימר פומודורו', url: 'https://www.youtube.com/watch?v=mNBmG24djoY' },
      { label: '🧘 מתיחות קצרות', url: 'https://www.youtube.com/watch?v=tAUf7aajBWE' },
    ],
  },
];

function todayStr() { return new Date().toISOString().split('T')[0]; }

const AiAssistant = ({ tasks = [], calendarEvents = [] }: Props) => {
  const [selectedInsight, setSelectedInsight] = useState<InsightType>(null);

  const insights = useMemo(() => {
    const today = todayStr();
    const open = tasks.filter(t => !t.completed && t.status !== 'done');
    const urgentTasks = open.filter(t =>
      t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical'
    );
    const todayTasks = open.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? ''));
    const deferrable = open.filter(t =>
      t.priority !== 'high' && t.urgency !== 'high' && t.urgency !== 'urgent' &&
      !isToday(t.dueDate) && !isToday(t.deadlineDate ?? '')
    );
    const todayEvents = calendarEvents.filter(e => e.date === today);
    const nextEvent = [...todayEvents].sort((a,b) => a.startTime.localeCompare(b.startTime))[0];

    const urgentContent = urgentTasks.length > 0
      ? `יש ${urgentTasks.length} משימות דחופות: ${urgentTasks.slice(0, 2).map(t => t.title).join(', ')}${urgentTasks.length > 2 ? '...' : ''}.`
      : todayTasks.length > 0
        ? `אין דחיפות גבוהה, אבל יש ${todayTasks.length} משימות לסיום היום.`
        : 'אין משימות דחופות כרגע. יום טוב לתכנון קדימה.';

    const delayContent = deferrable.length > 0
      ? `${deferrable.length} משימות ניתנות לדחייה: ${deferrable.slice(0, 2).map(t => t.title).join(', ')}${deferrable.length > 2 ? ' ועוד...' : '.'}`
      : 'רוב המשימות הפתוחות דחופות או מתוכננות להיום — קשה לדחות כרגע.';

    const prepareContent = nextEvent
      ? `האירוע הבא: "${nextEvent.title}" בשעה ${nextEvent.startTime}.${urgentTasks.length > 0 ? ` גמרי קודם: ${urgentTasks[0].title}.` : ' כל המשימות הדחופות נקיות.'}`
      : todayTasks.length > 0
        ? `${todayTasks.length} משימות מתוכננות להיום. התחילי מהדחופות ביותר.`
        : 'אין אירועים ביומן היום. יום פנוי לעבודה עמוקה.';

    const hour = new Date().getHours();
    const relaxTip = hour >= 14 && hour < 16
      ? RELAX_TIPS[1]
      : hour >= 21
        ? RELAX_TIPS[2]
        : RELAX_TIPS[0];

    return { urgentContent, delayContent, prepareContent, relaxTip };
  }, [tasks, calendarEvents]);

  const toggle = (t: InsightType) => setSelectedInsight(prev => prev === t ? null : t);

  return (
    <section className="quick-insights-card">
      <header className="quick-insights-header">
        <div>
          <h3>תובנות מהירות</h3>
          <p>סיכומים קצרים שיעזרו לך להבין מה חשוב עכשיו</p>
        </div>
        <span className="quick-insights-icon">✦</span>
      </header>

      <div className="quick-insights-actions">
        <button
          className={`quick-insight-btn ${selectedInsight === 'urgent' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('urgent')}
        >
          מה דחוף היום?
        </button>
        <button
          className={`quick-insight-btn ${selectedInsight === 'delay' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('delay')}
        >
          מה אפשר לדחות?
        </button>
        <button
          className={`quick-insight-btn ${selectedInsight === 'prepare' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('prepare')}
        >
          איך להתכונן ליום?
        </button>
        <button
          className={`quick-insight-btn quick-insight-btn--relax ${selectedInsight === 'relax' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('relax')}
        >
          🌬️ רגע של רוגע
        </button>
      </div>

      {selectedInsight === 'urgent' && (
        <div className="quick-insights-result">
          <p>{insights.urgentContent}</p>
        </div>
      )}
      {selectedInsight === 'delay' && (
        <div className="quick-insights-result">
          <p>{insights.delayContent}</p>
        </div>
      )}
      {selectedInsight === 'prepare' && (
        <div className="quick-insights-result">
          <p>{insights.prepareContent}</p>
        </div>
      )}
      {selectedInsight === 'relax' && (
        <div className="quick-insights-result quick-insights-relax">
          <p>{insights.relaxTip.text}</p>
          <div className="qi-actions">
            {insights.relaxTip.links.map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="qi-action-chip">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
      {!selectedInsight && (
        <div className="quick-insights-empty">
          בחרי שאלה מהירה כדי לקבל תובנה על היום שלך.
        </div>
      )}
    </section>
  );
};

export default AiAssistant;
