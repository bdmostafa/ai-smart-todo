import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * CompletedSection – collapsible section displaying completed tasks.
 *
 * Requirements: 5.4
 */
export function CompletedSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const tasks = useAppStore((s) => s.tasks);
  const restoreTask = useAppStore((s) => s.restoreTask);

  const completedTasks = tasks.filter((t) => t.status === 'complete');

  if (completedTasks.length === 0) {
    return null;
  }

  return (
    <section className="completed-section" aria-labelledby="completed-heading">
      <button
        id="completed-heading"
        type="button"
        className="completed-section__toggle"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <span className="completed-section__title">
          Completed ({completedTasks.length})
        </span>
        <span className="completed-section__chevron" aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>

      {isExpanded && (
        <ul className="completed-section__list">
          {completedTasks.map((task) => (
            <li key={task.taskId} className="completed-section__item">
              <span className="completed-section__description">
                {task.description}
              </span>
              <button
                type="button"
                className="completed-section__restore"
                onClick={() => restoreTask(task.taskId)}
                aria-label={`Restore task: ${task.description}`}
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
