/**
 * Priority scoring and top-three selection logic.
 *
 * - selectTopThree: returns top 3 highest-scored incomplete task IDs
 * - recalculateScores: batch re-invokes AI for all incomplete tasks
 * - getTaskOrdering: groups by quadrant, sorts within quadrant by score desc then createdAt desc
 */

import { Task, Quadrant } from './types';
import { categorizeAndScore } from './aiService';

/** Quadrant display order per requirement 7.1 */
const QUADRANT_ORDER: Quadrant[] = ['do-first', 'schedule', 'delegate', 'eliminate'];

/**
 * Select the top three highest-priority incomplete tasks.
 *
 * Filters to incomplete tasks, sorts by priorityScore descending,
 * and returns up to 3 taskIds (or fewer if less than 3 exist).
 *
 * Requirements: 4.2, 4.4
 */
export function selectTopThree(tasks: Task[]): string[] {
  const incomplete = tasks.filter((t) => t.status === 'incomplete');

  const sorted = [...incomplete].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    // Tiebreaker: most recently created first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sorted.slice(0, 3).map((t) => t.taskId);
}

/**
 * Batch re-invoke AI for all incomplete tasks, updating their quadrant and priorityScore.
 *
 * Returns updated task objects with new AI results applied.
 * Completed tasks are returned unchanged.
 *
 * Requirements: 3.4
 */
export async function recalculateScores(tasks: Task[]): Promise<Task[]> {
  const incompleteTasks = tasks.filter((t) => t.status === 'incomplete');
  const completedTasks = tasks.filter((t) => t.status === 'complete');

  const updatedIncomplete = await Promise.all(
    incompleteTasks.map(async (task) => {
      const aiResult = await categorizeAndScore(task.description, incompleteTasks.length);
      return {
        ...task,
        quadrant: aiResult.quadrant,
        priorityScore: aiResult.priorityScore,
        aiProcessed: true,
      };
    })
  );

  return [...updatedIncomplete, ...completedTasks];
}

/**
 * Order tasks for the quadrant view display.
 *
 * Groups tasks by quadrant in the order [do-first, schedule, delegate, eliminate].
 * Within each quadrant, sorts by priorityScore descending, with ties broken by
 * createdAt descending (most recent first).
 *
 * Requirements: 7.1, 7.2
 */
export function getTaskOrdering(tasks: Task[]): Task[] {
  const result: Task[] = [];

  for (const quadrant of QUADRANT_ORDER) {
    const quadrantTasks = tasks.filter((t) => t.quadrant === quadrant);

    quadrantTasks.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      // Ties broken by createdAt descending (most recent first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    result.push(...quadrantTasks);
  }

  return result;
}
