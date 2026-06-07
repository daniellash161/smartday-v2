import { useState, useMemo } from 'react';
import type { Alert, CalendarEvent } from '../types';
import { mockAlerts } from '../data/mockData';
import { priorityColor } from '../utils/priority';
import { generateSmartAlertsFromEvents } from '../utils/alertGenerator';

const alertTypeIcon: Record<Alert['type'], string> = {
  payment: '💳',
  deadline: '⏰',
  reminder: '🔔',
  email: '📧',
};

const AlertItem = ({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) => {
  const color = priorityColor[alert.urgency];
  return (
    <div className="alert-item" style={{ borderRightColor: color }}>
      <div className="alert-icon">{alertTypeIcon[alert.type]}</div>
      <div className="alert-info">
        <span className="alert-title">{alert.title}</span>
        <span className="alert-desc">{alert.description}</span>
        {alert.actionLabel && (
          <button className="alert-action-btn" style={{ color }}>
            {alert.actionLabel} ←
          </button>
        )}
      </div>
      <button className="alert-dismiss" onClick={() => onDismiss(alert.id)} aria-label="סגור">
        ✕
      </button>
    </div>
  );
};

interface AlertsCardProps {
  calendarEvents?: CalendarEvent[];
}

const AlertsCard = ({ calendarEvents = [] }: AlertsCardProps) => {
  // Generate smart alerts from real calendar events
  const generatedAlerts = useMemo(
    () => generateSmartAlertsFromEvents(calendarEvents),
    [calendarEvents],
  );

  // Use mockAlerts as fallback only if no real alerts exist
  const initialAlerts = generatedAlerts.length > 0 ? generatedAlerts : [];
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter out dismissed alerts
  const alerts = initialAlerts.filter(a => !dismissedIds.has(a.id));

  const dismiss = (id: string) => setDismissedIds((prev) => new Set(prev).add(id));

  if (alerts.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="card-icon">🔔</span>
            <h2 className="card-title">התראות חכמות</h2>
          </div>
        </div>
        <p className="empty-state">✅ אין התראות דחופות כרגע.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon">🔔</span>
          <h2 className="card-title">התראות חכמות</h2>
          <span className="badge badge-red">{alerts.length}</span>
        </div>
      </div>
      <div className="alert-list">
        {alerts.map((a) => (
          <AlertItem key={a.id} alert={a} onDismiss={dismiss} />
        ))}
      </div>
    </div>
  );
};

export default AlertsCard;
