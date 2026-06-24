export type Priority = 'high' | 'medium' | 'low';

export type AlertType = 'payment' | 'deadline' | 'reminder' | 'email';

export type EventCategory = 'academic' | 'work' | 'personal' | 'meeting' | 'exam' | 'holiday';
export type EventImportance = 'normal' | 'important' | 'urgent';
export type EventSource = 'demo' | 'manual' | 'googleCalendar' | 'appleCalendar' | 'gmail';

export type TaskUrgency = 'low' | 'medium' | 'high' | 'critical' | 'urgent';
export type TaskCategory = 'work' | 'personal' | 'shopping' | 'health' | 'education' | 'לוח זמנים' | string;
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled' | 'open' | 'handled' | 'ignored';

export type EmailCategory = 'academic' | 'work' | 'payment' | 'meeting' | 'personal' | 'other';
export type EmailImportance = 'urgent' | 'high' | 'medium' | 'low';
export type EmailStatus = 'unread' | 'read' | 'archived' | 'starred' | 'handled' | 'ignored';
export type EmailAction = 'read' | 'archive' | 'delete' | 'star' | 'reviewOnly' | 'addTask' | 'addEvent';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate: string; // ISO date string
  completed: boolean;
  category: string;
  createdAt?: string;
  urgency?: TaskUrgency;
  deadlineDate?: string;
  deadlineTime?: string;
  status?: TaskStatus;
  source?: string;
  priorityScore?: number;
  originalEmailId?: string;
  originalAlertId?: string;
  reason?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;       // ISO date string YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime?: string;   // HH:MM
  location?: string;
  category: EventCategory;
  importance: EventImportance;
  source: EventSource;
  allDay?: boolean;
  calendarName?: string;
}

export interface AlertPlanTask {
  title: string;
  daysBeforeEvent: number;
  urgency: 'high' | 'medium' | 'low';
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  type: AlertType;
  urgency: Priority;
  actionLabel?: string;
  suggestedAction?: string;
  source?: string;
  sourceTag?: string;
  dueDate?: string;
  priorityScore?: number;
  reason?: string;
  planTasks?: AlertPlanTask[];
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface ImportantEmail {
  id: string;
  from?: string;
  senderName?: string;
  senderEmail?: string;
  subject: string;
  preview?: string;
  snippet?: string;
  date?: string;
  receivedAt?: string;
  category: EmailCategory;
  importance: EmailImportance;
  status: EmailStatus;
  hasAttachments?: boolean;
  recommendedAction?: string;
  source?: string;
  reason?: string;
}
