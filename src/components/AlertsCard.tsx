import { useState } from 'react';
import type { Alert } from '../types';
import { mockAlerts } from '../data/mockData';
import { priorityColor } from '../utils/priority';

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

const AlertsCard = () => {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);

  const dismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  if (alerts.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="card-icon">🔔</span>
            <h2 className="card-title">התראות חכמות</h2>
          </div>
        </div>
        <p className="empty-state">✅ אין התראות פתוחות — הכל תקין!</p>
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
