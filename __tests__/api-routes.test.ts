import { describe, expect, test } from '@jest/globals';
import { feedRequestSchema, projectsRequestSchema } from '../src/lib/validation';
import { z } from 'zod';

describe('API Security - Input Validation', () => {
  describe('Projects API Schema', () => {
    test('rejects requests missing org', () => {
      expect(() => projectsRequestSchema.parse({ pat: 'validpat123456789012345' })).toThrow();
    });

    test('rejects requests missing PAT', () => {
      expect(() => projectsRequestSchema.parse({ org: 'validorg' })).toThrow();
    });

    test('rejects invalid org format', () => {
      expect(() => projectsRequestSchema.parse({
        org: 'invalid@org',
        pat: 'validpat123456789012345'
      })).toThrow();
    });

    test('rejects short PAT', () => {
      expect(() => projectsRequestSchema.parse({
        org: 'validorg',
        pat: 'short'
      })).toThrow();
    });

    test('accepts valid request', () => {
      const result = projectsRequestSchema.parse({
        org: 'validorg',
        pat: 'validpat123456789012345'
      });
      expect(result.org).toBe('validorg');
      expect(result.pat).toBe('validpat123456789012345');
    });
  });

  describe('Feed API Schema', () => {
    const validBase = {
      org: 'validorg',
      pat: 'validpat123456789012345',
    };

    test('enforces maximum hours limit', () => {
      expect(() => feedRequestSchema.parse({
        ...validBase,
        hours: 10000 // Over 8760 limit
      })).toThrow();
    });

    test('enforces maximum prTop limit', () => {
      expect(() => feedRequestSchema.parse({
        ...validBase,
        prTop: 300 // Over 200 limit
      })).toThrow();
    });

    test('enforces maximum wiTop limit', () => {
      expect(() => feedRequestSchema.parse({
        ...validBase,
        wiTop: 600 // Over 500 limit
      })).toThrow();
    });

    test('enforces maximum projects array size', () => {
      expect(() => feedRequestSchema.parse({
        ...validBase,
        projects: Array(150).fill('Project') // Over 100 limit
      })).toThrow();
    });

    test('accepts valid feed request', () => {
      const result = feedRequestSchema.parse({
        ...validBase,
        hours: 24,
        prTop: 50,
        wiTop: 100,
        projects: ['Project1', 'Project2']
      });
      expect(result.hours).toBe(24);
      expect(result.prTop).toBe(50);
      expect(result.wiTop).toBe(100);
      expect(result.projects).toHaveLength(2);
    });

    test('accepts null hours for all-time', () => {
      const result = feedRequestSchema.parse({
        ...validBase,
        hours: null
      });
      expect(result.hours).toBeNull();
    });

    test('accepts null projects for all projects', () => {
      const result = feedRequestSchema.parse({
        ...validBase,
        projects: null
      });
      expect(result.projects).toBeNull();
    });
  });
});
