/**
 * SmartTaskSuggestions — Suggests tasks based on real calendar events
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows preparation and planning tasks derived from upcoming calendar events.
 */

import { useState, useMemo } from 'react';
import type { CalendarEvent, Task } from '../types';
import { generateTaskSuggestionsFromEvents, type TaskSuggestion } from '../utils/taskSuggestionGenerator';

interface SmartTaskSuggestionsProps {
  calendarEvents: CalendarEvent[];
  existingTaskTitles: Set<string>;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

const SmartTaskSuggestions = ({
  calendarEvents,
  existingTaskTitles,
  onAddTask,
}: SmartTaskSuggestionsProps) => {
  const suggestions = useMemo(
    () => generateTaskSuggestionsFromEvents(calendarEvents),
    [calendarEvents]
  );

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  if (suggestions.length === 0) return null;

  const handleAddTask = (suggestion: TaskSuggestion) => {
    onAddTask({
      title: suggestion.taskTitle,
      priority: 'medium',
      dueDate: suggestion.dueDate,
      completed: false,
      category: suggestion.category,
    });
    setAddedIds(prev => new Set(prev).add(suggestion.id));
  };

  return (
    <div className="smart-task-suggestions">
      <div className="smart-task-suggestions-header">
        <span className="smart-task-suggestions-icon">💡</span>
        <div>
          <h3 className="smart-task-suggestions-title">המלצות משימות</h3>
          <p className="smart-task-suggestions-sub">מבוסס על לוח הזמנים שלך</p>
        </div>
      </div>

      <div className="smart-task-suggestions-list">
        {suggestions.map((suggestion) => {
          const isAdded = addedIds.has(suggestion.id) || existingTaskTitles.has(suggestion.taskTitle);

          return (
            <div key={suggestion.id} className="smart-task-suggestion-card">
              <div className="smart-task-suggestion-top">
                <span className="smart-task-suggestion-icon">{suggestion.icon}</span>
                <div className="smart-task-suggestion-content">
                  <h4 className="smart-task-suggestion-title">{suggestion.title}</h4>
                  <p className="smart-task-suggestion-desc">{suggestion.description}</p>
                </div>
              </div>

              {isAdded ? (
                <span className="smart-task-suggestion-done">✓ נוסף למשימות שלך</span>
              ) : (
                <button
                  className="smart-task-suggestion-btn"
                  onClick={() => handleAddTask(suggestion)}
                  type="button"
                >
                  {suggestion.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SmartTaskSuggestions;
