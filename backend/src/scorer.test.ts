import { describe, it, expect, vi } from 'vitest';
import { selectTopThree, recalculateScores, getTaskOrdering } from './scorer';
import { Task } from './types';

// Mock aiService for recalculateScores tests
vi.mock('./aiService', () => ({
  categorizeAndScore: vi.fn().mockResolvedValue({
    quadrant: 'do-first',
    priorityScore: 85,
    reasoning: 'Test recalculation',
  }),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 'task-1',
    userId: 'user-1',
    description: 'Test task',
    quadrant: 'schedule',
    priorityScore: 50,
    status: 'incomplete',
    createdAt: '2024-01-15T10:00:00.000Z',
    completedAt: null,
    aiProcessed: true,
    ...overrides,
  };
}

describe('selectTopThree', () => {
  it('returns empty array when no tasks', () => {
    expect(selectTopThree([])).toEqual([]);
  });

  it('returns empty array when all tasks are complete', () => {
    const tasks = [
      makeTask({ taskId: 'a', status: 'complete', priorityScore: 90 }),
      makeTask({ taskId: 'b', status: 'complete', priorityScore: 80 }),
    ];
    expect(selectTopThree(tasks)).toEqual([]);
  });

  it('returns all incomplete tasks when fewer than 3 exist', () => {
    const tasks = [
      makeTask({ taskId: 'a', priorityScore: 60 }),
      makeTask({ taskId: 'b', priorityScore: 80 }),
    ];
    const result = selectTopThree(tasks);
    expect(result).toEqual(['b', 'a']);
  });

  it('returns top 3 by priority score descending', () => {
    const tasks = [
      makeTask({ taskId: 'a', priorityScore: 30 }),
      makeTask({ taskId: 'b', priorityScore: 90 }),
      makeTask({ taskId: 'c', priorityScore: 70 }),
      makeTask({ taskId: 'd', priorityScore: 50 }),
      makeTask({ taskId: 'e', priorityScore: 85 }),
    ];
    const result = selectTopThree(tasks);
    expect(result).toEqual(['b', 'e', 'c']);
  });

  it('breaks ties by createdAt descending (most recent first)', () => {
    const tasks = [
      makeTask({ taskId: 'a', priorityScore: 80, createdAt: '2024-01-10T10:00:00.000Z' }),
      makeTask({ taskId: 'b', priorityScore: 80, createdAt: '2024-01-15T10:00:00.000Z' }),
      makeTask({ taskId: 'c', priorityScore: 80, createdAt: '2024-01-12T10:00:00.000Z' }),
    ];
    const result = selectTopThree(tasks);
    expect(result).toEqual(['b', 'c', 'a']);
  });

  it('excludes completed tasks from selection', () => {
    const tasks = [
      makeTask({ taskId: 'a', priorityScore: 99, status: 'complete' }),
      makeTask({ taskId: 'b', priorityScore: 70 }),
      makeTask({ taskId: 'c', priorityScore: 60 }),
      makeTask({ taskId: 'd', priorityScore: 50 }),
      makeTask({ taskId: 'e', priorityScore: 40 }),
    ];
    const result = selectTopThree(tasks);
    expect(result).toEqual(['b', 'c', 'd']);
  });
});

describe('recalculateScores', () => {
  it('returns empty array when no tasks', async () => {
    const result = await recalculateScores([]);
    expect(result).toEqual([]);
  });

  it('recalculates scores for incomplete tasks', async () => {
    const tasks = [
      makeTask({ taskId: 'a', priorityScore: 30, quadrant: 'eliminate' }),
    ];
    const result = await recalculateScores(tasks);
    expect(result[0].priorityScore).toBe(85);
    expect(result[0].quadrant).toBe('do-first');
    expect(result[0].aiProcessed).toBe(true);
  });

  it('does not recalculate completed tasks', async () => {
    const tasks = [
      makeTask({ taskId: 'a', priorityScore: 30, status: 'complete', quadrant: 'eliminate' }),
    ];
    const result = await recalculateScores(tasks);
    expect(result[0].priorityScore).toBe(30);
    expect(result[0].quadrant).toBe('eliminate');
  });

  it('preserves all tasks in output', async () => {
    const tasks = [
      makeTask({ taskId: 'a', status: 'incomplete' }),
      makeTask({ taskId: 'b', status: 'complete' }),
      makeTask({ taskId: 'c', status: 'incomplete' }),
    ];
    const result = await recalculateScores(tasks);
    expect(result).toHaveLength(3);
  });
});

describe('getTaskOrdering', () => {
  it('returns empty array when no tasks', () => {
    expect(getTaskOrdering([])).toEqual([]);
  });

  it('groups tasks by quadrant in correct order', () => {
    const tasks = [
      makeTask({ taskId: 'a', quadrant: 'eliminate', priorityScore: 10 }),
      makeTask({ taskId: 'b', quadrant: 'do-first', priorityScore: 90 }),
      makeTask({ taskId: 'c', quadrant: 'delegate', priorityScore: 30 }),
      makeTask({ taskId: 'd', quadrant: 'schedule', priorityScore: 60 }),
    ];
    const result = getTaskOrdering(tasks);
    expect(result.map((t) => t.quadrant)).toEqual([
      'do-first',
      'schedule',
      'delegate',
      'eliminate',
    ]);
  });

  it('sorts within quadrant by score descending', () => {
    const tasks = [
      makeTask({ taskId: 'a', quadrant: 'schedule', priorityScore: 55 }),
      makeTask({ taskId: 'b', quadrant: 'schedule', priorityScore: 70 }),
      makeTask({ taskId: 'c', quadrant: 'schedule', priorityScore: 60 }),
    ];
    const result = getTaskOrdering(tasks);
    expect(result.map((t) => t.taskId)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties within quadrant by createdAt descending', () => {
    const tasks = [
      makeTask({ taskId: 'a', quadrant: 'do-first', priorityScore: 90, createdAt: '2024-01-10T10:00:00.000Z' }),
      makeTask({ taskId: 'b', quadrant: 'do-first', priorityScore: 90, createdAt: '2024-01-15T10:00:00.000Z' }),
      makeTask({ taskId: 'c', quadrant: 'do-first', priorityScore: 90, createdAt: '2024-01-12T10:00:00.000Z' }),
    ];
    const result = getTaskOrdering(tasks);
    expect(result.map((t) => t.taskId)).toEqual(['b', 'c', 'a']);
  });

  it('handles multiple tasks across multiple quadrants', () => {
    const tasks = [
      makeTask({ taskId: 'a', quadrant: 'eliminate', priorityScore: 10 }),
      makeTask({ taskId: 'b', quadrant: 'do-first', priorityScore: 95 }),
      makeTask({ taskId: 'c', quadrant: 'do-first', priorityScore: 80 }),
      makeTask({ taskId: 'd', quadrant: 'schedule', priorityScore: 65 }),
      makeTask({ taskId: 'e', quadrant: 'delegate', priorityScore: 40 }),
      makeTask({ taskId: 'f', quadrant: 'delegate', priorityScore: 35 }),
    ];
    const result = getTaskOrdering(tasks);
    expect(result.map((t) => t.taskId)).toEqual(['b', 'c', 'd', 'e', 'f', 'a']);
  });
});
