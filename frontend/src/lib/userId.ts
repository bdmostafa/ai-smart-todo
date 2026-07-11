import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'ai-smart-todo-user-id';

/** UUID v4 format regex */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a string is a valid UUID v4.
 */
export function isValidUUIDv4(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

/**
 * Retrieve the user ID from localStorage, or generate and store a new one.
 *
 * - If a valid UUID v4 exists in localStorage, return it.
 * - If localStorage is empty or contains an invalid value, generate a new
 *   UUID v4, persist it, and return the new value.
 *
 * Requirements: 10.1, 10.4
 */
export function getUserId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidUUIDv4(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }

  const newId = uuidv4();
  try {
    localStorage.setItem(STORAGE_KEY, newId);
  } catch {
    // Proceed with the generated ID even if storage fails
  }

  return newId;
}

/**
 * Regenerate the user ID — generates a new UUID v4 and stores it,
 * replacing the old value. Used when a 401 response indicates the
 * current userId is invalid.
 *
 * Requirements: 10.4
 */
export function regenerateUserId(): string {
  const newId = uuidv4();
  try {
    localStorage.setItem(STORAGE_KEY, newId);
  } catch {
    // Proceed with the generated ID even if storage fails
  }
  return newId;
}
