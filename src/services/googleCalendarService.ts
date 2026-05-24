/**
 * Google Calendar Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Real implementation using Google Identity Services (GSI) token flow
 * and the Google Calendar API v3.
 *
 * Token is stored in module memory only — never written to localStorage
 * or sessionStorage.
 */

import type { CalendarEvent, EventCategory } from '../types';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CALENDAR_SCOPE,
  isGoogleConfigured,
} from '../config/google';

// ---------------------------------------------------------------------------
// Minimal GSI type declarations (no npm package needed)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: TokenClientConfig): TokenClient;
          revoke(token: string, callback: () => void): void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface TokenClient {
  requestAccessToken(): void;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/** Raw Google Calendar API v3 event (partial). */
interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  colorId?: string;
}

// ---------------------------------------------------------------------------
// Module-level auth state (memory only)
// ---------------------------------------------------------------------------

let _accessToken: string | null = null;

export function getIsConnected(): boolean {
  return _accessToken !== null;
}

// ---------------------------------------------------------------------------
// Script loading
// ---------------------------------------------------------------------------

/**
 * Inject the Google Identity Services script once.
 * Safe to call multiple times — resolves immediately if already loaded.
 */
export function loadGsiScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      // Script tag exists but may not be done yet — poll for google object
      const id = setInterval(() => {
        if (window.google?.accounts) { clearInterval(id); resolve(); }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('נכשלה טעינת ספריית Google Identity Services.'));
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Open the Google OAuth consent popup and store the access token.
 * Wraps the GSI callback-based API in a Promise.
 *
 * Resolves when the token is received successfully.
 * Rejects with a Hebrew error string on failure.
 */
export async function connectGoogleCalendar(): Promise<void> {
  if (!isGoogleConfigured) {
    throw new Error('חיבור Google Calendar עדיין לא הוגדר בסביבת הפיתוח.');
  }

  await loadGsiScript();

  return new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID!,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (response: TokenResponse) => {
        if (!response.access_token) {
          const msg = response.error === 'access_denied'
            ? 'ההרשאה נדחתה. נסה שוב ואשר גישה ליומן.'
            : `שגיאת התחברות: ${response.error_description ?? response.error ?? 'לא ידוע'}`;
          reject(new Error(msg));
          return;
        }
        _accessToken = response.access_token;
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
 * Revoke the stored token and clear local auth state.
 */
export function disconnectGoogleCalendar(): void {
  if (!_accessToken) return;
  window.google?.accounts.oauth2.revoke(_accessToken, () => {});
  _accessToken = null;
}

// ---------------------------------------------------------------------------
// Calendar API
// ---------------------------------------------------------------------------

/**
 * Fetch upcoming events from the user's primary Google Calendar.
 * Looks 14 days ahead.
 *
 * @throws Hebrew error string when the request fails.
 */
export async function fetchGoogleCalendarEvents(): Promise<CalendarEvent[]> {
  if (!_accessToken) {
    throw new Error('לא מחובר ל-Google Calendar.');
  }

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
  );
  url.searchParams.set('timeMin',       timeMin);
  url.searchParams.set('timeMax',       timeMax);
  url.searchParams.set('singleEvents',  'true');
  url.searchParams.set('orderBy',       'startTime');
  url.searchParams.set('maxResults',    '50');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${_accessToken}` },
  });

  if (res.status === 401) {
    _accessToken = null;
    throw new Error('פג תוקף החיבור ל-Google Calendar. נסה להתחבר מחדש.');
  }
  if (!res.ok) {
    throw new Error(`שגיאה בטעינת האירועים (${res.status}).`);
  }

  const data = await res.json();
  return (data.items ?? []).map(mapGoogleEventToSmartDayEvent);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export function mapGoogleEventToSmartDayEvent(raw: GCalEvent): CalendarEvent {
  const startRaw = raw.start.dateTime ?? raw.start.date ?? '';
  const endRaw   = raw.end.dateTime   ?? raw.end.date   ?? '';

  const date      = startRaw.split('T')[0];
  const startTime = startRaw.includes('T') ? startRaw.split('T')[1].slice(0, 5) : '00:00';
  const endTime   = endRaw.includes('T')   ? endRaw.split('T')[1].slice(0, 5)   : undefined;

  return {
    id:          raw.id,
    title:       raw.summary ?? '(ללא כותרת)',
    description: raw.description,
    date,
    startTime,
    endTime,
    location:    raw.location,
    category:    detectCategory(raw.summary ?? ''),
    importance:  'normal',
    source:      'googleCalendar',
  };
}

function detectCategory(title: string): EventCategory {
  const t = title.toLowerCase();
  if (/בחינה|מבחן|exam|test/.test(t))             return 'exam';
  if (/הרצאה|שיעור|lecture|class|קורס/.test(t))   return 'academic';
  if (/משמרת|עבודה|work|shift/.test(t))            return 'work';
  if (/פגישה|meeting|ועידה|סיעור/.test(t))         return 'meeting';
  if (/חג|holiday|יום טוב|festival/.test(t))       return 'holiday';
  return 'personal';
}
