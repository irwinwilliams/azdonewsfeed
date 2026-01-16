"use client";

import type { FeedPost } from "@/lib/types";

const STORAGE_KEY = "azdonewsfeed:userState:v1";

const FEED_CACHE_PREFIX = "azdonewsfeed:feedcache:v1:";
const SCROLL_PREFIX = "azdonewsfeed:scrollY:v1:";

export type StoredUserPostState = {
  saved: boolean;
  pinned: boolean;
  note: string | null;
  noteUpdatedAt: string | null;
  pinnedAt: string | null;
};

export type StoredUserState = Record<string, StoredUserPostState>;

const defaultPostState: StoredUserPostState = {
  saved: false,
  pinned: false,
  note: null,
  noteUpdatedAt: null,
  pinnedAt: null,
};

export function loadUserState(): StoredUserState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredUserState;
  } catch {
    return {};
  }
}

export function saveUserState(state: StoredUserState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // no-op: private browsing / storage disabled
  }
}

export function getPostState(state: StoredUserState, postId: string): StoredUserPostState {
  return {
    ...defaultPostState,
    ...(state[postId] ?? {}),
  };
}

export function setPostState(
  state: StoredUserState,
  postId: string,
  patch: Partial<StoredUserPostState>,
): StoredUserState {
  const current = getPostState(state, postId);
  const next = { ...current, ...patch };
  const nextState = { ...state, [postId]: next };
  return nextState;
}

export function clearPostNote(state: StoredUserState, postId: string): StoredUserState {
  const current = getPostState(state, postId);
  const next = { ...current, note: null, noteUpdatedAt: null };
  return { ...state, [postId]: next };
}

export type StoredFeedCache = {
  fetchedAt: number;
  posts: FeedPost[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function loadFeedCache(scopeKey: string): StoredFeedCache | null {
  try {
    const raw = window.localStorage.getItem(FEED_CACHE_PREFIX + scopeKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    const fetchedAt = rec["fetchedAt"];
    const posts = rec["posts"];
    if (typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return null;
    if (!Array.isArray(posts)) return null;
    return {
      fetchedAt,
      posts: posts as FeedPost[],
    };
  } catch {
    return null;
  }
}

export function saveFeedCache(scopeKey: string, cache: StoredFeedCache) {
  try {
    window.localStorage.setItem(FEED_CACHE_PREFIX + scopeKey, JSON.stringify(cache));
  } catch {
    // no-op
  }
}

export function loadScrollY(scopeKey: string): number | null {
  try {
    const raw = window.localStorage.getItem(SCROLL_PREFIX + scopeKey);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n, 0, 10_000_000) : null;
  } catch {
    return null;
  }
}

export function saveScrollY(scopeKey: string, scrollY: number) {
  try {
    window.localStorage.setItem(SCROLL_PREFIX + scopeKey, String(Math.max(0, Math.floor(scrollY))));
  } catch {
    // no-op
  }
}
