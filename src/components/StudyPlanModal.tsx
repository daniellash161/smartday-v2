// @ts-nocheck
import { useState } from 'react';
import type { Alert, Task } from '../types';
import { planTasksToTasks } from '../utils/alertGenerator';

interface EditableTask {
  title: string;
  dueDate: string;
  urgency: 'high' | 'medium' | 'low';
  priority: 'high' | 'medium' | 'low';
  priorityScore: number;
  enabled: boolean;
}

interface StudyPlanModalProps {
  alert: Alert;
  onClose: () => void;
  onConfirm: (tasks: Omit<Task, 'id' | 'createdAt'>[], alertId: string) => void;
  existingTaskTitles: Set<string>;
}

function formatDateHebrew(d: string): string {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

const urgencyLabel: Record<string, string> = {
  high: 'דחוף', medium: 'בינוני', low: 'רגיל',
};
const urgencyColor: Record<string, string> = {
  high: '#e8738f', medium: '#f4c76b', low: '#7ec98f',
};

const StudyPlanModal = ({ alert, onClose, onConfirm, existingTaskTitles }: StudyPlanModalProps) => {
  // Build initial editable tasks from planTasks
  const initial: EditableTask[] = alert.planTasks
    ? planTasksToTasks(alert.planTasks, alert.dueDate ?? new Date().toISOString().split('T')[0]).map(t => ({
        ...t,
        enabled: true,
      }))
    : [];

  const [tasks, setTasks] = useState<EditableTask[]>(initial);

  const updateTask = (i: number, field: keyof EditableTask, value: string | boolean) => {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  };

  const enabledCount = tasks.filter(t => t.enabled).length;

  const handleConfirm = () => {
    const toAdd = tasks
      .filter(t => t.enabled && t.title.trim())
      .map(t => ({
        title: t.title.trim(),
        description: alert.title,
        category: 'personal',
        urgency: t.urgency,
        priority: t.priority,
        dueDate: t.dueDate,
        deadlineDate: t.dueDate,
        completed: false,
        status: 'open' as const,
        source: 'study-plan',
        priorityScore: t.priorityScore,
        originalAlertId: alert.id,
        reason: alert.title,
      }));
    onConfirm(toAdd, alert.id);
    onClose();
  };

  return (
    <div
      className="spm-overlay"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="spm-panel">
        {/* Header */}
        <header className="spm-header">
          <div>
            <h2>📅 תכנון לוז</h2>
            <p>{alert.title}</p>
          </div>
          <button className="spm-close" onClick={onClose} aria-label="סגור">×</button>
        </header>

        <div className="spm-body">
          <p className="spm-intro">
            SmartDay הציע את הלוז הבא. ערכי כל משימה לפי הצורך ולחצי ״שמור לוז״.
          </p>

          <div className="spm-task-list">
            {tasks.map((t, i) => (
              <div key={i} className={`spm-task-row ${!t.enabled ? 'spm-task-row--disabled' : ''}`}>
                <input
                  type="checkbox"
                  className="spm-checkbox"
                  checked={t.enabled}
                  onChange={e => updateTask(i, 'enabled', e.target.checked)}
                />
                <div className="spm-task-fields">
                  <input
                    className="spm-task-title"
                    type="text"
                    value={t.title}
                    onChange={e => updateTask(i, 'title', e.target.value)}
                    disabled={!t.enabled}
                    placeholder="שם המשימה"
                  />
                  <div className="spm-task-meta-row">
                    <input
                      className="spm-task-date"
                      type="date"
                      value={t.dueDate}
                      onChange={e => updateTask(i, 'dueDate', e.target.value)}
                      disabled={!t.enabled}
                    />
                    <span
                      className="spm-urgency-badge"
                      style={{ background: urgencyColor[t.urgency] + '22', color: urgencyColor[t.urgency] }}
                    >
                      {urgencyLabel[t.urgency]}
                    </span>
                    <span className="spm-date-label">{formatDateHebrew(t.dueDate)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {tasks.length === 0 && (
            <p className="spm-empty">לא נמצאו משימות לתכנון.</p>
          )}
        </div>

        <footer className="spm-footer">
          <button className="spm-btn-cancel" onClick={onClose}>ביטול</button>
          <button
            className="spm-btn-confirm"
            onClick={handleConfirm}
            disabled={enabledCount === 0}
          >
            שמור לוז ({enabledCount} משימות)
          </button>
        </footer>
      </div>
    </div>
  );
};

export default StudyPlanModal;
