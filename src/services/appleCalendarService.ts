/**
 * Apple Calendar Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses .ics (iCalendar, RFC 5545) files exported from Apple Calendar and
 * converts VEVENT blocks to SmartDay CalendarEvent objects.
 *
 * Scope: read-only import via FileReader. No OAuth. No API.
 */

import type { CalendarEvent } from '../types';
import { categorizeCalendarEvent } from '../utils/calendarCategorize';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const APPLE_KEY = 'smartday-apple-events';

export function loadAppleEvents(): CalendarEvent[] {
  try {
    return JSON.parse(localStorage.getItem(APPLE_KEY) ?? '[]') as CalendarEvent[];
  } catch {
    return [];
  }
}

export function saveAppleEvents(events: CalendarEvent[]): void {
  localStorage.setItem(APPLE_KEY, JSON.stringify(events));
}

export function clearAppleEvents(): void {
  localStorage.removeItem(APPLE_KEY);
}

// ---------------------------------------------------------------------------
// Date / time parsing
// ---------------------------------------------------------------------------

interface ParsedDT {
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
  allDay: boolean;
}

/**
 * Parse a DTSTART / DTEND value.
 * Supported formats (value part after the colon):
 *   YYYYMMDD           → all-day
 *   YYYYMMDDTHHmmss    → local date-time
 *   YYYYMMDDTHHmmssZ   → UTC date-time (treated as local for display)
 */
function parseDT(raw: string): ParsedDT | null {
  // Strip trailing Z — we show times as-is without TZ conversion
  const s = raw.trim().replace(/Z$/i, '');

  // All-day: exactly 8 digits
  if (s.length === 8 && /^\d{8}$/.test(s)) {
    const date = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return { date, time: '00:00', allDay: true };
  }

  // Date-time: YYYYMMDDTHHmmss (15+ chars starting with 8 digits + T + 6 digits)
  if (s.length >= 15 && /^\d{8}T\d{6}/.test(s)) {
    const date = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const time = `${s.slice(9, 11)}:${s.slice(11, 13)}`;
    return { date, time, allDay: false };
  }

  return null;
}

// ---------------------------------------------------------------------------
// ICS text parser
// ---------------------------------------------------------------------------

/**
 * Parse an iCalendar (.ics) text string and return SmartDay events.
 * Only VEVENT components are processed; VTODO, VJOURNAL etc. are ignored.
 *
 * @param text       Raw .ics file content
 * @param calendarName  Optional label (file name without extension) stored on each event
 */
export function parseICSText(text: string, calendarName?: string): CalendarEvent[] {
  // RFC 5545 §3.1 — unfold lines: CRLF or LF followed by a single WSP char
  const unfolded = text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '');

  const events: CalendarEvent[] = [];
  // Split on BEGIN:VEVENT (case-insensitive) and skip the leading segment
  const veventBlocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);

  for (let i = 0; i < veventBlocks.length; i++) {
    const block = veventBlocks[i].split(/END:VEVENT/i)[0];
    const props: Record<string, string> = {};

    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      // Strip parameters from the key  e.g.  DTSTART;TZID=America/New_York  → DTSTART
      const keyFull = line.slice(0, colonIdx);
      const key     = keyFull.split(';')[0].toUpperCase();
      const value   = line.slice(colonIdx + 1);

      // Keep first occurrence (some props like EXDATE may repeat)
      if (!(key in props)) props[key] = value;
    }

    // ── Require at least a DTSTART ──────────────────────────────────────────
    const startParsed = parseDT(props['DTSTART'] ?? '');
    if (!startParsed) continue;

    const endParsed = parseDT(props['DTEND'] ?? '');
    const endTime   =
      !startParsed.allDay && endParsed && !endParsed.allDay
        ? endParsed.time
        : undefined;

    const uid     = props['UID']?.trim()         || `ics-${Date.now()}-${i}`;
    const summary = props['SUMMARY']?.trim()     || '(ללא כותרת)';
    const desc    = props['DESCRIPTION']?.trim() || undefined;
    const loc     = props['LOCATION']?.trim()    || undefined;

    events.push({
      id:           uid,
      title:        summary,
      description:  desc,
      date:         startParsed.date,
      startTime:    startParsed.time,
      endTime,
      allDay:       startParsed.allDay || undefined,
      location:     loc,
      category:     categorizeCalendarEvent(summary, desc, loc, calendarName),
      importance:   'normal',
      source:       'appleCalendar',
      calendarName: calendarName || undefined,
    });
  }

  return events;
}
