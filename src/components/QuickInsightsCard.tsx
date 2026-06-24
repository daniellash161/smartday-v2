// @ts-nocheck
import { useState, useMemo } from 'react';
import type { CalendarEvent, Task } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InsightAction {
  label: string;
  url?: string;       // external link
  onClick?: () => void;
}

interface Insight {
  id: string;
  emoji: string;
  text: string;
  subtext?: string;
  actions?: InsightAction[];
  color: string;     // accent color
}

// ── Context detection helpers ─────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0]; }

function getHour(): number { return new Date().getHours(); }

function isBusyDay(events: CalendarEvent[], tasks: Task[]): boolean {
  const todayEvents = events.filter(e => e.date === todayStr() && e.source !== 'demo');
  const urgentTasks = tasks.filter(t => !t.completed && (t.urgency === 'high' || t.urgency === 'urgent'));
  return todayEvents.length >= 2 || urgentTasks.length >= 3;
}

function hasExamToday(events: CalendarEvent[]): boolean {
  return events.some(e => {
    if (e.date !== todayStr() || e.source === 'demo') return false;
    const lc = e.title.toLowerCase();
    return lc.includes('מבחן') || lc.includes('בחינה') || e.category === 'exam';
  });
}

function hasExamSoon(events: CalendarEvent[]): CalendarEvent | null {
  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86_400_000);
  return events.find(e => {
    if (e.source === 'demo') return false;
    const d = new Date(e.date);
    const lc = e.title.toLowerCase();
    return d > today && d <= in7 && (lc.includes('מבחן') || lc.includes('בחינה') || e.category === 'exam');
  }) ?? null;
}

function hasInterviewSoon(events: CalendarEvent[]): boolean {
  const today = new Date();
  const in3 = new Date(today.getTime() + 3 * 86_400_000);
  return events.some(e => {
    if (e.source === 'demo') return false;
    const d = new Date(e.date);
    return d >= today && d <= in3 && e.title.toLowerCase().includes('ראיון');
  });
}

function hasMeetingToday(events: CalendarEvent[]): boolean {
  return events.some(e => {
    if (e.date !== todayStr() || e.source === 'demo') return false;
    return e.category === 'meeting' || e.title.toLowerCase().includes('פגישה');
  });
}

function openTasksCount(tasks: Task[]): number {
  return tasks.filter(t => !t.completed && t.status !== 'done').length;
}

// ── Insight generators ────────────────────────────────────────────────────────

