import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const loadTasks = useAppStore((s) => s.loadTasks);
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);
  const tasks = useAppStore((s) => s.tasks);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <main className="app">
      <h1>AI Smart To-Do</h1>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <p>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <p className="empty-state">
          No tasks yet. Add your first task to get started!
        </p>
      ) : (
        <p>{tasks.length} task(s) loaded</p>
      )}
    </main>
  );
}

export default App;
