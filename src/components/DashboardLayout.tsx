import { useState } from 'react';
import Header from './Header';
import DailySummaryCard from './DailySummaryCard';
import TaskList from './TaskList';
import EventsCard from './EventsCard';
import AlertsCard from './AlertsCard';
import AiAssistant from './AiAssistant';
import type { Task } from '../types';
import { mockTasks } from '../data/mockData';

const DashboardLayout = () => {
  // Task state lives here so EventsCard suggestions can add to the same list
  const [tasks, setTasks] = useState<Task[]>(mockTasks);

  const toggleTask = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const addTasks = (incoming: Omit<Task, 'id'>[]) =>
    setTasks((prev) => [
      ...prev,
      ...incoming.map((t, i) => ({ ...t, id: `s-${Date.now()}-${i}` })),
    ]);

  const existingTaskTitles = new Set(tasks.map((t) => t.title));

  return (
    <div className="dashboard-root" dir="rtl">
      <Header />
      <main className="dashboard-main">
        <section className="dashboard-full">
          <DailySummaryCard />
        </section>

        <section className="dashboard-full">
          <EventsCard onAddTasks={addTasks} existingTaskTitles={existingTaskTitles} />
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-col">
            <TaskList tasks={tasks} onToggle={toggleTask} />
          </div>
          <div className="dashboard-col">
            <AlertsCard />
            <AiAssistant />
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardLayout;
