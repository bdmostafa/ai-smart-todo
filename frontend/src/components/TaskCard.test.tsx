import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import type { Task } from '../types';
import { useAppStore } from '../store/useAppStore';

// Mock the zustand store
vi.mock('../store/useAppStore');

const mockCompleteTask = vi.fn().mockResolvedValue(undefined);
const mockRestoreTask = vi.fn().mockResolvedValue(undefined);
const mockDeleteTask = vi.fn().mockResolvedValue(undefined);
const mockRefreshTopThree = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppStore).mockImplementation((selector: any) => {
    const state = {
      completeTask: mockCompleteTask,
      restoreTask: mockRestoreTask,
      deleteTask: mockDeleteTask,
      refreshTopThree: mockRefreshTopThree,
    };
    return selector(state);
  });
});

const incompleteTask: Task = {
  taskId: 'task-1',
  description: 'Buy groceries for dinner',
  quadrant: 'do-first',
  priorityScore: 85,
  status: 'incomplete',
  createdAt: '2024-01-15T10:00:00Z',
  completedAt: null,
};

const completedTask: Task = {
  taskId: 'task-2',
  description: 'Clean the garage',
  quadrant: 'eliminate',
  priorityScore: 15,
  status: 'complete',
  createdAt: '2024-01-14T08:00:00Z',
  completedAt: '2024-01-15T12:00:00Z',
};

describe('TaskCard', () => {
  describe('display', () => {
    it('renders task description', () => {
      render(<TaskCard task={incompleteTask} />);
      expect(screen.getByText('Buy groceries for dinner')).toBeInTheDocument();
    });

    it('renders quadrant label (Req 2.2)', () => {
      render(<TaskCard task={incompleteTask} />);
      expect(screen.getByTestId('quadrant-label')).toHaveTextContent('Do First');
    });

    it('renders priority score (Req 3.3)', () => {
      render(<TaskCard task={incompleteTask} />);
      expect(screen.getByTestId('priority-score')).toHaveTextContent('85');
    });

    it('displays all quadrant labels correctly', () => {
      const quadrants = [
        { quadrant: 'do-first' as const, label: 'Do First' },
        { quadrant: 'schedule' as const, label: 'Schedule' },
        { quadrant: 'delegate' as const, label: 'Delegate' },
        { quadrant: 'eliminate' as const, label: 'Eliminate' },
      ];

      for (const { quadrant, label } of quadrants) {
        const task = { ...incompleteTask, quadrant };
        const { unmount } = render(<TaskCard task={task} />);
        expect(screen.getByTestId('quadrant-label')).toHaveTextContent(label);
        unmount();
      }
    });
  });

  describe('completed task styling (Req 5.2)', () => {
    it('applies strikethrough to completed task description', () => {
      render(<TaskCard task={completedTask} />);
      const description = screen.getByText('Clean the garage');
      expect(description).toHaveStyle({ textDecoration: 'line-through' });
    });

    it('applies reduced opacity to completed task card', () => {
      render(<TaskCard task={completedTask} />);
      const card = screen.getByTestId('task-card');
      expect(card).toHaveStyle({ opacity: '0.5' });
    });

    it('does not apply strikethrough to incomplete task', () => {
      render(<TaskCard task={incompleteTask} />);
      const description = screen.getByText('Buy groceries for dinner');
      expect(description).toHaveStyle({ textDecoration: 'none' });
    });

    it('does not reduce opacity for incomplete task', () => {
      render(<TaskCard task={incompleteTask} />);
      const card = screen.getByTestId('task-card');
      expect(card).toHaveStyle({ opacity: '1' });
    });
  });

  describe('complete/restore toggle', () => {
    it('shows complete button for incomplete task', () => {
      render(<TaskCard task={incompleteTask} />);
      const button = screen.getByTestId('toggle-complete');
      expect(button).toHaveAccessibleName('Complete task');
    });

    it('shows restore button for completed task', () => {
      render(<TaskCard task={completedTask} />);
      const button = screen.getByTestId('toggle-complete');
      expect(button).toHaveAccessibleName('Restore task');
    });

    it('calls completeTask and refreshTopThree when completing', async () => {
      render(<TaskCard task={incompleteTask} />);
      fireEvent.click(screen.getByTestId('toggle-complete'));

      await waitFor(() => {
        expect(mockCompleteTask).toHaveBeenCalledWith('task-1');
      });
      await waitFor(() => {
        expect(mockRefreshTopThree).toHaveBeenCalled();
      });
    });

    it('calls restoreTask and refreshTopThree when restoring', async () => {
      render(<TaskCard task={completedTask} />);
      fireEvent.click(screen.getByTestId('toggle-complete'));

      await waitFor(() => {
        expect(mockRestoreTask).toHaveBeenCalledWith('task-2');
      });
      await waitFor(() => {
        expect(mockRefreshTopThree).toHaveBeenCalled();
      });
    });
  });

  describe('delete with confirmation (Req 6.1)', () => {
    it('does not show confirmation dialog initially', () => {
      render(<TaskCard task={incompleteTask} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog when delete is clicked', () => {
      render(<TaskCard task={incompleteTask} />);
      fireEvent.click(screen.getByTestId('delete-button'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete this task?')).toBeInTheDocument();
    });

    it('calls deleteTask and refreshTopThree on confirm', async () => {
      render(<TaskCard task={incompleteTask} />);
      fireEvent.click(screen.getByTestId('delete-button'));
      fireEvent.click(screen.getByTestId('confirm-delete'));

      await waitFor(() => {
        expect(mockDeleteTask).toHaveBeenCalledWith('task-1');
      });
      await waitFor(() => {
        expect(mockRefreshTopThree).toHaveBeenCalled();
      });
    });

    it('hides confirmation dialog on cancel', () => {
      render(<TaskCard task={incompleteTask} />);
      fireEvent.click(screen.getByTestId('delete-button'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cancel-delete'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not call deleteTask on cancel', () => {
      render(<TaskCard task={incompleteTask} />);
      fireEvent.click(screen.getByTestId('delete-button'));
      fireEvent.click(screen.getByTestId('cancel-delete'));
      expect(mockDeleteTask).not.toHaveBeenCalled();
    });
  });
});
