/**
 * Google Calendar Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Infrastructure layer for future Google Calendar integration.
 *
 * Current state: all async functions are safe stubs — they log clearly and
 * return empty results rather than throwing, so the rest of the app stays
 * stable while mock data is in use.
 *
 * Phase 2 checklist (when ready to go live):
 *   ① Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY in .env.local
 *   ② Call loadGoogleScripts() once at app startup (e.g. in main.tsx)
 *   ③ Replace the stub bodies below with the commented-out real implementations
 *   ④ Store the access token in memory only (never localStorage / sessionStorage)
 *   ⑤ Wire isConnected state into EventsCard via context or lifted state
 */

import type { CalendarEvent, EventCategory } from '../types';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_API_KEY,
  GOOGLE_CALENDAR_SCOPE,
  isGoogleConfigured,
} from '../config/google';

// ---------------------------------------------------------------------------
// Script loading
// ---------------------------------------------------------------------------

/**
 * Dynamically inject the Google Identity Services (GSI) and Google API
 * Client Library scripts into the page.
 *
 * Call once at app startup, before any auth attempt.
 * Returns a Promise that resolves when both scripts are ready.
 *
 * TODO (Phase 2): Call this from main.tsx or App.tsx on mount.
 */
export function loadGoogleScripts(): Promise<void> {
  // TODO (Phase 2): uncomment and use the real implementation below
  console.info('[SmartDay] loadGoogleScripts: stub — scripts not loaded yet');
  return Promise.resolve();

  /*
  return new Promise((resolve, reject) => {
    // 1. Google Identity Services (handles OAuth popup / redirect)
    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.async = true;
    gsiScript.defer = true;
    gsiScript.onload = () => {
      // 2. Google API client library (used for Calendar API calls)
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.async = true;
      gapiScript.defer = true;
      gapiScript.onload = () => resolve();
      gapiScript.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(gapiScript);
    };
    gsiScript.onerror = () => reject(new Error('Failed to load GSI script'));
    document.head.appendChild(gsiScript);
  });
  */
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Start the Google OAuth 2.0 consent flow using Google Identity Services.
 *
 * On success the user grants calendar.readonly access and an access token
 * is returned via the callback. Store it in module-level memory only.
 *
 * TODO (Phase 2): Replace stub with real GSI token client.
 */
export async function connectGoogleCalendar(): Promise<void> {
  if (!isGoogleConfigured) {
    console.warn(
      '[SmartDay] connectGoogleCalendar: VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_API_KEY is missing.',
      'Set them in .env.local — see .env.example for the required keys.',
    );
    return;
  }

  // TODO (Phase 2): implement using Google Identity Services
  /*
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID!,
    scope: GOOGLE_CALENDAR_SCOPE,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error('[SmartDay] OAuth error:', tokenResponse.error);
        return;
      }
      _accessToken = tokenResponse.access_token;
      console.info('[SmartDay] Google Calendar connected successfully');
    },
  });
  client.requestAccessToken();
  */

  console.info('[SmartDay] connectGoogleCalendar: stub — OAuth not implemented yet');
}

/**
 * Revoke the stored OAuth token and clear local auth state.
 *
 * TODO (Phase 2): Call google.accounts.oauth2.revoke() and clear _accessToken.
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  if (!_accessToken) return;

  // TODO (Phase 2): implement token revocation
  /*
  window.google.accounts.oauth2.revoke(_accessToken, () => {
    console.info('[SmartDay] Google Calendar disconnected');
  });
  _accessToken = null;
  */

  console.info('[SmartDay] disconnectGoogleCalendar: stub — revocation not implemented yet');
}

/** In-memory token storage — never persisted to disk or localStorage. */
let _accessToken: string | null = null;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Fetch events from a Google Calendar using the Calendar API v3.
 *
 * Returns an empty array when credentials are missing or the stub is active,
 * so the app continues to show mock data without errors.
 *
 * @param calendarId - Calendar to fetch from (default: 'primary')
 * @param timeMin    - ISO 8601 lower bound (default: start of today)
 * @param timeMax    - ISO 8601 upper bound (default: 14 days from now)
 *
 * TODO (Phase 2): Replace stub with real fetch call.
 */
