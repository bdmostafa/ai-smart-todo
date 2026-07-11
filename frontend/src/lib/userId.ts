import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'ai-smart-todo-user-id';

/** UUID v4 format regex */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a string matches UUID v4 format.
 */
export function isValidUuidV4(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Retrieves the user ID from localStorage.
 * If no valid UUID v4 is stored, generates a new one and persists it.
 *
 * Requirements 10.1, 10.2, 10.4:
 * - Generate UUID v4 for new users, store in localStorage
 * - On return visits, retrieve existing UUID from localStorage
 * - If stored value is invalid, generate a new one (empty state)
 */
export function getUserId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidUuidV4(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (e.g., private browsing in some browsers)
  }

  const newId = uuidv4();
  try {
    localStorage.setItem(STORAGE_KEY, newId);
  } catch {
    // Proceed with in-memory ID if storage fails
  }
  return newId;
}
