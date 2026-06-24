/**
 * alertGenerator.ts
 * Generates smart, contextual alerts with different logic per time horizon:
 *  - Within 48h → readiness alert ("prepare now")
 *  - 2–14 days away → planning alert ("create a study/prep schedule")
 *  - Task deadlines → urgency alerts
 */

import type { CalendarEvent, Alert, AlertPlanTask, Priority, Task } from '../types';

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
function addDays(base: Date, n: number): string {
  const d = new Date(base); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function formatDateHebrew(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function generateSmartAlerts(
  events: CalendarEvent[] = [],
  tasks: Task[] = [],
): Alert[] {
  const alerts: Alert[] = [];
  const seen = new Set<string>();

  const add = (a: Alert) => { if (!seen.has(a.id)) { seen.add(a.id); alerts.push(a); } };

  // A. Calendar — upcoming 48h (readiness)
  for (const a of generateImmediateCalendarAlerts(events)) add(a);

  // B. Calendar — 2–14 days ahead (planning)
  for (const a of generatePlanningAlerts(events)) add(a);

  // C. Task deadlines
  for (const a of generateTaskAlerts(tasks)) add(a);

  // Sort: high → medium → low
  alerts.sort((a, b) => {
    const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });

  return alerts.slice(0, 5);
}

// ── A. Immediate (0–48h) ─────────────────────────────────────────────────────

function generateImmediateCalendarAlerts(events: CalendarEvent[]): Alert[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 48 * 3600_000);
  const alerts: Alert[] = [];

  for (const event of events) {
    if (event.source === 'demo') continue;
    const dt = new Date(`${event.date}T${event.startTime}`);
    if (dt < now || dt > cutoff) continue;
    const hoursUntil = (dt.getTime() - now.getTime()) / 3_600_000;
    const urgency: Priority = hoursUntil < 24 ? 'high' : 'medium';
    const lc = event.title.toLowerCase();

    // Skip events that also have a planning alert (exam/interview/deadline)
    // so we don't double-alert
    const isPlanning = isExam(lc, event.category)
      || isInterview(lc)
      || isDeadline(lc);

    if (isExam(lc, event.category)) {
      alerts.push({
        id: `alert-imm-${event.id}`,
        type: 'deadline',
        title: `בחינה היום/מחר: ${event.title}`,
        description: `${event.title} מתוכננת ב-${event.startTime}. זה הזמן לחזור על הנושאים ולנוח לפני.`,
        urgency,
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `לחזור על החומר לבחינה: ${event.title}`,
        dueDate: event.date,
        reason: `בחינה ב-${formatDateHebrew(event.date)}`,
      });
    } else if (isInterview(lc)) {
      alerts.push({
        id: `alert-imm-${event.id}`,
        type: 'reminder',
        title: `ראיון היום: ${event.title}`,
        description: `ראיון מתוכנן ב-${event.startTime}. כדאי לחזור על קורות חיים ולהכין שאלות.`,
        urgency: 'high',
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `להכין לראיון: ${event.title}`,
        dueDate: event.date,
        reason: `ראיון ב-${event.startTime}`,
      });
    } else if (isMeeting(lc, event.category)) {
      alerts.push({
        id: `alert-imm-${event.id}`,
        type: 'reminder',
        title: `פגישה בקרוב: ${event.title}`,
        description: `${event.title} ב-${event.startTime}. כדאי לארגן נקודות לשיחה מראש.`,
        urgency,
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `להכין נקודות לפגישה: ${event.title}`,
        dueDate: event.date,
        reason: `פגישה ב-${event.startTime}`,
      });
    } else if (isShift(lc, event.category)) {
      alerts.push({
        id: `alert-imm-${event.id}`,
        type: 'reminder',
        title: `משמרת בקרוב: ${event.title}`,
        description: `${event.title} ב-${event.startTime}. כדאי להכין אוכל ולבדוק נסיעות.`,
        urgency,
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `להכין מראש: ${event.title}`,
        dueDate: event.date,
        reason: `משמרת ב-${event.startTime}`,
      });
    } else if (isClass(lc, event.category)) {
      alerts.push({
        id: `alert-imm-${event.id}`,
        type: 'reminder',
        title: `שיעור בקרוב: ${event.title}`,
        description: `${event.title} ב-${event.startTime}. כדאי לעבור על חומר קודם.`,
        urgency: hoursUntil < 24 ? 'medium' : 'low',
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `לעבור על חומר: ${event.title}`,
        dueDate: event.date,
        reason: `שיעור ב-${event.startTime}`,
      });
    }
  }
  return alerts;
}

// ── B. Planning (2–14 days ahead) ────────────────────────────────────────────

function generatePlanningAlerts(events: CalendarEvent[]): Alert[] {
  const now = new Date();
  const nearCutoff = new Date(now.getTime() + 2 * 86_400_000);   // skip next 48h
  const farCutoff  = new Date(now.getTime() + 14 * 86_400_000);  // up to 14 days
  const alerts: Alert[] = [];

  for (const event of events) {
    if (event.source === 'demo') continue;
    const dt = new Date(`${event.date}T${event.startTime}`);
    if (dt < nearCutoff || dt > farCutoff) continue;

    const daysUntil = Math.ceil((dt.getTime() - now.getTime()) / 86_400_000);
    const lc = event.title.toLowerCase();
    const dateLabel = formatDateHebrew(event.date);

    if (isExam(lc, event.category)) {
      // Build a study schedule: review today, practice halfway, final review day-before
      const planTasks = buildStudyPlan(event, daysUntil);
      alerts.push({
        id: `alert-plan-${event.id}`,
        type: 'deadline',
        title: `מבחן ב-${dateLabel} — כדאי לתכנן לוז למידה`,
        description: `${event.title} בעוד ${daysUntil} ימים (${dateLabel}). תכנון לוז למידה מסודר יעזור לך להגיע מוכנה.`,
        urgency: daysUntil <= 3 ? 'high' : 'medium',
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `לתכנן לוז למידה ל: ${event.title}`,
        dueDate: event.date,
        reason: `מבחן ב-${dateLabel} — ${daysUntil} ימים מהיום`,
        planTasks,
      });
    } else if (isDeadline(lc)) {
      const planTasks = buildSubmissionPlan(event, daysUntil);
      alerts.push({
        id: `alert-plan-${event.id}`,
        type: 'deadline',
        title: `הגשה ב-${dateLabel} — כדאי לתכנן מראש`,
        description: `${event.title} בעוד ${daysUntil} ימים. כדאי לפרק לשלבים כדי לא להגיע ללחץ ברגע האחרון.`,
        urgency: daysUntil <= 3 ? 'high' : 'medium',
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `לתכנן עבודה על: ${event.title}`,
        dueDate: event.date,
        reason: `הגשה ב-${dateLabel}`,
        planTasks,
      });
    } else if (isInterview(lc)) {
      const planTasks = buildInterviewPlan(event, daysUntil);
      alerts.push({
        id: `alert-plan-${event.id}`,
        type: 'reminder',
        title: `ראיון ב-${dateLabel} — כדאי להכין`,
        description: `${event.title} בעוד ${daysUntil} ימים. הכנה טובה מראש תגדיל את הסיכויים.`,
        urgency: daysUntil <= 3 ? 'high' : 'medium',
        source: 'calendar', sourceTag: 'יומן',
        suggestedAction: `להכין לראיון: ${event.title}`,
        dueDate: event.date,
        reason: `ראיון ב-${dateLabel}`,
        planTasks,
      });
    }
  }
  return alerts;
}

// ── Study / prep plan builders ────────────────────────────────────────────────

function buildStudyPlan(event: CalendarEvent, daysUntil: number): AlertPlanTask[] {
  const tasks: AlertPlanTask[] = [];
  if (daysUntil >= 5) {
    tasks.push({ title: `לחזור על נושאי ${event.title} — סקירה כללית`, daysBeforeEvent: Math.floor(daysUntil * 0.7), urgency: 'low' });
    tasks.push({ title: `לתרגל שאלות בנושאי ${event.title}`, daysBeforeEvent: Math.floor(daysUntil * 0.4), urgency: 'medium' });
    tasks.push({ title: `חזרה אחרונה לפני ${event.title} — להתמקד בנקודות חלשות`, daysBeforeEvent: 1, urgency: 'high' });
  } else if (daysUntil >= 3) {
    tasks.push({ title: `לחזור על חומר ${event.title}`, daysBeforeEvent: daysUntil - 1, urgency: 'medium' });
    tasks.push({ title: `חזרה אחרונה — ${event.title}`, daysBeforeEvent: 1, urgency: 'high' });
  } else {
    tasks.push({ title: `ללמוד לקראת ${event.title}`, daysBeforeEvent: 1, urgency: 'high' });
  }
  return tasks;
}

function buildSubmissionPlan(event: CalendarEvent, daysUntil: number): AlertPlanTask[] {
  const tasks: AlertPlanTask[] = [];
  if (daysUntil >= 4) {
    tasks.push({ title: `להתחיל לעבוד על: ${event.title}`, daysBeforeEvent: daysUntil - 1, urgency: 'medium' });
    tasks.push({ title: `לסיים טיוטה ראשונה — ${event.title}`, daysBeforeEvent: 2, urgency: 'medium' });
    tasks.push({ title: `לבדוק ולסגור הגשה: ${event.title}`, daysBeforeEvent: 1, urgency: 'high' });
  } else {
    tasks.push({ title: `לסיים הגשה: ${event.title}`, daysBeforeEvent: 1, urgency: 'high' });
  }
  return tasks;
}

function buildInterviewPlan(event: CalendarEvent, daysUntil: number): AlertPlanTask[] {
  const tasks: AlertPlanTask[] = [];
  if (daysUntil >= 3) {
    tasks.push({ title: `לחזור על קורות חיים לפני ${event.title}`, daysBeforeEvent: daysUntil - 1, urgency: 'medium' });
    tasks.push({ title: `להכין שאלות ותשובות לראיון: ${event.title}`, daysBeforeEvent: 2, urgency: 'medium' });
    tasks.push({ title: `לתרגל הצגה עצמית לפני ${event.title}`, daysBeforeEvent: 1, urgency: 'high' });
  } else {
    tasks.push({ title: `להכין לראיון: ${event.title}`, daysBeforeEvent: 1, urgency: 'high' });
  }
  return tasks;
}

// ── C. Task deadline alerts ───────────────────────────────────────────────────

function generateTaskAlerts(tasks: Task[]): Alert[] {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const alerts: Alert[] = [];

  const urgentTasks = tasks.filter(t => {
    if (t.completed || t.status === 'done' || t.status === 'handled') return false;
    const due = t.deadlineDate ?? t.dueDate;
    return due === today || due === tomorrow;
  });

  for (const task of urgentTasks.slice(0, 2)) {
    const due = task.deadlineDate ?? task.dueDate;
    const dueLabel = due === today ? 'היום' : 'מחר';
    alerts.push({
      id: `alert-task-${task.id}`,
      type: 'deadline',
      title: 'דדליין קרוב',
      description: `"${task.title}" — תאריך היעד ${dueLabel}. כדאי לטפל בה לפני שאר המשימות.`,
      urgency: 'high',
      source: 'tasks', sourceTag: 'משימות',
      suggestedAction: `לטפל במשימה: ${task.title}`,
      dueDate: due,
      reason: `תאריך יעד: ${dueLabel}`,
    });
  }

  const highCount = tasks.filter(t =>
    !t.completed && (t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical')
  ).length;

  if (highCount >= 3) {
    alerts.push({
      id: `alert-task-overload`,
      type: 'reminder',
      title: 'עומס משימות גבוה',
      description: `יש ${highCount} משימות דחופות פתוחות. כדאי להתמקד ב-2 החשובות ביותר תחילה.`,
      urgency: 'medium',
      source: 'tasks', sourceTag: 'משימות',
      suggestedAction: 'להתמקד ב-2 המשימות הדחופות ביותר',
      reason: `${highCount} משימות דחופות`,
    });
  }

  return alerts;
}

// ── Category helpers ──────────────────────────────────────────────────────────

function isExam(lc: string, cat: string): boolean {
  return cat === 'exam' || lc.includes('מבחן') || lc.includes('בחינה') || lc.includes('exam');
}
function isInterview(lc: string): boolean {
  return lc.includes('ראיון') || lc.includes('interview');
}
function isDeadline(lc: string): boolean {
  return lc.includes('הגשה') || lc.includes('פרויקט') || lc.includes('deadline');
}
function isMeeting(lc: string, cat: string): boolean {
  return cat === 'meeting' || lc.includes('פגישה') || lc.includes('meeting');
}
function isShift(lc: string, cat: string): boolean {
  return cat === 'work' && (lc.includes('משמרת') || lc.includes('עבודה'));
}
function isClass(lc: string, cat: string): boolean {
  return cat === 'academic' || lc.includes('שיעור') || lc.includes('הרצאה') || lc.includes('תרגול');
}

// ── Backward compat ───────────────────────────────────────────────────────────
export function generateSmartAlertsFromEvents(events: CalendarEvent[]): Alert[] {
  return generateSmartAlerts(events, []);
}

// ── Helper for AlertsCard: convert planTasks → Task objects ──────────────────
export function planTasksToTasks(
  planTasks: AlertPlanTask[],
  eventDate: string,
): Array<{ title: string; dueDate: string; urgency: 'high' | 'medium' | 'low'; priority: 'high' | 'medium' | 'low'; priorityScore: number }> {
  const eventDT = new Date(eventDate);
  return planTasks.map(pt => {
    const due = addDays(eventDT, -pt.daysBeforeEvent);
    return {
      title: pt.title,
      dueDate: due,
      urgency: pt.urgency,
      priority: pt.urgency,
      priorityScore: pt.urgency === 'high' ? 85 : pt.urgency === 'medium' ? 60 : 35,
    };
  });
}
