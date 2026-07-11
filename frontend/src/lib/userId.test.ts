import { describe, it, expect, beforeEach } from 'vitest';
import { getUserId, isValidUuidV4 } from './userId';

describe('isValidUuidV4', () => {
  it('accepts a valid UUID v4', () => {
    expect(isValidUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts uppercase UUID v4', () => {
    expect(isValidUuidV4('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidUuidV4('')).toBe(false);
  });

  it('rejects a non-UUID string', () => {
    expect(isValidUuidV4('not-a-uuid')).toBe(false);
  });

  it('rejects a UUID v1 (wrong version digit)', () => {
    expect(isValidUuidV4('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
  });

  it('rejects UUID with invalid variant bits', () => {
    // variant bits must be 8, 9, a, or b at position 19
    expect(isValidUuidV4('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
  });
});

describe('getUserId', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('generates a valid UUID v4 on first visit', () => {
    const id = getUserId();
    expect(isValidUuidV4(id)).toBe(true);
  });

  it('stores the generated ID in localStorage', () => {
    const id = getUserId();
    expect(window.localStorage.getItem('ai-smart-todo-user-id')).toBe(id);
  });

  it('returns the same ID on subsequent calls', () => {
    const id1 = getUserId();
    const id2 = getUserId();
    expect(id1).toBe(id2);
  });

  it('returns existing valid ID from localStorage', () => {
    const existing = '550e8400-e29b-41d4-a716-446655440000';
    window.localStorage.setItem('ai-smart-todo-user-id', existing);
    expect(getUserId()).toBe(existing);
  });

  it('generates a new ID if stored value is invalid', () => {
    window.localStorage.setItem('ai-smart-todo-user-id', 'invalid-value');
    const id = getUserId();
    expect(isValidUuidV4(id)).toBe(true);
    expect(id).not.toBe('invalid-value');
  });
});
