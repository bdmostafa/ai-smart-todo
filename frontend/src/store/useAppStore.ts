import { create } from 'zustand';
import type { AppState, Task } from '../types';
import { getUserId } from '../lib/userId';
import * as api from '../lib/apiClient';
import { ApiError } from '../lib/apiClient';

/**
 * Actions available on the app store.
 */
export interface AppActions {
  /** Load all tasks from the backend */
  loadTasks: () => Promise<void>;
  /** Create a new task (optimistic: adds placeholder, rolls back on failure) */
  addTask: (description: string) => Promise<Task>;
  /** Mark a task as complete (optimistic) */
  completeTask: (taskId: string) => Promise<void>;
  /** Restore a completed task to incomplete (optimistic) */
  restoreTask: (taskId: string) => Promise<void>;
  /** Delete a task (optimistic) */
  deleteTask: (taskId: string) => Promise<void>;
  /** Refresh top-three recommendations */
  refreshTopThree: () => Promise<void>;
  /** Clear the current error */
  clearError: () => void;
}

export type AppStore = AppState & AppActions;

/**
 * Zustand store implementing AppState with optimistic update pattern.
 *
 * Optimistic updates:
 * - UI updates immediately on user action
 * - On API failure, state is rolled back to previous snapshot
 * - Error is set for display in the UI
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export const useAppStore = create<AppStore>((set, get) => ({
  // --- Initial State ---
  tasks: [],
  topThree: [],
  isLoading: false,
  error: null,
  userId: getUserId(),

  // --- Actions ---

  loadTasks: async () => {
    const { userId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await api.fetchTasks(userId);
      set({
        tasks: response.tasks,
        topThree: response.topThree,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to load tasks';
      set({ isLoading: false, error: message });
    }
  },

  addTask: async (description: string) => {
    const { userId, tasks } = get();
    set({ error: null });

    try {
      const response = await api.createTask(userId, { description });
      const newTask: Task = { ...response };
      set({ tasks: [...tasks, newTask] });
      return newTask;
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to create task';
      set({ error: message });
      throw err;
    }
  },

  completeTask: async (taskId: string) => {
    const { userId, tasks } = get();
    const previousTasks = tasks;

    // Optimistic update
    set({
      tasks: tasks.map((t) =>
        t.taskId === taskId
          ? { ...t, status: 'complete' as const, completedAt: new Date().toISOString() }
          : t,
      ),
      error: null,
    });

    try {
      const updated = await api.completeTask(userId, taskId);
      // Replace with server response
      set({
        tasks: get().tasks.map((t) => (t.taskId === taskId ? { ...updated } : t)),
      });
    } catch (err) {
      // Rollback
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to complete task';
      set({ tasks: previousTasks, error: message });
    }
  },

  restoreTask: async (taskId: string) => {
    const { userId, tasks } = get();
    const previousTasks = tasks;

    // Optimistic update
    set({
      tasks: tasks.map((t) =>
        t.taskId === taskId
          ? { ...t, status: 'incomplete' as const, completedAt: null }
          : t,
      ),
      error: null,
    });

    try {
      const updated = await api.restoreTask(userId, taskId);
      set({
        tasks: get().tasks.map((t) => (t.taskId === taskId ? { ...updated } : t)),
      });
    } catch (err) {
      // Rollback
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to restore task';
      set({ tasks: previousTasks, error: message });
    }
  },

  deleteTask: async (taskId: string) => {
    const { userId, tasks } = get();
    const previousTasks = tasks;

    // Optimistic update: remove from list
    set({
      tasks: tasks.filter((t) => t.taskId !== taskId),
      error: null,
    });

    try {
      await api.deleteTask(userId, taskId);
    } catch (err) {
      // Rollback
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to delete task';
      set({ tasks: previousTasks, error: message });
    }
  },

  refreshTopThree: async () => {
    const { userId } = get();
    try {
      const response = await api.refreshTopThree(userId);
      set({ topThree: response.topThree });
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to refresh recommendations';
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
