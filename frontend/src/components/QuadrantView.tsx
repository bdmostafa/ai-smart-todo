import type { Task, Quadrant } from '../types';

/** Metadata for each Eisenhower Matrix quadrant */
interface QuadrantMeta {
  key: Quadrant;
  label: string;
  description: string;
}

const QUADRANT_ORDER: QuadrantMeta[] = [
  { key: 'do-first', label: 'Do First', description: 'Urgent & Important' },
  { key: 'schedule', label: 'Schedule', description: 'Important, Not Urgent' },
  { key: 'delegate', label: 'Delegate', description: 'Urgent, Not Important' },
  { key: 'eliminate', label: 'Eliminate', description: 'Neither Urgent Nor Important' },
];

export interface QuadrantViewProps {
  tasks: Task[];
}

/**
 * Sort tasks by priorityScore descending, ties broken by createdAt descending (most recent first).
 */
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * QuadrantView renders a four-panel Eisenhower Matrix layout.
 * Displays incomplete tasks grouped by quadrant in order: Do First, Schedule, Delegate, Eliminate.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function QuadrantView({ tasks }: QuadrantViewProps) {
  // When no tasks exist at all, show an invitation prompt
  if (tasks.length === 0) {
    return (
      <div className="quadrant-view quadrant-view--empty" data-testid="quadrant-view-empty">
        <p className="quadrant-view__invite">
          No tasks yet. Add your first task to get started with the Eisenhower Matrix!
        </p>
      </div>
    );
  }

  // Group tasks by quadrant
  const groupedTasks: Record<Quadrant, Task[]> = {
    'do-first': [],
    'schedule': [],
    'delegate': [],
    'eliminate': [],
  };

  for (const task of tasks) {
    groupedTasks[task.quadrant].push(task);
  }

  return (
    <div className="quadrant-view" data-testid="quadrant-view">
      <div className="quadrant-view__grid">
        {QUADRANT_ORDER.map((quadrant) => {
          const quadrantTasks = sortTasks(groupedTasks[quadrant.key]);

          return (
            <section
              key={quadrant.key}
              className={`quadrant-panel quadrant-panel--${quadrant.key}`}
              aria-label={`${quadrant.label} quadrant`}
              data-testid={`quadrant-${quadrant.key}`}
            >
              <header className="quadrant-panel__header">
                <h3 className="quadrant-panel__title">{quadrant.label}</h3>
                <span className="quadrant-panel__description">{quadrant.description}</span>
              </header>

              <div className="quadrant-panel__tasks">
                {quadrantTasks.length === 0 ? (
                  <p className="quadrant-panel__placeholder" data-testid={`placeholder-${quadrant.key}`}>
                    No tasks in this quadrant
                  </p>
                ) : (
                  <ul className="quadrant-panel__list">
                    {quadrantTasks.map((task) => (
                      <li key={task.taskId} className="quadrant-task" data-testid={`task-${task.taskId}`}>
                        <span className="quadrant-task__description">{task.description}</span>
                        <div className="quadrant-task__meta">
                          <span className="quadrant-task__quadrant-label">{quadrant.label}</span>
                          <span className="quadrant-task__score">Score: {task.priorityScore}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
