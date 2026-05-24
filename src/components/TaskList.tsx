import { useState } from 'react';
import type { Task } from '../types';
import { sortByPriority, priorityLabel, priorityColor, formatDate, isToday, isTomorrow } from '../utils/priority';

const TaskItem = ({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) => {
  const color = priorityColor[task.priority];
  const label = priorityLabel[task.priority];

  const dueDateLabel = isToday(task.dueDate)
    ? 'היום'
    : isTomorrow(task.dueDate)
    ? 'מחר'
    : formatDate(task.dueDate);

  return (
    <div className={`task-item ${task.completed ? 'task-done' : ''}`}>
      <div className="task-left">
        <button
          className={`task-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={() => onToggle(task.id)}
          aria-label="סמן כבוצע"
        >
          {task.completed && <span>✓</span>}
        </button>
        <div className="task-info">
          <span className="task-title">{task.title}</span>
          {task.description && <span className="task-desc">{task.description}</span>}
        </div>
      </div>
      <div className="task-right">
        <span className="task-priority-badge" style={{ background: color + '22', color }}>
          {label}
        </span>
        <span className="task-due">{dueDateLabel}</span>
        <span className="task-category">{task.category}</span>
      </div>
    </div>
  );
};

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
}

const TaskList = ({ tasks, onToggle }: TaskListProps) => {
  const [showDone, setShowDone] = useState(false);

  const pending = sortByPriority(tasks.filter((t) => !t.completed));
  const done    = tasks.filter((t) => t.completed);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon">✅</span>
          <h2 className="card-title">משימות</h2>
          <span className="badge">{pending.length}</span>
        </div>
      </div>
      <div className="task-list">
        {pending.map((t) => (
          <TaskItem key={t.id} task={t} onToggle={onToggle} />
        ))}
      </div>
      {done.length > 0 && (
        <div className="task-done-section">
          <button className="show-done-btn" onClick={() => setShowDone((s) => !s)}>
            {showDone ? 'הסתר' : 'הצג'} משימות שהושלמו ({done.length})
          </button>
          {showDone && done.map((t) => <TaskItem key={t.id} task={t} onToggle={onToggle} />)}
        </div>
      )}
    </div>
  );
};

export default TaskList;
