import { useState } from 'react';
import type { Task } from '../types';
import { sortByPriority, priorityLabel, priorityColor, formatDate, isToday, isTomorrow } from '../utils/priority';

// ─────────────────────────────────────────────────────────────────────────────
// Inline Edit Row
// ─────────────────────────────────────────────────────────────────────────────

interface EditRowProps {
  task: Task;
  onSave: (id: string, patch: Partial<Task>) => void;
  onCancel: () => void;
}

const PRIORITY_OPTIONS: { value: Task['priority']; label: string }[] = [
  { value: 'high',   label: 'דחוף' },
  { value: 'medium', label: 'בינוני' },
  { value: 'low',    label: 'רגיל' },
];

const EditRow = ({ task, onSave, onCancel }: EditRowProps) => {
  const [title,    setTitle]    = useState(task.title);
  const [dueDate,  setDueDate]  = useState(task.dueDate ?? task.deadlineDate ?? '');
  const [priority, setPriority] = useState<Task['priority']>(task.priority ?? 'medium');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(task.id, {
      title: title.trim(),
      dueDate,
      deadlineDate: dueDate,
      priority,
      urgency: priority as any,
    });
  };

  return (
    <div className="tl-edit-row">
      <input
        className="tl-edit-title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        autoFocus
        placeholder="שם המשימה"
      />
      <div className="tl-edit-meta">
        <input
          type="date"
          className="tl-edit-date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
        />
        <select
          className="tl-edit-priority"
          value={priority}
          onChange={e => setPriority(e.target.value as Task['priority'])}
        >
          {PRIORITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button className="tl-edit-save" onClick={handleSave}>שמור</button>
        <button className="tl-edit-cancel" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Task Item Component
// ─────────────────────────────────────────────────────────────────────────────

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit:   (id: string, patch: Partial<Task>) => void;
}

const TaskItem = ({ task, onToggle, onDelete, onEdit }: TaskItemProps) => {
  const [editing, setEditing] = useState(false);
  const color = priorityColor[task.priority];
  const label = priorityLabel[task.priority];

  const dueDateLabel = isToday(task.dueDate)
    ? 'היום'
    : isTomorrow(task.dueDate)
    ? 'מחר'
    : formatDate(task.dueDate);

  if (editing) {
    return (
      <EditRow
        task={task}
        onSave={(id, patch) => { onEdit(id, patch); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className={`tl-task-item ${task.completed ? 'tl-task-done' : ''}`}>
      <button
        className={`tl-task-checkbox ${task.completed ? 'tl-checked' : ''}`}
        onClick={() => onToggle(task.id)}
        aria-label="סמן כבוצע"
      >
        {task.completed ? '✓' : ''}
      </button>

      <div className="tl-task-content">
        <span className={`tl-task-title ${task.completed ? 'tl-task-title-done' : ''}`}>
          {task.title}
        </span>
        {task.description && <p className="tl-task-desc">{task.description}</p>}
      </div>

      <div className="tl-task-meta">
        <span className="tl-task-priority" style={{ background: color + '22', color }}>
          {label}
        </span>
        <span className="tl-task-date">{dueDateLabel}</span>
        {!task.completed && (
          <button
            className="tl-task-action tl-task-edit"
            onClick={() => setEditing(true)}
            title="ערוך"
          >
            ✏️
          </button>
        )}
        {task.completed && (
          <button
            className="tl-task-action tl-task-delete"
            onClick={() => onDelete(task.id)}
            title="מחק"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main TaskList Component
// ─────────────────────────────────────────────────────────────────────────────

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit:   (id: string, patch: Partial<Task>) => void;
}

type FilterType = 'all' | 'today' | 'urgent' | 'in-progress' | 'done';

const TaskList = ({ tasks, onToggle, onDelete, onEdit }: TaskListProps) => {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');

  const urgentCount = tasks.filter(t =>
    !t.completed && (t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical')
  ).length;
  const todayCount = tasks.filter(t =>
    !t.completed && (isToday(t.dueDate) || isToday(t.deadlineDate ?? ''))
  ).length;
  const doneCount = tasks.filter(t => t.completed || t.status === 'done').length;

  const getBase = (): Task[] => {
    if (selectedFilter === 'today')       return tasks.filter(t => !t.completed && (isToday(t.dueDate) || isToday(t.deadlineDate ?? '')));
    if (selectedFilter === 'urgent')      return tasks.filter(t => !t.completed && (t.priority === 'high' || t.urgency === 'high' || t.urgency === 'urgent'));
    if (selectedFilter === 'in-progress') return tasks.filter(t => !t.completed);
    if (selectedFilter === 'done')        return tasks.filter(t => t.completed);
    return tasks;
  };
  const filteredTasks = sortByPriority(getBase());

  return (
    <div className="tl-card">
      {/* Header */}
      <div className="tl-header">
        <div className="tl-header-content">
          <h2 className="tl-title">משימות ✅</h2>
          <p className="tl-subtitle">המשימות שלך מסודרות לפי דחיפות ודדליין</p>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="tl-summary-strip">
        <div className="tl-stat-col tl-stat-total">
          <span className="tl-stat-number">{tasks.length}</span>
          <span className="tl-stat-label">סה״כ</span>
        </div>
        <div className="tl-stat-col tl-stat-urgent">
          <span className="tl-stat-number">{urgentCount}</span>
          <span className="tl-stat-label">דחופות</span>
        </div>
        <div className="tl-stat-col tl-stat-today">
          <span className="tl-stat-number">{todayCount}</span>
          <span className="tl-stat-label">להיום</span>
        </div>
        <div className="tl-stat-col tl-stat-done">
          <span className="tl-stat-number">{doneCount}</span>
          <span className="tl-stat-label">הושלמו</span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="tl-filters">
        {([
          ['all', 'הכל'],
          ['today', 'היום'],
          ['urgent', 'דחופות'],
          ['in-progress', 'בתהליך'],
          ['done', 'הושלמו'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            className={`tl-filter-chip ${selectedFilter === val ? 'tl-filter-active' : ''}`}
            onClick={() => setSelectedFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="tl-task-list">
        {filteredTasks.length === 0 ? (
          <div className="tl-empty-state">אין משימות בסינון הנבחר.</div>
        ) : (
          filteredTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TaskList;
