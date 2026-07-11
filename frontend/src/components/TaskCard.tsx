import { useState } from 'react';
import type { Task, Quadrant } from '../types';
import { useAppStore } from '../store/useAppStore';

export interface TaskCardProps {
  task: Task;
}

const quadrantLabels: Record<Quadrant, string> = {
  'do-first': 'Do First',
  schedule: 'Schedule',
  delegate: 'Delegate',
  eliminate: 'Eliminate',
};

/**
 * TaskCard displays a single task with its description, quadrant label,
 * priority score, and action buttons (complete/restore, delete).
 *
 * Requirements: 2.2, 3.3, 5.2, 6.1
 */
export function TaskCard({ task }: TaskCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const completeTask = useAppStore((s) => s.completeTask);
  const restoreTask = useAppStore((s) => s.restoreTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const refreshTopThree = useAppStore((s) => s.refreshTopThree);

  const isComplete = task.status === 'complete';

  const handleToggleComplete = async () => {
    if (isComplete) {
      await restoreTask(task.taskId);
    } else {
      await completeTask(task.taskId);
    }
    await refreshTopThree();
  };

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirm(false);
    await deleteTask(task.taskId);
    await refreshTopThree();
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  return (
    <div
      className="task-card"
      style={{ opacity: isComplete ? 0.5 : 1 }}
      data-testid="task-card"
    >
      <div className="task-card-content">
        <p
          className="task-card-description"
          style={{ textDecoration: isComplete ? 'line-through' : 'none' }}
        >
          {task.description}
        </p>
        <div className="task-card-meta">
          <span className="task-card-quadrant" data-testid="quadrant-label">
            {quadrantLabels[task.quadrant]}
          </span>
          <span className="task-card-score" data-testid="priority-score">
            {task.priorityScore}
          </span>
        </div>
      </div>

      <div className="task-card-actions">
        <button
          className="task-card-toggle"
          onClick={handleToggleComplete}
          aria-label={isComplete ? 'Restore task' : 'Complete task'}
          data-testid="toggle-complete"
        >
          {isComplete ? '↩' : '✓'}
        </button>
        <button
          className="task-card-delete"
          onClick={handleDeleteClick}
          aria-label="Delete task"
          data-testid="delete-button"
        >
          ✕
        </button>
      </div>

      {showConfirm && (
        <div className="task-card-confirm" role="dialog" aria-label="Confirm deletion">
          <p>Delete this task?</p>
          <button
            onClick={handleConfirmDelete}
            data-testid="confirm-delete"
          >
            Confirm
          </button>
          <button
            onClick={handleCancelDelete}
            data-testid="cancel-delete"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
