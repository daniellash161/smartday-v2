/**
 * taskSuggestionGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates smart task suggestions from real calendar events.
 * Suggests tasks for preparation, study, and other calendar-based activities.
 */

import type { CalendarEvent } from '../types';

export interface TaskSuggestion {
  id: string;
  eventId: string;
  title: string;
  description: string;
  taskTitle: string;
  dueDate: string; // ISO date
  category: string;
  actionLabel: string;
  icon: string;
}

/**
 * Generate task suggestions from upcoming calendar events.
 * Only creates suggestions for real events, not demo events.
 */
export function generateTaskSuggestionsFromEvents(
  events: CalendarEvent[]
): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];
  const now = new Date();
  const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

  for (const event of events) {
    // Skip demo events
    if (event.source === 'demo') continue;

    const eventDateTime = new Date(`${event.date}T${event.startTime}`);

    // Only suggest for future events within next 2 weeks
    if (eventDateTime < now || eventDateTime > twoWeeksAhead) continue;

    const suggestion = generateSuggestionForEvent(event);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  // Deduplicate by event ID (only one suggestion per event)
  const uniqueMap = new Map<string, TaskSuggestion>();
  for (const suggestion of suggestions) {
    if (!uniqueMap.has(suggestion.eventId)) {
      uniqueMap.set(suggestion.eventId, suggestion);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Generate a single task suggestion for an event.
 */
function generateSuggestionForEvent(event: CalendarEvent): TaskSuggestion | null {
  const eventTitle = event.title.toLowerCase();
  const eventDate = new Date(`${event.date}T${event.startTime}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate due date (day before event, or today if event is today/tomorrow)
  let dueDate = new Date(eventDate);
  dueDate.setDate(dueDate.getDate() - 1);
  dueDate.setHours(0, 0, 0, 0);
  if (dueDate < today) {
    dueDate = new Date(today);
  }
  const dueDateStr = dueDate.toISOString().split('T')[0];

  // Work/Shift events
  if (eventTitle.includes('משמרת') || eventTitle.includes('עבודה') || event.category === 'work') {
    if (eventTitle.includes('משמרת') || eventTitle.includes('shift')) {
      return {
        id: `suggestion-${event.id}`,
        eventId: event.id,
        title: 'להתכונן למשמרת',
        description: 'יש לך משמרת קרובה. כדאי להכין אוכל, בגדים ולבדוק זמן יציאה.',
        taskTitle: 'הכנה למשמרת',
        dueDate: dueDateStr,
        category: 'עבודה',
        actionLabel: 'הוסף למשימות שלי',
        icon: '💼',
      };
    }

    return {
      id: `suggestion-${event.id}`,
      eventId: event.id,
      title: 'להתכונן לאירוע עבודה',
      description: `יש לך "${event.title}" בלוח הזמנים. כדאי להיערך מראש.`,
      taskTitle: `הכנה ל-${event.title}`,
      dueDate: dueDateStr,
      category: 'עבודה',
      actionLabel: 'הוסף למשימות שלי',
      icon: '💼',
    };
  }

  // Academic - Exam/Test
  if (
    eventTitle.includes('מבחן') ||
    eventTitle.includes('בחינה') ||
    event.category === 'exam'
  ) {
    return {
      id: `suggestion-${event.id}`,
      eventId: event.id,
      title: 'להתכונן לבחינה',
      description: 'יש בחינה קרובה בלוח הזמנים. כדאי לפתוח משימת חזרה מסודרת.',
      taskTitle: `חזרה לבחינה: ${event.title}`,
      dueDate: dueDateStr,
      category: 'אקדמי',
      actionLabel: 'הוסף למשימות שלי',
      icon: '📝',
    };
  }

  // Academic - Lesson/Lecture
  if (
    eventTitle.includes('שיעור') ||
    eventTitle.includes('הרצאה') ||
    eventTitle.includes('קורס') ||
    eventTitle.includes('תרגול') ||
    event.category === 'academic'
  ) {
    return {
      id: `suggestion-${event.id}`,
      eventId: event.id,
      title: 'להגיע מוכנה לשיעור',
      description: 'יש לך שיעור קרוב. כדאי לעבור על החומר הקודם ולהכין שאלות.',
      taskTitle: `מעבר על חומר לפני ${event.title}`,
      dueDate: dueDateStr,
      category: 'אקדמי',
      actionLabel: 'הוסף למשימות שלי',
      icon: '📚',
    };
  }

  // Submission/Deadline
  if (
    eventTitle.includes('הגשה') ||
    eventTitle.includes('עבודה להגשה') ||
    eventTitle.includes('deadline')
  ) {
    return {
      id: `suggestion-${event.id}`,
      eventId: event.id,
      title: 'הגשה קרובה',
      description: 'יש הגשה קרובה בלוח הזמנים. אפשר להוסיף משימה כדי לא לשכוח.',
      taskTitle: `השלמת הגשה: ${event.title}`,
      dueDate: dueDateStr,
      category: 'אקדמי',
      actionLabel: 'הוסף למשימות שלי',
      icon: '📎',
    };
  }

  // Meeting
  if (event.category === 'meeting') {
    return {
      id: `suggestion-${event.id}`,
      eventId: event.id,
      title: 'להתכונן לפגישה',
      description: `יש לך פגישה קרובה: "${event.title}". כדאי להכין נושאים וחומרים.`,
      taskTitle: `הכנה לפגישה: ${event.title}`,
      dueDate: dueDateStr,
      category: 'עבודה',
      actionLabel: 'הוסף למשימות שלי',
      icon: '🤝',
    };
  }

  return null;
}
