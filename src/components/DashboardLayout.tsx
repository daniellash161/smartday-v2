import { useState, lazy, Suspense, useEffect } from 'react';
import Header from './Header';
import DailySummaryCard from './DailySummaryCard';
import TaskList from './TaskList';
import EventsCard from './EventsCard';
import AlertsCard from './AlertsCard';
import AiAssistant from './AiAssistant';
import PaymentsModal from './PaymentsModal';
import NewsModal from './NewsModal';
import type { Task, CalendarEvent, EventCategory } from '../types';
import type { NewsItem } from '../services/newsService';

// Demo task titles that should not appear in the dashboard
const DEMO_TASK_TITLES = new Set([
  'הגשת עבודה סמינריונית',
  'תשלום שכר לימוד',
  'קריאת מאמר לשיעור מחר',
  'הכנת מצגת לעבודת קבוצה',
  'עדכון קורות חיים',
  'עבודה על אפיון מרצה',
]);

// Clean up old demo/generated tasks from localStorage
function migrateCleanDemoTasks(): void {
  const migrationKey = 'smartday-clean-invalid-demo-tasks-v1';

  // Only run migration once
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  try {
    const stored = localStorage.getItem('smartday-tasks');
    if (!stored) {
      localStorage.setItem(migrationKey, 'true');
      return;
    }

    const tasks = JSON.parse(stored) as Array<any>;
    const cleaned = tasks.filter(t => {
      // Remove if title is a demo task
      if (DEMO_TASK_TITLES.has(t.title)) return false;

      // Remove if title contains common demo/generated patterns
      if (t.title?.includes('הכנה למשמרת')) return false;
      if (t.title?.includes('אימייל')) return false;

      // Remove if date is invalid
      if (t.dueDate) {
        const date = new Date(t.dueDate);
        if (Number.isNaN(date.getTime())) return false;
      }

      return true;
    });

    if (cleaned.length !== tasks.length) {
      localStorage.setItem('smartday-tasks', JSON.stringify(cleaned));
    }

    localStorage.setItem(migrationKey, 'true');
  } catch {
    // Silently fail if migration has issues
    localStorage.setItem(migrationKey, 'true');
  }
}

// Lazy-load advanced recovered components to avoid type checking conflicts
const NewsUpdatesCard = lazy(() => import('./NewsUpdatesCard'));
const PaymentsInsightsCard = lazy(() => import('./PaymentsInsightsCard'));
const ImportantEmailsCard = lazy(() => import('./ImportantEmailsCard'));
const PersonalWidget = lazy(() => import('./PersonalWidget'));
const FutureEventsPanel = lazy(() => import('./FutureEventsPanel'));

interface DashboardLayoutProps {
  onExitToOnboarding?: () => void;
}

