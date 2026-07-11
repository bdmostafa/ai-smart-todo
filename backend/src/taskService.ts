/**
 * Task service business logic orchestration.
 *
 * Implements the "write-then-enrich" pattern for task creation:
 * 1. Task is immediately saved to DynamoDB with defaults (quadrant: "schedule", score: 50)
 * 2. Bedrock is invoked for AI categorization/scoring
 * 3. If AI succeeds, task is updated with AI results
 * 4. If AI fails, task retains defaults and is flagged for retry
 *
 * Requirements: 1.1, 1.4, 5.1, 5.3, 5.5, 6.2, 6.3, 4.1, 4.5, 3.4
 */

import { Task } from './types';
import { validateDescription, validateUserId } from './validator';
import * as dbService from './dbService';
import { categorizeAndScore } from './aiService';
import { selectTopThree, recalculateScores } from './scorer';

/**
 * Create a new task using the write-then-enrich pattern.
 *
 * 1. Validates userId and description
 * 2. Writes task to DynamoDB with defaults (quadrant: "schedule", score: 50)
 * 3. Invokes AI for categorization and scoring
 * 4. Updates task with AI results if successful; retains defaults if AI fails
 *
 * Requirements: 1.1, 1.4
 */
export async function createTask(userId: string, description: string): Promise<Task> {
  // Validate inputs
  if (!validateUserId(userId)) {
    throw new Error('Invalid user ID format. Must be a valid UUID v4.');
  }

  const validation = validateDescription(description);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid task description.');
  }

  const trimmedDescription = description.trim();

  // Build task with defaults
  const task: Task = {
    taskId: crypto.randomUUID(),
    userId,
    description: trimmedDescription,
    quadrant: 'schedule',
    priorityScore: 50,
    status: 'incomplete',
    createdAt: new Date().toISOString(),
    completedAt: null,
    aiProcessed: false,
  };

  // Step 1: Write to DynamoDB immediately with defaults
  await dbService.createTask(task);

  // Step 2: Invoke AI for categorization and scoring
  try {
    const existingTasks = await dbService.getTasksByUser(userId);
    const taskCount = existingTasks.filter((t) => t.taskId !== task.taskId).length;

    const aiResult = await categorizeAndScore(trimmedDescription, taskCount);

    // Step 3: Update task with AI results
    const updatedTask = await dbService.updateTask(userId, task.taskId, {
      quadrant: aiResult.quadrant,
      priorityScore: aiResult.priorityScore,
      aiProcessed: true,
    });

    return updatedTask;
  } catch {
    // Step 4: AI failed — task retains defaults, flagged for retry
    return task;
  }
}

/**
 * Mark a task as complete.
 *
 * Updates status to "complete", sets completedAt timestamp,
 * and updates GSI keys to move the task out of the incomplete index.
 *
 * Requirements: 5.1, 5.3
 */
export async function completeTask(userId: string, taskId: string): Promise<Task> {
  if (!validateUserId(userId)) {
    throw new Error('Invalid user ID format. Must be a valid UUID v4.');
  }

  const updatedTask = await dbService.updateTask(userId, taskId, {
    status: 'complete',
    completedAt: new Date().toISOString(),
  });

  return updatedTask;
}

/**
 * Restore a completed task to incomplete status.
 *
 * Updates status to "incomplete", clears completedAt,
 * and restores GSI keys with the task's original quadrant.
 *
 * Requirements: 5.5
 */
export async function restoreTask(userId: string, taskId: string): Promise<Task> {
  if (!validateUserId(userId)) {
    throw new Error('Invalid user ID format. Must be a valid UUID v4.');
  }

  const updatedTask = await dbService.updateTask(userId, taskId, {
    status: 'incomplete',
    completedAt: null,
  });

  return updatedTask;
}

/**
 * Delete a task permanently from DynamoDB.
 *
 * Requirements: 6.2, 6.3
 */
export async function deleteTask(userId: string, taskId: string): Promise<void> {
  if (!validateUserId(userId)) {
    throw new Error('Invalid user ID format. Must be a valid UUID v4.');
  }

  await dbService.deleteTask(userId, taskId);
}

/**
 * Get the top three highest-priority incomplete tasks for a user.
 *
 * Retrieves all incomplete tasks sorted by score, then applies
 * selectTopThree logic to return the top 3 task IDs.
 *
 * Requirements: 4.1, 4.5
 */
export async function getTopThree(userId: string): Promise<string[]> {
  if (!validateUserId(userId)) {
    throw new Error('Invalid user ID format. Must be a valid UUID v4.');
  }

  const incompleteTasks = await dbService.getIncompleteTasksByScore(userId);
  return selectTopThree(incompleteTasks);
}

/**
 * Recalculate priority scores for all incomplete tasks.
 *
 * Fetches incomplete tasks, re-invokes AI for each one,
 * and updates DynamoDB with the new scores and quadrants.
 *
 * Requirements: 3.4
 */
export async function recalculate(userId: string): Promise<Task[]> {
  if (!validateUserId(userId)) {
    throw new Error('Invalid user ID format. Must be a valid UUID v4.');
  }

  const incompleteTasks = await dbService.getIncompleteTasksByScore(userId);

  if (incompleteTasks.length === 0) {
    return [];
  }

  // Re-score all incomplete tasks via AI
  const updatedTasks = await recalculateScores(incompleteTasks);

  // Persist updated scores and quadrants to DynamoDB
  const persistedTasks = await Promise.all(
    updatedTasks.map(async (task) => {
      if (task.status === 'incomplete') {
        return dbService.updateTask(userId, task.taskId, {
          quadrant: task.quadrant,
          priorityScore: task.priorityScore,
          aiProcessed: task.aiProcessed,
        });
      }
      return task;
    })
  );

  return persistedTasks;
}
