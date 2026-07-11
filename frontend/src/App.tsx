import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
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
 * 1. Header (sticky nav with theme toggle)
 * 2. ErrorBanner (top, non-blocking)
 * 3. Hero section with title
 * 4. TaskInput
 * 5. TopThreePanel (above quadrant view)
 * 6. QuadrantView (incomplete tasks only)
 * 7. CompletedSection (below active list)
 * 8. Footer
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
    <>
      <Header />

      <main className="app">
        <ErrorBanner />

        <div className="app__hero">
          <h1 className="app__title">AI Smart Todo</h1>
          <p className="app__subtitle">
            Your AI-powered productivity companion. Organize tasks smartly with the Eisenhower Matrix.
          </p>
        </div>

        <TaskInput />

        {isLoading ? (
          <div className="app__loading" aria-live="polite">
            <p>Loading your tasks...</p>
          </div>
        ) : (
          <>
            <TopThreePanel />
            <QuadrantView tasks={incompleteTasks} />
            <CompletedSection />
          </>
        )}
      </main>

      <Footer />
    </>
  );
}

export default App;
