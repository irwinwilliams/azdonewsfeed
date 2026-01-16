import { describe, expect, test, jest } from '@jest/globals';
import { FetchTimeoutError } from '../src/lib/fetch-with-timeout';

describe('FetchTimeoutError', () => {
  test('creates error with correct message', () => {
    const error = new FetchTimeoutError('https://example.com', 5000);
    expect(error.message).toContain('https://example.com');
    expect(error.message).toContain('5000ms');
    expect(error.name).toBe('FetchTimeoutError');
  });

  test('is instance of Error', () => {
    const error = new FetchTimeoutError('https://test.com', 1000);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FetchTimeoutError);
  });
});
