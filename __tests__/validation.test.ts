import { describe, expect, test } from '@jest/globals';
import { 
  orgSchema, 
  patSchema, 
  projectNameSchema,
  feedRequestSchema,
  projectsRequestSchema,
  sanitizeError 
} from '../src/lib/validation';
import { z } from 'zod';

describe('Validation Schemas', () => {
  describe('orgSchema', () => {
    test('accepts valid organization names', () => {
      expect(() => orgSchema.parse('myorg')).not.toThrow();
      expect(() => orgSchema.parse('my-org')).not.toThrow();
      expect(() => orgSchema.parse('my_org')).not.toThrow();
      expect(() => orgSchema.parse('MyOrg123')).not.toThrow();
    });

    test('rejects invalid organization names', () => {
      expect(() => orgSchema.parse('')).toThrow();
      expect(() => orgSchema.parse('my org')).toThrow(); // spaces
      expect(() => orgSchema.parse('my@org')).toThrow(); // special chars
      expect(() => orgSchema.parse('my/org')).toThrow(); // slashes
      expect(() => orgSchema.parse('a'.repeat(256))).toThrow(); // too long
    });
  });

  describe('patSchema', () => {
    test('accepts valid PAT formats', () => {
      const validPat = 'abcdefghijklmnopqrstuvwxyz0123456789';
      expect(() => patSchema.parse(validPat)).not.toThrow();
      expect(() => patSchema.parse('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6')).not.toThrow();
    });

    test('rejects invalid PATs', () => {
      expect(() => patSchema.parse('short')).toThrow(); // too short
      expect(() => patSchema.parse('a'.repeat(1025))).toThrow(); // too long
      expect(() => patSchema.parse('invalid@chars!')).toThrow(); // invalid chars
    });
  });

  describe('projectNameSchema', () => {
    test('accepts valid project names', () => {
      expect(() => projectNameSchema.parse('MyProject')).not.toThrow();
      expect(() => projectNameSchema.parse('Project 123')).not.toThrow();
      expect(() => projectNameSchema.parse('Project-Name')).not.toThrow();
    });

    test('rejects invalid project names', () => {
      expect(() => projectNameSchema.parse('')).toThrow();
      expect(() => projectNameSchema.parse('a'.repeat(256))).toThrow();
      expect(() => projectNameSchema.parse('Project<Name')).toThrow();
      expect(() => projectNameSchema.parse('Project|Name')).toThrow();
    });
  });

  describe('feedRequestSchema', () => {
    const validRequest = {
      org: 'myorg',
      pat: 'abcdefghijklmnopqrstuvwxyz',
      hours: 24,
      projects: ['Project1', 'Project2'],
      prTop: 50,
      wiTop: 100,
    };

    test('accepts valid feed requests', () => {
      expect(() => feedRequestSchema.parse(validRequest)).not.toThrow();
    });

    test('accepts null hours (all time)', () => {
      expect(() => feedRequestSchema.parse({ ...validRequest, hours: null })).not.toThrow();
    });

    test('accepts null projects (all projects)', () => {
      expect(() => feedRequestSchema.parse({ ...validRequest, projects: null })).not.toThrow();
    });

    test('enforces maximum limits', () => {
      expect(() => feedRequestSchema.parse({ ...validRequest, hours: 10000 })).toThrow();
      expect(() => feedRequestSchema.parse({ ...validRequest, prTop: 300 })).toThrow();
      expect(() => feedRequestSchema.parse({ ...validRequest, wiTop: 1000 })).toThrow();
      expect(() => feedRequestSchema.parse({ 
        ...validRequest, 
        projects: Array(150).fill('Project') 
      })).toThrow();
    });
  });

  describe('projectsRequestSchema', () => {
    test('accepts valid projects request', () => {
      const request = { org: 'myorg', pat: 'abcdefghijklmnopqrstuvwxyz' };
      expect(() => projectsRequestSchema.parse(request)).not.toThrow();
    });

    test('rejects missing fields', () => {
      expect(() => projectsRequestSchema.parse({ org: 'myorg' })).toThrow();
      expect(() => projectsRequestSchema.parse({ pat: 'abc' })).toThrow();
    });
  });
});

describe('sanitizeError', () => {
  test('sanitizes Zod validation errors', () => {
    const error = new z.ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['org'],
        message: 'Expected string, received number',
      },
    ]);
    
    const result = sanitizeError(error);
    // Should return the first error message or fallback
    expect(result).toMatch(/Expected string, received number|Validation error/);
  });

  test('removes Bearer tokens', () => {
    const error = new Error('Failed with Bearer abc123xyz456');
    expect(sanitizeError(error)).not.toContain('abc123xyz456');
    expect(sanitizeError(error)).toContain('[REDACTED]');
  });

  test('removes Basic auth tokens', () => {
    const error = new Error('Failed with Basic xyz789abc123');
    expect(sanitizeError(error)).not.toContain('xyz789abc123');
    expect(sanitizeError(error)).toContain('[REDACTED]');
  });

  test('provides user-friendly messages for common errors', () => {
    expect(sanitizeError(new Error('ENOTFOUND'))).toBe(
      'Unable to connect to Azure DevOps. Please check your organization name.'
    );
    expect(sanitizeError(new Error('401 Unauthorized'))).toBe(
      'Authentication failed. Please check your Personal Access Token.'
    );
    expect(sanitizeError(new Error('403 Forbidden'))).toBe(
      'Access denied. Your PAT may not have sufficient permissions.'
    );
    expect(sanitizeError(new Error('404 Not Found'))).toBe(
      'Resource not found. Please check your organization and project names.'
    );
  });

  test('limits error message length', () => {
    const longError = new Error('a'.repeat(500));
    const sanitized = sanitizeError(longError);
    expect(sanitized.length).toBeLessThanOrEqual(200);
  });

  test('handles non-Error types', () => {
    expect(sanitizeError('string error')).toBe('An unexpected error occurred');
    expect(sanitizeError(null)).toBe('An unexpected error occurred');
    expect(sanitizeError(undefined)).toBe('An unexpected error occurred');
    expect(sanitizeError(123)).toBe('An unexpected error occurred');
  });
});
