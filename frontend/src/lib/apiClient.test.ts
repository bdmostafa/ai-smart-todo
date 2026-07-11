import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiError, fetchTasks, createTask, completeTask, deleteTask } from './apiClient';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('apiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchTasks', () => {
    it('calls GET /tasks with proper headers', async () => {
      const mockResponse = { tasks: [], topThree: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchTasks('user-id-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-user-id': 'user-id-123',
            'x-api-key': expect.any(String),
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws ApiError on non-OK response with error body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { code: 'VALIDATION_ERROR', message: 'Unauthorized' },
          }),
      });

      await expect(fetchTasks('user-id')).rejects.toThrow(ApiError);
      await expect(fetchTasks('user-id')).rejects.toMatchObject({
        status: 401,
        code: 'VALIDATION_ERROR',
        message: 'Unauthorized',
      });
    });

    it('throws ApiError with defaults when response body is not parseable', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not JSON')),
      });

      await expect(fetchTasks('user-id')).rejects.toMatchObject({
        status: 500,
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('createTask', () => {
    it('calls POST /tasks with request body', async () => {
      const mockTask = {
        taskId: 'task-1',
        description: 'Buy milk',
        quadrant: 'schedule',
        priorityScore: 50,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: null,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTask),
      });

      const result = await createTask('user-id', { description: 'Buy milk' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ description: 'Buy milk' }),
        }),
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('completeTask', () => {
    it('calls PATCH /tasks/{taskId}/complete', async () => {
      const mockTask = {
        taskId: 'task-1',
        description: 'Buy milk',
        quadrant: 'schedule',
        priorityScore: 50,
        status: 'complete',
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-02T00:00:00.000Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTask),
      });

      const result = await completeTask('user-id', 'task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task-1/complete'),
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(result.status).toBe('complete');
    });
  });

  describe('deleteTask', () => {
    it('calls DELETE /tasks/{taskId}', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      await deleteTask('user-id', 'task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('ApiError', () => {
    it('has correct properties', () => {
      const err = new ApiError(404, 'NOT_FOUND', 'Task not found');
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Task not found');
      expect(err.name).toBe('ApiError');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
