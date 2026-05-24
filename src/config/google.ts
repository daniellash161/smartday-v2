/**
 * Google Calendar configuration
 *
 * All values are read from environment variables at build time.
 * Never hardcode real credentials here.
 *
 * Setup:
 *   1. Copy .env.example to .env.local
 *   2. Fill in your values from https://console.cloud.google.com/
 *   3. .env.local is git-ignored — never commit it
 */

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/** True only when both required credentials are present at runtime. */
export const isGoogleConfigured =
  typeof GOOGLE_CLIENT_ID === 'string' && GOOGLE_CLIENT_ID.length > 0 &&
  typeof GOOGLE_API_KEY   === 'string' && GOOGLE_API_KEY.length   > 0;
