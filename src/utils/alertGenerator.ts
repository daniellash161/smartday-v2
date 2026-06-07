/**
 * alertGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates smart alerts from real calendar events based on time proximity and
 * event characteristics (academic, work, etc.).
 */

import type { CalendarEvent, Alert, Priority } from '../types';

interface AlertGeneratorOptions {
  hoursAhead?: number; // How many hours in advance to generate alerts (default: 48)
}

/**
 * Generate smart alerts from upcoming calendar events.
 * Only creates alerts for real events within the next N hours.
 */
export function generateSmartAlertsFromEvents(
  events: CalendarEvent[],
  options: AlertGeneratorOptions = {}
): Alert[] {
  const { hoursAhead = 48 } = options;
  const now = new Date();
  const cutoffTime = new Date(now.getTime() + hoursAhead * 3600 * 1000);

  const alerts: Alert[] = [];

  for (const event of events) {
    // Skip demo events and events from the past
    if (event.source === 'demo') continue;

    const eventDateTime = new Date(`${event.date}T${event.startTime}`);
    if (eventDateTime < now || eventDateTime > cutoffTime) continue;

    // Calculate time until event (in hours)
    const hoursUntil = (eventDateTime.getTime() - now.getTime()) / (3600 * 1000);

    // Generate alerts based on event category and characteristics
    const alert = generateAlertForEvent(event, hoursUntil);
    if (alert) {
      alerts.push(alert);
    }
  }

  return alerts;
}

/**
 * Generate a single alert for an event based on its category and characteristics.
 */
function generateAlertForEvent(event: CalendarEvent, hoursUntil: number): Alert | null {
  const eventTitle = event.title.toLowerCase();
  const category = event.category;

  // Determine urgency: high if < 24 hours, medium otherwise
  const urgency: Priority = hoursUntil < 24 ? 'high' : 'medium';

  // Academic events
  if (category === 'academic' || category === 'exam') {
    if (eventTitle.includes('מבחן') || eventTitle.includes('בחינה') || category === 'exam') {
      return {
        id: `alert-${event.id}`,
        type: 'reminder',
        title: 'בחינה קרובה',
        description: `${event.title} מתוכננת ל-${event.startTime}. כדאי לפתוח חומרים ולהכין עצמך מראש.`,
        urgency: urgency,
        actionLabel: 'לפתיחת חומרים',
      };
    }

    if (
      eventTitle.includes('הגשה') ||
      eventTitle.includes('עבודה להגשה') ||
      eventTitle.includes('פרויקט')
    ) {
      return {
        id: `alert-${event.id}`,
        type: 'deadline',
        title: 'הגשה קרובה',
        description: `${event.title} מתוכננת ל-${event.startTime}. כדאי להכין הכל מראש ולהוסיף למשימות.`,
        urgency: urgency,
        actionLabel: 'הוסף למשימות',
      };
    }

    if (
      eventTitle.includes('שיעור') ||
      eventTitle.includes('הרצאה') ||
      eventTitle.includes('קורס') ||
      eventTitle.includes('תרגול')
    ) {
      return {
        id: `alert-${event.id}`,
        type: 'reminder',
        title: 'אירוע אקדמי קרוב',
        description: `${event.title} מתוכנן ל-${event.startTime}. כדאי לעבור על החומר מראש.`,
        urgency: hoursUntil < 48 ? 'medium' : 'low',
        actionLabel: 'לעבור על חומר',
      };
    }

    // Default academic alert
    return {
      id: `alert-${event.id}`,
      type: 'reminder',
      title: 'אירוע אקדמי קרוב',
      description: `${event.title} מתוכנן ל-${event.startTime}. כדאי לעבור על החומר מראש.`,
      urgency: hoursUntil < 48 ? 'medium' : 'low',
      actionLabel: 'לעבור על חומר',
    };
  }

  // Work events
  if (category === 'work') {
    if (eventTitle.includes('משמרת') || eventTitle.includes('עבודה')) {
      return {
        id: `alert-${event.id}`,
        type: 'reminder',
        title: 'משמרת קרובה',
        description: `${event.title} מתוכננת ל-${event.startTime}. כדאי להיערך מראש (אוכל, בגדים, בדיקת זמנים).`,
        urgency: urgency,
        actionLabel: 'להכנה',
      };
    }

    // Default work alert
    return {
      id: `alert-${event.id}`,
      type: 'reminder',
      title: 'אירוע עבודה קרוב',
      description: `${event.title} מתוכנן ל-${event.startTime}. כדאי להיערך מראש.`,
      urgency: hoursUntil < 48 ? 'medium' : 'low',
      actionLabel: 'להכנה',
    };
  }

  // Meeting events
  if (category === 'meeting') {
    return {
      id: `alert-${event.id}`,
      type: 'reminder',
      title: 'פגישה קרובה',
      description: `${event.title} מתוכננת ל-${event.startTime}. כדאי לעבור על נושאים ולהכין שאלות.`,
      urgency: hoursUntil < 48 ? 'medium' : 'low',
      actionLabel: 'להכנה',
    };
  }

  // Holiday events
  if (category === 'holiday') {
    return {
      id: `alert-${event.id}`,
      type: 'reminder',
      title: 'חג/אירוע חגיגי קרוב',
      description: `${event.title} מתוכנן ל-${event.startTime}. בדוק שעות פתיחה והכן מה שצריך.`,
      urgency: 'low',
      actionLabel: 'להתכוננות',
    };
  }

  // No alert for other categories
  return null;
}
