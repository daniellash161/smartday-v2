/**
 * onboarding.ts — SmartDay local account, session & preferences (prototype)
 * ─────────────────────────────────────────────────────────────────────────────
 * PROTOTYPE AUTH: there is no backend. Registration/login are stored locally in
 * the browser only, so the dashboard can open with a personal session and the
 * integrations (Gmail / Calendar) can be wired to the real services.
 *
 * Nothing here is sensitive by design — no real personal data is seeded, and the
 * whole thing can be wiped via fullReset().
 */

import { PREF, setUserPreference, removeUserPreference } from './userPreferences';
import { clearGmailToken, disconnectGmail } from '../services/gmailService';
import { disconnectGoogleCalendar } from '../services/googleCalendarService';
import { clearAppleEvents } from '../services/appleCalendarService';

// ─────────────────────────────────────────────────────────────────────────────
// localStorage keys
// ─────────────────────────────────────────────────────────────────────────────

export const ACCOUNT_KEYS = {
  USER:        'smartdayUser',          // { email, createdAt }
  SESSION:     'smartdaySession',       // "true"
  ONBOARDED:   'smartdayOnboarded',     // "true" once connect+prefs steps are done
  USERS:       'smartdayUsers',         // { [email]: passwordHash }  (prototype only)
  GMAIL:       'gmailConnected',        // "true" | "false"
  CAL_SOURCE:  'preferredCalendarSource', // "google" | "apple" | "none"
  PREFS:       'smartdayPreferences',   // Preferences JSON
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CalendarSource = 'google' | 'apple' | 'none';
export type DisplayMode    = 'compact' | 'detailed';
export type FocusSection   = 'calendar' | 'tasks' | 'emails' | 'payments';

export interface SmartDayUser {
  email:     string;
  createdAt: string;
}

export interface Preferences {
  darkMode:                boolean;
  displayMode:             DisplayMode;
  morningSummaryTime:      string;        // "HH:MM"
  mainFocusSection:        FocusSection;
  preferredCalendarSource: CalendarSource;
}

export const DEFAULT_PREFERENCES: Preferences = {
  darkMode:                false,
  displayMode:             'detailed',
  morningSummaryTime:      '08:00',
  mainFocusSection:        'calendar',
  preferredCalendarSource: 'none',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/**
 * Non-cryptographic hash — PROTOTYPE ONLY. Avoids storing the raw password in
 * localStorage. NOT a substitute for real server-side password hashing.
 */
function weakHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return `h${h.toString(36)}`;
}

export function emailLocalPart(email: string): string {
  return (email.split('@')[0] || email).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Session / routing
// ─────────────────────────────────────────────────────────────────────────────

export function hasSession(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_KEYS.SESSION) === 'true' && getUser() !== null;
  } catch { return false; }
}

export function isOnboarded(): boolean {
  try { return localStorage.getItem(ACCOUNT_KEYS.ONBOARDED) === 'true'; }
  catch { return false; }
}

