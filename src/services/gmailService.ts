// @ts-nocheck
/**
 * Gmail Service
 * ─────────────────────────────────────────────────────────────────────────────
 * OAuth token flow via Google Identity Services (GSI).
 * Uses the same VITE_GOOGLE_CLIENT_ID as the Calendar integration.
 *
 * Token is stored in sessionStorage only — never in localStorage.
 * Keys are intentionally different from the Calendar service keys so the two
 * connections are fully independent.
 *
 * Scopes requested:
 *   https://www.googleapis.com/auth/gmail.readonly  (read-only, no send/delete)
 */

import type {
  ImportantEmail,
  EmailCategory,
  EmailImportance,
  EmailAction,
} from '../types';
import {
  GOOGLE_CLIENT_ID,
  GMAIL_SCOPE,
  isGoogleConfigured,
} from '../config/google';

// ---------------------------------------------------------------------------
// GSI type declarations
// (window.google is already augmented by googleCalendarService.ts — the
//  declare global there is project-wide, so no re-declaration is needed here.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Raw Gmail API types (partial — only fields we actually use)
// ---------------------------------------------------------------------------

interface GmailMessageListItem {
  id:       string;
  threadId: string;
}

interface GmailMessageListResponse {
  messages?:           GmailMessageListItem[];
  nextPageToken?:      string;
  resultSizeEstimate?: number;
}

interface GmailHeader {
  name:  string;
  value: string;
}

interface GmailMessage {
  id:           string;
  snippet:      string;
  internalDate: string;   // milliseconds since epoch, as a string
  labelIds:     string[];
  payload: {
    headers: GmailHeader[];
  };
}

// ---------------------------------------------------------------------------
// SessionStorage helpers  (separate keys from Calendar — never localStorage)
// ---------------------------------------------------------------------------

const SS_TOKEN  = 'smartday-gmail-token';
const SS_EXPIRY = 'smartday-gmail-expiry';

let _gmailToken: string | null = null;

function _saveGmailSession(token: string, expiresIn: number): void {
  _gmailToken = token;
  const expiry = Date.now() + expiresIn * 1_000;
  sessionStorage.setItem(SS_TOKEN,  token);
  sessionStorage.setItem(SS_EXPIRY, String(expiry));
}

/** Clear the Gmail token from memory and sessionStorage. */
export function clearGmailToken(): void {
  _gmailToken = null;
  sessionStorage.removeItem(SS_TOKEN);
  sessionStorage.removeItem(SS_EXPIRY);
}

/**
 * Try to restore a Gmail session from sessionStorage.
 * Returns true if a valid, non-expired token was found.
 * Call once on component mount.
 */
export function restoreGmailSession(): boolean {
  const token  = sessionStorage.getItem(SS_TOKEN);
  const expiry = Number(sessionStorage.getItem(SS_EXPIRY) ?? '0');
  if (!token || Date.now() >= expiry) {
    clearGmailToken();
    return false;
  }
  _gmailToken = token;
  return true;
}

export function gmailIsConnected(): boolean {
  return _gmailToken !== null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Open the Google OAuth consent popup and request Gmail read-only access.
 * Wraps the GSI callback API in a Promise.
 *
 * Resolves when the token is received.
 * Rejects with a Hebrew error string on failure.
 */
export async function connectGmail(): Promise<void> {
  if (!isGoogleConfigured) {
    throw new Error('חיבור Google עדיין לא הוגדר בסביבת הפיתוח.');
  }

  // Lazily load the GSI script (may already be present from Calendar)
  await _loadGsiScript();

  return new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID!,
      scope:     GMAIL_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          const msg = response.error === 'access_denied'
            ? 'ההרשאה נדחתה. נסה שוב ואשר גישה ל-Gmail.'
            : `שגיאת התחברות: ${response.error_description ?? response.error ?? 'לא ידוע'}`;
          reject(new Error(msg));
          return;
        }
        _saveGmailSession(response.access_token, response.expires_in ?? 3_600);
        resolve();
      },
      error_callback: (err) => {
        const msg = err.type === 'popup_closed'
          ? 'החלון נסגר לפני השלמת ההתחברות.'
          : `שגיאת OAuth: ${err.type}`;
        reject(new Error(msg));
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Revoke the Gmail token and clear local auth state.
 */
export function disconnectGmail(): void {
  if (_gmailToken) {
    window.google?.accounts.oauth2.revoke(_gmailToken, () => {});
  }
  clearGmailToken();
}

// ---------------------------------------------------------------------------
// Gmail API — fetch important emails
// ---------------------------------------------------------------------------

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Gmail pre-filter query.
 *
 * Kept intentionally broad — the real filtering is done locally by
 * _classifyEmail(), which applies strict actionability rules.
 * Excludes Gmail's automated category tabs (Promotions, Social, Updates,
 * Forums) because those rarely contain actionable emails.
 */
