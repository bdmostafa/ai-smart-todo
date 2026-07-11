/**
 * Input validation module
 */

import { ValidationResult } from './types';

/**
 * Validates a task description string.
 * Trims whitespace and checks that the result is between 1 and 500 characters.
 * Rejects empty strings, whitespace-only strings, and strings exceeding 500 chars after trimming.
 */
export function validateDescription(input: string): ValidationResult {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Task description must be between 1 and 500 characters.',
    };
  }

  if (trimmed.length > 500) {
    return {
      valid: false,
      error: 'Task description must be between 1 and 500 characters.',
    };
  }

  return { valid: true };
}

/** UUID v4 format regex */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a given string is a valid UUID v4 format.
 * Accepts standard UUID v4 with version digit 4 and variant bits [89ab].
 */
export function validateUserId(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Generates a new UUID v4 user identifier using Node.js crypto.randomUUID().
 */
export function generateUserId(): string {
  return crypto.randomUUID();
}

/**
 * Validates the request body for task creation (POST /tasks).
 * Checks that the body is a non-null object with a required `description` field
 * that is a string and passes description validation.
 * Returns a 400-style error with field-specific messages for invalid input.
 */
export function validateCreateTaskRequest(body: unknown): ValidationResult {
  if (body === null || body === undefined || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be a JSON object',
    };
  }

  const obj = body as Record<string, unknown>;

  if (!('description' in obj) || obj.description === undefined) {
    return {
      valid: false,
      error: 'Missing required field: description',
    };
  }

  if (typeof obj.description !== 'string') {
    return {
      valid: false,
      error: 'Field "description" must be a string',
    };
  }

  return validateDescription(obj.description);
}
