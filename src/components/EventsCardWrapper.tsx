import { Suspense } from 'react';
import EventsCard from './EventsCard';
import type { Task, CalendarEvent } from '../types';

interface EventsCardWrapperProps {
  events?: any[];
  onAddTasks?: (tasks: any[]) => void;
  existingTaskTitles?: Set<string>;
  manualEvents?: CalendarEvent[];
  onAddManualEvent?: (event: any) => void;
}

export default function EventsCardWrapper(props: EventsCardWrapperProps) {
  return (
    <Suspense fallback={
      <div style={{
        background: '#f0f7fb',
        border: '2px solid #7DB7E8',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#0F2440' }}>📅 לוח הזמנים</h3>
        <p style={{ color: '#6B7280' }}>טוען...</p>
      </div>
    }>
      <EventsCard {...props} />
    </Suspense>
  );
}