// Relaxed query: includes both read and unread emails from last 30 days
// Removes unread-only filter to catch important emails user may have already read
const IMPORTANCE_QUERY = 'newer_than:30d -category:promotions -category:social -category:forums -category:updates';

/**
 * Fetch recent unread emails, classify them locally with strict actionability
 * rules, and return up to 5 emails sorted by importance.
 *
 * Three-step process:
 *   1. List up to 30 message IDs matching IMPORTANCE_QUERY
 *   2. Fetch metadata for each in parallel
 *   3. Classify locally (null = not actionable), sort, cap at 5
 *
 * TODO (future): use Gmail batch requests to reduce round-trips.
 * TODO (future): support pagination / "load more".
 * TODO (future): use Gmail push notifications (PubSub) for real-time updates.
 */
export async function fetchImportantEmails(): Promise<ImportantEmail[]> {
  if (!_gmailToken) {
    throw new Error('לא מחובר ל-Gmail.');
  }

  // ── Step 1: list matching message IDs ──────────────────────────────────────
  const listUrl = new URL(`${GMAIL_API_BASE}/messages`);
  listUrl.searchParams.set('q',          IMPORTANCE_QUERY);
  listUrl.searchParams.set('maxResults', '30');

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${_gmailToken}` },
  });

  if (listRes.status === 401) {
    clearGmailToken();
    throw new Error('פג תוקף החיבור ל-Gmail. התחבר/י מחדש.');
  }
  if (!listRes.ok) {
    throw new Error(`שגיאה בטעינת המיילים (${listRes.status}).`);
  }

  const listData: GmailMessageListResponse = await listRes.json();
  const ids = (listData.messages ?? []).map(m => m.id);

  if (ids.length === 0) return [];

  // ── Step 2: fetch metadata for each message in parallel ────────────────────
  const rawMessages = await Promise.all(ids.map(id => _fetchMessageMetadata(id)));
  const valid = rawMessages.filter((m): m is GmailMessage => m !== null);

  // ── Step 3: classify (null = not actionable) → sort → cap at 5 ───────────
  const emails = valid
    .map(mapGmailMessageToSmartDayEmail)
    .filter((e): e is ImportantEmail => e !== null);

  const SORT_ORDER: Record<EmailImportance, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  emails.sort((a, b) => {
    const io = SORT_ORDER[a.importance] - SORT_ORDER[b.importance];
    if (io !== 0) return io;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  return emails.slice(0, 5);
}

/** Fetch a single message's metadata (headers + snippet + labelIds). */
async function _fetchMessageMetadata(id: string): Promise<GmailMessage | null> {
  const url = new URL(`${GMAIL_API_BASE}/messages/${id}`);
  url.searchParams.set('format', 'metadata');
  // Request only the headers we need — keeps payload small
  url.searchParams.append('metadataHeaders', 'From');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'Date');

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${_gmailToken!}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as GmailMessage;
  } catch {
    return null;   // network error on a single message — skip it gracefully
  }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Convert a raw Gmail message into a SmartDay ImportantEmail.
 * Returns null when the email is not actionable (should not be shown).
 *
 * Actionability is determined by _classifyEmail() which applies strict
 * rules: urgency keywords, deadline phrases, payment problems, meeting
 * invites/changes, or messages from important senders/domains.
 */
export function mapGmailMessageToSmartDayEmail(raw: GmailMessage): ImportantEmail | null {
  // ── Parse headers ──────────────────────────────────────────────────────────
  const headers   = raw.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  const fromRaw = getHeader('From');
  const { senderName, senderEmail } = _parseFrom(fromRaw);
  const subject    = getHeader('Subject') || '(ללא נושא)';
  const receivedAt = new Date(Number(raw.internalDate)).toISOString();

  const ageDays = (Date.now() - Number(raw.internalDate)) / 86_400_000;
  const text    = `${subject} ${raw.snippet}`.toLowerCase();

  // ── Classify — returns null if not actionable ──────────────────────────────
  const cls = _classifyEmail(text, senderEmail, ageDays);
  if (!cls.actionable) return null;

  return {
    id:                `gmail-${raw.id}`,
    senderName,
    senderEmail,
    subject,
    snippet:           raw.snippet || '',
    receivedAt,
    category:          cls.category,
    importance:        cls.importance,
    recommendedAction: cls.recommendedAction,
    reason:            cls.reason,
    status:            'unread',
    source:            'gmail',
  };
}

// ---------------------------------------------------------------------------
// Classification — patterns
// ---------------------------------------------------------------------------

/** Explicit urgency / action-required keywords */
const P_URGENT =
  /דחוף|בהול|urgent|asap|action required|נדרש טיפול/i;

/** Deadline / must-do phrases */
const P_DEADLINE =
  /עד מחר|עד היום|עד יום|מועד אחרון|deadline|due date|תאריך אחרון|להשלמת|להשלים|נדרש למלא|יש לאשר|יש להשלים|נא לאשר|נא למלא/i;

/** Generic payment words — not enough alone; must pair with P_PAYMENT_PROBLEM */
const P_PAYMENT_BASE = /תשלום|חשבונית|חיוב|invoice|payment|bill/i;

/** Payment-problem indicators — shown only when co-occurring with P_PAYMENT_BASE */
const P_PAYMENT_PROBLEM =
  /לתשלום|נדרש תשלום|חוב|פיגור|נדחה|נכשל|failed|overdue|לא שולם|הסדר תשלום/i;

/** Meeting / schedule-change words */
const P_MEETING = /פגישה|meeting|zoom|invite|הזמנה|שינוי מועד|בוטל|cancelled|rescheduled/i;

/** Text cues that indicate an important sender (in subject/snippet or sender name) */
const P_IMPORTANT_TEXT = /מרצה|lecturer|payroll|שכר|ביטוח|insurance|ביט|בנק|bank/i;

/** Academic institution domains */
const ACADEMIC_DOMAIN_RE = /ac\.il|\.edu|college|university|moodle/i;

/** Bank / financial service domains */
const BANK_DOMAIN_RE = /leumi|hapoalim|discount|mizrahi|yahav|bank/i;

// ---------------------------------------------------------------------------
// Classification — result type + sentinel
// ---------------------------------------------------------------------------

interface EmailClassification {
  actionable:        boolean;
  reason:            string;
  importance:        EmailImportance;
  category:          EmailCategory;
  recommendedAction: EmailAction;
}

const NOT_ACTIONABLE: EmailClassification = {
  actionable: false, reason: '', importance: 'low',
  category: 'other', recommendedAction: 'reviewOnly',
};

// ---------------------------------------------------------------------------
// Classification — unified function
// ---------------------------------------------------------------------------

/**
 * Decide whether an email should be shown and why.
 * Returns NOT_ACTIONABLE when the email should be hidden.
 *
 * Priority order (first match wins):
 *   1. Urgency / "action required" keywords          → shown regardless of age (≤14d)
 *   2. Deadline phrase                               → shown if ≤7 days old
 *   3. Payment word + problem indicator              → shown if ≤7 days old
 *   4. Meeting / schedule-change word                → shown if ≤7 days old
 *   5. Important sender domain or text cue           → shown if ≤7 days old
 *
 * Pure informational emails (receipts, subscription confirmations, etc.)
 * that don't match any rule are silently dropped.
 */
function _classifyEmail(
  text:        string,
  senderEmail: string,
  ageDays:     number,
): EmailClassification {
  const domain = senderEmail.split('@')[1]?.toLowerCase() ?? '';

  // ── Rule 1: Urgency ─────────────────────────────────────────────────────────
  if (P_URGENT.test(text)) {
    if (ageDays > 30) return NOT_ACTIONABLE;
    const category = _deriveCategory(text, domain);
    return {
      actionable: true,
      reason:     'נדרש טיפול',
      importance: 'urgent',
      category,
      recommendedAction: _deriveAction(category, text),
    };
  }

  // ── Age gate for non-urgent rules (relaxed to 30 days) ─────────────────────
  if (ageDays > 30) return NOT_ACTIONABLE;

  // ── Rule 2: Deadline phrase ─────────────────────────────────────────────────
  if (P_DEADLINE.test(text)) {
    if (ageDays > 14) return NOT_ACTIONABLE;
    const category = _deriveCategory(text, domain);
    return {
      actionable: true,
      reason:     'זוהה דדליין',
      importance: 'high',
      category,
      recommendedAction: _deriveAction(category, text),
    };
  }

  // ── Rule 3: Payment with a problem indicator ────────────────────────────────
  if (P_PAYMENT_BASE.test(text) && P_PAYMENT_PROBLEM.test(text)) {
    if (ageDays > 14) return NOT_ACTIONABLE;
    return {
      actionable: true,
      reason:     'בעיה בתשלום',
      importance: 'high',
      category:   'payment',
      recommendedAction: 'addTask',
    };
  }

  // ── Rule 4: Meeting / schedule change ──────────────────────────────────────
  if (P_MEETING.test(text)) {
    if (ageDays > 14) return NOT_ACTIONABLE;
    const isCancelled   = /בוטל|cancelled/.test(text);
    const isRescheduled = /שינוי מועד|נדחה|rescheduled/.test(text);
    const reason = isCancelled   ? 'פגישה בוטלה'
                 : isRescheduled ? 'שינוי פגישה'
                 : 'הזמנה לפגישה';
    return {
      actionable: true,
      reason,
      importance: 'medium',
      category:   'meeting',
      recommendedAction: 'addEvent',
    };
  }

  // ── Rule 5: Important sender / domain ──────────────────────────────────────
  const isAcademic      = ACADEMIC_DOMAIN_RE.test(domain);
  const isBank          = BANK_DOMAIN_RE.test(domain);
  const isImportantSender =
    isAcademic ||
    isBank ||
    P_IMPORTANT_TEXT.test(domain) ||
    P_IMPORTANT_TEXT.test(senderEmail) ||
    P_IMPORTANT_TEXT.test(text);

  if (isImportantSender) {
    if (ageDays > 14) return NOT_ACTIONABLE;
    const category: EmailCategory =
      isAcademic ? 'academic'
      : isBank   ? 'payment'
      : _deriveCategory(text, domain);
    return {
      actionable: true,
      reason:     'שולח חשוב',
      importance: 'medium',
      category,
      recommendedAction: category === 'meeting' ? 'addEvent' : 'addTask',
    };
  }

  return NOT_ACTIONABLE;
}

// ---------------------------------------------------------------------------
// Classification — category + action helpers
// ---------------------------------------------------------------------------

function _deriveCategory(text: string, domain: string): EmailCategory {
  if (/תשלום|חשבונית|חיוב|invoice|payment|bill/.test(text) ||
      /bank|בנק|paypal|לאומי|פועלים|discount/.test(domain)) {
    return 'payment';
  }
  if (/פגישה|ישיבה|meeting|zoom|call|invite|calendar/.test(text)) {
    return 'meeting';
  }
  if (/הגשה|מבחן|בחינה|שיעור|מרצה|קורס|אוניברסיטה|מכללה|lecture|assignment|grade/.test(text)) {
    return 'academic';
  }
  if (/עבודה|משמרת|hr|חוזה|employer|salary|shift|work/.test(text)) {
    return 'work';
  }
  if (/יום הולדת|תור|רופא|birthday|appointment/.test(text)) {
    return 'personal';
  }
  return 'other';
}

function _deriveAction(category: EmailCategory, text: string): EmailAction {
  if (category === 'payment' || category === 'academic' || category === 'work' ||
      /הגשה|deadline|due.?date/.test(text)) {
    return 'addTask';
  }
  if (category === 'meeting' || /invite|invitation|להזמין|פגישה/.test(text)) {
    return 'addEvent';
  }
  return 'reviewOnly';
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Parse a RFC 5322 From header into name + email.
 * Handles:
 *   "John Doe <john@example.com>"
 *   "<john@example.com>"
 *   "john@example.com"
 */
function _parseFrom(raw: string): { senderName: string; senderEmail: string } {
  const match = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match) {
    return {
      senderName:  match[1].trim() || match[2],
      senderEmail: match[2].trim(),
    };
  }
  // Plain email address only
  const plain = raw.trim();
  return { senderName: plain, senderEmail: plain };
}

// ---------------------------------------------------------------------------
// Script loading  (shared with Calendar — safe to call multiple times)
// ---------------------------------------------------------------------------

function _loadGsiScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      const id = setInterval(() => {
        if (window.google?.accounts) { clearInterval(id); resolve(); }
      }, 50);
      return;
    }

    const script   = document.createElement('script');
    script.src     = 'https://accounts.google.com/gsi/client';
    script.async   = true;
    script.defer   = true;
    script.onload  = () => resolve();
    script.onerror = () =>
      reject(new Error('נכשלה טעינת ספריית Google Identity Services.'));
    document.head.appendChild(script);
  });
}
