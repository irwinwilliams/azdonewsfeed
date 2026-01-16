export type FeedPostType = "commit" | "pull_request" | "work_item" | "build";

export type UserPostState = {
  saved: boolean;
  pinned: boolean;
  note: string | null;
  noteUpdatedAt: string | null;
  pinnedAt: string | null;
};

export type FeedPost = {
  id: string;
  type: FeedPostType;
  org: string;
  project: string;
  repo?: string;
  branch?: string;
  actor: {
    displayName: string;
    uniqueName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  summary: string;
  url: string;

  workItem?: {
    id: number;
    title: string;
    state: string;
    type: string;
  };

  pullRequest?: {
    id: number;
    title: string;
    status: string;
  };

  commit?: {
    sha: string;
    message: string;
  };

  tags?: string[];

  // Client-only (MVP): per-user state joined in at render time.
  userState?: Partial<UserPostState>;

  // Phase 2+: negative/needs-attention signal.
  needsAttention?: boolean;
};
