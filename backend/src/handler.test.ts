import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './handler';
import { ApiEvent } from './types';

// Mock external dependencies
vi.mock('./taskService', () => ({
  createTask: vi.fn(),
  completeTask: vi.fn(),
  restoreTask: vi.fn(),
  deleteTask: vi.fn(),
  getTopThree: vi.fn(),
  recalculate: vi.fn(),
}));

vi.mock('./dbService', () => ({
  getTasksByUser: vi.fn(),
}));

import * as taskService from './taskService';
import * as dbService from './dbService';

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeEvent(overrides: Partial<ApiEvent> = {}): ApiEvent {
  return {
    httpMethod: 'GET',
    path: '/tasks',
    headers: { 'x-user-id': VALID_USER_ID },
    body: null,
    ...overrides,
  };
}

describe('handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS headers', () => {
    it('includes CORS headers in all responses', async () => {
      vi.mocked(dbService.getTasksByUser).mockResolvedValue([]);
      vi.mocked(taskService.getTopThree).mockResolvedValue([]);

      const response = await handler(makeEvent());

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Headers']).toBe('Content-Type, x-api-key, x-user-id');
      expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST, PATCH, DELETE, OPTIONS');
      expect(response.headers['Content-Type']).toBe('application/json');
    });

    it('returns 204 for OPTIONS preflight requests', async () => {
      const response = await handler(makeEvent({ httpMethod: 'OPTIONS', path: '/tasks' }));

      expect(response.statusCode).toBe(204);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('userId validation', () => {
    it('returns 400 when x-user-id header is missing', async () => {
      const response = await handler(makeEvent({ headers: {} }));

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('x-user-id');
    });

    it('returns 400 when x-user-id is not a valid UUID v4', async () => {
      const response = await handler(makeEvent({ headers: { 'x-user-id': 'invalid-uuid' } }));

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('UUID v4');
    });

    it('accepts valid UUID v4 in x-user-id header', async () => {
      vi.mocked(dbService.getTasksByUser).mockResolvedValue([]);
      vi.mocked(taskService.getTopThree).mockResolvedValue([]);

      const response = await handler(makeEvent());

      expect(response.statusCode).toBe(200);
    });
  });

  describe('route matching', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await handler(makeEvent({ httpMethod: 'GET', path: '/unknown' }));

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for wrong HTTP method on known path', async () => {
      const response = await handler(makeEvent({ httpMethod: 'PUT', path: '/tasks' }));

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /tasks', () => {
    it('creates a task with valid request body', async () => {
      const mockTask = {
        taskId: 'task-123',
        userId: VALID_USER_ID,
        description: 'Buy groceries',
        quadrant: 'schedule' as const,
        priorityScore: 50,
        status: 'incomplete' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: null,
        aiProcessed: false,
      };
      vi.mocked(taskService.createTask).mockResolvedValue(mockTask);

      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks',
        body: JSON.stringify({ description: 'Buy groceries' }),
      }));

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.taskId).toBe('task-123');
      expect(body.description).toBe('Buy groceries');
      expect(body.quadrant).toBe('schedule');
      expect(body.priorityScore).toBe(50);
      expect(body.status).toBe('incomplete');
    });

    it('returns 400 for invalid JSON body', async () => {
      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks',
        body: 'not json',
      }));

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('returns 400 for missing description field', async () => {
      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks',
        body: JSON.stringify({}),
      }));

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('description');
    });

    it('returns 400 for empty description', async () => {
      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks',
        body: JSON.stringify({ description: '' }),
      }));

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 when AI service fails', async () => {
      vi.mocked(taskService.createTask).mockRejectedValue(new Error('AI service unavailable'));

      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks',
        body: JSON.stringify({ description: 'Buy groceries' }),
      }));

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AI_UNAVAILABLE');
      expect(body.error.retryAfter).toBe(30);
    });
  });

  describe('GET /tasks', () => {
    it('returns tasks and top three', async () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          userId: VALID_USER_ID,
          description: 'Task one',
          quadrant: 'do-first' as const,
          priorityScore: 90,
          status: 'incomplete' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          completedAt: null,
          aiProcessed: true,
        },
      ];
      vi.mocked(dbService.getTasksByUser).mockResolvedValue(mockTasks);
      vi.mocked(taskService.getTopThree).mockResolvedValue(['task-1']);

      const response = await handler(makeEvent());

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0].taskId).toBe('task-1');
      expect(body.topThree).toEqual(['task-1']);
    });
  });

  describe('PATCH /tasks/{taskId}/complete', () => {
    it('marks a task as complete', async () => {
      const mockTask = {
        taskId: 'task-1',
        userId: VALID_USER_ID,
        description: 'Task one',
        quadrant: 'schedule' as const,
        priorityScore: 50,
        status: 'complete' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-02T00:00:00.000Z',
        aiProcessed: true,
      };
      vi.mocked(taskService.completeTask).mockResolvedValue(mockTask);

      const response = await handler(makeEvent({
        httpMethod: 'PATCH',
        path: '/tasks/task-1/complete',
      }));

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('complete');
      expect(body.completedAt).toBe('2024-01-02T00:00:00.000Z');
    });

    it('returns 404 when task not found', async () => {
      vi.mocked(taskService.completeTask).mockRejectedValue(new Error('Task xyz not found'));

      const response = await handler(makeEvent({
        httpMethod: 'PATCH',
        path: '/tasks/xyz/complete',
      }));

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /tasks/{taskId}/incomplete', () => {
    it('restores a task to incomplete', async () => {
      const mockTask = {
        taskId: 'task-1',
        userId: VALID_USER_ID,
        description: 'Task one',
        quadrant: 'schedule' as const,
        priorityScore: 50,
        status: 'incomplete' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: null,
        aiProcessed: true,
      };
      vi.mocked(taskService.restoreTask).mockResolvedValue(mockTask);

      const response = await handler(makeEvent({
        httpMethod: 'PATCH',
        path: '/tasks/task-1/incomplete',
      }));

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('incomplete');
      expect(body.completedAt).toBeNull();
    });
  });

  describe('DELETE /tasks/{taskId}', () => {
    it('deletes a task successfully', async () => {
      vi.mocked(taskService.deleteTask).mockResolvedValue(undefined);

      const response = await handler(makeEvent({
        httpMethod: 'DELETE',
        path: '/tasks/task-1',
      }));

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('deleted');
    });

    it('returns 404 when task not found', async () => {
      vi.mocked(taskService.deleteTask).mockRejectedValue(new Error('Task xyz not found'));

      const response = await handler(makeEvent({
        httpMethod: 'DELETE',
        path: '/tasks/xyz',
      }));

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /tasks/top-three', () => {
    it('returns top three task IDs', async () => {
      vi.mocked(taskService.getTopThree).mockResolvedValue(['t1', 't2', 't3']);

      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks/top-three',
      }));

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.topThree).toEqual(['t1', 't2', 't3']);
    });
  });

  describe('POST /tasks/recalculate', () => {
    it('recalculates and returns updated tasks', async () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          userId: VALID_USER_ID,
          description: 'Task one',
          quadrant: 'do-first' as const,
          priorityScore: 85,
          status: 'incomplete' as const,
          createdAt: '2024-01-01T00:00:00.000Z',
          completedAt: null,
          aiProcessed: true,
        },
      ];
      vi.mocked(taskService.recalculate).mockResolvedValue(mockTasks);

      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks/recalculate',
      }));

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0].priorityScore).toBe(85);
    });

    it('returns 503 when AI is unavailable during recalculation', async () => {
      vi.mocked(taskService.recalculate).mockRejectedValue(new Error('Bedrock invocation failed'));

      const response = await handler(makeEvent({
        httpMethod: 'POST',
        path: '/tasks/recalculate',
      }));

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AI_UNAVAILABLE');
      expect(body.error.retryAfter).toBe(30);
    });
  });
});
