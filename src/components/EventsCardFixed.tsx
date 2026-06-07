import { useState } from 'react';
import type { CalendarEvent, EventCategory } from '../types';

interface EventsCardFixedProps {
  onAddTasks?: (tasks: any[]) => void;
  existingTaskTitles?: Set<string>;
  manualEvents?: CalendarEvent[];
  onAddManualEvent?: (event: any) => void;
}

const EventsCardFixed = ({
  onAddManualEvent,
  manualEvents = [],
}: EventsCardFixedProps) => {
  const [calendarSource] = useState<'google' | 'apple'>('apple');

  // Simple display of manual events
  const todayEvents = (manualEvents || []).filter(e => {
    const today = new Date().toISOString().split('T')[0];
    return e.date === today;
  });

  const tomorrowEvents = (manualEvents || []).filter(e => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    return e.date === tomorrow;
  });

  return (
    <div className="events-card">
      <div className="events-header">
        <div className="events-header-section">
          <h2 className="events-title">📅 לוח הזמנים</h2>
          <button className="events-source-btn">
            {calendarSource === 'google' ? '🔗 Google Calendar' : '🍎 Apple Calendar'}
          </button>
        </div>
      </div>

      <div className="sched-body">
        {/* Today Section */}
        <div className="sched-day-section">
          <div className="sched-day-header">
            <span className="sched-day-label">היום</span>
            <span className="sched-day-count">{todayEvents.length} אירועים</span>
          </div>
          <div className="sched-day-grid">
            {todayEvents.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
                אין אירועים היום
              </div>
            ) : (
              todayEvents.map(event => (
                <div key={event.id} className="sched-cat-box" style={{ borderTopColor: '#3FAFA3' }}>
                  <div className="sched-event-top">
                    <span className="sched-event-title">{event.title}</span>
                  </div>
                  <div className="sched-event-meta">
                    <span>{event.startTime}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tomorrow Section */}
        <div className="sched-day-section">
          <div className="sched-day-header">
            <span className="sched-day-label">מחר</span>
            <span className="sched-day-count">{tomorrowEvents.length} אירועים</span>
          </div>
          <div className="sched-day-grid">
            {tomorrowEvents.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
                אין אירועים מחר
              </div>
            ) : (
              tomorrowEvents.map(event => (
                <div key={event.id} className="sched-cat-box" style={{ borderTopColor: '#3FAFA3' }}>
                  <div className="sched-event-top">
                    <span className="sched-event-title">{event.title}</span>
                  </div>
                  <div className="sched-event-meta">
                    <span>{event.startTime}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add event button */}
      <div style={{ padding: '0 24px 18px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            onAddManualEvent?.({
              date: today,
              startTime: '10:00',
              title: 'אירוע חדש',
              category: 'work' as EventCategory
            });
          }}
          className="events-gcal-btn"
        >
          + הוסף אירוע
        </button>
      </div>
    </div>
  );
};

export default EventsCardFixed;
