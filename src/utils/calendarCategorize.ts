/**
 * calendarCategorize.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Expanded event categorisation used by both Google and Apple Calendar imports.
 * Also owns the localStorage-based category override system.
 */

import type { EventCategory } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Classification regexes
// ─────────────────────────────────────────────────────────────────────────────

/** Calendar names (Apple ICS file names) that indicate an academic calendar */
const ACADEMIC_CAL_NAME_RE =
  /אונו|לימודים|אקדמי|קורסים|מכללה|college|university|study|courses|academic|syllabus/i;

const EXAM_RE =
  /מבחן|בחינה|בוחן|exam|test|quiz/i;

const ACADEMIC_RE =
  /שיעור|הרצאה|תרגול|מטלה|הגשה|עבודת[\s_]*הגשה|סמינר|קורס|למידה|לימודים|מכללה|אונו|קריה[\s_]*אקדמית|ספרייה|פרויקט|מצגת|מעבדה|תואר|סטודנט|שיעורי[\s_]*בית|עבודה[\s_]*להגשה|class|lecture|assignment|submission|seminar|course|college|university|study|project|presentation|lab|homework/i;

const WORK_RE =
  /משמרת|מלגה|צוות|לקוח|HR|ראיון|משרד|חפיפה|shift|job|office|client|interview|onboarding|עבודה\s*ב/i;

const MEETING_RE =
  /פגישה|ישיבה|סיעור|ועידה|zoom|call\b|meeting/i;

const HOLIDAY_RE =
  /חג\b|חגים|יום[\s_]*העצמאות|שבועות|פסח|ראש[\s_]*השנה|יום[\s_]*כיפור|סוכות|חנוכה|פורים|שבתון|חופש|ערב[\s_]*חג|holiday|vacation|day[\s_]*off|festival|יום[\s_]*טוב|מועד/i;

// ─────────────────────────────────────────────────────────────────────────────
// Main categorization function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the EventCategory for a calendar event.
 *
 * Priority order (first match wins):
 *   exam  >  academic  >  work  >  meeting  >  holiday  >  personal (default)
 *
 * Apple ICS rule: if the calendarName looks like an academic calendar
 * (e.g. "אונו", "לימודים", "college") the event defaults to 'academic'
 * unless a stronger category (exam/work/holiday) is detected.
 */
export function categorizeCalendarEvent(
  title: string,
  description?: string,
  location?: string,
  calendarName?: string,
): EventCategory {
  const text = [title, description ?? '', location ?? ''].join(' ');
  const cal  = calendarName ?? '';

  // Exam (strongest signal — check before general academic)
  if (EXAM_RE.test(text) || EXAM_RE.test(cal)) return 'exam';

  // Academic — including events from academic-named calendars
  const isAcademicCal = ACADEMIC_CAL_NAME_RE.test(cal);
  if (ACADEMIC_RE.test(text) || isAcademicCal) return 'academic';

  // Work
  if (WORK_RE.test(text)) return 'work';

  // Meeting
  if (MEETING_RE.test(text)) return 'meeting';

  // Holiday
  if (HOLIDAY_RE.test(text) || HOLIDAY_RE.test(cal)) return 'holiday';

  return 'personal';
}

// ─────────────────────────────────────────────────────────────────────────────
// Category override — localStorage persistence
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY_OVERRIDE_KEY = 'smartday-event-category-overrides';

export function loadCategoryOverrides(): Record<string, EventCategory> {
  try {
    const raw = localStorage.getItem(CATEGORY_OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, EventCategory>) : {};
  } catch {
    return {};
  }
}

export function saveCategoryOverride(eventId: string, category: EventCategory): void {
  const overrides = loadCategoryOverrides();
  overrides[eventId] = category;
  localStorage.setItem(CATEGORY_OVERRIDE_KEY, JSON.stringify(overrides));
}

export function clearCategoryOverride(eventId: string): void {
  const overrides = loadCategoryOverrides();
  delete overrides[eventId];
  localStorage.setItem(CATEGORY_OVERRIDE_KEY, JSON.stringify(overrides));
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY_DISPLAY: Record<EventCategory, { label: string; icon: string }> = {
  academic: { label: 'לו״ז אקדמי',   icon: '📚' },
  exam:     { label: 'בחינה',        icon: '📝' },
  work:     { label: 'עבודה',        icon: '💼' },
  meeting:  { label: 'פגישה',        icon: '🤝' },
  holiday:  { label: 'חגים ומועדים', icon: '🎉' },
  personal: { label: 'אישי',         icon: '🌟' },
};

export const CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
  { value: 'academic', label: 'לו״ז אקדמי' },
  { value: 'exam',     label: 'בחינה' },
  { value: 'work',     label: 'עבודה' },
  { value: 'meeting',  label: 'פגישה' },
  { value: 'holiday',  label: 'חגים ומועדים' },
  { value: 'personal', label: 'אישי' },
];
