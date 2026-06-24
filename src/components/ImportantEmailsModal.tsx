// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';
import type { ImportantEmail, EmailStatus, Task, CalendarEvent } from '../types';

// ── Default keywords ──────────────────────────────────────────────────────────
const DEFAULT_KEYWORDS = [
  'פגישה', 'מבחן', 'דדליין', 'תשלום', 'חשבונית',
  'ראיון', 'אישור', 'דחוף', 'הגשה', 'עבודה',
];

const KEYWORDS_KEY = 'smartdayEmailKeywords';
const EMAIL_STATUS_KEY = 'smartday-email-status';

function loadKeywords(): string[] {
  try {
    const stored = localStorage.getItem(KEYWORDS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_KEYWORDS;
  } catch {
    return DEFAULT_KEYWORDS;
  }
}

function saveKeywords(kw: string[]) {
  localStorage.setItem(KEYWORDS_KEY, JSON.stringify(kw));
}

function loadStatuses(): Record<string, EmailStatus> {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_STATUS_KEY) ?? '{}') as Record<string, EmailStatus>;
  } catch {
    return {};
  }
}

function saveStatuses(s: Record<string, EmailStatus>) {
  localStorage.setItem(EMAIL_STATUS_KEY, JSON.stringify(s));
}

// ── Urgency / priority calculation ───────────────────────────────────────────
const URGENT_WORDS = ['דחוף', 'היום', 'מיידי', 'asap', 'חשוב'];
const DEADLINE_WORDS = ['דדליין', 'הגשה', 'עד', 'תאריך אחרון'];

