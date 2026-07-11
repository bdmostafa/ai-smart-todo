import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { ErrorBanner } from './components/ErrorBanner';
import { TaskInput } from './components/TaskInput';
import { TopThreePanel } from './components/TopThreePanel';
import { QuadrantView } from './components/QuadrantView';
import { CompletedSection } from './components/CompletedSection';
import './App.css';

/**
 * App – main application shell composing all components.
 *
 * Layout order:
 * 1. ErrorBanner (top, non-blocking)
 * 2. Title
 * 3. TaskInput
 * 4. TopThreePanel (above quadrant view)
 * 5. QuadrantView (incomplete tasks only)
 * 6. CompletedSection (below active list)
 *
 * Requirements: 1.4, 2.2, 3.3, 4.5, 5.1, 6.2, 6.4, 8.5
 */
function App() {
  const loadTasks = useAppStore((s) => s.loadTasks);
  const isLoading = useAppStore((s) => s.isLoading);
  const tasks = useAppStore((s) => s.tasks);

  // Load tasks from backend on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Filter to only incomplete tasks for the quadrant view
  const incompleteTasks = tasks.filter((t) => t.status === 'incomplete');

  return (
    <main className="app">
      <ErrorBanner />

      <h1 className="app__title">AI Smart To-Do</h1>

      <TaskInput />

      {isLoading ? (
        <div className="app__loading" aria-live="polite">
          <p>Loading tasks...</p>
        </div>
      ) : (
        <>
          <TopThreePanel />
          <QuadrantView tasks={incompleteTasks} />
          <CompletedSection />
        </>
      )}
    </main>
  );
}

export default App;
