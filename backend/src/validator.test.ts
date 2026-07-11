import { describe, it, expect } from 'vitest';
import { validateDescription, validateUserId, generateUserId, validateCreateTaskRequest } from './validator';

describe('validateDescription', () => {
  it('accepts a valid description', () => {
    const result = validateDescription('Buy groceries');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a single character description', () => {
    const result = validateDescription('a');
    expect(result.valid).toBe(true);
  });

  it('accepts a 500 character description', () => {
    const result = validateDescription('x'.repeat(500));
    expect(result.valid).toBe(true);
  });

  it('rejects an empty string', () => {
    const result = validateDescription('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Task description must be between 1 and 500 characters.');
  });

  it('rejects a whitespace-only string', () => {
    const result = validateDescription('   \t\n  ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Task description must be between 1 and 500 characters.');
  });

  it('rejects a description exceeding 500 characters after trim', () => {
    const result = validateDescription('x'.repeat(501));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Task description must be between 1 and 500 characters.');
  });

  it('trims leading and trailing whitespace before validation', () => {
    const result = validateDescription('  hello world  ');
    expect(result.valid).toBe(true);
  });

  it('rejects when trimmed length exceeds 500 even with surrounding whitespace', () => {
    const result = validateDescription('  ' + 'x'.repeat(501) + '  ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Task description must be between 1 and 500 characters.');
  });

  it('accepts when content is exactly 500 chars after trimming whitespace', () => {
    const result = validateDescription('  ' + 'a'.repeat(500) + '  ');
    expect(result.valid).toBe(true);
  });
});

describe('validateUserId', () => {
  it('accepts a valid UUID v4', () => {
    expect(validateUserId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts a valid UUID v4 with uppercase hex', () => {
    expect(validateUserId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('accepts UUID v4 with variant bits 8, 9, a, b', () => {
    expect(validateUserId('550e8400-e29b-41d4-8716-446655440000')).toBe(true);
    expect(validateUserId('550e8400-e29b-41d4-9716-446655440000')).toBe(true);
    expect(validateUserId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validateUserId('550e8400-e29b-41d4-b716-446655440000')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(validateUserId('')).toBe(false);
  });

  it('rejects a random string', () => {
    expect(validateUserId('not-a-uuid')).toBe(false);
  });

  it('rejects UUID v1 (version digit is 1, not 4)', () => {
    expect(validateUserId('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
  });

  it('rejects UUID with invalid variant bits (0-7, c-f)', () => {
    expect(validateUserId('550e8400-e29b-41d4-0716-446655440000')).toBe(false);
    expect(validateUserId('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
    expect(validateUserId('550e8400-e29b-41d4-f716-446655440000')).toBe(false);
  });

  it('rejects UUID without hyphens', () => {
    expect(validateUserId('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('rejects UUID with extra characters', () => {
    expect(validateUserId('550e8400-e29b-41d4-a716-446655440000x')).toBe(false);
  });
});

describe('generateUserId', () => {
  it('generates a string that passes UUID v4 validation', () => {
    const id = generateUserId();
    expect(validateUserId(id)).toBe(true);
  });

  it('generates unique IDs on each call', () => {
    const id1 = generateUserId();
    const id2 = generateUserId();
    expect(id1).not.toBe(id2);
  });

  it('generates IDs with version digit 4', () => {
    const id = generateUserId();
    // The 15th character (index 14) should be '4'
    expect(id[14]).toBe('4');
  });

  it('generates IDs with valid variant bits', () => {
    const id = generateUserId();
    // The 20th character (index 19) should be 8, 9, a, or b
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });
});

describe('validateCreateTaskRequest', () => {
  it('accepts a valid request body with a description', () => {
    const result = validateCreateTaskRequest({ description: 'Buy groceries' });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects null body', () => {
    const result = validateCreateTaskRequest(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Request body must be a JSON object');
  });

  it('rejects undefined body', () => {
    const result = validateCreateTaskRequest(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Request body must be a JSON object');
  });

  it('rejects non-object body (string)', () => {
    const result = validateCreateTaskRequest('hello');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Request body must be a JSON object');
  });

  it('rejects non-object body (number)', () => {
    const result = validateCreateTaskRequest(42);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Request body must be a JSON object');
  });

  it('rejects body missing description field', () => {
    const result = validateCreateTaskRequest({ title: 'Some title' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required field: description');
  });

  it('rejects body with empty object', () => {
    const result = validateCreateTaskRequest({});
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required field: description');
  });

  it('rejects body where description is not a string (number)', () => {
    const result = validateCreateTaskRequest({ description: 123 });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Field "description" must be a string');
  });

  it('rejects body where description is not a string (boolean)', () => {
    const result = validateCreateTaskRequest({ description: true });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Field "description" must be a string');
  });

  it('rejects body where description is not a string (array)', () => {
    const result = validateCreateTaskRequest({ description: ['task'] });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Field "description" must be a string');
  });

  it('rejects body where description is not a string (null)', () => {
    const result = validateCreateTaskRequest({ description: null });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Field "description" must be a string');
  });

  it('rejects body where description is empty string', () => {
    const result = validateCreateTaskRequest({ description: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Task description must be between 1 and 500 characters.');
  });

  it('rejects body where description is whitespace-only', () => {
    const result = validateCreateTaskRequest({ description: '   \t\n  ' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Task description must be between 1 and 500 characters.');
  });

  it('rejects body where description exceeds 500 chars after trim', () => {
    const result = validateCreateTaskRequest({ description: 'x'.repeat(501) });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Task description must be between 1 and 500 characters.');
  });

  it('accepts body with extra fields beyond description', () => {
    const result = validateCreateTaskRequest({ description: 'Valid task', extra: 'ignored' });
    expect(result.valid).toBe(true);
  });

  it('accepts description at boundary (1 char)', () => {
    const result = validateCreateTaskRequest({ description: 'x' });
    expect(result.valid).toBe(true);
  });

  it('accepts description at boundary (500 chars)', () => {
    const result = validateCreateTaskRequest({ description: 'a'.repeat(500) });
    expect(result.valid).toBe(true);
  });
});
