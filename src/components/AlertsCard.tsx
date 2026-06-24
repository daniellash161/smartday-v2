import { useState, useMemo } from 'react';
import type { Alert, Task, CalendarEvent } from '../types';
import { priorityColor } from '../utils/priority';
import { generateSmartAlerts, planTasksToTasks } from '../utils/alertGenerator';

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
  addedState: 'none' | 'single' | 'plan';
  onDismiss: (id: string) => void;
  onAddTask: (alert: Alert) => void;
  onAddPlan: (alert: Alert) => void;
  onMarkHandled: (id: string) => void;
}

const AlertItem = ({ alert, addedState, onDismiss, onAddTask, onAddPlan, onMarkHandled }: AlertItemProps) => {
  const color = priorityColor[alert.urgency];
  const sourceLabel = alert.source ? sourceTagLabel[alert.source] : null;
  const hasPlan = alert.planTasks && alert.planTasks.length > 0;

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
          {addedState === 'none' ? (
            <>
              {/* If there are plan tasks, primary = plan button */}
              {hasPlan ? (
                <button
                  className="alert-action-btn alert-action-btn--plan"
                  onClick={() => onAddPlan(alert)}
                >
                  📅 תכנן לוז ({alert.planTasks!.length} משימות)
                </button>
              ) : null}
              {/* Secondary / only button: add single task */}
              <button
                className={`alert-action-btn ${hasPlan ? 'alert-action-btn--add-secondary' : 'alert-action-btn--add'}`}
                style={!hasPlan ? { color } : undefined}
                onClick={() => onAddTask(alert)}
              >
                הוסף למשימות
              </button>
            </>
          ) : addedState === 'plan' ? (
            <button className="alert-action-btn alert-action-btn--done" disabled>
              לוז תוכנן ✓
            </button>
          ) : (
            <button className="alert-action-btn alert-action-btn--done" disabled>
              נוסף למשימות ✓
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
  onAddTasks?: (tasks: Omit<Task, 'id'>[]) => void;
  existingTaskTitles?: Set<string>;
}

const AlertsCard = ({
  calendarEvents = [],
  tasks = [],
  onAddTask,
  onAddTasks,
  existingTaskTitles = new Set(),
}: AlertsCardProps) => {
  const generatedAlerts = useMemo(
    () => generateSmartAlerts(calendarEvents, tasks),
    [calendarEvents, tasks],
  );

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [addedAlertIds, setAddedAlertIds] = useState<Map<string, 'single' | 'plan'>>(new Map());
  const [confirmation, setConfirmation] = useState('');

  const activeAlerts = generatedAlerts.filter(
    a => !dismissedIds.has(a.id) && !handledIds.has(a.id)
  );

  const dismiss = (id: string) => setDismissedIds(prev => new Set(prev).add(id));
  const markHandled = (id: string) => setHandledIds(prev => new Set(prev).add(id));

  const showConfirmation = (msg: string) => {
    setConfirmation(msg);
    setTimeout(() => setConfirmation(''), 2500);
  };

  const handleAddTask = (alert: Alert) => {
    if (!onAddTask) return;
    const taskTitle = alert.suggestedAction ?? alert.title;
    if (addedAlertIds.has(alert.id) || existingTaskTitles.has(taskTitle)) {
      showConfirmation('ההתראה כבר נוספה למשימות');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
    let score = alert.urgency === 'high' ? 90 : alert.urgency === 'medium' ? 60 : 30;
    if (alert.dueDate && (alert.dueDate === today || alert.dueDate === tomorrow)) score = Math.min(score + 10, 100);

    onAddTask({
      title: taskTitle,
      description: `${alert.title}: ${alert.description}`,
      category: alert.source === 'payments' ? 'payment' : 'personal',
      urgency: alert.urgency as any,
      priority: alert.urgency as 'high' | 'medium' | 'low',
      dueDate: alert.dueDate ?? today,
      completed: false,
      status: 'open',
      source: 'smart-alert',
      priorityScore: score,
      originalAlertId: alert.id,
      reason: alert.reason ?? alert.title,
    });

    setAddedAlertIds(prev => new Map(prev).set(alert.id, 'single'));
    showConfirmation('ההתראה נוספה למשימות לפי רמת דחיפות');
  };

  const handleAddPlan = (alert: Alert) => {
    if (!alert.planTasks || !alert.dueDate) return;
    if (addedAlertIds.has(alert.id)) {
      showConfirmation('הלוז כבר תוכנן');
      return;
    }
    const taskObjects = planTasksToTasks(alert.planTasks, alert.dueDate);
    const toAdd = taskObjects.filter(t => !existingTaskTitles.has(t.title));

    if (toAdd.length === 0) {
      showConfirmation('המשימות כבר קיימות');
      return;
    }

    const addFn = onAddTasks ?? (ts => ts.forEach(t => onAddTask?.({
      ...t,
      description: alert.title,
      category: 'personal',
      completed: false,
      status: 'open',
      source: 'smart-alert',
      originalAlertId: alert.id,
    })));

    addFn(toAdd.map(t => ({
      ...t,
      description: alert.title,
      category: 'personal',
      completed: false,
      status: 'open' as const,
      source: 'smart-alert',
      originalAlertId: alert.id,
    })));

    setAddedAlertIds(prev => new Map(prev).set(alert.id, 'plan'));
    showConfirmation(`לוז תוכנן — נוספו ${toAdd.length} משימות לפי תאריכים`);
  };

  if (activeAlerts.length === 0) {
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
          <span className="badge badge-red">{activeAlerts.length}</span>
        </div>
      </div>
      {confirmation && <div className="alertsConfirmation">{confirmation}</div>}
      <div className="alert-list">
        {activeAlerts.map(a => (
          <AlertItem
            key={a.id}
            alert={a}
            addedState={addedAlertIds.get(a.id) ?? 'none'}
            onDismiss={dismiss}
            onAddTask={handleAddTask}
            onAddPlan={handleAddPlan}
            onMarkHandled={markHandled}
          />
        ))}
      </div>
    </div>
  );
};

export default AlertsCard;
