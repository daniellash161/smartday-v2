import { useState, useMemo } from 'react';
import type { Alert, Task, CalendarEvent } from '../types';
import { priorityColor } from '../utils/priority';
import { generateSmartAlerts } from '../utils/alertGenerator';

const alertTypeIcon: Record<Alert['type'], string> = {
  payment: '💳',
  deadline: '⏰',
  reminder: '🔔',
  email: '📧',
};

const sourceTagLabel: Record<string, string> = {
  calendar: 'יומן',
  tasks: 'משימות',
  email: 'מייל',
  payments: 'תשלומים',
  morning: 'עדכוני בוקר',
  system: 'מערכת',
};

interface AlertItemProps {
  alert: Alert;
  alreadyAdded: boolean;
  onDismiss: (id: string) => void;
  onAddTask: (alert: Alert) => void;
  onMarkHandled: (id: string) => void;
}

const AlertItem = ({ alert, alreadyAdded, onDismiss, onAddTask, onMarkHandled }: AlertItemProps) => {
  const color = priorityColor[alert.urgency];
  const sourceLabel = alert.source ? sourceTagLabel[alert.source] : null;
  return (
    <div className="alert-item" style={{ borderRightColor: color }}>
      <div className="alert-icon">{alertTypeIcon[alert.type]}</div>
      <div className="alert-info">
        <div className="alert-title-row">
          <span className="alert-title">{alert.title}</span>
          {sourceLabel && <span className="alert-source-tag">{sourceLabel}</span>}
        </div>
        <span className="alert-desc">{alert.description}</span>
        {alert.reason && <span className="alert-reason">🔍 {alert.reason}</span>}
        <div className="alert-actions-row">
          {alreadyAdded ? (
            <button className="alert-action-btn alert-action-btn--done" disabled>
              נוסף למשימות ✓
            </button>
          ) : (
            <button
              className="alert-action-btn alert-action-btn--add"
              style={{ color }}
              onClick={() => onAddTask(alert)}
            >
              הוסף למשימות
            </button>
          )}
          <button
            className="alert-action-btn alert-action-btn--handled"
            onClick={() => onMarkHandled(alert.id)}
          >
            סמן כטופל
          </button>
        </div>
      </div>
      <button className="alert-dismiss" onClick={() => onDismiss(alert.id)} aria-label="סגור">
        ✕
      </button>
    </div>
  );
};

interface AlertsCardProps {
  calendarEvents?: CalendarEvent[];
  tasks?: Task[];
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  existingTaskTitles?: Set<string>;
}

const AlertsCard = ({
  calendarEvents = [],
  tasks = [],
  onAddTask,
  existingTaskTitles = new Set(),
}: AlertsCardProps) => {
  const generatedAlerts = useMemo(
    () => generateSmartAlerts(calendarEvents, tasks),
    [calendarEvents, tasks],
  );

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [addedAlertIds, setAddedAlertIds] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState('');

  const alerts = generatedAlerts.filter(
    a => !dismissedIds.has(a.id) && !handledIds.has(a.id)
  );

  const dismiss = (id: string) => setDismissedIds(prev => new Set(prev).add(id));
  const markHandled = (id: string) => setHandledIds(prev => new Set(prev).add(id));

  const handleAddTask = (alert: Alert) => {
    if (!onAddTask) return;
    const taskTitle = alert.suggestedAction ?? alert.title;
    if (addedAlertIds.has(alert.id) || existingTaskTitles.has(taskTitle)) {
      setConfirmation('ההתראה כבר נוספה למשימות');
      setTimeout(() => setConfirmation(''), 2000);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();

    let score = alert.priorityScore
      ?? (alert.urgency === 'high' ? 90 : alert.urgency === 'medium' ? 60 : 30);

    if (alert.dueDate && (alert.dueDate === today || alert.dueDate === tomorrow)) score = Math.min(score + 10, 100);

    onAddTask({
      title: taskTitle,
      description: `${alert.title}: ${alert.description}`,
      category: alert.source === 'payments' ? 'payment' : 'personal',
      urgency: alert.urgency === 'high' ? 'high' : alert.urgency === 'medium' ? 'medium' : 'low',
      priority: alert.urgency as 'high' | 'medium' | 'low',
      dueDate: alert.dueDate ?? today,
      completed: false,
      status: 'open',
      source: 'smart-alert',
      priorityScore: score,
      originalAlertId: alert.id,
      reason: alert.reason ?? alert.title,
    });

    setAddedAlertIds(prev => new Set(prev).add(alert.id));
    setConfirmation('ההתראה נוספה למשימות לפי רמת דחיפות');
    setTimeout(() => setConfirmation(''), 2500);
  };

  if (alerts.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="card-icon">🔔</span>
            <h2 className="card-title">התראות חכמות</h2>
          </div>
        </div>
        <p className="empty-state">אין התראות חכמות כרגע</p>
        <p className="empty-state-sub">ככל שתחברי יותר מקורות מידע, SmartDay תוכל להציע פעולות מדויקות יותר.</p>
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
      {confirmation && <div className="alertsConfirmation">{confirmation}</div>}
      <div className="alert-list">
        {alerts.map(a => (
          <AlertItem
            key={a.id}
            alert={a}
            alreadyAdded={addedAlertIds.has(a.id) || existingTaskTitles.has(a.suggestedAction ?? a.title)}
            onDismiss={dismiss}
            onAddTask={handleAddTask}
            onMarkHandled={markHandled}
          />
        ))}
      </div>
    </div>
  );
};

export default AlertsCard;
