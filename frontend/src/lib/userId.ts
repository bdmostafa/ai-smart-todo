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
 * Gets the available localStorage instance.
 * In browser environments this is window.localStorage.
 * Falls back gracefully when unavailable.
 */
function getStorage(): Storage | null {
  try {
    // Use window.localStorage to avoid Node 26 globalThis.localStorage issues
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // localStorage may be unavailable
  }
  return null;
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
  const storage = getStorage();

  if (storage) {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored && isValidUuidV4(stored)) {
      return stored;
    }
  }

  const newId = uuidv4();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, newId);
    } catch {
      // Proceed with in-memory ID if storage write fails
    }
  }
  return newId;
}
