import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Task, Quadrant } from '../types';

/** Human-readable quadrant labels */
const QUADRANT_LABELS: Record<Quadrant, string> = {
  'do-first': 'Do First',
  schedule: 'Schedule',
  delegate: 'Delegate',
  eliminate: 'Eliminate',
};

/**
 * TopThreePanel – displays the daily AI-recommended top 3 tasks.
 *
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6
 *
 * - Positioned above the task list as a dedicated section
 * - Shows up to 3 recommended tasks with details
 * - Handles fewer than 3 gracefully (shows whatever is available)
 * - Shows empty state when no incomplete tasks exist
 * - Refreshes when a task is completed or deleted
 */
export function TopThreePanel() {
  const tasks = useAppStore((s) => s.tasks);
  const topThree = useAppStore((s) => s.topThree);
  const refreshTopThree = useAppStore((s) => s.refreshTopThree);
  const completeTask = useAppStore((s) => s.completeTask);
  const deleteTask = useAppStore((s) => s.deleteTask);

  // Req 4.1: Generate top-three on mount
  useEffect(() => {
    refreshTopThree();
  }, [refreshTopThree]);

  // Resolve taskIds to full task objects, filtering out any missing references
  const recommendedTasks: Task[] = topThree
    .map((id) => tasks.find((t) => t.taskId === id))
    .filter((t): t is Task => t != null && t.status === 'incomplete');

  // Req 4.6: Fallback – if topThree is empty but there are incomplete tasks,
  // show the 3 highest-priority incomplete tasks
  const incompleteTasks = tasks.filter((t) => t.status === 'incomplete');
  const displayTasks =
    recommendedTasks.length > 0
      ? recommendedTasks
      : incompleteTasks
          .slice()
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .slice(0, 3);

  // Req 4.5: Complete a task and refresh recommendations
  const handleComplete = useCallback(
    async (taskId: string) => {
      await completeTask(taskId);
      await refreshTopThree();
    },
    [completeTask, refreshTopThree],
  );

  // Delete a task and refresh recommendations
  const handleDelete = useCallback(
    async (taskId: string) => {
      await deleteTask(taskId);
      await refreshTopThree();
    },
    [deleteTask, refreshTopThree],
  );

  // Req 4.4: Empty state when no incomplete tasks exist
  if (incompleteTasks.length === 0) {
    return (
      <section className="top-three-panel" aria-labelledby="top-three-heading">
        <h2 id="top-three-heading" className="top-three-panel__heading">
          Today's Top 3
        </h2>
        <p className="top-three-panel__empty">
          No incomplete tasks. Add a task to get personalized recommendations!
        </p>
      </section>
    );
  }

  return (
    <section className="top-three-panel" aria-labelledby="top-three-heading">
      <h2 id="top-three-heading" className="top-three-panel__heading">
        Today's Top 3
      </h2>
      <ul className="top-three-panel__list" role="list">
        {displayTasks.map((task) => (
          <li key={task.taskId} className="top-three-panel__item">
            <div className="top-three-panel__item-content">
              <span className="top-three-panel__description">
                {task.description}
              </span>
              <span className="top-three-panel__meta">
                <span className="top-three-panel__quadrant">
                  {QUADRANT_LABELS[task.quadrant]}
                </span>
                <span className="top-three-panel__score">
                  Score: {task.priorityScore}
                </span>
              </span>
            </div>
            <div className="top-three-panel__actions">
              <button
                className="top-three-panel__complete-btn"
                onClick={() => handleComplete(task.taskId)}
                aria-label={`Complete task: ${task.description}`}
              >
                ✓
              </button>
              <button
                className="top-three-panel__delete-btn"
                onClick={() => handleDelete(task.taskId)}
                aria-label={`Delete task: ${task.description}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
