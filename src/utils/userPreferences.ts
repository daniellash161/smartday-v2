/**
 * userPreferences.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed localStorage helpers for persisting safe, non-sensitive UI preferences.
 * All data stored here must be safe to keep in the browser:
 *   ✓ UI state (theme, selected source, view mode)
 *   ✓ Category overrides
 *   ✗ Raw PDF text, Gmail bodies, API tokens, PII
 */

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Well-known preference keys
// ─────────────────────────────────────────────────────────────────────────────

export const PREF = {
  THEME:                    'smartday-theme',
  CALENDAR_SOURCE:          'smartday-calendar-source',
  MINI_CAL_VIEW:            'smartday-mini-calendar-view',
  EVENT_CATEGORY_OVERRIDES: 'smartday-event-category-overrides',
  NEWS_DEMO_ENABLED:        'smartday-news-demo-enabled',
  PAYMENT_INSIGHTS:         'smartday-payment-insights',
  PAYMENT_TASK_LINKS:       'smartday-payment-reminder-task-links',
  PAYMENT_EVENT_LINKS:      'smartday-payment-reminder-event-links',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Core read / write helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a preference value from localStorage.
 * Returns `fallback` if the key is absent or the stored JSON is invalid.
 */
export function getUserPreference<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write a preference value to localStorage as JSON.
 * Silently ignores errors (e.g. private browsing, quota exceeded).
 */
export function setUserPreference<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

/** Remove a preference from localStorage. */
export function removeUserPreference(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook: useState + automatic persistence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `useState` that persists state to localStorage.
 *
 * Usage:
 *   const [view, setView] = usePersistentState('smartday-mini-calendar-view', 'month');
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => getUserPreference(key, defaultValue));

  const setAndPersist = (value: T) => {
    setState(value);
    setUserPreference(key, value);
  };

  return [state, setAndPersist];
}
