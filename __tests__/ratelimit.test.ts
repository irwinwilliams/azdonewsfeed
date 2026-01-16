import { describe, expect, test, beforeEach } from '@jest/globals';
import { feedRateLimiter, projectsRateLimiter, RateLimitError } from '../src/lib/ratelimit';

describe('Rate Limiter', () => {
  beforeEach(() => {
    feedRateLimiter.resetAll();
    projectsRateLimiter.resetAll();
  });

  test('allows requests under the limit', () => {
    for (let i = 0; i < 10; i++) {
      expect(feedRateLimiter.check('test-key')).toBe(true);
    }
  });

  test('blocks requests over the limit', () => {
    // Allow 10 requests
    for (let i = 0; i < 10; i++) {
      feedRateLimiter.check('test-key');
    }
    
    // 11th request should be blocked
    expect(feedRateLimiter.check('test-key')).toBe(false);
  });

  test('returns time until reset', () => {
    feedRateLimiter.check('test-key');
    const timeUntilReset = feedRateLimiter.getTimeUntilReset('test-key');
    expect(timeUntilReset).toBeGreaterThan(0);
    expect(timeUntilReset).toBeLessThanOrEqual(60000); // Should be within 1 minute
  });

  test('resets specific key', () => {
    for (let i = 0; i < 10; i++) {
      feedRateLimiter.check('test-key');
    }
    
    feedRateLimiter.reset('test-key');
    expect(feedRateLimiter.check('test-key')).toBe(true);
  });

  test('isolates different keys', () => {
    for (let i = 0; i < 10; i++) {
      feedRateLimiter.check('key1');
    }
    
    expect(feedRateLimiter.check('key1')).toBe(false);
    expect(feedRateLimiter.check('key2')).toBe(true);
  });
});
