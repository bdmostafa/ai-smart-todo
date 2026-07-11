import { describe, it, expect, beforeEach } from 'vitest';
import { getUserId, isValidUUIDv4 } from './userId';

describe('isValidUUIDv4', () => {
  it('accepts a valid UUID v4', () => {
    expect(isValidUUIDv4('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
  });

  it('accepts uppercase UUID v4', () => {
    expect(isValidUUIDv4('123E4567-E89B-42D3-A456-426614174000')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidUUIDv4('')).toBe(false);
  });

  it('rejects non-UUID strings', () => {
    expect(isValidUUIDv4('not-a-uuid')).toBe(false);
  });

  it('rejects UUID v1 (wrong version digit)', () => {
    expect(isValidUUIDv4('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
  });

  it('rejects UUID with invalid variant bits', () => {
    // variant digit must be 8, 9, a, or b
    expect(isValidUUIDv4('123e4567-e89b-42d3-f456-426614174000')).toBe(false);
  });
});

describe('getUserId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a valid UUID v4 when localStorage is empty', () => {
    const userId = getUserId();
    expect(isValidUUIDv4(userId)).toBe(true);
  });

  it('persists the generated ID to localStorage', () => {
    const userId = getUserId();
    expect(localStorage.getItem('ai-smart-todo-user-id')).toBe(userId);
  });

  it('returns the stored ID when a valid UUID exists', () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    // This is actually a v4-valid format (4 in position 13, a in position 17)
    const validId = '550e8400-e29b-4bd4-a716-446655440000';
    localStorage.setItem('ai-smart-todo-user-id', validId);
    expect(getUserId()).toBe(validId);
  });

  it('generates a new ID when localStorage has invalid value', () => {
    localStorage.setItem('ai-smart-todo-user-id', 'invalid');
    const userId = getUserId();
    expect(isValidUUIDv4(userId)).toBe(true);
    expect(userId).not.toBe('invalid');
  });

  it('returns the same ID on consecutive calls', () => {
    const first = getUserId();
    const second = getUserId();
    expect(first).toBe(second);
  });
});
