/**
 * Unit tests for the AI Service module.
 * Tests prompt construction, response parsing, and circuit breaker logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildPrompt,
  parseAiResponse,
  resetCircuitBreaker,
  getCircuitBreakerState,
} from './aiService';

describe('aiService', () => {
  beforeEach(() => {
    resetCircuitBreaker();
  });

  describe('buildPrompt', () => {
    it('should include the task description in the prompt', () => {
      const prompt = buildPrompt('Buy groceries', 5);
      expect(prompt).toContain('Buy groceries');
    });

    it('should include the task count context', () => {
      const prompt = buildPrompt('Fix bug', 10);
      expect(prompt).toContain('User has 10 other tasks');
    });

    it('should include the current date', () => {
      const today = new Date().toISOString().split('T')[0];
      const prompt = buildPrompt('Read book', 0);
      expect(prompt).toContain(`Current date: ${today}`);
    });

    it('should include quadrant assignment rules', () => {
      const prompt = buildPrompt('Test', 0);
      expect(prompt).toContain('do-first');
      expect(prompt).toContain('schedule');
      expect(prompt).toContain('delegate');
      expect(prompt).toContain('eliminate');
    });

    it('should include scoring rules', () => {
      const prompt = buildPrompt('Test', 0);
      expect(prompt).toContain('do-first=75-100');
      expect(prompt).toContain('schedule=50-74');
      expect(prompt).toContain('delegate=25-49');
      expect(prompt).toContain('eliminate=1-24');
    });

    it('should request JSON-only response', () => {
      const prompt = buildPrompt('Test', 0);
      expect(prompt).toContain('Return ONLY a valid JSON object');
    });
  });

  describe('parseAiResponse', () => {
    it('should parse a valid JSON response', () => {
      const response = JSON.stringify({
        quadrant: 'do-first',
        priorityScore: 85,
        reasoning: 'High urgency deadline',
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('do-first');
      expect(result.priorityScore).toBe(85);
      expect(result.reasoning).toBe('High urgency deadline');
    });

    it('should parse response wrapped in markdown code block', () => {
      const response = '```json\n{"quadrant": "delegate", "priorityScore": 30, "reasoning": "Routine task"}\n```';

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('delegate');
      expect(result.priorityScore).toBe(30);
      expect(result.reasoning).toBe('Routine task');
    });

    it('should parse response with extra text around JSON', () => {
      const response = 'Here is the analysis:\n{"quadrant": "eliminate", "priorityScore": 10, "reasoning": "Low value"}\nDone.';

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('eliminate');
      expect(result.priorityScore).toBe(10);
      expect(result.reasoning).toBe('Low value');
    });

    it('should return defaults for completely invalid response', () => {
      const result = parseAiResponse('this is not json at all');
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(50);
    });

    it('should return defaults for empty string', () => {
      const result = parseAiResponse('');
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(50);
    });

    it('should default quadrant for invalid quadrant value', () => {
      const response = JSON.stringify({
        quadrant: 'invalid-quadrant',
        priorityScore: 75,
        reasoning: 'Test',
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(75);
    });

    it('should default score for out-of-range score (> 100)', () => {
      const response = JSON.stringify({
        quadrant: 'do-first',
        priorityScore: 150,
        reasoning: 'Test',
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('do-first');
      expect(result.priorityScore).toBe(50);
    });

    it('should default score for out-of-range score (< 1)', () => {
      const response = JSON.stringify({
        quadrant: 'do-first',
        priorityScore: 0,
        reasoning: 'Test',
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('do-first');
      expect(result.priorityScore).toBe(50);
    });

    it('should default score for non-integer score', () => {
      const response = JSON.stringify({
        quadrant: 'schedule',
        priorityScore: 75.5,
        reasoning: 'Test',
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(50);
    });

    it('should parse string numbers as priority score', () => {
      const response = JSON.stringify({
        quadrant: 'schedule',
        priorityScore: '65',
        reasoning: 'Test',
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(65);
    });

    it('should default reasoning when not a string', () => {
      const response = JSON.stringify({
        quadrant: 'do-first',
        priorityScore: 90,
        reasoning: 123,
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('do-first');
      expect(result.priorityScore).toBe(90);
      expect(result.reasoning).toBe('');
    });

    it('should handle missing fields gracefully', () => {
      const response = JSON.stringify({});

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(50);
      expect(result.reasoning).toBe('');
    });

    it('should handle null values', () => {
      const response = JSON.stringify({
        quadrant: null,
        priorityScore: null,
        reasoning: null,
      });

      const result = parseAiResponse(response);
      expect(result.quadrant).toBe('schedule');
      expect(result.priorityScore).toBe(50);
      expect(result.reasoning).toBe('');
    });
  });

  describe('circuit breaker', () => {
    it('should start with circuit breaker closed', () => {
      const state = getCircuitBreakerState();
      expect(state.isOpen).toBe(false);
      expect(state.consecutiveFailures).toBe(0);
      expect(state.lastFailureTime).toBeNull();
    });

    it('should reset correctly', () => {
      resetCircuitBreaker();
      const state = getCircuitBreakerState();
      expect(state.isOpen).toBe(false);
      expect(state.consecutiveFailures).toBe(0);
    });
  });
});
