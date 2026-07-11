import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateApiKey } from './middleware';

describe('validateApiKey', () => {
  const VALID_KEY = 'test-api-key-12345';

  beforeEach(() => {
    process.env.AUTHORIZED_API_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.AUTHORIZED_API_KEY;
  });

  it('returns null when a valid API key is provided', () => {
    const result = validateApiKey({ 'x-api-key': VALID_KEY });
    expect(result).toBeNull();
  });

  it('returns 401 when the x-api-key header is missing', () => {
    const result = validateApiKey({});
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
    const body = JSON.parse(result!.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toContain('Missing API key');
  });

  it('returns 401 when the x-api-key header is undefined', () => {
    const result = validateApiKey({ 'x-api-key': undefined });
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
    const body = JSON.parse(result!.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toContain('Missing API key');
  });

  it('returns 401 when the API key does not match', () => {
    const result = validateApiKey({ 'x-api-key': 'wrong-key' });
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
    const body = JSON.parse(result!.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toContain('Invalid API key');
  });

  it('performs case-insensitive header lookup', () => {
    const result = validateApiKey({ 'X-Api-Key': VALID_KEY });
    expect(result).toBeNull();
  });

  it('performs case-insensitive header lookup with all caps', () => {
    const result = validateApiKey({ 'X-API-KEY': VALID_KEY });
    expect(result).toBeNull();
  });

  it('returns 401 when AUTHORIZED_API_KEY env var is not set', () => {
    delete process.env.AUTHORIZED_API_KEY;
    const result = validateApiKey({ 'x-api-key': 'any-key' });
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it('includes CORS headers in the 401 response', () => {
    const result = validateApiKey({});
    expect(result).not.toBeNull();
    expect(result!.headers['Content-Type']).toBe('application/json');
    expect(result!.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('returns proper error structure in response body', () => {
    const result = validateApiKey({ 'x-api-key': 'bad-key' });
    expect(result).not.toBeNull();
    const body = JSON.parse(result!.body);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });
});