function todayStr() { return new Date().toISOString().split('T')[0]; }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
function thisWeekEnd() {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function detectDate(text: string): string | null {
  if (/היום/.test(text)) return todayStr();
  if (/מחר/.test(text)) return tomorrowStr();
  const full = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (full) return `${full[3]}-${full[2].padStart(2,'0')}-${full[1].padStart(2,'0')}`;
  const short = text.match(/(\d{1,2})[./](\d{1,2})(?![./\d])/);
  if (short) return `${new Date().getFullYear()}-${short[2].padStart(2,'0')}-${short[1].padStart(2,'0')}`;
  return null;
}

function calcEmailPriority(email: ImportantEmail, userKeywords: string[]) {
  const allText = `${email.subject} ${email.snippet ?? ''} ${email.preview ?? ''}`;
  const lc = allText.toLowerCase();

  let score = 30;
  let urgency: 'high' | 'medium' | 'low' = 'low';

  const hasUrgent = URGENT_WORDS.some(w => lc.includes(w.toLowerCase()));
  const hasDeadline = DEADLINE_WORDS.some(w => lc.includes(w.toLowerCase()));
  const hasUserKw = userKeywords.some(w => lc.includes(w.toLowerCase()));
  const detectedDate = detectDate(lc);

  if (hasUrgent) { urgency = 'high'; score = 90; }
  else if (hasDeadline) { urgency = 'medium'; score = 60; }
  else if (email.importance === 'urgent') { urgency = 'high'; score = 90; }
  else if (email.importance === 'high') { urgency = 'high'; score = 90; }
  else if (email.importance === 'medium') { urgency = 'medium'; score = 60; }

  if (detectedDate) {
    const t = todayStr(); const tm = tomorrowStr();
    if (detectedDate <= tm) { score += 10; if (urgency === 'low') urgency = 'high'; }
    else if (detectedDate <= thisWeekEnd()) { score += 5; if (urgency === 'low') urgency = 'medium'; }
  }

  if (hasUserKw) score += 5;
  if (lc.includes('דחוף') || lc.includes('asap')) score += 15;

  score = Math.min(score, 100);

  const detectedKw = userKeywords.find(w => lc.includes(w.toLowerCase()));
  const reason = detectedKw
    ? `זוהה כי המייל כולל את המילה: ${detectedKw}`
    : email.reason ?? null;

  return { score, urgency, dueDate: detectedDate, reason };
}

// ── Helper: map urgency → Task.priority ──────────────────────────────────────
function urgencyToPriority(u: string): 'high' | 'medium' | 'low' {
  if (u === 'high') return 'high';
  if (u === 'medium') return 'medium';
  return 'low';
}

// ── Time helper ───────────────────────────────────────────────────────────────
function timeAgo(isoStr?: string): string {
  if (!isoStr) return '';
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0 && diffHours === 0) return `לפני ${Math.max(diffMins, 1)} דק׳`;
  if (diffDays === 0) return `לפני ${diffHours} שע׳`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  const d = new Date(isoStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ImportantEmailsModalProps {
  onClose: () => void;
  emails: ImportantEmail[];
  isConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  existingTaskTitles: Set<string>;
  addedFromEmailIds: Set<string>;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>, emailId: string) => void;
  onMarkHandled: (emailId: string) => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
const ImportantEmailsModal = ({
  onClose,
  emails,
  isConnected,
  isLoading,
  onConnect,
  existingTaskTitles,
  addedFromEmailIds,
  onAddTask,
  onMarkHandled,
}: ImportantEmailsModalProps) => {
  const [keywords, setKeywords] = useState<string[]>(loadKeywords);
  const [kwInput, setKwInput] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => { saveKeywords(keywords); }, [keywords]);

  const addKeyword = () => {
    const trimmed = kwInput.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    setKeywords(prev => [...prev, trimmed]);
    setKwInput('');
  };

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  // Show all emails; just detect which ones match keywords (for badge display)
  const filteredEmails = emails;

  const matchedKeyword = (email: ImportantEmail): string | null => {
    const text = `${email.subject} ${email.snippet ?? ''} ${email.preview ?? ''}`.toLowerCase();
    return keywords.find(kw => text.includes(kw.toLowerCase())) ?? null;
  };

  const handleAddTask = (email: ImportantEmail) => {
    const { score, urgency, dueDate, reason } = calcEmailPriority(email, keywords);
    const title = email.subject.length > 55
      ? email.subject.slice(0, 55).trimEnd() + '…'
      : email.subject;

    if (existingTaskTitles.has(title) || addedFromEmailIds.has(email.id)) {
      setConfirmation('המייל כבר נוסף למשימות');
      setTimeout(() => setConfirmation(''), 2500);
      return;
    }

    onAddTask({
      title,
      description: `מאת: ${email.senderName ?? email.from ?? ''} — ${email.snippet ?? ''}`,
      category: email.category === 'meeting' ? 'personal' : email.category,
      urgency: urgency as any,
      priority: urgencyToPriority(urgency),
      dueDate: dueDate ?? todayStr(),
      deadlineDate: dueDate ?? undefined,
      completed: false,
      status: 'open',
      source: 'email',
      priorityScore: score,
      originalEmailId: email.id,
      reason: reason ?? undefined,
    }, email.id);

    setConfirmation('המייל נוסף למשימות לפי רמת דחיפות');
    setTimeout(() => setConfirmation(''), 2500);
  };

  const openInGmail = (email: ImportantEmail) => {
    if (email.senderEmail) {
      window.open(`https://mail.google.com/mail/u/0/#search/from:${encodeURIComponent(email.senderEmail)}`, '_blank');
    }
  };

  return (
    <div
      className="emailsModalOverlay"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="emailsModalPanel">
        {/* Header */}
        <header className="emailsModalHeader">
          <div>
            <h2>📬 מיילים חשובים</h2>
            <p>מיילים שזוהו כחשובים לפי מילות מפתח ורמת חשיבות</p>
          </div>
          <button className="emailsModalClose" onClick={onClose} aria-label="סגור">×</button>
        </header>

        {/* Confirmation toast */}
        {confirmation && (
          <div className="emailsModalToast">{confirmation}</div>
        )}

        <div className="emailsModalBody">
          {/* Keywords section */}
          <section className="emailsKeywordsSection">
            <h3>מילים חשובות לזיהוי מיילים</h3>
            <div className="emailsKeywordsChips">
              {keywords.map(kw => (
                <span key={kw} className="emailsKeywordChip">
                  {kw}
                  <button className="emailsKeywordRemove" onClick={() => removeKeyword(kw)} aria-label={`הסר ${kw}`}>×</button>
                </span>
              ))}
            </div>
            <div className="emailsKeywordsInput">
              <input
                type="text"
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                placeholder="לדוגמה: פגישה, מבחן, תשלום, דדליין, ראיון"
              />
              <button className="emailsAddKwBtn" onClick={addKeyword}>הוסף מילה</button>
            </div>
          </section>

          {/* Emails list */}
          {!isConnected ? (
            <div className="emailsConnectPrompt">
              <p>📧 Gmail לא מחובר</p>
              <p>חברי Gmail כדי לראות מיילים חשובים שדורשים פעולה</p>
              <button className="emailsConnectBtn" onClick={onConnect}>התחברות ל-Gmail</button>
            </div>
          ) : isLoading ? (
            <p className="emailsLoading">טוען מיילים מ-Gmail...</p>
          ) : filteredEmails.length === 0 ? (
            <p className="emailsEmpty">לא נמצאו מיילים חשובים שדורשים פעולה כרגע.</p>
          ) : (
            <div className="emailsModalList">
              {filteredEmails.map(email => {
                const kw = matchedKeyword(email);
                const displayReason = kw
                  ? `זוהה כי המייל כולל את המילה: ${kw}`
                  : email.reason ?? null;
                const title = email.subject.length > 55 ? email.subject.slice(0,55).trimEnd()+'…' : email.subject;
                const alreadyAdded = addedFromEmailIds.has(email.id) || existingTaskTitles.has(title);
                return (
                  <div key={email.id} className="emailsModalItem">
                    <div className="emailsModalItemHeader">
                      <span className="emailsModalSender">{email.senderName ?? email.from}</span>
                      <span className="emailsModalTime">{timeAgo(email.receivedAt ?? email.date)}</span>
                    </div>
                    <p className="emailsModalSubject">{email.subject}</p>
                    <p className="emailsModalPreview">{email.snippet ?? email.preview}</p>
                    {displayReason && (
                      <span className="emailsModalReason">🔍 {displayReason}</span>
                    )}
                    <div className="emailsModalActions">
                      {alreadyAdded ? (
                        <button className="emailsActionBtn emailsActionBtn--done" disabled>נוסף למשימות ✓</button>
                      ) : (
                        <button className="emailsActionBtn emailsActionBtn--primary" onClick={() => handleAddTask(email)}>
                          הוסף למשימות
                        </button>
                      )}
                      <button className="emailsActionBtn emailsActionBtn--handled" onClick={() => onMarkHandled(email.id)}>
                        סמן כטופל
                      </button>
                      {email.senderEmail && (
                        <button className="emailsActionBtn emailsActionBtn--open" onClick={() => openInGmail(email)}>
                          פתח במייל ↗
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportantEmailsModal;
export { DEFAULT_KEYWORDS, KEYWORDS_KEY, loadKeywords, calcEmailPriority };
