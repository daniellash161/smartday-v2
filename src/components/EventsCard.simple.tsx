import type { Task, CalendarEvent, EventCategory } from '../types';

interface EventsCardProps {
  events?: any[];
  onAddTasks?: (tasks: any[]) => void;
  existingTaskTitles?: Set<string>;
  manualEvents?: CalendarEvent[];
  onAddManualEvent?: (event: any) => void;
}

const EventsCard = ({ onAddManualEvent }: EventsCardProps) => {
  return (
    <div style={{
      background: '#f0f7fb',
      border: '2px solid #7DB7E8',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#0F2440', marginBottom: '12px' }}>📅 לוח הזמנים</h3>
      <p style={{ color: '#6B7280', marginBottom: '12px' }}>
        לוח הזמנים זמין בגרסה מלאה
      </p>
      <button
        onClick={() => onAddManualEvent?.({ date: new Date().toISOString().split('T')[0], startTime: '10:00', title: 'אירוע חדש', category: 'work' as EventCategory })}
        style={{
          padding: '8px 16px',
          background: '#3FAFA3',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600'
        }}
      >
        + הוסף אירוע
      </button>
    </div>
  );
};

export default EventsCard;
