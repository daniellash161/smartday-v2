/**
 * alertGenerator.ts
 * Generates contextual smart alerts from calendar events, tasks, and other sources.
 */

import type { CalendarEvent, Alert, Priority, Task } from '../types';

function todayStr() { return new Date().toISOString().split('T')[0]; }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Main entry point — generates up to 5 smart alerts from all available context.
 */
export function generateSmartAlerts(
  events: CalendarEvent[] = [],
  tasks: Task[] = [],
): Alert[] {
  const alerts: Alert[] = [];
  const seen = new Set<string>();

  // A. Calendar-based alerts
  for (const a of generateCalendarAlerts(events)) {
    if (!seen.has(a.id)) { seen.add(a.id); alerts.push(a); }
  }

  // B. Task deadline alerts
  for (const a of generateTaskAlerts(tasks)) {
    if (!seen.has(a.id)) { seen.add(a.id); alerts.push(a); }
  }

  // Sort: high first, then medium, then low
  alerts.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });

  // Limit to 5
  return alerts.slice(0, 5);
}

// ── A. Calendar alerts ────────────────────────────────────────────────────────
function generateCalendarAlerts(events: CalendarEvent[]): Alert[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 48 * 3600 * 1000);
  const alerts: Alert[] = [];

  for (const event of events) {
    if (event.source === 'demo') continue;
    const eventDT = new Date(`${event.date}T${event.startTime}`);
    if (eventDT < now || eventDT > cutoff) continue;
    const hoursUntil = (eventDT.getTime() - now.getTime()) / 3600000;
    const urgency: Priority = hoursUntil < 24 ? 'high' : 'medium';
    const alert = buildCalendarAlert(event, hoursUntil, urgency);
    if (alert) alerts.push(alert);
  }
  return alerts;
}

function buildCalendarAlert(event: CalendarEvent, hoursUntil: number, urgency: Priority): Alert | null {
  const lc = event.title.toLowerCase();
  const cat = event.category;
  const time = event.startTime;
  const today = new Date().toISOString().split('T')[0];

  if (cat === 'exam' || lc.includes('מבחן') || lc.includes('בחינה')) {
    return {
      id: `alert-cal-${event.id}`,
      type: 'deadline',
      title: 'בחינה קרובה',
      description: `${event.title} מתוכננת ב-${time}. כדאי לפתוח חומרים ולחזור על הנושאים.`,
      urgency,
      source: 'calendar',
      sourceTag: 'יומן',
      suggestedAction: `להכין חומרים ל: ${event.title}`,
      dueDate: event.date,
      reason: `אירוע ביומן: ${event.title}`,
    };
  }

  if (lc.includes('הגשה') || lc.includes('פרויקט')) {
    return {
      id: `alert-cal-${event.id}`,
      type: 'deadline',
      title: 'הגשה קרובה',
      description: `${event.title} מתוכנן ב-${time}. כדאי לוודא שהכל מוכן מראש.`,
      urgency,
      source: 'calendar',
      sourceTag: 'יומן',
      suggestedAction: `לסיים את: ${event.title}`,
      dueDate: event.date,
      reason: `אירוע ביומן: ${event.title}`,
    };
  }

  if (lc.includes('ראיון') || lc.includes('interview')) {
    return {
      id: `alert-cal-${event.id}`,
      type: 'reminder',
      title: 'ראיון קרוב',
      description: `${event.title} מתוכנן ב-${time}. כדאי להכין שאלות ולחזור על קורות חיים.`,
      urgency: 'high',
      source: 'calendar',
      sourceTag: 'יומן',
      suggestedAction: `להכין נקודות לראיון: ${event.title}`,
      dueDate: event.date,
      reason: `ראיון ביומן: ${event.title}`,
    };
  }

  if (cat === 'meeting' || lc.includes('פגישה') || lc.includes('meeting')) {
    return {
      id: `alert-cal-${event.id}`,
      type: 'reminder',
      title: 'פגישה קרובה היום',
      description: `${event.title} מתוכננת ב-${time}. כדאי להכין נקודות לשיחה מראש.`,
      urgency: hoursUntil < 24 ? 'high' : 'medium',
      source: 'calendar',
      sourceTag: 'יומן',
      suggestedAction: `להכין נקודות לפגישה: ${event.title}`,
      dueDate: event.date,
      reason: `פגישה ביומן ב-${time}`,
    };
  }

  if (cat === 'work' && (lc.includes('משמרת') || lc.includes('עבודה'))) {
    return {
      id: `alert-cal-${event.id}`,
      type: 'reminder',
      title: 'משמרת קרובה',
      description: `${event.title} מתוכננת ב-${time}. כדאי להכין אוכל ולבדוק זמני נסיעה.`,
      urgency,
      source: 'calendar',
      sourceTag: 'יומן',
      suggestedAction: `להכין מראש למשמרת: ${event.title}`,
      dueDate: event.date,
      reason: `משמרת ביומן ב-${time}`,
    };
  }

  if (cat === 'academic' || lc.includes('שיעור') || lc.includes('הרצאה')) {
    return {
      id: `alert-cal-${event.id}`,
      type: 'reminder',
      title: 'שיעור קרוב',
      description: `${event.title} מתוכנן ב-${time}. כדאי לעבור על משימות פתוחות לפני.`,
      urgency: hoursUntil < 24 ? 'medium' : 'low',
      source: 'calendar',
      sourceTag: 'יומן',
      suggestedAction: `לעבור על חומר לפני: ${event.title}`,
      dueDate: event.date,
      reason: `שיעור ביומן ב-${time}`,
    };
  }

  return null;
}

// ── B. Task deadline alerts ───────────────────────────────────────────────────
function generateTaskAlerts(tasks: Task[]): Alert[] {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const alerts: Alert[] = [];

  const urgentTasks = tasks.filter(t => {
    if (t.completed || t.status === 'done' || t.status === 'handled') return false;
    const due = t.deadlineDate ?? t.dueDate;
    return due === today || due === tomorrow;
  });

  const highUrgencyCount = tasks.filter(t =>
    !t.completed && (t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical')
  ).length;

  // Alert for individual due-today/tomorrow tasks (up to 2)
  for (const task of urgentTasks.slice(0, 2)) {
    const due = task.deadlineDate ?? task.dueDate;
    const dueLabel = due === today ? 'היום' : 'מחר';
    alerts.push({
      id: `alert-task-${task.id}`,
      type: 'deadline',
      title: 'דדליין קרוב',
      description: `"${task.title}" — תאריך היעד הוא ${dueLabel}. כדאי לטפל בה לפני שאר המשימות.`,
      urgency: 'high',
      source: 'tasks',
      sourceTag: 'משימות',
      suggestedAction: `לטפל במשימה: ${task.title}`,
      dueDate: due,
      reason: `תאריך יעד: ${dueLabel}`,
    });
  }

  // Alert for high workload
  if (highUrgencyCount >= 3) {
    alerts.push({
      id: `alert-task-overload`,
      type: 'reminder',
      title: 'עומס משימות גבוה',
      description: `יש ${highUrgencyCount} משימות דחופות. כדאי להתמקד ב-2 החשובות ביותר תחילה.`,
      urgency: 'medium',
      source: 'tasks',
      sourceTag: 'משימות',
      suggestedAction: 'לבחור ולהתמקד ב-2 משימות קריטיות',
      reason: `${highUrgencyCount} משימות דחופות פתוחות`,
    });
  }

  return alerts;
}

// Keep backward-compat export for any code that imports the old name
export function generateSmartAlertsFromEvents(
  events: CalendarEvent[],
): Alert[] {
  return generateSmartAlerts(events, []);
}
