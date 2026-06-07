import { useMemo } from 'react';
import type { Task, TaskUrgency } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().split('T')[0];

const URGENCY_ORDER: Record<TaskUrgency, number> = {
  urgent: 0,
  high:   1,
  medium: 2,
  low:    3,
};

function sortByUrgencyDeadline(a: Task, b: Task): number {
  const uo = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
  if (uo !== 0) return uo;
  return (a.deadlineDate + (a.deadlineTime ?? '23:59')).localeCompare(
    b.deadlineDate + (b.deadlineTime ?? '23:59'),
  );
}

interface LoadInfo {
  label: string;
  color: string;
  dots:  number;   // filled dots out of 4
}

function getLoad(openCount: number): LoadInfo {
  if (openCount <= 2) return { label: 'רגוע',     color: '#7cc9a5', dots: 1 };
  if (openCount <= 4) return { label: 'בינוני',   color: '#f4c76b', dots: 2 };
  if (openCount <= 6) return { label: 'עמוס',     color: '#ef8a8a', dots: 3 };
  return               { label: 'עמוס מאוד', color: '#e05a7a', dots: 4 };
}

function buildFocus(sorted: Task[]): string {
  if (sorted.length === 0) return 'אין משימות פתוחות להיום — נשמע כמו יום נעים!';

  const top = sorted[0];
  const urgentCount = sorted.filter(t => t.urgency === 'urgent').length;
  const highCount   = sorted.filter(t => t.urgency === 'high').length;

  if (urgentCount >= 2) return `יש לך ${urgentCount} משימות דחופות שמחכות לך — כדאי להתחיל בהן עכשיו.`;
  if (urgentCount === 1 && highCount >= 1)
    return `משימה דחופה בראש הרשימה: "${top.title}". אחריה יש עוד ${highCount} משימות חשובות.`;
  if (urgentCount === 1) return `יש לך משימה דחופה אחת: "${top.title}". מומלץ לטפל בה ראשונה.`;
  if (highCount >= 1)    return `המשימה הכי חשובה שלך היום: "${top.title}".`;
  return `יש לך ${sorted.length} משימות פתוחות. הכי קרובה: "${top.title}".`;
}

function buildNextAction(sorted: Task[]): string {
  if (sorted.length === 0) return 'אפשר להוסיף משימות חדשות ולתכנן את השבוע.';
  const top = sorted[0];
  const deadline = top.deadlineDate === TODAY ? 'היום' : `עד ${top.deadlineDate.slice(5).replace('-', '/')}`;
  return `${top.title} (${deadline})`;
}

function buildWarning(sorted: Task[]): string | null {
  const todayUrgent = sorted.filter(
    t => t.urgency === 'urgent' && t.deadlineDate === TODAY,
  );
  if (todayUrgent.length > 0)
    return `${todayUrgent.length === 1 ? 'משימה דחופה' : `${todayUrgent.length} משימות דחופות`} נגמרות היום!`;

  const overdue = sorted.filter(t => t.deadlineDate < TODAY);
  if (overdue.length > 0)
    return `${overdue.length} ${overdue.length === 1 ? 'משימה עברה' : 'משימות עברו'} את המועד האחרון.`;

  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  const tmrHigh = sorted.filter(
    t => t.deadlineDate === tomorrowStr && ['urgent', 'high'].includes(t.urgency),
  );
  if (tmrHigh.length > 0)
    return `${tmrHigh.length === 1 ? 'משימה חשובה' : `${tmrHigh.length} משימות חשובות`} מסתיימות מחר.`;

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  tasks: Task[];
}

const SmartDayBrief = ({ tasks }: Props) => {
  const openTasks = useMemo(
    () => tasks.filter(t => t.status !== 'done').sort(sortByUrgencyDeadline),
    [tasks],
  );

  const load        = useMemo(() => getLoad(openTasks.length), [openTasks]);
  const focus       = useMemo(() => buildFocus(openTasks), [openTasks]);
  const nextAction  = useMemo(() => buildNextAction(openTasks), [openTasks]);
  const warning     = useMemo(() => buildWarning(openTasks), [openTasks]);

  // Life-area counts
  const areas = useMemo(() => {
    const academic = openTasks.filter(t => t.category === 'academic').length;
    const work     = openTasks.filter(t => t.category === 'work').length;
    const personal = openTasks.filter(t => t.category === 'personal').length;
    const other    = openTasks.filter(t => ['payment', 'other'].includes(t.category)).length;
    return { academic, work, personal, other };
  }, [openTasks]);

  // Day-of-week in Hebrew
  const dayName = useMemo(() => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return 'יום ' + days[new Date().getDay()];
  }, []);

  const dateLabel = useMemo(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  return (
    <div className="brief-card">
      {/* ── Top row ── */}
      <div className="brief-top-row">
        <div className="brief-brand-group">
          <span className="brief-icon">✦</span>
          <div>
            <div className="brief-title">SmartDay Brief</div>
            <div className="brief-subtitle">היום שלך במבט אחד</div>
          </div>
        </div>

        <div className="brief-meta">
          <span className="brief-date">{dayName}, {dateLabel}</span>
          <span
            className="brief-load-badge"
            style={{ background: load.color + '22', color: load.color, borderColor: load.color + '55' }}
          >
            {[...Array(4)].map((_, i) => (
              <span
                key={i}
                className="brief-load-dot"
                style={{ background: i < load.dots ? load.color : load.color + '33' }}
              />
            ))}
            עומס {load.label}
          </span>
        </div>
      </div>

      {/* ── Focus sentence ── */}
      <p className="brief-focus">{focus}</p>

      {/* ── Insights row ── */}
      <div className="brief-insights-row">
        <div className="brief-insight brief-insight--action">
          <span className="brief-insight-icon">▶</span>
          <div>
            <div className="brief-insight-label">הפעולה הבאה המומלצת</div>
            <div className="brief-insight-value">{nextAction}</div>
          </div>
        </div>

        {warning ? (
          <div className="brief-insight brief-insight--warning">
            <span className="brief-insight-icon">⚠</span>
            <div>
              <div className="brief-insight-label">שים לב</div>
              <div className="brief-insight-value">{warning}</div>
            </div>
          </div>
        ) : (
          <div className="brief-insight brief-insight--ok">
            <span className="brief-insight-icon">✓</span>
            <div>
              <div className="brief-insight-label">הכל בסדר</div>
              <div className="brief-insight-value">אין משימות דחופות שעומדות לפוג בקרוב</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Life areas ── */}
      <div className="brief-areas-row">
        {areas.academic > 0 && (
          <span className="brief-area-chip brief-area--academic">
            🎓 לימודים <span className="brief-area-count">{areas.academic}</span>
          </span>
        )}
        {areas.work > 0 && (
          <span className="brief-area-chip brief-area--work">
            💼 עבודה <span className="brief-area-count">{areas.work}</span>
          </span>
        )}
        {areas.personal > 0 && (
          <span className="brief-area-chip brief-area--personal">
            🌱 אישי <span className="brief-area-count">{areas.personal}</span>
          </span>
        )}
        {areas.other > 0 && (
          <span className="brief-area-chip brief-area--other">
            📋 סידורים <span className="brief-area-count">{areas.other}</span>
          </span>
        )}
        {openTasks.length === 0 && (
          <span className="brief-area-chip brief-area--empty">אין משימות פתוחות</span>
        )}
      </div>
    </div>
  );
};

export default SmartDayBrief;