export function getUser(): SmartDayUser | null {
  return read<SmartDayUser | null>(ACCOUNT_KEYS.USER, null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Register / login (prototype, local only)
// ─────────────────────────────────────────────────────────────────────────────

interface AuthResult { ok: boolean; error?: string; }

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function registerUser(emailRaw: string, password: string): AuthResult {
  const email = emailRaw.trim().toLowerCase();
  if (!validEmail(email))    return { ok: false, error: 'כתובת אימייל לא תקינה.' };
  if (password.length < 4)   return { ok: false, error: 'הסיסמה צריכה להכיל לפחות 4 תווים.' };

  const users = read<Record<string, string>>(ACCOUNT_KEYS.USERS, {});
  if (users[email])          return { ok: false, error: 'משתמש עם אימייל זה כבר קיים. אפשר להתחבר.' };

  users[email] = weakHash(password);
  write(ACCOUNT_KEYS.USERS, users);
  write(ACCOUNT_KEYS.USER, { email, createdAt: new Date().toISOString() } satisfies SmartDayUser);
  try { localStorage.setItem(ACCOUNT_KEYS.SESSION, 'true'); } catch { /* ignore */ }
  return { ok: true };
}

export function loginUser(emailRaw: string, password: string): AuthResult {
  const email = emailRaw.trim().toLowerCase();
  if (!validEmail(email)) return { ok: false, error: 'כתובת אימייל לא תקינה.' };

  const users = read<Record<string, string>>(ACCOUNT_KEYS.USERS, {});
  const stored = users[email];
  if (!stored) return { ok: false, error: 'לא נמצא משתמש עם אימייל זה. אפשר להירשם.' };
  if (stored !== weakHash(password)) return { ok: false, error: 'סיסמה שגויה.' };

  // Preserve original createdAt if present, otherwise stamp now
  const existing = getUser();
  const createdAt = existing && existing.email === email ? existing.createdAt : new Date().toISOString();
  write(ACCOUNT_KEYS.USER, { email, createdAt } satisfies SmartDayUser);
  try { localStorage.setItem(ACCOUNT_KEYS.SESSION, 'true'); } catch { /* ignore */ }
  return { ok: true };
}

/** Log out: clears the session only. Keeps user record + preferences. */
export function logout(): void {
  try { localStorage.removeItem(ACCOUNT_KEYS.SESSION); } catch { /* ignore */ }
}

export function markOnboarded(): void {
  try { localStorage.setItem(ACCOUNT_KEYS.ONBOARDED, 'true'); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gmail connection state
// ─────────────────────────────────────────────────────────────────────────────

export function isGmailConnected(): boolean {
  try { return localStorage.getItem(ACCOUNT_KEYS.GMAIL) === 'true'; }
  catch { return false; }
}

export function setGmailConnected(connected: boolean): void {
  try { localStorage.setItem(ACCOUNT_KEYS.GMAIL, connected ? 'true' : 'false'); }
  catch { /* ignore */ }
}

/** Disconnect Gmail everywhere: app flag + service token + session keys. */
export function disconnectGmailAccount(): void {
  setGmailConnected(false);
  try { disconnectGmail(); } catch { /* ignore */ }
  try { clearGmailToken(); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar connection state
// ─────────────────────────────────────────────────────────────────────────────

export function getCalendarSource(): CalendarSource {
  try {
    const v = localStorage.getItem(ACCOUNT_KEYS.CAL_SOURCE);
    return v === 'google' || v === 'apple' ? v : 'none';
  } catch { return 'none'; }
}

/**
 * Persist the preferred calendar source and mirror it into the existing
 * EventsCard preference (smartday-calendar-source) so the dashboard reflects it.
 */
export function setCalendarSource(source: CalendarSource): void {
  try { localStorage.setItem(ACCOUNT_KEYS.CAL_SOURCE, source); } catch { /* ignore */ }
  if (source === 'google' || source === 'apple') {
    setUserPreference(PREF.CALENDAR_SOURCE, source);
  }
}

/** Disconnect calendar: clear source + cached Google + Apple data. */
export function disconnectCalendarAccount(): void {
  setCalendarSource('none');
  try { localStorage.setItem(ACCOUNT_KEYS.CAL_SOURCE, 'none'); } catch { /* ignore */ }
  try { disconnectGoogleCalendar(); } catch { /* ignore */ }
  try { clearAppleEvents(); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferences
// ─────────────────────────────────────────────────────────────────────────────

export function getPreferences(): Preferences {
  return { ...DEFAULT_PREFERENCES, ...read<Partial<Preferences>>(ACCOUNT_KEYS.PREFS, {}) };
}

/**
 * Save preferences and mirror the ones the dashboard already consumes:
 *  - darkMode → theme (Header reads PREF.THEME on mount)
 *  - preferredCalendarSource → calendar source
 */
export function savePreferences(prefs: Preferences): void {
  write(ACCOUNT_KEYS.PREFS, prefs);
  applyPreferences(prefs);
}

export function applyPreferences(prefs: Preferences): void {
  setUserPreference(PREF.THEME, prefs.darkMode ? 'dark' : 'light');
  // Reflect dark mode immediately on the document
  try {
    const root = document.documentElement;
    if (prefs.darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  } catch { /* ignore */ }
  setCalendarSource(prefs.preferredCalendarSource);
}

/** Reset preferences to defaults, keep the user logged in. */
export function resetPreferences(): void {
  try { localStorage.removeItem(ACCOUNT_KEYS.PREFS); } catch { /* ignore */ }
  applyPreferences(DEFAULT_PREFERENCES);
}

// ─────────────────────────────────────────────────────────────────────────────
// Full local reset
// ─────────────────────────────────────────────────────────────────────────────

/** Wipe the local profile, session, preferences and all integration state. */
export function fullReset(): void {
  // Integrations first (service-side caches)
  disconnectGmailAccount();
  disconnectCalendarAccount();
  try {
    localStorage.removeItem(ACCOUNT_KEYS.USER);
    localStorage.removeItem(ACCOUNT_KEYS.SESSION);
    localStorage.removeItem(ACCOUNT_KEYS.ONBOARDED);
    localStorage.removeItem(ACCOUNT_KEYS.PREFS);
    localStorage.removeItem(ACCOUNT_KEYS.GMAIL);
    localStorage.removeItem(ACCOUNT_KEYS.CAL_SOURCE);
  } catch { /* ignore */ }
  removeUserPreference(PREF.CALENDAR_SOURCE);
  applyPreferences(DEFAULT_PREFERENCES);
}