const DashboardLayout = ({ onExitToOnboarding }: DashboardLayoutProps) => {
  // Initialize tasks with localStorage cleanup of demo tasks
  const [tasks, setTasks] = useState<Task[]>(() => {
    // Run cleanup migration before loading tasks
    migrateCleanDemoTasks();

    // Load tasks from localStorage if they exist
    try {
      const stored = localStorage.getItem('smartday-tasks');
      if (stored) {
        const parsed = JSON.parse(stored) as Task[];
        // Filter out any demo tasks that were previously saved
        return parsed.filter(t => !DEMO_TASK_TITLES.has(t.title) && !t.title.includes('הכנה למשמרת') && !t.title.includes('אימייל'));
      }
    } catch {
      // If parsing fails, start with empty list
    }
    return [];
  });

  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsDemoMode, setNewsDemoMode] = useState(false);

  // Calendar state for future events modal
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [showFutureEvents, setShowFutureEvents] = useState(false);

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('smartday-tasks', JSON.stringify(tasks));
    } catch {
      // Silently fail if localStorage is not available
    }
  }, [tasks]);

  const toggleTask = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const addTasks = (incoming: Omit<Task, 'id'>[]) =>
    setTasks((prev) => {
      const newTasks = incoming.map((t, i) => ({ ...t, id: `s-${Date.now()}-${i}` }));
      const combined = [...prev, ...newTasks];
      // Sort by priorityScore desc, then urgency, then dueDate
      const urgencyOrder: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3 };
      return combined.sort((a, b) => {
        const scoreA = (a as any).priorityScore ?? 0;
        const scoreB = (b as any).priorityScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        const uA = urgencyOrder[a.urgency ?? 'low'] ?? 3;
        const uB = urgencyOrder[b.urgency ?? 'low'] ?? 3;
        if (uA !== uB) return uA - uB;
        const dA = a.deadlineDate ?? a.dueDate ?? '';
        const dB = b.deadlineDate ?? b.dueDate ?? '';
        return dA.localeCompare(dB);
      });
    });

  const addTask = (task: Omit<Task, 'id' | 'createdAt'>) =>
    addTasks([task as Omit<Task, 'id'>]);

  const addEvent = () => {
    // Placeholder for event addition
  };

  const existingTaskTitles = new Set(tasks.map((t) => t.title));

  return (
    <div className="dashboard-root" dir="rtl">
      <Header onExitToOnboarding={onExitToOnboarding} />
      <main className="dashboard-main">
        <section className="dashboard-full">
          <DailySummaryCard
            tasks={tasks}
            calendarEvents={calendarEvents}
            newsCount={newsItems.length}
          />
        </section>

        <section className="dashboard-full">
          <EventsCard
            onAddTasks={addTasks}
            existingTaskTitles={existingTaskTitles}
            onCalendarEventsUpdate={setCalendarEvents}
            onOpenFutureEvents={() => setShowFutureEvents(true)}
          />
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-col">
            <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>טוען...</div>}>
              <NewsUpdatesCard
                compact={true}
                onOpenModal={() => setShowNewsModal(true)}
                onItemsLoaded={(items) => setNewsItems(items)}
                demoMode={newsDemoMode}
              />
            </Suspense>
            <TaskList tasks={tasks} onToggle={toggleTask} />
            <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>טוען...</div>}>
              <PersonalWidget onAddTask={addTask} />
            </Suspense>
          </div>
          <div className="dashboard-col">
            <AlertsCard
              calendarEvents={calendarEvents}
              tasks={tasks}
              onAddTask={addTask}
              onAddTasks={addTasks}
              existingTaskTitles={existingTaskTitles}
            />
            <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>טוען...</div>}>
              <PaymentsInsightsCard
                compact={true}
                onAddTask={addTask}
                onAddEvent={addEvent}
                onOpenModal={() => setShowPaymentsModal(true)}
              />
            </Suspense>
            <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>טוען...</div>}>
              <ImportantEmailsCard onAddTask={addTask} onAddEvent={addEvent} existingTaskTitles={existingTaskTitles} />
            </Suspense>
            <AiAssistant />
          </div>
        </section>
      </main>

      {/* Payments Modal */}
      {showPaymentsModal && (
        <PaymentsModal onClose={() => setShowPaymentsModal(false)}>
          <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>טוען...</div>}>
            <PaymentsInsightsCard
              compact={false}
              onAddTask={addTask}
              onAddEvent={addEvent}
            />
          </Suspense>
        </PaymentsModal>
      )}

      {/* News Modal */}
      {showNewsModal && (
        <NewsModal
          items={newsItems}
          demoMode={newsDemoMode}
          onAddTask={addTask}
          existingTaskTitles={existingTaskTitles}
          onClose={() => setShowNewsModal(false)}
        />
      )}

      {/* Future Events Modal */}
      {showFutureEvents && (
        <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>טוען...</div>}>
          <FutureEventsPanel
            allEvents={calendarEvents}
            hasCalendar={calendarEvents.length > 0}
            onClose={() => setShowFutureEvents(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default DashboardLayout;
