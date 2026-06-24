// @ts-nocheck
import { useState, useMemo } from 'react';
import type { Task, CalendarEvent } from '../types';
import { isToday, isTomorrow } from '../utils/priority';

type InsightType = 'focus' | 'flow' | 'agenda' | 'relax' | null;

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
    text: 'ירידת אנרגיה בצהריים היא ביולוגית. 10 דקות שכיבה עוזרות יותר מקפה.',
    links: [
      { label: '😴 שינה פלאית 10 דק׳', url: 'https://www.youtube.com/watch?v=gh4G0eu8U1E' },
      { label: '🚶 הליכה קצרה בחוץ', url: 'https://www.youtube.com/watch?v=GQuYCKJNpM0' },
    ],
  },
  {
    text: 'ערב טוב לסגור את היום. פומודורו אחד אחרון ואז קחי הפסקה אמיתית.',
    links: [
      { label: '⏱️ טיימר פומודורו', url: 'https://www.youtube.com/watch?v=mNBmG24djoY' },
      { label: '🧘 מתיחות קצרות', url: 'https://www.youtube.com/watch?v=tAUf7aajBWE' },
    ],
  },
];

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

// Find the single most important upcoming thing (exam/deadline/interview/event)
function findMainFocus(tasks: Task[], calendarEvents: CalendarEvent[]) {
  const today = todayStr();
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  // Upcoming high-priority events (exams, interviews, deadlines) in next 14 days
  const EXAM_RE = /מבחן|בחינה|exam|test|quiz/i;
  const INTERVIEW_RE = /ראיון|interview/i;
  const DEADLINE_RE = /הגשה|דדליין|deadline/i;

  const upcomingImportant = calendarEvents
    .filter(e => e.source !== 'demo' && e.date >= today)
    .map(e => ({ ...e, days: daysUntil(e.date) }))
    .filter(e => e.days <= 14)
    .sort((a, b) => a.days - b.days);

  const exam = upcomingImportant.find(e => EXAM_RE.test(e.title));
  const interview = upcomingImportant.find(e => INTERVIEW_RE.test(e.title));
  const deadline = upcomingImportant.find(e => DEADLINE_RE.test(e.title));
  const nextEvent = upcomingImportant[0] ?? null;

  // Today's future events
  const futureToday = calendarEvents
    .filter(e => e.source !== 'demo' && e.date === today)
    .filter(e => {
      const [h, m] = e.startTime.split(':').map(Number);
      return (h * 60 + (m || 0)) > nowMins;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const open = tasks.filter(t => !t.completed && t.status !== 'done');
  const todayTasks = open.filter(t => isToday(t.dueDate) || isToday(t.deadlineDate ?? ''));
  const tomorrowTasks = open.filter(t => isTomorrow(t.dueDate) || isTomorrow(t.deadlineDate ?? ''));

  const mainFocus = exam ?? interview ?? deadline ?? (nextEvent?.days === 0 ? nextEvent : null);

  return { exam, interview, deadline, nextEvent, mainFocus, futureToday, open, todayTasks, tomorrowTasks, upcomingImportant };
}

const AiAssistant = ({ tasks = [], calendarEvents = [] }: Props) => {
  const [selectedInsight, setSelectedInsight] = useState<InsightType>(null);

  const ctx = useMemo(() => findMainFocus(tasks, calendarEvents), [tasks, calendarEvents]);

  const hour = new Date().getHours();
  const relaxTip = hour >= 14 && hour < 17 ? RELAX_TIPS[1] : hour >= 20 ? RELAX_TIPS[2] : RELAX_TIPS[0];

  const toggle = (t: InsightType) => setSelectedInsight(prev => prev === t ? null : t);

  // ── Smart wisdom sentences ────────────────────────────────────────────────

  const focusWisdom = (): string => {
    const { mainFocus, exam, interview, deadline, futureToday, todayTasks, open } = ctx;

    if (exam) {
      const d = exam.days;
      if (d === 0) return `היום יש את ${exam.title} — הזמן ללמוד ולנשום עמוק. מזל טוב 🍀`;
      if (d === 1) return `מחר יש ${exam.title}. הערב — חזרה אחרונה ושינה טובה, לא לחץ.`;
      if (d <= 3) return `${exam.title} בעוד ${d} ימים. זה הדבר הכי חשוב עכשיו — שאר הדברים ימתינו.`;
      return `${exam.title} ב-${formatDate(exam.date)} — ${d} ימים. כדאי להתחיל לבנות לוז למידה.`;
    }
    if (interview) {
      const d = interview.days;
      if (d <= 1) return `ראיון ${d === 0 ? 'היום' : 'מחר'}: ${interview.title}. תתמקדי בהכנה — שאר הדברים ימתינו.`;
      return `יש לך ראיון ב-${formatDate(interview.date)} — כדאי להכין שאלות ולתרגל הצגה עצמית.`;
    }
    if (deadline) {
      const d = deadline.days;
      if (d === 0) return `הגשה היום: ${deadline.title}. קדימה — זה הדבר הכי דחוף עכשיו.`;
      if (d === 1) return `הגשה מחר: ${deadline.title}. סיימי אותה הערב.`;
      return `הגשה ב-${formatDate(deadline.date)}: ${deadline.title}. עוד ${d} ימים — תתחילי להתקדם.`;
    }
    if (futureToday.length > 0) {
      const e = futureToday[0];
      return `יש לך ${e.title} בשעה ${e.startTime} היום. תסיימי משימה אחת לפני כן ותגיעי רגועה.`;
    }
    if (todayTasks.length > 0) {
      const t = todayTasks[0];
      return `"${t.title}" צריכה להיגמר היום. קחי 25 דקות פומודורו ותתחילי עכשיו.`;
    }
    if (open.length > 0) {
      return `אין דדליינים לחץ קרובים. בחרי את המשימה שהכי מפחידה אותך — ותעשי אותה ראשונה.`;
    }
    return 'הכל רגוע היום 🎉 יום טוב לתכנון שבוע הבא.';
  };

  const flowWisdom = (): string => {
    const { mainFocus, exam, interview, deadline, open, todayTasks, tomorrowTasks, futureToday } = ctx;

    if (exam || interview || deadline) {
      const focus = exam ?? interview ?? deadline;
      const other = open.filter(t =>
        !isToday(t.dueDate) && !isToday(t.deadlineDate ?? '') &&
        !isTomorrow(t.dueDate) && !isTomorrow(t.deadlineDate ?? '')
      );
      if (focus.days <= 3) {
        return `עם ${focus.title} בעוד ${focus.days} ימ${focus.days === 1 ? '' : 'ים'} — הכל מלבד ההכנה יכול לחכות. תתרכזי.`;
      }
      if (other.length > 0) {
        return `ה${exam ? 'מבחן' : interview ? 'ראיון' : 'הגשה'} ב-${formatDate(focus.date)} הוא העדיפות. שאר המשימות הפתוחות לא בורחות — תחזרי אליהן אחרי.`;
      }
    }
    if (todayTasks.length === 0 && tomorrowTasks.length === 0) {
      return `אין לחץ של דדליינים קרובים. זה הזמן לעבוד על משימות שדוחות לפי חשיבות, לא דחיפות.`;
    }
    if (futureToday.length >= 2) {
      return `יש לך ${futureToday.length} אירועים היום — תסיימי דברים קצרים בין אירוע לאירוע, לא תתחילי משהו כבד.`;
    }
    if (open.length === 0) {
      return `אין משימות פתוחות כרגע — היום יכול להיות יום לנשום ולחשוב על מה הלאה.`;
    }
    return `תקחי את המשימה שהכי דוחה אותה ותעשי אותה ראשונה. שאר הדברים ירגישו קלים יותר אחרי.`;
  };

  const agendaWisdom = (): string => {
    const { futureToday, todayTasks, exam, mainFocus, open } = ctx;

    if (futureToday.length === 0 && todayTasks.length === 0 && !exam) {
      return `אין אירועים או דדליינים היום — יום פנוי. בחרי 1-3 משימות ותגדירי לעצמך יעד ברור לסיום היום.`;
    }
    const parts: string[] = [];
    if (futureToday.length > 0) {
      const e = futureToday[0];
      parts.push(`בשעה ${e.startTime} — ${e.title}`);
      if (futureToday.length > 1) parts.push(`ואחר כך ${futureToday[1].title} בשעה ${futureToday[1].startTime}`);
    }
    if (exam && exam.days > 0 && exam.days <= 7) {
      parts.push(`בין לבין — ללמוד ל${exam.title} (${exam.days} ימים נשארו)`);
    } else if (todayTasks.length > 0) {
      parts.push(`בין לבין — ${todayTasks[0].title}`);
    }
    if (parts.length === 0 && open.length > 0) {
      return `היום פנוי — תבחרי משימה אחת ותסיימי אותה לגמרי לפני שעוברת לאחרת.`;
    }
    return parts.join('. ') + '.';
  };

  const getWisdom = (type: InsightType): string => {
    if (type === 'focus')  return focusWisdom();
    if (type === 'flow')   return flowWisdom();
    if (type === 'agenda') return agendaWisdom();
    return '';
  };

  return (
    <section className="quick-insights-card">
      <header className="quick-insights-header">
        <div>
          <h3>תובנות מהירות</h3>
          <p>לחצי שאלה לקבלת פרספקטיבה חכמה</p>
        </div>
        <span className="quick-insights-icon">✦</span>
      </header>

      <div className="quick-insights-actions">
        <button
          className={`quick-insight-btn ${selectedInsight === 'focus' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('focus')}
        >
          🎯 מה הכי חשוב עכשיו?
        </button>
        <button
          className={`quick-insight-btn ${selectedInsight === 'flow' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('flow')}
        >
          🧠 על מה להתמקד?
        </button>
        <button
          className={`quick-insight-btn ${selectedInsight === 'agenda' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('agenda')}
        >
          🗓️ איך ייראה היום?
        </button>
        <button
          className={`quick-insight-btn quick-insight-btn--relax ${selectedInsight === 'relax' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => toggle('relax')}
        >
          🌬️ רגע של רוגע
        </button>
      </div>

      {(selectedInsight === 'focus' || selectedInsight === 'flow' || selectedInsight === 'agenda') && (
        <div className="quick-insights-result qi-wisdom">
          <p className="qi-wisdom-text">{getWisdom(selectedInsight)}</p>
        </div>
      )}

      {selectedInsight === 'relax' && (
        <div className="quick-insights-result quick-insights-relax">
          <p>{relaxTip.text}</p>
          <div className="qi-actions">
            {relaxTip.links.map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="qi-action-chip">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {!selectedInsight && (
        <div className="quick-insights-empty">
          לחצי על שאלה לקבלת פרספקטיבה חכמה על היום שלך.
        </div>
      )}
    </section>
  );
};

export default AiAssistant;
