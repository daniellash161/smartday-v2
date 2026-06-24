/**
 * Onboarding — simple account setup + integration connection flow.
 * Welcome → Register/Login → Connect Gmail → Connect Calendar → Preferences.
 * Prototype local auth (no backend). Opens the dashboard only after a session.
 */
import { useState } from 'react';
import {
  registerUser,
  loginUser,
  hasSession,
  isOnboarded,
  getPreferences,
  savePreferences,
  markOnboarded,
  setGmailConnected,
  setCalendarSource,
  emailLocalPart,
  getUser,
  type Preferences,
  type DisplayMode,
  type FocusSection,
} from '../utils/onboarding';
import { connectGmail } from '../services/gmailService';
import { connectGoogleCalendar, fetchGoogleCalendarEvents } from '../services/googleCalendarService';
import { parseICSText, saveAppleEvents, loadAppleEvents } from '../services/appleCalendarService';
import type { CalendarEvent } from '../types';

interface OnboardingProps {
  onComplete: () => void;
}

type Phase = 'welcome' | 'auth' | 'gmail' | 'calendar' | 'prefs';
type AuthMode = 'register' | 'login';

const FOCUS_OPTIONS: { value: FocusSection; label: string; emoji: string }[] = [
  { value: 'calendar', label: 'לוח שנה', emoji: '📅' },
  { value: 'tasks',    label: 'משימות',  emoji: '✅' },
  { value: 'emails',   label: 'מיילים',  emoji: '✉️' },
  { value: 'payments', label: 'תשלומים', emoji: '💳' },
];