export async function fetchGoogleCalendarEvents(
  _calendarId: string = 'primary',
  _timeMin?: string,
  _timeMax?: string,
): Promise<CalendarEvent[]> {
  if (!isGoogleConfigured) {
    console.warn('[SmartDay] fetchGoogleCalendarEvents: Google not configured — returning []');
    return [];
  }

  if (!_accessToken) {
    console.warn('[SmartDay] fetchGoogleCalendarEvents: no access token — call connectGoogleCalendar() first');
    return [];
  }

  // TODO (Phase 2): implement real fetch
  /*
  const timeMin = _timeMin ?? startOfToday();
  const timeMax = _timeMax ?? plusDays(14);

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(_calendarId)}/events`,
  );
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('key', GOOGLE_API_KEY!);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${_accessToken}` },
  });

  if (!res.ok) {
    console.error('[SmartDay] Calendar API error:', res.status, await res.text());
    return [];
  }

  const data = await res.json();
  return (data.items ?? []).map(mapGoogleEventToSmartDayEvent);
  */

  console.info('[SmartDay] fetchGoogleCalendarEvents: stub — returning []');
  return [];
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** Raw event shape returned by Google Calendar API v3 (partial). */
interface GoogleCalendarEventRaw {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?:  Record<string, string>;
  };
}

/**
 * Convert a raw Google Calendar API event into a SmartDay CalendarEvent.
 *
 * TODO (Phase 2): Improve category detection —
 *   - Use colorId to map Google calendar colors to categories
 *   - Check extendedProperties.private['smartday-category'] for manual overrides
 *   - Use a richer keyword list or an AI classifier on the title/description
 */
export function mapGoogleEventToSmartDayEvent(
  raw: GoogleCalendarEventRaw,
): CalendarEvent {
  const startRaw = raw.start.dateTime ?? raw.start.date ?? '';
  const endRaw   = raw.end.dateTime   ?? raw.end.date   ?? '';

  const date      = startRaw.split('T')[0];
  const startTime = startRaw.includes('T') ? startRaw.split('T')[1].slice(0, 5) : '00:00';
  const endTime   = endRaw.includes('T')   ? endRaw.split('T')[1].slice(0, 5)   : undefined;

  // TODO (Phase 2): replace with richer detection (see JSDoc above)
  const category: EventCategory = detectCategory(raw.summary ?? '', raw.colorId);

  return {
    id:          raw.id,
    title:       raw.summary ?? '(ללא כותרת)',
    description: raw.description,
    date,
    startTime,
    endTime,
    location:    raw.location,
    category,
    importance:  'normal', // TODO (Phase 2): derive from colorId or extendedProperties
    source:      'googleCalendar',
  };
}

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

/**
 * Keyword-based category detection.
 * Intentionally naive — real version should use colorId mapping first.
 *
 * TODO (Phase 2): Accept a colorId→category map from user preferences.
 */
function detectCategory(title: string, _colorId?: string): EventCategory {
  const t = title.toLowerCase();
  if (/בחינה|מבחן|exam|test/.test(t))            return 'exam';
  if (/הרצאה|שיעור|lecture|class|קורס/.test(t))  return 'academic';
  if (/משמרת|עבודה|work|shift/.test(t))           return 'work';
  if (/פגישה|meeting|סיעור|ועידה/.test(t))        return 'meeting';
  if (/חג|holiday|יום טוב|festival/.test(t))      return 'holiday';
  return 'personal';
}

// Exported only for use in the TODO Phase 2 block above — not yet active.
export { GOOGLE_CLIENT_ID, GOOGLE_API_KEY, GOOGLE_CALENDAR_SCOPE, isGoogleConfigured };
