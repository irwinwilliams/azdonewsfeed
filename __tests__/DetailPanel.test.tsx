import { describe, expect, test } from '@jest/globals';
import type { FeedPost, UserPostState } from '../src/lib/types';

describe('DetailPanel Type Definitions', () => {
  test('handles pull request post structure', () => {
    const mockPost: FeedPost = {
      id: 'pr:myorg:myrepo:123:2024-01-01T00:00:00Z',
      type: 'pull_request',
      org: 'myorg',
      project: 'MyProject',
      repo: 'myrepo',
      actor: {
        displayName: 'John Doe',
        uniqueName: 'john@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
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

    expect(mockPost.pullRequest).toBeDefined();
    expect(mockPost.pullRequest?.title).toBe('Add new feature');
    expect(mockPost.url).toContain('pullrequest');
  });

  test('handles work item post structure', () => {
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

    expect(mockPost.workItem).toBeDefined();
    expect(mockPost.workItem?.type).toBe('Bug');
    expect(mockPost.url).toContain('_workitems');
  });

  test('handles note state structure', () => {
    const mockState: UserPostState = {
      saved: false,
      pinned: false,
      note: 'This is a private note',
      noteUpdatedAt: '2024-01-01T12:00:00Z',
      pinnedAt: null,
    };

    expect(mockState.note).toBe('This is a private note');
    expect(mockState.noteUpdatedAt).toBeTruthy();
  });
});
