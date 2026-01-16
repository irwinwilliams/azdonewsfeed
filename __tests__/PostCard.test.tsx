import { describe, expect, test } from '@jest/globals';
import type { FeedPost, UserPostState } from '../src/lib/types';

describe('PostCard Type Definitions', () => {
  test('FeedPost type structure for pull request', () => {
    const mockPost: FeedPost = {
      id: 'pr:myorg:myrepo:123:2024-01-01T00:00:00Z',
      type: 'pull_request',
      org: 'myorg',
      project: 'MyProject',
      repo: 'myrepo',
      actor: {
        displayName: 'John Doe',
        uniqueName: 'john@example.com',
        avatarUrl: null,
      },
      createdAt: '2024-01-01T00:00:00Z',
      summary: 'completed PR #123: Add new feature',
      url: 'https://dev.azure.com/myorg/MyProject/_git/myrepo/pullrequest/123',
      pullRequest: {
        id: 123,
        title: 'Add new feature',
        status: 'completed',
      },
    };

    expect(mockPost.type).toBe('pull_request');
    expect(mockPost.pullRequest?.id).toBe(123);
    expect(mockPost.actor.displayName).toBe('John Doe');
  });

  test('FeedPost type structure for work item', () => {
    const mockPost: FeedPost = {
      id: 'wi:myorg:456:2024-01-01T00:00:00Z',
      type: 'work_item',
      org: 'myorg',
      project: 'MyProject',
      actor: {
        displayName: 'Jane Smith',
        uniqueName: 'jane@example.com',
        avatarUrl: null,
      },
      createdAt: '2024-01-01T00:00:00Z',
      summary: 'updated Bug 456: Fix login issue',
      url: 'https://dev.azure.com/myorg/MyProject/_workitems/edit/456',
      workItem: {
        id: 456,
        title: 'Fix login issue',
        state: 'Active',
        type: 'Bug',
      },
    };

    expect(mockPost.type).toBe('work_item');
    expect(mockPost.workItem?.id).toBe(456);
    expect(mockPost.workItem?.type).toBe('Bug');
  });

  test('UserPostState type structure', () => {
    const mockState: UserPostState = {
      saved: true,
      pinned: false,
      note: 'Test note',
      noteUpdatedAt: '2024-01-01T00:00:00Z',
      pinnedAt: null,
    };

    expect(mockState.saved).toBe(true);
    expect(mockState.note).toBe('Test note');
  });
});
