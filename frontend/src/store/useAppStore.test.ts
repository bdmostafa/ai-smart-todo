import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './useAppStore';
import type { Task } from '../types';

// Mock the API client
vi.mock('../lib/apiClient', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.name = 'ApiError';
    }
  },
  fetchTasks: vi.fn(),
  createTask: vi.fn(),
  completeTask: vi.fn(),
  restoreTask: vi.fn(),
  deleteTask: vi.fn(),
  refreshTopThree: vi.fn(),
}));

// Import the mocked module for controlling behavior
import * as api from '../lib/apiClient';

const mockTask: Task = {
  taskId: '123e4567-e89b-42d3-a456-426614174000',
  description: 'Test task',
  quadrant: 'schedule',
  priorityScore: 50,
  status: 'incomplete',
  createdAt: '2024-01-01T00:00:00.000Z',
  completedAt: null,
};

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      tasks: [],
      topThree: [],
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has a valid userId', () => {
      const { userId } = useAppStore.getState();
      expect(userId).toBeTruthy();
      expect(userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('starts with empty tasks', () => {
      const { tasks } = useAppStore.getState();
      expect(tasks).toEqual([]);
    });

    it('starts with no error', () => {
      const { error } = useAppStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('loadTasks', () => {
    it('fetches tasks and updates state', async () => {
      vi.mocked(api.fetchTasks).mockResolvedValue({
        tasks: [mockTask],
        topThree: [mockTask.taskId],
      });

      await useAppStore.getState().loadTasks();

      const state = useAppStore.getState();
      expect(state.tasks).toEqual([mockTask]);
      expect(state.topThree).toEqual([mockTask.taskId]);
      expect(state.isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(api.fetchTasks).mockRejectedValue(new Error('Network error'));

      await useAppStore.getState().loadTasks();

      const state = useAppStore.getState();
      expect(state.error).toBe('Failed to load tasks');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('addTask', () => {
    it('creates a task and adds to state', async () => {
      vi.mocked(api.createTask).mockResolvedValue(mockTask);

      const result = await useAppStore.getState().addTask('Test task');

      expect(result).toEqual(mockTask);
      expect(useAppStore.getState().tasks).toContainEqual(mockTask);
    });

    it('sets error and throws on failure', async () => {
      vi.mocked(api.createTask).mockRejectedValue(new Error('Server error'));

      await expect(
        useAppStore.getState().addTask('Test task'),
      ).rejects.toThrow();

      expect(useAppStore.getState().error).toBe('Failed to create task');
    });
  });

  describe('completeTask (optimistic)', () => {
    beforeEach(() => {
      useAppStore.setState({ tasks: [mockTask] });
    });

    it('optimistically marks task as complete', async () => {
      const completedTask = {
        ...mockTask,
        status: 'complete' as const,
        completedAt: '2024-01-02T00:00:00.000Z',
      };
      vi.mocked(api.completeTask).mockResolvedValue(completedTask);

      await useAppStore.getState().completeTask(mockTask.taskId);

      const task = useAppStore.getState().tasks.find(
        (t) => t.taskId === mockTask.taskId,
      );
      expect(task?.status).toBe('complete');
      expect(task?.completedAt).toBeTruthy();
    });

    it('rolls back on failure', async () => {
      vi.mocked(api.completeTask).mockRejectedValue(new Error('Failed'));

      await useAppStore.getState().completeTask(mockTask.taskId);

      const task = useAppStore.getState().tasks.find(
        (t) => t.taskId === mockTask.taskId,
      );
      expect(task?.status).toBe('incomplete');
      expect(task?.completedAt).toBeNull();
      expect(useAppStore.getState().error).toBe('Failed to complete task');
    });
  });

  describe('restoreTask (optimistic)', () => {
    const completedTask: Task = {
      ...mockTask,
      status: 'complete',
      completedAt: '2024-01-02T00:00:00.000Z',
    };

    beforeEach(() => {
      useAppStore.setState({ tasks: [completedTask] });
    });

    it('optimistically restores task to incomplete', async () => {
      vi.mocked(api.restoreTask).mockResolvedValue(mockTask);

      await useAppStore.getState().restoreTask(mockTask.taskId);

      const task = useAppStore.getState().tasks.find(
        (t) => t.taskId === mockTask.taskId,
      );
      expect(task?.status).toBe('incomplete');
      expect(task?.completedAt).toBeNull();
    });

    it('rolls back on failure', async () => {
      vi.mocked(api.restoreTask).mockRejectedValue(new Error('Failed'));

      await useAppStore.getState().restoreTask(mockTask.taskId);

      const task = useAppStore.getState().tasks.find(
        (t) => t.taskId === mockTask.taskId,
      );
      expect(task?.status).toBe('complete');
      expect(task?.completedAt).toBe('2024-01-02T00:00:00.000Z');
      expect(useAppStore.getState().error).toBe('Failed to restore task');
    });
  });

  describe('deleteTask (optimistic)', () => {
    beforeEach(() => {
      useAppStore.setState({ tasks: [mockTask] });
    });

    it('optimistically removes task from list', async () => {
      vi.mocked(api.deleteTask).mockResolvedValue(undefined);

      await useAppStore.getState().deleteTask(mockTask.taskId);

      expect(useAppStore.getState().tasks).toHaveLength(0);
    });

    it('rolls back on failure', async () => {
      vi.mocked(api.deleteTask).mockRejectedValue(new Error('Failed'));

      await useAppStore.getState().deleteTask(mockTask.taskId);

      expect(useAppStore.getState().tasks).toContainEqual(mockTask);
      expect(useAppStore.getState().error).toBe('Failed to delete task');
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useAppStore.setState({ error: 'Some error' });
      useAppStore.getState().clearError();
      expect(useAppStore.getState().error).toBeNull();
    });
  });
});
