import type { EventCategory } from '../types';

export const taskSuggestions: Record<EventCategory, string[]> = {
  work: [
    'להכין אוכל לעבודה',
    'להכין בגדי עבודה',
    'לבדוק זמן יציאה',
    'להטעין טלפון',
  ],
  academic: [
    'לעבור על חומר קודם',
    'להכין מחשב / מחברת',
    'להוריד מצגת או חומר לשיעור',
    'להכין שאלות למרצה',
  ],
  exam: [
    'לקבוע זמן חזרה',
    'לפתור מבחן לדוגמה',
    'להכין סיכומים',
    'להכין ציוד למבחן',
  ],
  personal: [
    'לבדוק כתובת',
    'להגדיר תזכורת יציאה',
    'להכין דברים שצריך לקחת',
  ],
  meeting: [
    'לעבור על נושאי הפגישה',
    'להכין שאלות',
    'לשלוח תזכורת למשתתפים',
  ],
  holiday: [
    'לבדוק שעות פתיחה',
    'לקנות מצרכים',
    'לתאם עם המשפחה',
    'להכין מתנה או ציוד רלוונטי',
  ],
};

/** Returns de-duplicated suggestions for a set of categories, preserving order. */
export function getSuggestionsForCategories(categories: EventCategory[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of categories) {
    for (const s of taskSuggestions[cat] ?? []) {
      if (!seen.has(s)) {
        seen.add(s);
        result.push(s);
      }
    }
  }
  return result;
}
