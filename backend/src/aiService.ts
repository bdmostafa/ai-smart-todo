/**
 * Amazon Bedrock AI integration service.
 * Handles task categorization and priority scoring via Claude 3 Haiku.
 * Includes retry logic (3 retries, 5s intervals) and circuit breaker pattern.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { AiResult, Quadrant } from './types';

// --- Constants ---

const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60000;

const VALID_QUADRANTS: Quadrant[] = ['do-first', 'schedule', 'delegate', 'eliminate'];

const DEFAULT_AI_RESULT: AiResult = {
  quadrant: 'schedule',
  priorityScore: 50,
  reasoning: 'Default assignment due to AI processing failure',
};

// --- Circuit Breaker State ---

interface CircuitBreakerState {
  consecutiveFailures: number;
  lastFailureTime: number | null;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  consecutiveFailures: 0,
  lastFailureTime: null,
  isOpen: false,
};

// --- Bedrock Client ---

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// --- Exported for testing ---

/**
 * Reset circuit breaker state (used for testing).
 */
export function resetCircuitBreaker(): void {
  circuitBreaker.consecutiveFailures = 0;
  circuitBreaker.lastFailureTime = null;
  circuitBreaker.isOpen = false;
}

/**
 * Get current circuit breaker state (used for testing/monitoring).
 */
export function getCircuitBreakerState(): Readonly<CircuitBreakerState> {
  return { ...circuitBreaker };
}

// --- Prompt Construction ---

/**
 * Build the AI prompt with quadrant rules, scoring rules, task context, and current date.
 */
export function buildPrompt(description: string, taskCount: number): string {
  const today = new Date().toISOString().split('T')[0];

  return `Analyze the following task and return a JSON response:
- "quadrant": one of "do-first", "schedule", "delegate", "eliminate"
- "priorityScore": integer 1-100
- "reasoning": brief explanation

Rules for quadrant assignment:
- "do-first": urgent AND important (deadlines today/tomorrow, critical keywords)
- "schedule": important but NOT urgent (goals, projects, growth)
- "delegate": urgent but NOT important (routine, low-impact deadlines)
- "eliminate": neither urgent nor important (distractions, low-value)

Rules for scoring:
- Base score from quadrant: do-first=75-100, schedule=50-74, delegate=25-49, eliminate=1-24
- Adjust up for: explicit deadlines, action verbs, specificity
- Adjust down for: vague language, no timeline, passive phrasing

Task: "${description}"
Context: User has ${taskCount} other tasks. Current date: ${today}.

Return ONLY a valid JSON object with the three fields above. No additional text.`;
}

// --- Response Parsing ---

/**
 * Parse AI response string into a validated AiResult.
 * Returns defaults if parsing fails or values are out of range.
 */
export function parseAiResponse(rawResponse: string): AiResult {
  try {
    // Try to extract JSON from the response (handle possible markdown code blocks)
    let jsonStr = rawResponse.trim();

    // Remove markdown code block wrappers if present
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }

    // Try to find a JSON object in the string
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonObjectMatch) {
      return { ...DEFAULT_AI_RESULT };
    }

    const parsed = JSON.parse(jsonObjectMatch[0]);

    // Validate and extract quadrant
    const quadrant = validateQuadrant(parsed.quadrant);

    // Validate and extract priority score
    const priorityScore = validatePriorityScore(parsed.priorityScore);

    // Extract reasoning (optional, default to empty string)
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    return { quadrant, priorityScore, reasoning };
  } catch {
    return { ...DEFAULT_AI_RESULT };
  }
}

/**
 * Validate that a quadrant value is one of the allowed enum values.
 * Returns 'schedule' as default if invalid.
 */
function validateQuadrant(value: unknown): Quadrant {
  if (typeof value === 'string' && VALID_QUADRANTS.includes(value as Quadrant)) {
    return value as Quadrant;
  }
  return 'schedule';
}

/**
 * Validate that a priority score is an integer between 1 and 100.
 * Returns 50 as default if invalid.
 */
function validatePriorityScore(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100) {
    return value;
  }
  // Try to parse if it's a string number
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      return parsed;
    }
  }
  return 50;
}

// --- Circuit Breaker Logic ---

/**
 * Check if the circuit breaker is open (should skip AI calls).
 * If cooldown has elapsed, close the circuit breaker.
 */
function isCircuitBreakerOpen(): boolean {
  if (!circuitBreaker.isOpen) {
    return false;
  }

  // Check if cooldown period has elapsed
  if (
    circuitBreaker.lastFailureTime &&
    Date.now() - circuitBreaker.lastFailureTime >= CIRCUIT_BREAKER_COOLDOWN_MS
  ) {
    // Reset circuit breaker after cooldown
    circuitBreaker.isOpen = false;
    circuitBreaker.consecutiveFailures = 0;
    circuitBreaker.lastFailureTime = null;
    return false;
  }

  return true;
}

/**
 * Record a successful AI call — resets consecutive failure counter.
 */
function recordSuccess(): void {
  circuitBreaker.consecutiveFailures = 0;
}

/**
 * Record a failed AI call — increments counter and may trip the circuit breaker.
 */
function recordFailure(): void {
  circuitBreaker.consecutiveFailures++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
  }
}

// --- Bedrock Invocation ---

/**
 * Invoke Bedrock Claude 3 Haiku with the given prompt.
 * Returns the raw text response from the model.
 */
async function invokeBedrock(prompt: string): Promise<string> {
  const requestBody = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(requestBody),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Claude 3 response format: { content: [{ type: 'text', text: '...' }] }
  if (responseBody.content && responseBody.content.length > 0) {
    return responseBody.content[0].text;
  }

  throw new Error('Empty response from Bedrock');
}

// --- Sleep Utility ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main Exported Function ---

/**
 * Categorize and score a task description using Amazon Bedrock Claude 3 Haiku.
 *
 * Implements:
 * - Prompt construction with quadrant/scoring rules
 * - Retry logic: 3 retries with 5-second intervals
 * - Circuit breaker: after 3 consecutive failures, stops calls for 60 seconds
 * - Default fallback: quadrant="schedule", priorityScore=50 on all failures
 */
export async function categorizeAndScore(
  description: string,
  taskCount: number
): Promise<AiResult> {
  // Check circuit breaker — if open, return defaults immediately
  if (isCircuitBreakerOpen()) {
    return { ...DEFAULT_AI_RESULT };
  }

  const prompt = buildPrompt(description, taskCount);

  // Attempt invocation with retries
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const rawResponse = await invokeBedrock(prompt);
      const result = parseAiResponse(rawResponse);
      recordSuccess();
      return result;
    } catch {
      recordFailure();

      // If circuit breaker tripped during retries, stop immediately
      if (isCircuitBreakerOpen()) {
        return { ...DEFAULT_AI_RESULT };
      }

      // Wait before retry (except after last attempt)
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_INTERVAL_MS);
      }
    }
  }

  // All retries exhausted — return defaults
  return { ...DEFAULT_AI_RESULT };
}
