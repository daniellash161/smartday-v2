import { useState, lazy, Suspense } from 'react';
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
import { mockTasks } from '../data/mockData';

// Lazy-load advanced recovered components to avoid type checking conflicts
const NewsUpdatesCard = lazy(() => import('./NewsUpdatesCard'));
const PaymentsInsightsCard = lazy(() => import('./PaymentsInsightsCard'));
const ImportantEmailsCard = lazy(() => import('./ImportantEmailsCard'));
const PersonalWidget = lazy(() => import('./PersonalWidget'));
const FutureEventsPanel = lazy(() => import('./FutureEventsPanel'));

const DashboardLayout = () => {
  // Task state lives here so EventsCard suggestions can add to the same list
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsDemoMode, setNewsDemoMode] = useState(false);

  // Calendar state for future events modal
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [showFutureEvents, setShowFutureEvents] = useState(false);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, EventCategory>>({});

  const toggleTask = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const addTasks = (incoming: Omit<Task, 'id'>[]) =>
    setTasks((prev) => [
      ...prev,
      ...incoming.map((t, i) => ({ ...t, id: `s-${Date.now()}-${i}` })),
    ]);

  const addTask = (task: Omit<Task, 'id' | 'createdAt'>) =>
    addTasks([task as Omit<Task, 'id'>]);

  const addEvent = () => {
    // Placeholder for event addition
  };

  const existingTaskTitles = new Set(tasks.map((t) => t.title));

  const handleCategoryOverride = (id: string, cat: EventCategory) => {
    setCategoryOverrides(prev => ({ ...prev, [id]: cat }));
  };

  return (
    <div className="dashboard-root" dir="rtl">
      <Header />
      <main className="dashboard-main">
        <section className="dashboard-full">
          <DailySummaryCard />
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
            <AlertsCard calendarEvents={calendarEvents} />
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
            categoryOverrides={categoryOverrides}
            onCategoryOverride={handleCategoryOverride}
            hasCalendar={calendarEvents.length > 0}
            onClose={() => setShowFutureEvents(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default DashboardLayout;
