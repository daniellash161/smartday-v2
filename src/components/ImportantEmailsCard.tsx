// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';
import type {
  ImportantEmail,
  EmailCategory,
  EmailImportance,
  EmailStatus,
  Task,
  TaskUrgency,
  TaskCategory,
  CalendarEvent,
  EventCategory,
  EventImportance,
} from '../types';
import {
  connectGmail,
  disconnectGmail,
  fetchImportantEmails,
  restoreGmailSession,
  gmailIsConnected,
} from '../services/gmailService';

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

const IMPORTANCE_ORDER: Record<EmailImportance, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

const IMPORTANCE_LABEL: Record<EmailImportance, string> = {
  urgent: 'דחוף',
  high:   'חשוב',
  medium: 'בינוני',
  low:    'רגיל',
};

const IMPORTANCE_COLOR: Record<EmailImportance, string> = {
  urgent: '#e05a7a',
  high:   '#d4844a',
  medium: '#b89010',
  low:    '#4aae80',
};

const IMPORTANCE_BG: Record<EmailImportance, string> = {
  urgent: '#ffeef3',
  high:   '#fff2e8',
  medium: '#fffbe6',
  low:    '#edfbf3',
};

const CATEGORY_LABEL: Record<EmailCategory, string> = {
  academic: 'לימודים',
  work:     'עבודה',
  payment:  'תשלום',
  meeting:  'פגישה',
  personal: 'אישי',
  other:    'אחר',
};

const CATEGORY_COLOR: Record<EmailCategory, string> = {
  academic: '#4a7aa8',
  work:     '#d98ba6',
  payment:  '#907010',
  meeting:  '#4a9870',
  personal: '#a080c0',
  other:    '#9b7f90',
};

const CATEGORY_BG: Record<EmailCategory, string> = {
  academic: 'rgba(142,202,230,.15)',
  work:     'rgba(217,139,166,.12)',
  payment:  'rgba(244,199,107,.14)',
  meeting:  'rgba(124,201,165,.14)',
  personal: 'rgba(160,128,192,.12)',
  other:    'rgba(155,127,144,.10)',
};

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const EMAIL_STATUS_KEY = 'smartday-email-status';

function loadStatuses(): Record<string, EmailStatus> {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_STATUS_KEY) ?? '{}') as Record<string, EmailStatus>;
  } catch {
    return {};
  }
}

function saveStatuses(statuses: Record<string, EmailStatus>): void {
  localStorage.setItem(EMAIL_STATUS_KEY, JSON.stringify(statuses));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortEmails(emails: ImportantEmail[]): ImportantEmail[] {
  return [...emails].sort((a, b) => {
    const io = IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance];
    if (io !== 0) return io;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });
}