const Onboarding = ({ onComplete }: OnboardingProps) => {
  // If a session already exists but onboarding wasn't finished, resume at Gmail.
  const [phase, setPhase] = useState<Phase>(() =>
    hasSession() && !isOnboarded() ? 'gmail' : 'welcome'
  );
  const [authMode, setAuthMode] = useState<AuthMode>('register');

  // Auth fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Integration feedback
  const [busy, setBusy]               = useState(false);
  const [gmailMsg, setGmailMsg]       = useState<string | null>(null);
  const [calMsg, setCalMsg]           = useState<string | null>(null);
  const [calChoice, setCalChoice]     = useState<'google' | 'apple' | null>(null);
  const [icsCount, setIcsCount]       = useState<number>(() => loadAppleEvents().length);

  // Preferences
  const [prefs, setPrefs] = useState<Preferences>(() => getPreferences());

  const updatePref = <K extends keyof Preferences>(k: K, v: Preferences[K]) =>
    setPrefs(p => ({ ...p, [k]: v }));

  // ── Auth ────────────────────────────────────────────────────────────────────
  const handleAuth = () => {
    setAuthError(null);
    const result = authMode === 'register'
      ? registerUser(email, password)
      : loginUser(email, password);
    if (!result.ok) { setAuthError(result.error ?? 'אירעה שגיאה.'); return; }

    // Returning, already-onboarded user → straight to dashboard
    if (authMode === 'login' && isOnboarded()) {
      onComplete();
      return;
    }
    setPhase('gmail');
  };

  // ── Gmail ───────────────────────────────────────────────────────────────────
  const handleConnectGmail = async () => {
    setBusy(true);
    setGmailMsg(null);
    try {
      await connectGmail();
      setGmailConnected(true);
      setGmailMsg('✓ Gmail חובר בהצלחה');
      setTimeout(() => setPhase('calendar'), 700);
    } catch (err) {
      setGmailConnected(false);
      setGmailMsg(err instanceof Error ? err.message : 'חיבור ל-Gmail נכשל. אפשר לדלג ולחבר מאוחר יותר.');
    } finally {
      setBusy(false);
    }
  };

  const skipGmail = () => {
    setGmailConnected(false);
    setPhase('calendar');
  };

  // ── Calendar ──────────────────────────────────────────────────────────────────
  const handleConnectGoogleCal = async () => {
    setCalChoice('google');
    setBusy(true);
    setCalMsg(null);
    setCalendarSource('google');
    updatePref('preferredCalendarSource', 'google');
    try {
      await connectGoogleCalendar();
      await fetchGoogleCalendarEvents();
      setCalMsg('✓ Google Calendar חובר');
      setTimeout(() => setPhase('prefs'), 700);
    } catch (err) {
      setCalMsg(err instanceof Error ? err.message : 'אפשר להמשיך ולחבר את היומן מהדשבורד.');
    } finally {
      setBusy(false);
    }
  };

  const chooseApple = () => {
    setCalChoice('apple');
    setCalMsg(null);
    setCalendarSource('apple');
    updatePref('preferredCalendarSource', 'apple');
  };

  const handleIcsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setCalMsg(null);
    try {
      const existing = loadAppleEvents();
      const collected: CalendarEvent[] = [...existing];
      for (const file of Array.from(files)) {
        const text = await file.text();
        const parsed = parseICSText(text, file.name.replace(/\.ics$/i, ''));
        collected.push(...parsed);
      }
      // De-dup by id
      const unique = Array.from(new Map(collected.map(ev => [ev.id, ev])).values());
      saveAppleEvents(unique);
      setIcsCount(unique.length);
      setCalMsg(`✓ יובאו ${unique.length} אירועים`);
    } catch {
      setCalMsg('קריאת קובץ ה-ICS נכשלה. ודאי שזה קובץ יומן תקין.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const skipCalendar = () => {
    setCalendarSource('none');
    updatePref('preferredCalendarSource', 'none');
    setPhase('prefs');
  };

  // ── Finish ────────────────────────────────────────────────────────────────────
  const handleFinish = () => {
    savePreferences(prefs);
    markOnboarded();
    onComplete();
  };

  const user = getUser();
  const greetName = user ? emailLocalPart(user.email) : emailLocalPart(email);

  return (
    <div className="onb-root" dir="rtl">
      <div className="onb-card">
        <div className="onb-brand">
          <span className="onb-brand-smart">Smart</span><span className="onb-brand-day">Day</span>
        </div>

        {/* ─── Welcome ─── */}
        {phase === 'welcome' && (
          <div className="onb-step onb-welcome">
            <div className="onb-welcome-emoji">👋</div>
            <h1 className="onb-title">SmartDay</h1>
            <p className="onb-subtitle onb-subtitle--lead">הדשבורד היומי החכם שלך</p>
            <p className="onb-subtitle">
              בואי נחבר את הכלים המרכזיים שלך כדי להתאים את הדשבורד ליום שלך.
            </p>
            <div className="onb-welcome-actions">
              <button
                className="onb-btn onb-btn--primary onb-btn--lg"
                onClick={() => { setAuthMode('register'); setPhase('auth'); }}
              >הרשמה</button>
              <button
                className="onb-btn onb-btn--ghost onb-btn--lg"
                onClick={() => { setAuthMode('login'); setPhase('auth'); }}
              >התחברות</button>
            </div>
            <p className="onb-privacy">
              המידע נשמר מקומית בדפדפן בלבד. זוהי הרשמה לצורכי אב-טיפוס (Prototype).
            </p>
          </div>
        )}

        {/* ─── Auth ─── */}
        {phase === 'auth' && (
          <div className="onb-step">
            <h2 className="onb-step-title">{authMode === 'register' ? 'הרשמה' : 'התחברות'}</h2>
            <p className="onb-step-sub">
              {authMode === 'register'
                ? 'יצירת פרופיל SmartDay מקומי עם אימייל וסיסמה.'
                : 'התחברות לפרופיל ה-SmartDay המקומי שלך.'}
            </p>

            <label className="onb-field-label">אימייל</label>
            <input
              className="onb-input" type="email" dir="ltr" autoFocus
              value={email} placeholder="you@example.com"
              onChange={e => setEmail(e.target.value)}
            />

            <label className="onb-field-label">סיסמה</label>
            <input
              className="onb-input" type="password" dir="ltr"
              value={password} placeholder="••••••"
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAuth(); }}
            />

            {authError && <p className="onb-error">{authError}</p>}

            <button
              className="onb-btn onb-btn--primary onb-btn--block"
              onClick={handleAuth}
              disabled={!email || !password}
            >
              {authMode === 'register' ? 'יצירת חשבון' : 'התחברות'}
            </button>

            <button
              className="onb-link"
              onClick={() => { setAuthError(null); setAuthMode(m => m === 'register' ? 'login' : 'register'); }}
            >
              {authMode === 'register' ? 'כבר יש לך חשבון? התחברות' : 'אין לך חשבון? הרשמה'}
            </button>

            <p className="onb-privacy onb-privacy--sm">
              🔒 אימות לצורכי אב-טיפוס: הנתונים נשמרים מקומית בלבד ואינם נשלחים לשרת.
            </p>
          </div>
        )}

        {/* ─── Gmail ─── */}
        {phase === 'gmail' && (
          <div className="onb-step">
            <div className="onb-connect-icon">✉️</div>
            <h2 className="onb-step-title">חיבור Gmail</h2>
            <p className="onb-step-sub">
              כדי לזהות מיילים חשובים שדורשים פעולה, ניתן לחבר את Gmail.
            </p>

            {gmailMsg && <p className={`onb-conn-msg${gmailMsg.startsWith('✓') ? ' onb-conn-msg--ok' : ''}`}>{gmailMsg}</p>}

            <button
              className="onb-btn onb-btn--primary onb-btn--block"
              onClick={handleConnectGmail}
              disabled={busy}
            >
              {busy ? 'מתחבר…' : 'התחברות ל-Gmail'}
            </button>
            <button className="onb-btn onb-btn--ghost onb-btn--block" onClick={skipGmail} disabled={busy}>
              דלגי בינתיים
            </button>
            <p className="onb-privacy onb-privacy--sm">
              לא יוצגו מיילים אם Gmail אינו מחובר.
            </p>
          </div>
        )}

        {/* ─── Calendar ─── */}
        {phase === 'calendar' && (
          <div className="onb-step">
            <div className="onb-connect-icon">📅</div>
            <h2 className="onb-step-title">חיבור יומן</h2>
            <p className="onb-step-sub">בחרי מקור יומן אחד להצגה בדשבורד.</p>

            {calMsg && <p className={`onb-conn-msg${calMsg.startsWith('✓') ? ' onb-conn-msg--ok' : ''}`}>{calMsg}</p>}

            <button
              className={`onb-choice onb-choice--wide${calChoice === 'google' ? ' onb-choice--on' : ''}`}
              onClick={handleConnectGoogleCal}
              disabled={busy}
            >
              <span className="onb-choice-emoji">📅</span>
              <span>Google Calendar</span>
            </button>

            <button
              className={`onb-choice onb-choice--wide${calChoice === 'apple' ? ' onb-choice--on' : ''}`}
              onClick={chooseApple}
              disabled={busy}
            >
              <span className="onb-choice-emoji">🍎</span>
              <span>Apple Calendar / ICS</span>
            </button>

            {calChoice === 'apple' && (
              <div className="onb-ics-box">
                <p className="onb-ics-text">
                  {icsCount > 0 ? `${icsCount} אירועים מיובאים` : 'ייבוא קובץ ICS אחד או יותר'}
                </p>
                <label className="onb-btn onb-btn--ghost onb-btn--block onb-file-label">
                  <input type="file" accept=".ics,text/calendar" multiple hidden onChange={handleIcsUpload} />
                  בחירת קובץ ICS
                </label>
              </div>
            )}

            <div className="onb-footer">
              <button className="onb-btn onb-btn--ghost" onClick={skipCalendar} disabled={busy}>דלגי בינתיים</button>
              <button
                className="onb-btn onb-btn--primary"
                onClick={() => setPhase('prefs')}
                disabled={busy || (calChoice === 'apple' && icsCount === 0)}
              >
                המשך
              </button>
            </div>
          </div>
        )}

        {/* ─── Preferences ─── */}
        {phase === 'prefs' && (
          <div className="onb-step">
            <h2 className="onb-step-title">העדפות בסיסיות</h2>
            <p className="onb-step-sub">
              {greetName ? `כמעט סיימנו, ${greetName}. ` : ''}כמה כיוונונים והדשבורד מוכן.
            </p>

            <label className="onb-field-label">מצב כהה כברירת מחדל?</label>
            <div className="onb-toggle-row">
              {([[true, 'כן, כהה 🌙'], [false, 'לא, בהיר ☀️']] as [boolean, string][]).map(([v, l]) => (
                <button key={String(v)}
                  className={`onb-toggle${prefs.darkMode === v ? ' onb-toggle--on' : ''}`}
                  onClick={() => updatePref('darkMode', v)}
                >{l}</button>
              ))}
            </div>

            <label className="onb-field-label">תצוגת דשבורד</label>
            <div className="onb-toggle-row">
              {([['detailed', 'מפורטת'], ['compact', 'קומפקטית']] as [DisplayMode, string][]).map(([v, l]) => (
                <button key={v}
                  className={`onb-toggle${prefs.displayMode === v ? ' onb-toggle--on' : ''}`}
                  onClick={() => updatePref('displayMode', v)}
                >{l}</button>
              ))}
            </div>

            <label className="onb-field-label">שעת סיכום הבוקר (אופציונלי)</label>
            <input
              className="onb-input onb-input--time" type="time"
              value={prefs.morningSummaryTime}
              onChange={e => updatePref('morningSummaryTime', e.target.value)}
            />

            <label className="onb-field-label">מוקד עיקרי</label>
            <div className="onb-grid onb-grid--2">
              {FOCUS_OPTIONS.map(opt => (
                <button key={opt.value}
                  className={`onb-choice${prefs.mainFocusSection === opt.value ? ' onb-choice--on' : ''}`}
                  onClick={() => updatePref('mainFocusSection', opt.value)}
                >
                  <span className="onb-choice-emoji">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <button className="onb-btn onb-btn--primary onb-btn--block onb-btn--finish" onClick={handleFinish}>
              סיום ופתיחת הדשבורד
            </button>
            <p className="onb-privacy onb-privacy--sm">
              ההעדפות נשמרות מקומית בדפדפן. ניתן לאפס בכל רגע מתפריט החשבון.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
