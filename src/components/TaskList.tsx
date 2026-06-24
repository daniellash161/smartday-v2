import { useState } from 'react';
import type { Task } from '../types';
import { sortByPriority, priorityLabel, priorityColor, formatDate, isToday, isTomorrow } from '../utils/priority';

// ─────────────────────────────────────────────────────────────────────────────
// Task Item Component
// ─────────────────────────────────────────────────────────────────────────────

const TaskItem = ({ task, onToggle, onDelete }: { task: Task; onToggle: (id: string) => void; onDelete: (id: string) => void }) => {
  const color = priorityColor[task.priority];
  const label = priorityLabel[task.priority];

  const dueDateLabel = isToday(task.dueDate)
    ? 'היום'
    : isTomorrow(task.dueDate)
    ? 'מחר'
    : formatDate(task.dueDate);

  return (
    <div className={`tl-task-item ${task.completed ? 'tl-task-done' : ''}`}>
      <button
        className={`tl-task-checkbox ${task.completed ? 'tl-checked' : ''}`}
        onClick={() => onToggle(task.id)}
        aria-label="סמן כבוצע"
        title={task.completed ? 'בוצע' : 'לא בוצע'}
      >
        {task.completed ? '✓' : ''}
      </button>

      <div className="tl-task-content">
        <div className="tl-task-title-row">
          <span className={`tl-task-title ${task.completed ? 'tl-task-title-done' : ''}`}>
            {task.title}
          </span>
        </div>
        {task.description && <p className="tl-task-desc">{task.description}</p>}
      </div>

      <div className="tl-task-meta">
        <span className="tl-task-priority" style={{ background: color + '22', color }}>
          {label}
        </span>
        <span className="tl-task-category">{task.category}</span>
        <span className="tl-task-date">{dueDateLabel}</span>
        {task.completed && (
          <button
            className="tl-task-delete"
            onClick={() => onDelete(task.id)}
            title="מחק משימה"
            aria-label="מחק"
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
}

type FilterType = 'all' | 'today' | 'urgent' | 'in-progress' | 'done' | 'smart';

const TaskList = ({ tasks, onToggle, onDelete }: TaskListProps) => {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');

  const allCount = tasks.length;
  const urgentCount = tasks.filter((t) =>
    !t.completed && (
      t.priority === 'high' ||
      t.urgency === 'high' || t.urgency === 'urgent' || t.urgency === 'critical'
    )
  ).length;
  const todayCount = tasks.filter((t) =>
    !t.completed && (isToday(t.dueDate) || isToday(t.deadlineDate ?? ''))
  ).length;
  const doneCount = tasks.filter((t) => t.completed || t.status === 'done').length;

  // Filter tasks based on selection
  const getFilteredTasks = () => {
    let filtered = tasks;

    if (selectedFilter === 'today') {
      filtered = tasks.filter((t) => isToday(t.dueDate) && !t.completed);
    } else if (selectedFilter === 'urgent') {
      filtered = tasks.filter((t) => t.priority === 'high' && !t.completed);
    } else if (selectedFilter === 'in-progress') {
      filtered = tasks.filter((t) => !t.completed);
    } else if (selectedFilter === 'done') {
      filtered = tasks.filter((t) => t.completed);
    } else if (selectedFilter === 'smart') {
      // Smart suggestions: high priority or due today
      filtered = tasks.filter((t) => (t.priority === 'high' || isToday(t.dueDate)) && !t.completed);
    }

    return sortByPriority(filtered);
  };

  const filteredTasks = getFilteredTasks();

  return (
    <div className="tl-card">
      {/* Header */}
      <div className="tl-header">
        <button className="tl-add-btn" title="הוסף משימה חדשה">
          + הוסף משימה
        </button>
        <div className="tl-header-content">
          <h2 className="tl-title">משימות ✅</h2>
          <p className="tl-subtitle">המשימות שלך מסודרות לפי דחיפות ודדליין</p>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="tl-summary-strip">
        <div className="tl-stat-col tl-stat-total">
          <span className="tl-stat-number">{allCount}</span>
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
        <button
          className={`tl-filter-chip ${selectedFilter === 'all' ? 'tl-filter-active' : ''}`}
          onClick={() => setSelectedFilter('all')}
        >
          הכל
        </button>
        <button
          className={`tl-filter-chip ${selectedFilter === 'today' ? 'tl-filter-active' : ''}`}
          onClick={() => setSelectedFilter('today')}
        >
          היום
        </button>
        <button
          className={`tl-filter-chip ${selectedFilter === 'urgent' ? 'tl-filter-active' : ''}`}
          onClick={() => setSelectedFilter('urgent')}
        >
          דחופות
        </button>
        <button
          className={`tl-filter-chip ${selectedFilter === 'in-progress' ? 'tl-filter-active' : ''}`}
          onClick={() => setSelectedFilter('in-progress')}
        >
          בתהליך
        </button>
        <button
          className={`tl-filter-chip ${selectedFilter === 'done' ? 'tl-filter-active' : ''}`}
          onClick={() => setSelectedFilter('done')}
        >
          הושלמו
        </button>
        <button
          className={`tl-filter-chip ${selectedFilter === 'smart' ? 'tl-filter-active' : ''}`}
          onClick={() => setSelectedFilter('smart')}
        >
          המלצות חכמות
        </button>
      </div>

      {/* Task List */}
      <div className="tl-task-list">
        {filteredTasks.length === 0 ? (
          <div className="tl-empty-state">אין משימות בסינון הנבחר.</div>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
};

export default TaskList;
