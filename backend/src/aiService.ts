/**
 * Amazon Bedrock AI integration service
 */

import { AiResult } from './types';

export async function categorizeAndScore(
  description: string,
  taskCount: number
): Promise<AiResult> {
  // Placeholder - will be implemented in task 4.1
  return {
    quadrant: 'schedule',
    priorityScore: 50,
    reasoning: '',
  };
}

export function parseAiResponse(rawResponse: string): AiResult {
  // Placeholder - will be implemented in task 4.1
  return {
    quadrant: 'schedule',
    priorityScore: 50,
    reasoning: '',
  };
}