function buildInsights(events: CalendarEvent[], tasks: Task[]): Insight[] {
  const hour = getHour();
  const insights: Insight[] = [];
  const busy = isBusyDay(events, tasks);
  const examToday = hasExamToday(events);
  const examSoon = hasExamSoon(events);
  const interviewSoon = hasInterviewSoon(events);
  const meetingToday = hasMeetingToday(events);
  const openTasks = openTasksCount(tasks);

  // ── Morning greeting (until 10:00) ─────────────────────────────────────────
  if (hour < 10) {
    if (examToday) {
      insights.push({
        id: 'morning-exam',
        emoji: '🧠',
        text: 'יש לך מבחן היום — שנייה לפני שמתחילים',
        subtext: '2 דקות נשימות עמוקות ישפרו את הריכוז ויורידו עצבים. כדאי ממש לפני.',
        color: '#7db7e8',
        actions: [
          { label: '🌬️ נשימות 4-7-8', url: 'https://www.youtube.com/watch?v=gz4G31LGyog' },
          { label: '🧘 הרגעה 3 דק׳', url: 'https://www.youtube.com/watch?v=inpok4MKVLM' },
        ],
      });
    } else if (busy) {
      insights.push({
        id: 'morning-busy',
        emoji: '☀️',
        text: 'יום עמוס לפניך — כדאי להתחיל ברוגע',
        subtext: 'לפני שצוללים, 2 דקות נשימות יעזרו לך להתמקד ולהתחיל יותר בשליטה.',
        color: '#f4c76b',
        actions: [
          { label: '🌬️ נשימות בוקר', url: 'https://www.youtube.com/watch?v=gz4G31LGyog' },
          { label: '☕ הפסקת בוקר מכוונת', url: 'https://www.youtube.com/watch?v=O-6f5wQXSu8' },
        ],
      });
    } else {
      insights.push({
        id: 'morning-calm',
        emoji: '✨',
        text: 'בוקר טוב! היום נראה יחסית פנוי',
        subtext: 'יום יותר שקט הוא הזדמנות לעשות משהו שדחית — אולי להתחיל משימה שנצברה?',
        color: '#7ec98f',
        actions: [
          { label: '🎵 מוזיקת ריכוז', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
        ],
      });
    }
  }

  // ── Exam today ──────────────────────────────────────────────────────────────
  if (examToday) {
    insights.push({
      id: 'exam-today',
      emoji: '📝',
      text: 'לפני הבחינה — כמה דקות של הכנה נפשית',
      subtext: 'ביטחון עצמי משפיע על ביצועים. תזכורת: את יודעת את החומר. נשמי, ותנחיתי.',
      color: '#e8738f',
      actions: [
        { label: '💪 הרגעה לפני מבחן', url: 'https://www.youtube.com/watch?v=inpok4MKVLM' },
        { label: '🧘 מדיטציה 5 דק׳', url: 'https://www.youtube.com/watch?v=ZToicYcHIOU' },
      ],
    });
  }

  // ── Exam coming soon ────────────────────────────────────────────────────────
  if (examSoon && !examToday) {
    const daysLeft = Math.ceil((new Date(examSoon.date).getTime() - Date.now()) / 86_400_000);
    insights.push({
      id: 'exam-soon',
      emoji: '📚',
      text: `${examSoon.title} בעוד ${daysLeft} ימים`,
      subtext: 'כדאי לתכנן מתי לחזור על החומר. מחקרים מראים שחזרה קצרה כל יום יעילה יותר ממרתון לימוד.',
      color: '#7db7e8',
      actions: [
        { label: '🎵 מוזיקה ללמידה', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
        { label: '⏱️ טכניקת פומודורו', url: 'https://www.youtube.com/watch?v=mNBmG24djoY' },
      ],
    });
  }

  // ── Interview coming ────────────────────────────────────────────────────────
  if (interviewSoon) {
    insights.push({
      id: 'interview-soon',
      emoji: '💼',
      text: 'ראיון בקרוב — הכנה מנטלית חשובה לא פחות מהכנה מקצועית',
      subtext: 'כמה דקות של ויזואליזציה חיובית לפני ראיון משפרות ביצועים. מוכנה לנסות?',
      color: '#a080c0',
      actions: [
        { label: '🧘 הכנה לראיון', url: 'https://www.youtube.com/watch?v=RVmMeMcGc0Y' },
        { label: '💪 Power pose 2 דק׳', url: 'https://www.youtube.com/watch?v=Ks-_Mh1QhMc' },
      ],
    });
  }

  // ── Meeting today ────────────────────────────────────────────────────────────
  if (meetingToday && !examToday) {
    insights.push({
      id: 'meeting-today',
      emoji: '🤝',
      text: 'יש לך פגישה היום — כניסה עם אנרגיה טובה עושה הבדל',
      subtext: 'פגישה אחרי הפסקה קצרה ומיינדפול יוצאת הרבה יותר טוב מפגישה "בין לבין".',
      color: '#3fafa3',
      actions: [
        { label: '🌬️ נשימות לפני פגישה', url: 'https://www.youtube.com/watch?v=gz4G31LGyog' },
      ],
    });
  }

  // ── Many open tasks ──────────────────────────────────────────────────────────
  if (openTasks >= 5) {
    insights.push({
      id: 'task-overload',
      emoji: '🗂️',
      text: `יש לך ${openTasks} משימות פתוחות — קחי רגע`,
      subtext: 'עומס יוצר מחשבות מסוחררות. 5 דקות של ארגון (לא עשייה!) עוזרות לתעדף ולנשום.',
      color: '#ef8a8a',
      actions: [
        { label: '🧹 "Brain dump" מהיר', url: 'https://www.youtube.com/watch?v=gCswMsONkwY' },
      ],
    });
  }

  // ── Afternoon energy dip (14:00–16:00) ─────────────────────────────────────
  if (hour >= 14 && hour <= 16) {
    insights.push({
      id: 'afternoon-dip',
      emoji: '😴',
      text: 'עמך בשעות הצהריים? זה לגמרי נורמלי',
      subtext: 'ירידת אנרגיה בשעות 14-16 היא ביולוגית. הפסקה קצרה של 10-20 דק׳ מאפסת ועדיפה על קפה.',
      color: '#b89010',
      actions: [
        { label: '😴 שינה פלאית 10 דק׳', url: 'https://www.youtube.com/watch?v=FNpFBaWImFw' },
        { label: '🚶 הליכה קצרה בחוץ', url: 'https://www.youtube.com/watch?v=hnpQrMqDoqE' },
      ],
    });
  }

  // ── Evening wind-down (after 20:00) ────────────────────────────────────────
  if (hour >= 20) {
    insights.push({
      id: 'evening',
      emoji: '🌙',
      text: 'ערב טוב — הגיע הזמן לעבור מצב',
      subtext: 'מחקרים מראים שכיבוי מסכות 30 דק׳ לפני שינה משפר את איכות השינה משמעותית.',
      color: '#7b68ee',
      actions: [
        { label: '🌙 מדיטציית לילה', url: 'https://www.youtube.com/watch?v=aEqlQvczMJQ' },
        { label: '📖 ספר / ג׳ורנל', url: undefined },
      ],
    });
  }

  // Always show at least 1 insight — default motivational
  if (insights.length === 0) {
    insights.push({
      id: 'default',
      emoji: '💡',
      text: 'טיפ מהיר להיום',
      subtext: 'ריכוז טוב מתחיל בנשימה. אפילו 60 שניות של נשימה מודעת משנות את מצב הרוח.',
      color: '#7db7e8',
      actions: [
        { label: '🌬️ נסי עכשיו — 60 שניות', url: 'https://www.youtube.com/watch?v=gz4G31LGyog' },
      ],
    });
  }

  return insights.slice(0, 3);
}

// ── Insight bubble component ──────────────────────────────────────────────────

const InsightBubble = ({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="qi-bubble" style={{ borderRightColor: insight.color }}>
      <div className="qi-bubble-top" onClick={() => setExpanded(e => !e)}>
        <span className="qi-emoji">{insight.emoji}</span>
        <div className="qi-content">
          <p className="qi-text">{insight.text}</p>
          {expanded && insight.subtext && (
            <p className="qi-subtext">{insight.subtext}</p>
          )}
          {expanded && insight.actions && insight.actions.length > 0 && (
            <div className="qi-actions">
              {insight.actions.map((a, i) =>
                a.url ? (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qi-action-chip"
                    style={{ background: insight.color + '22', color: insight.color }}
                  >
                    {a.label}
                  </a>
                ) : (
                  <span
                    key={i}
                    className="qi-action-chip"
                    style={{ background: insight.color + '22', color: insight.color }}
                  >
                    {a.label}
                  </span>
                )
              )}
            </div>
          )}
        </div>
        <button className="qi-expand-btn" aria-label={expanded ? 'כווץ' : 'הרחב'}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {!expanded && (
        <button className="qi-dismiss" onClick={(e) => { e.stopPropagation(); onDismiss(); }} aria-label="סגור">
          ✕
        </button>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface QuickInsightsCardProps {
  calendarEvents?: CalendarEvent[];
  tasks?: Task[];
}

const QuickInsightsCard = ({
  calendarEvents = [],
  tasks = [],
}: QuickInsightsCardProps) => {
  const allInsights = useMemo(
    () => buildInsights(calendarEvents, tasks),
    [calendarEvents, tasks],
  );

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visible = allInsights.filter(i => !dismissedIds.has(i.id));

  const dismiss = (id: string) => setDismissedIds(prev => new Set(prev).add(id));

  if (visible.length === 0) return null;

  return (
    <div className="card qi-card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon">💬</span>
          <h2 className="card-title">תובנות מהירות</h2>
        </div>
      </div>
      <div className="qi-list">
        {visible.map(insight => (
          <InsightBubble
            key={insight.id}
            insight={insight}
            onDismiss={() => dismiss(insight.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default QuickInsightsCard;
