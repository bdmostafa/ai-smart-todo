import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopThreePanel } from './TopThreePanel';
import { useAppStore } from '../store/useAppStore';
import type { Task } from '../types';

// Helper to create a mock task
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 'task-1',
    description: 'Test task',
    quadrant: 'do-first',
    priorityScore: 80,
    status: 'incomplete',
    createdAt: '2024-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

// Mock the store module
vi.mock('../store/useAppStore');

const mockRefreshTopThree = vi.fn().mockResolvedValue(undefined);
const mockCompleteTask = vi.fn().mockResolvedValue(undefined);
const mockDeleteTask = vi.fn().mockResolvedValue(undefined);

function setupStore(state: { tasks: Task[]; topThree: string[] }) {
  vi.mocked(useAppStore).mockImplementation((selector: unknown) => {
    const fullState = {
      ...state,
      refreshTopThree: mockRefreshTopThree,
      completeTask: mockCompleteTask,
      deleteTask: mockDeleteTask,
    };
    return (selector as (s: typeof fullState) => unknown)(fullState);
  });
}

describe('TopThreePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('shows empty message when no incomplete tasks exist', () => {
      setupStore({ tasks: [], topThree: [] });

      render(<TopThreePanel />);

      expect(
        screen.getByText(/no incomplete tasks/i),
      ).toBeInTheDocument();
    });

    it('shows empty message when all tasks are complete', () => {
      const tasks = [
        makeTask({ taskId: '1', status: 'complete', completedAt: '2024-01-02T00:00:00Z' }),
        makeTask({ taskId: '2', status: 'complete', completedAt: '2024-01-02T00:00:00Z' }),
      ];
      setupStore({ tasks, topThree: [] });

      render(<TopThreePanel />);

      expect(
        screen.getByText(/no incomplete tasks/i),
      ).toBeInTheDocument();
    });
  });

  describe('displaying recommended tasks', () => {
    it('renders up to 3 recommended tasks from topThree', () => {
      const tasks = [
        makeTask({ taskId: '1', description: 'Task Alpha', priorityScore: 90 }),
        makeTask({ taskId: '2', description: 'Task Beta', priorityScore: 80 }),
        makeTask({ taskId: '3', description: 'Task Gamma', priorityScore: 70 }),
      ];
      setupStore({ tasks, topThree: ['1', '2', '3'] });

      render(<TopThreePanel />);

      expect(screen.getByText('Task Alpha')).toBeInTheDocument();
      expect(screen.getByText('Task Beta')).toBeInTheDocument();
      expect(screen.getByText('Task Gamma')).toBeInTheDocument();
    });

    it('shows task quadrant label and priority score', () => {
      const tasks = [
        makeTask({ taskId: '1', description: 'Important task', quadrant: 'do-first', priorityScore: 95 }),
      ];
      setupStore({ tasks, topThree: ['1'] });

      render(<TopThreePanel />);

      expect(screen.getByText('Do First')).toBeInTheDocument();
      expect(screen.getByText('Score: 95')).toBeInTheDocument();
    });

    it('handles fewer than 3 tasks gracefully', () => {
      const tasks = [
        makeTask({ taskId: '1', description: 'Only task', priorityScore: 85 }),
      ];
      setupStore({ tasks, topThree: ['1'] });

      render(<TopThreePanel />);

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(screen.getByText('Only task')).toBeInTheDocument();
    });

    it('handles 2 tasks gracefully', () => {
      const tasks = [
        makeTask({ taskId: '1', description: 'First', priorityScore: 90 }),
        makeTask({ taskId: '2', description: 'Second', priorityScore: 75 }),
      ];
      setupStore({ tasks, topThree: ['1', '2'] });

      render(<TopThreePanel />);

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(2);
    });
  });

  describe('fallback behavior (Req 4.6)', () => {
    it('falls back to highest priority incomplete tasks when topThree is empty', () => {
      const tasks = [
        makeTask({ taskId: '1', description: 'Low priority', priorityScore: 20 }),
        makeTask({ taskId: '2', description: 'High priority', priorityScore: 95 }),
        makeTask({ taskId: '3', description: 'Medium priority', priorityScore: 60 }),
        makeTask({ taskId: '4', description: 'Very high priority', priorityScore: 99 }),
      ];
      setupStore({ tasks, topThree: [] });

      render(<TopThreePanel />);

      // Should show top 3 by score: 99, 95, 60
      expect(screen.getByText('Very high priority')).toBeInTheDocument();
      expect(screen.getByText('High priority')).toBeInTheDocument();
      expect(screen.getByText('Medium priority')).toBeInTheDocument();
      expect(screen.queryByText('Low priority')).not.toBeInTheDocument();
    });

    it('ignores completed tasks in topThree references', () => {
      const tasks = [
        makeTask({ taskId: '1', description: 'Active', priorityScore: 80 }),
        makeTask({ taskId: '2', description: 'Done', status: 'complete', completedAt: '2024-01-02T00:00:00Z', priorityScore: 90 }),
      ];
      // topThree references a completed task — it should be filtered out
      setupStore({ tasks, topThree: ['2', '1'] });

      render(<TopThreePanel />);

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });

  describe('refresh on mount (Req 4.1)', () => {
    it('calls refreshTopThree on mount', () => {
      setupStore({ tasks: [], topThree: [] });

      render(<TopThreePanel />);

      expect(mockRefreshTopThree).toHaveBeenCalledTimes(1);
    });
  });

  describe('task actions (Req 4.5)', () => {
    it('calls completeTask and refreshTopThree when complete button is clicked', async () => {
      const user = userEvent.setup();
      const tasks = [
        makeTask({ taskId: '1', description: 'Finish report', priorityScore: 85 }),
      ];
      setupStore({ tasks, topThree: ['1'] });

      render(<TopThreePanel />);

      const completeBtn = screen.getByLabelText(/complete task: finish report/i);
      await user.click(completeBtn);

      expect(mockCompleteTask).toHaveBeenCalledWith('1');
      expect(mockRefreshTopThree).toHaveBeenCalled();
    });

    it('calls deleteTask and refreshTopThree when delete button is clicked', async () => {
      const user = userEvent.setup();
      const tasks = [
        makeTask({ taskId: '1', description: 'Delete me', priorityScore: 50 }),
      ];
      setupStore({ tasks, topThree: ['1'] });

      render(<TopThreePanel />);

      const deleteBtn = screen.getByLabelText(/delete task: delete me/i);
      await user.click(deleteBtn);

      expect(mockDeleteTask).toHaveBeenCalledWith('1');
      expect(mockRefreshTopThree).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has a heading for the section', () => {
      setupStore({ tasks: [makeTask()], topThree: ['task-1'] });

      render(<TopThreePanel />);

      expect(
        screen.getByRole('heading', { name: /today's top 3/i }),
      ).toBeInTheDocument();
    });

    it('uses aria-labelledby to link section to heading', () => {
      setupStore({ tasks: [makeTask()], topThree: ['task-1'] });

      render(<TopThreePanel />);

      const section = screen.getByRole('region', { hidden: true }) ?? 
        document.querySelector('section[aria-labelledby="top-three-heading"]');
      expect(section).toBeTruthy();
    });
  });
});
