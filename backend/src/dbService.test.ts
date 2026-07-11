import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Task } from './types';

// Mock the AWS SDK
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend })),
  },
  PutCommand: vi.fn((input) => ({ input, type: 'Put' })),
  QueryCommand: vi.fn((input) => ({ input, type: 'Query' })),
  UpdateCommand: vi.fn((input) => ({ input, type: 'Update' })),
  DeleteCommand: vi.fn((input) => ({ input, type: 'Delete' })),
}));

import {
  createTask,
  getTasksByUser,
  getIncompleteTasksByScore,
  updateTask,
  deleteTask,
} from './dbService';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 'task-123',
    userId: 'user-456',
    description: 'Test task',
    quadrant: 'do-first',
    priorityScore: 85,
    status: 'incomplete',
    createdAt: '2024-01-01T00:00:00.000Z',
    completedAt: null,
    aiProcessed: true,
    ...overrides,
  };
}

describe('dbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTask', () => {
    it('should put item with correct key structure', async () => {
      mockSend.mockResolvedValueOnce({});
      const task = makeTask();

      const result = await createTask(task);

      expect(result).toEqual(task);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Item.PK).toBe('USER#user-456');
      expect(cmd.input.Item.SK).toBe('TASK#task-123');
      expect(cmd.input.Item.GSI1PK).toBe('USER#user-456#STATUS#incomplete');
      expect(cmd.input.Item.GSI1SK).toBe('SCORE#085');
    });

    it('should set GSI1PK to complete status when task is complete', async () => {
      mockSend.mockResolvedValueOnce({});
      const task = makeTask({ status: 'complete' });

      await createTask(task);

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Item.GSI1PK).toBe('USER#user-456#STATUS#complete');
    });

    it('should zero-pad priority score in GSI1SK', async () => {
      mockSend.mockResolvedValueOnce({});
      const task = makeTask({ priorityScore: 5 });

      await createTask(task);

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Item.GSI1SK).toBe('SCORE#005');
    });

    it('should retry once on failure then succeed', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Throttled'))
        .mockResolvedValueOnce({});

      const task = makeTask();
      const result = await createTask(task);

      expect(result).toEqual(task);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw after retries exhausted', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Throttled'))
        .mockRejectedValueOnce(new Error('Throttled'));

      const task = makeTask();
      await expect(createTask(task)).rejects.toThrow('Throttled');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTasksByUser', () => {
    it('should query by PK and return tasks', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            taskId: 'task-1',
            userId: 'user-456',
            description: 'Task 1',
            quadrant: 'schedule',
            priorityScore: 50,
            status: 'incomplete',
            createdAt: '2024-01-01T00:00:00.000Z',
            completedAt: null,
            aiProcessed: false,
          },
        ],
      });

      const tasks = await getTasksByUser('user-456');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].taskId).toBe('task-1');
      expect(tasks[0].userId).toBe('user-456');
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.KeyConditionExpression).toBe('PK = :pk');
      expect(cmd.input.ExpressionAttributeValues[':pk']).toBe('USER#user-456');
    });

    it('should return empty array when no items found', async () => {
      mockSend.mockResolvedValueOnce({ Items: undefined });

      const tasks = await getTasksByUser('user-456');
      expect(tasks).toEqual([]);
    });

    it('should retry on failure', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ Items: [] });

      const tasks = await getTasksByUser('user-456');
      expect(tasks).toEqual([]);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getIncompleteTasksByScore', () => {
    it('should query GSI1 with descending sort', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            taskId: 'task-1',
            userId: 'user-456',
            description: 'High priority',
            quadrant: 'do-first',
            priorityScore: 95,
            status: 'incomplete',
            createdAt: '2024-01-01T00:00:00.000Z',
            completedAt: null,
            aiProcessed: true,
          },
        ],
      });

      const tasks = await getIncompleteTasksByScore('user-456');

      expect(tasks).toHaveLength(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe('GSI1');
      expect(cmd.input.KeyConditionExpression).toBe('GSI1PK = :gsi1pk');
      expect(cmd.input.ExpressionAttributeValues[':gsi1pk']).toBe(
        'USER#user-456#STATUS#incomplete'
      );
      expect(cmd.input.ScanIndexForward).toBe(false);
    });
  });

  describe('updateTask', () => {
    it('should build update expression from partial updates', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: {
          taskId: 'task-123',
          userId: 'user-456',
          description: 'Updated task',
          quadrant: 'do-first',
          priorityScore: 85,
          status: 'incomplete',
          createdAt: '2024-01-01T00:00:00.000Z',
          completedAt: null,
          aiProcessed: true,
        },
      });

      const result = await updateTask('user-456', 'task-123', {
        description: 'Updated task',
      });

      expect(result.description).toBe('Updated task');
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Key.PK).toBe('USER#user-456');
      expect(cmd.input.Key.SK).toBe('TASK#task-123');
      expect(cmd.input.UpdateExpression).toContain('#description = :description');
    });

    it('should update GSI1PK when status changes', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: {
          taskId: 'task-123',
          userId: 'user-456',
          description: 'Test',
          quadrant: 'do-first',
          priorityScore: 85,
          status: 'complete',
          createdAt: '2024-01-01T00:00:00.000Z',
          completedAt: '2024-01-02T00:00:00.000Z',
          aiProcessed: true,
        },
      });

      const result = await updateTask('user-456', 'task-123', {
        status: 'complete',
        completedAt: '2024-01-02T00:00:00.000Z',
      });

      expect(result.status).toBe('complete');
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[':gsi1pk']).toBe(
        'USER#user-456#STATUS#complete'
      );
    });

    it('should update GSI1SK when priorityScore changes', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: {
          taskId: 'task-123',
          userId: 'user-456',
          description: 'Test',
          quadrant: 'do-first',
          priorityScore: 92,
          status: 'incomplete',
          createdAt: '2024-01-01T00:00:00.000Z',
          completedAt: null,
          aiProcessed: true,
        },
      });

      await updateTask('user-456', 'task-123', { priorityScore: 92 });

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[':gsi1sk']).toBe('SCORE#092');
    });
  });

  describe('deleteTask', () => {
    it('should delete with correct key', async () => {
      mockSend.mockResolvedValueOnce({});

      await deleteTask('user-456', 'task-123');

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Key.PK).toBe('USER#user-456');
      expect(cmd.input.Key.SK).toBe('TASK#task-123');
    });

    it('should retry on failure', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Throttled'))
        .mockResolvedValueOnce({});

      await deleteTask('user-456', 'task-123');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
