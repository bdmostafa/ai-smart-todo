import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Task } from './types';

// Mock dbService
vi.mock('./dbService', () => ({
  createTask: vi.fn(),
  getTasksByUser: vi.fn(),
  getIncompleteTasksByScore: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

// Mock aiService
vi.mock('./aiService', () => ({
  categorizeAndScore: vi.fn(),
}));

// Mock scorer (selectTopThree and recalculateScores)
vi.mock('./scorer', () => ({
  selectTopThree: vi.fn(),
  recalculateScores: vi.fn(),
}));

import * as taskService from './taskService';
import * as dbService from './dbService';
import { categorizeAndScore } from './aiService';
import { selectTopThree, recalculateScores } from './scorer';

const VALID_USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const VALID_TASK_ID = 'f1e2d3c4-b5a6-4789-8012-3456789abcde';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: VALID_TASK_ID,
    userId: VALID_USER_ID,
    description: 'Test task',
    quadrant: 'schedule',
    priorityScore: 50,
    status: 'incomplete',
    createdAt: '2024-01-15T10:00:00.000Z',
    completedAt: null,
    aiProcessed: false,
    ...overrides,
  };
}

describe('taskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTask', () => {
    it('throws error for invalid userId', async () => {
      await expect(taskService.createTask('invalid-id', 'Buy milk')).rejects.toThrow(
        'Invalid user ID format'
      );
    });

    it('throws error for empty description', async () => {
      await expect(taskService.createTask(VALID_USER_ID, '')).rejects.toThrow(
        'Task description must be between 1 and 500 characters'
      );
    });

    it('throws error for whitespace-only description', async () => {
      await expect(taskService.createTask(VALID_USER_ID, '   ')).rejects.toThrow(
        'Task description must be between 1 and 500 characters'
      );
    });

    it('creates task with defaults then enriches with AI results', async () => {
      const aiResult = { quadrant: 'do-first' as const, priorityScore: 85, reasoning: 'Urgent' };
      const enrichedTask = makeTask({ quadrant: 'do-first', priorityScore: 85, aiProcessed: true });

      vi.mocked(dbService.createTask).mockResolvedValue(makeTask());
      vi.mocked(dbService.getTasksByUser).mockResolvedValue([]);
      vi.mocked(categorizeAndScore).mockResolvedValue(aiResult);
      vi.mocked(dbService.updateTask).mockResolvedValue(enrichedTask);

      const result = await taskService.createTask(VALID_USER_ID, 'Buy milk');

      // Verify task was first created with defaults
      expect(dbService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: VALID_USER_ID,
          description: 'Buy milk',
          quadrant: 'schedule',
          priorityScore: 50,
          status: 'incomplete',
          aiProcessed: false,
        })
      );

      // Verify AI was invoked
      expect(categorizeAndScore).toHaveBeenCalledWith('Buy milk', 0);

      // Verify task was updated with AI results
      expect(dbService.updateTask).toHaveBeenCalledWith(
        VALID_USER_ID,
        expect.any(String),
        { quadrant: 'do-first', priorityScore: 85, aiProcessed: true }
      );

      expect(result).toEqual(enrichedTask);
    });

    it('returns task with defaults when AI fails', async () => {
      const defaultTask = makeTask();

      vi.mocked(dbService.createTask).mockResolvedValue(defaultTask);
      vi.mocked(dbService.getTasksByUser).mockResolvedValue([]);
      vi.mocked(categorizeAndScore).mockRejectedValue(new Error('AI failure'));

      const result = await taskService.createTask(VALID_USER_ID, 'Buy milk');

      expect(dbService.createTask).toHaveBeenCalled();
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(50);
      expect(result.aiProcessed).toBe(false);
    });

    it('trims the description before saving', async () => {
      vi.mocked(dbService.createTask).mockResolvedValue(makeTask({ description: 'Buy milk' }));
      vi.mocked(dbService.getTasksByUser).mockResolvedValue([]);
      vi.mocked(categorizeAndScore).mockRejectedValue(new Error('AI failure'));

      await taskService.createTask(VALID_USER_ID, '  Buy milk  ');

      expect(dbService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Buy milk' })
      );
    });

    it('passes correct taskCount to AI (excluding the new task)', async () => {
      const existingTasks = [makeTask({ taskId: 'other-task' })];

      vi.mocked(dbService.createTask).mockResolvedValue(makeTask());
      vi.mocked(dbService.getTasksByUser).mockResolvedValue(existingTasks);
      vi.mocked(categorizeAndScore).mockResolvedValue({
        quadrant: 'schedule',
        priorityScore: 60,
        reasoning: '',
      });
      vi.mocked(dbService.updateTask).mockResolvedValue(makeTask({ priorityScore: 60 }));

      await taskService.createTask(VALID_USER_ID, 'New task');

      expect(categorizeAndScore).toHaveBeenCalledWith('New task', 1);
    });
  });

  describe('completeTask', () => {
    it('throws error for invalid userId', async () => {
      await expect(taskService.completeTask('bad-id', VALID_TASK_ID)).rejects.toThrow(
        'Invalid user ID format'
      );
    });

    it('updates task status to complete with completedAt timestamp', async () => {
      const completedTask = makeTask({ status: 'complete', completedAt: '2024-01-20T10:00:00.000Z' });
      vi.mocked(dbService.updateTask).mockResolvedValue(completedTask);

      const result = await taskService.completeTask(VALID_USER_ID, VALID_TASK_ID);

      expect(dbService.updateTask).toHaveBeenCalledWith(
        VALID_USER_ID,
        VALID_TASK_ID,
        expect.objectContaining({
          status: 'complete',
          completedAt: expect.any(String),
        })
      );
      expect(result.status).toBe('complete');
      expect(result.completedAt).not.toBeNull();
    });
  });

  describe('restoreTask', () => {
    it('throws error for invalid userId', async () => {
      await expect(taskService.restoreTask('bad-id', VALID_TASK_ID)).rejects.toThrow(
        'Invalid user ID format'
      );
    });

    it('updates task status to incomplete and clears completedAt', async () => {
      const restoredTask = makeTask({ status: 'incomplete', completedAt: null });
      vi.mocked(dbService.updateTask).mockResolvedValue(restoredTask);

      const result = await taskService.restoreTask(VALID_USER_ID, VALID_TASK_ID);

      expect(dbService.updateTask).toHaveBeenCalledWith(
        VALID_USER_ID,
        VALID_TASK_ID,
        { status: 'incomplete', completedAt: null }
      );
      expect(result.status).toBe('incomplete');
      expect(result.completedAt).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('throws error for invalid userId', async () => {
      await expect(taskService.deleteTask('bad-id', VALID_TASK_ID)).rejects.toThrow(
        'Invalid user ID format'
      );
    });

    it('deletes task from DynamoDB', async () => {
      vi.mocked(dbService.deleteTask).mockResolvedValue(undefined);

      await taskService.deleteTask(VALID_USER_ID, VALID_TASK_ID);

      expect(dbService.deleteTask).toHaveBeenCalledWith(VALID_USER_ID, VALID_TASK_ID);
    });
  });

  describe('getTopThree', () => {
    it('throws error for invalid userId', async () => {
      await expect(taskService.getTopThree('bad-id')).rejects.toThrow(
        'Invalid user ID format'
      );
    });

    it('retrieves incomplete tasks and applies selectTopThree', async () => {
      const tasks = [
        makeTask({ taskId: 'a', priorityScore: 90 }),
        makeTask({ taskId: 'b', priorityScore: 80 }),
        makeTask({ taskId: 'c', priorityScore: 70 }),
      ];
      vi.mocked(dbService.getIncompleteTasksByScore).mockResolvedValue(tasks);
      vi.mocked(selectTopThree).mockReturnValue(['a', 'b', 'c']);

      const result = await taskService.getTopThree(VALID_USER_ID);

      expect(dbService.getIncompleteTasksByScore).toHaveBeenCalledWith(VALID_USER_ID);
      expect(selectTopThree).toHaveBeenCalledWith(tasks);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array when no incomplete tasks', async () => {
      vi.mocked(dbService.getIncompleteTasksByScore).mockResolvedValue([]);
      vi.mocked(selectTopThree).mockReturnValue([]);

      const result = await taskService.getTopThree(VALID_USER_ID);
      expect(result).toEqual([]);
    });
  });

  describe('recalculate', () => {
    it('throws error for invalid userId', async () => {
      await expect(taskService.recalculate('bad-id')).rejects.toThrow(
        'Invalid user ID format'
      );
    });

    it('returns empty array when no incomplete tasks', async () => {
      vi.mocked(dbService.getIncompleteTasksByScore).mockResolvedValue([]);

      const result = await taskService.recalculate(VALID_USER_ID);
      expect(result).toEqual([]);
    });

    it('recalculates scores and persists updates to DynamoDB', async () => {
      const tasks = [
        makeTask({ taskId: 'a', priorityScore: 50 }),
        makeTask({ taskId: 'b', priorityScore: 60 }),
      ];
      const rescored = [
        makeTask({ taskId: 'a', priorityScore: 85, quadrant: 'do-first', aiProcessed: true }),
        makeTask({ taskId: 'b', priorityScore: 70, quadrant: 'schedule', aiProcessed: true }),
      ];

      vi.mocked(dbService.getIncompleteTasksByScore).mockResolvedValue(tasks);
      vi.mocked(recalculateScores).mockResolvedValue(rescored);
      vi.mocked(dbService.updateTask)
        .mockResolvedValueOnce(rescored[0])
        .mockResolvedValueOnce(rescored[1]);

      const result = await taskService.recalculate(VALID_USER_ID);

      expect(recalculateScores).toHaveBeenCalledWith(tasks);
      expect(dbService.updateTask).toHaveBeenCalledTimes(2);
      expect(dbService.updateTask).toHaveBeenCalledWith(VALID_USER_ID, 'a', {
        quadrant: 'do-first',
        priorityScore: 85,
        aiProcessed: true,
      });
      expect(dbService.updateTask).toHaveBeenCalledWith(VALID_USER_ID, 'b', {
        quadrant: 'schedule',
        priorityScore: 70,
        aiProcessed: true,
      });
      expect(result).toHaveLength(2);
    });
  });
});
