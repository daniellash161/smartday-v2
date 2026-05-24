export type Priority = 'high' | 'medium' | 'low';

export type AlertType = 'payment' | 'deadline' | 'reminder' | 'email';

export type EventCategory = 'academic' | 'work' | 'personal' | 'meeting' | 'exam' | 'holiday';
export type EventImportance = 'normal' | 'important' | 'urgent';
export type EventSource = 'demo' | 'manual' | 'googleCalendar';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate: string; // ISO date string
  completed: boolean;
  category: string;
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
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  type: AlertType;
  urgency: Priority;
  actionLabel?: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}