function timeAgo(isoStr: string): string {
  const diffMs    = Date.now() - new Date(isoStr).getTime();
  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0 && diffHours === 0) return `לפני ${Math.max(diffMins, 1)} דק׳`;
  if (diffDays === 0) return `לפני ${diffHours} שע׳`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7)   return `לפני ${diffDays} ימים`;
  const d = new Date(isoStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Derive a Task from an email (for "הוסף למשימות"). */
function emailToTask(email: ImportantEmail): Omit<Task, 'id' | 'createdAt'> {
  const fullText = `${email.subject} ${email.snippet}`.toLowerCase();

  const urgencyMap: Record<EmailImportance, TaskUrgency> = {
    urgent: 'urgent', high: 'high', medium: 'medium', low: 'low',
  };
  const catMap: Record<EmailCategory, TaskCategory> = {
    academic: 'academic', work: 'work', payment: 'payment',
    meeting: 'personal', personal: 'personal', other: 'other',
  };
  const title = email.subject.length > 55
    ? email.subject.slice(0, 55).trimEnd() + '…'
    : email.subject;

  return {
    title,
    description:  `מאת: ${email.senderName} — ${email.snippet}`,
    category:     catMap[email.category],
    urgency:      urgencyMap[email.importance],
    deadlineDate: detectDateFromText(fullText),
    status:       'open',
    source:       'gmail',
  };
}

/** The truncated title used for dedup checks (must match emailToTask). */
function taskTitleFor(email: ImportantEmail): string {
  return email.subject.length > 55
    ? email.subject.slice(0, 55).trimEnd() + '…'
    : email.subject;
}

// ---------------------------------------------------------------------------
// Date / time extraction from email text
// ---------------------------------------------------------------------------

/** Extract a YYYY-MM-DD date from email text. Falls back to today. */
function detectDateFromText(text: string): string {
  const today = new Date();

  if (/היום/.test(text))  return today.toISOString().split('T')[0];
  if (/מחר/.test(text)) {
    return new Date(today.getTime() + 86_400_000).toISOString().split('T')[0];
  }
  // DD/MM/YYYY or DD.MM.YYYY
  const full = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (full) {
    const [, d, m, y] = full;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD/MM or DD.MM (assume current year)
  const short = text.match(/(\d{1,2})[./](\d{1,2})(?![./\d])/);
  if (short) {
    const [, d, m] = short;
    return `${today.getFullYear()}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return today.toISOString().split('T')[0];
}

/** Extract HH:MM from email text. Falls back to '09:00'. */
function detectTimeFromText(text: string): string {
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return '09:00';
}

/** Add one hour to an HH:MM string. */
function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// emailToEvent — derive a CalendarEvent from an ImportantEmail
// ---------------------------------------------------------------------------

function emailToEvent(email: ImportantEmail): Omit<CalendarEvent, 'id'> {
  const fullText  = `${email.subject} ${email.snippet}`.toLowerCase();
  const date      = detectDateFromText(fullText);
  const startTime = detectTimeFromText(fullText);

  const catMap: Record<EmailCategory, EventCategory> = {
    meeting: 'meeting', academic: 'academic', work: 'work',
    payment: 'personal', personal: 'personal', other: 'personal',
  };
  const impMap: Record<EmailImportance, EventImportance> = {
    urgent: 'urgent', high: 'important', medium: 'normal', low: 'normal',
  };
  const title = email.subject.length > 55
    ? email.subject.slice(0, 55).trimEnd() + '…'
    : email.subject;

  return {
    title,
    description: `מאת: ${email.senderName} — ${email.snippet}`,
    date,
    startTime,
    endTime:    addOneHour(startTime),
    category:   catMap[email.category],
    importance: impMap[email.importance],
    source:     'gmail',
  };
}

// ---------------------------------------------------------------------------
// EmailItem
// ---------------------------------------------------------------------------

interface EmailItemProps {
  email:          ImportantEmail;
  /** true once the user clicked "הוסף למשימות" this session */
  taskAdded:      boolean;
  /** true if a matching task title already exists in the list */
  alreadyInTasks: boolean;
  /** true once the user clicked "הוסף ללוח זמנים" this session */
  eventAdded:     boolean;
  onAddTask:      () => void;
  onAddEvent:     () => void;
  onMarkHandled:  () => void;
  onIgnore:       () => void;
}

const EmailItem = ({
  email,
  taskAdded, alreadyInTasks,
  eventAdded,
  onAddTask, onAddEvent, onMarkHandled, onIgnore,
}: EmailItemProps) => {
  const { recommendedAction, importance, category } = email;
  const borderColor = IMPORTANCE_COLOR[importance];

  // ── Determine primary button state ────────────────────────────────────────
  const primaryDone =
    (recommendedAction === 'addTask'  && (taskAdded || alreadyInTasks)) ||
    (recommendedAction === 'addEvent' && eventAdded);

  const renderPrimaryButton = () => {
    if (recommendedAction === 'addTask') {
      if (taskAdded || alreadyInTasks) {
        return (
          <button className="email-btn email-btn--done" disabled>
            נוסף למשימות ✓
          </button>
        );
      }
      return (
        <button className="email-btn email-btn--primary" onClick={onAddTask}>
          הוסף למשימות
        </button>
      );
    }

    if (recommendedAction === 'addEvent') {
      if (eventAdded) {
        return (
          <button className="email-btn email-btn--done" disabled>
            נוסף ללוח ✓
          </button>
        );
      }
      return (
        <button className="email-btn email-btn--event" onClick={onAddEvent}>
          הוסף ללוח זמנים
        </button>
      );
    }

    if (recommendedAction === 'markHandled') {
      return (
        <button className="email-btn email-btn--handled" onClick={onMarkHandled}>
          סמן כטופל
        </button>
      );
    }

    // reviewOnly
    return (
      <button className="email-btn email-btn--review" onClick={onMarkHandled}>
        בדיקה
      </button>
    );
  };

  // ── Secondary actions ──────────────────────────────────────────────────────
  // "סמן כטופל" shown unless it is already the primary action
  const showHandledSecondary = recommendedAction !== 'markHandled';

  return (
    <div className="email-item" style={{ borderRightColor: borderColor }}>

      {/* Row 1 — sender */}
      <span className="email-sender">{email.senderName}</span>

      {/* Row 2 — subject */}
      <p className="email-subject">{email.subject}</p>

      {/* Row 3 — snippet */}
      <p className="email-snippet">{email.snippet}</p>

      {/* Row 4 — time */}
      <span className="email-time">{timeAgo(email.receivedAt)}</span>

      {/* Row 5 — category + importance badges */}
      <div className="email-tags-row">
        <span
          className="email-badge"
          style={{ background: CATEGORY_BG[category], color: CATEGORY_COLOR[category] }}
        >
          {CATEGORY_LABEL[category]}
        </span>
        <span
          className="email-badge"
          style={{ background: IMPORTANCE_BG[importance], color: IMPORTANCE_COLOR[importance] }}
        >
          {IMPORTANCE_LABEL[importance]}
        </span>
        {email.source === 'demo' && (
          <span className="email-badge email-badge--source">דמו</span>
        )}
      </div>

      {/* Row 5b — reason label ("למה זה מופיע?") */}
      {email.reason && (
        <span className="email-reason">למה זה מופיע? {email.reason}</span>
      )}

      {/* Row 6 — primary action */}
      <div className="email-primary-row">
        {renderPrimaryButton()}
      </div>

      {/* Row 7 — secondary actions (subtle) */}
      <div className="email-secondary-row">
        {showHandledSecondary && !primaryDone && (
          <button className="email-sec-btn" onClick={onMarkHandled}>
            סמן כטופל
          </button>
        )}
        {/* After primary done, keep "סמן כטופל" so user can dismiss */}
        {primaryDone && (
          <button className="email-sec-btn" onClick={onMarkHandled}>
            סמן כטופל
          </button>
        )}
        <button className="email-sec-btn email-sec-btn--ignore" onClick={onIgnore}>
          התעלם
        </button>
      </div>

    </div>
  );
};

// ---------------------------------------------------------------------------
// ImportantEmailsCard
// ---------------------------------------------------------------------------

interface Props {
  onAddTask:          (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onAddEvent:         (event: Omit<CalendarEvent, 'id'>) => void;
  existingTaskTitles: Set<string>;
}

const ImportantEmailsCard = ({ onAddTask, onAddEvent, existingTaskTitles }: Props) => {
  // ── Auth + fetch state ────────────────────────────────────────────────────
  const [isConnected,   setIsConnected]   = useState(() => restoreGmailSession());
  const [isLoading,     setIsLoading]     = useState(false);
  const [gmailError,    setGmailError]    = useState<string | null>(null);
  const [fetchedEmails, setFetchedEmails] = useState<ImportantEmail[]>([]);

  // ── Persistence state (email id → status) ────────────────────────────────
  const [statuses,      setStatuses]      = useState<Record<string, EmailStatus>>(loadStatuses);
  const [taskAddedIds,  setTaskAddedIds]  = useState<Set<string>>(new Set());
  const [eventAddedIds, setEventAddedIds] = useState<Set<string>>(new Set());

  // ── On mount: if session was restored, immediately fetch emails ───────────
  useEffect(() => {
    if (gmailIsConnected()) {
      _doFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived: merge fetched emails with local status overrides ─────────────
  const allEmails = useMemo<ImportantEmail[]>(
    () => fetchedEmails.map(e => ({ ...e, status: statuses[e.id] ?? e.status })),
    [fetchedEmails, statuses],
  );

  // Only unread; sorted by importance then newest-first
  const visibleEmails = useMemo<ImportantEmail[]>(
    () => sortEmails(allEmails.filter(e => e.status === 'unread')),
    [allEmails],
  );

  // ── Fetch helper ──────────────────────────────────────────────────────────
  async function _doFetch(): Promise<void> {
    setIsLoading(true);
    setGmailError(null);
    try {
      const emails = await fetchImportantEmails();
      setFetchedEmails(emails);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בטעינת המיילים.';
      setGmailError(msg);
      // If the token expired during fetch, the service cleared it — reflect that
      if (!gmailIsConnected()) {
        setIsConnected(false);
        setFetchedEmails([]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setIsLoading(true);
    setGmailError(null);
    try {
      await connectGmail();
      setIsConnected(true);
      await _doFetch();
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'שגיאת התחברות.');
      setIsLoading(false);
    }
  };

  // ── Disconnect ────────────────────────────────────────────────────────────
  const handleDisconnect = () => {
    disconnectGmail();
    setIsConnected(false);
    setFetchedEmails([]);
    setGmailError(null);
    // Clear in-memory action states — localStorage statuses are intentionally kept
    // so handled/ignored emails stay dismissed if user reconnects later
    setTaskAddedIds(new Set());
    setEventAddedIds(new Set());
  };

  // ── Email action handlers ─────────────────────────────────────────────────

  const updateStatus = (id: string, status: EmailStatus) => {
    // Persist only the id→status mapping — never the email content
    const next = { ...statuses, [id]: status };
    setStatuses(next);
    saveStatuses(next);
  };

  /** "הוסף למשימות" — creates a real task; email stays visible until user dismisses it */
  const handleAddTask = (email: ImportantEmail) => {
    const task = emailToTask(email);
    if (!existingTaskTitles.has(task.title)) {
      onAddTask(task);
    }
    setTaskAddedIds(prev => new Set(prev).add(email.id));
  };

  /** "הוסף ללוח זמנים" — creates a real CalendarEvent via the parent callback. */
  const handleAddEvent = (email: ImportantEmail) => {
    onAddEvent(emailToEvent(email));
    setEventAddedIds(prev => new Set(prev).add(email.id));
  };

  const handleMarkHandled = (id: string) => updateStatus(id, 'handled');
  const handleIgnore      = (id: string) => updateStatus(id, 'ignored');

  // ── Render ────────────────────────────────────────────────────────────────

  // Body content determined by connection + fetch state
  const renderBody = () => {
    if (!isConnected) {
      return (
        <p className="empty-state">
          אין מיילים להצגה כרגע. חברי Gmail כדי להציג מיילים חשובים שדורשים פעולה.
        </p>
      );
    }
    if (isLoading) {
      return <p className="email-loading">טוען מיילים מ־Gmail...</p>;
    }
    if (visibleEmails.length === 0) {
      return <p className="empty-state">לא נמצאו מיילים שדורשים פעולה כרגע.</p>;
    }
    return (
      <div className="email-list">
        {visibleEmails.map(email => (
          <EmailItem
            key={email.id}
            email={email}
            taskAdded={taskAddedIds.has(email.id)}
            alreadyInTasks={
              !taskAddedIds.has(email.id) &&
              existingTaskTitles.has(taskTitleFor(email))
            }
            eventAdded={eventAddedIds.has(email.id)}
            onAddTask={() => handleAddTask(email)}
            onAddEvent={() => handleAddEvent(email)}
            onMarkHandled={() => handleMarkHandled(email.id)}
            onIgnore={() => handleIgnore(email.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="card email-card">

      {/* Header */}
      <div className="card-header">
        <div>
          <div className="card-title-row">
            <span className="card-icon">📬</span>
            <h2 className="card-title">מיילים חשובים</h2>
            {visibleEmails.length > 0 && (
              <span className="badge badge-red">{visibleEmails.length}</span>
            )}
          </div>
          <p className="email-card-subtitle">מוצגים רק מיילים שזוהתה בהם פעולה נדרשת.</p>
        </div>
      </div>

      {/* Gmail connection row */}
      <div className="email-integration-row">
        <div className="email-connection-status">
          <span className={`events-connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="email-connection-text">
            {isLoading
              ? 'מתחבר...'
              : isConnected
                ? 'מחובר ל־Gmail'
                : 'לא מחובר ל־Gmail'}
          </span>
        </div>
        <div className="email-connection-actions">
          {!isConnected ? (
            <button
              className="email-connect-btn"
              onClick={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? 'מתחבר...' : 'התחברות ל־Gmail'}
            </button>
          ) : (
            <button
              className="email-connect-btn email-connect-btn--disconnect"
              onClick={handleDisconnect}
            >
              התנתק
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {gmailError && (
        <div className="events-gcal-msg events-gcal-msg--error">
          <span>⚠️ {gmailError}</span>
          <button
            className="events-gcal-msg-close"
            onClick={() => setGmailError(null)}
            aria-label="סגור"
          >✕</button>
        </div>
      )}

      {/* Body */}
      {renderBody()}

    </div>
  );
};

export default ImportantEmailsCard;
