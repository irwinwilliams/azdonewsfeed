"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FeedPost, FeedPostType, UserPostState } from "@/lib/types";
import { DetailPanel } from "@/components/DetailPanel";
import { PostCard } from "@/components/PostCard";
import {
  getPostState,
  loadFeedCache,
  loadScrollY,
  loadUserState,
  saveFeedCache,
  saveScrollY,
  saveUserState,
  setPostState,
  type StoredUserState,
} from "@/lib/storage";
import { loadConfig, saveConfig, type AzdoConfig } from "@/lib/config";
import { feedRateLimiter, RateLimitError } from "@/lib/ratelimit";

type FeedFilter = {
  showSavedOnly: boolean;
  type: FeedPostType | "all";
  project: string | "all";
  person: string | "all";
  workItemType: string | "all";
  prStatus: string | "all";
  query: string;
};

type RemoteFeedResponse = {
  posts?: FeedPost[];
  meta?: {
    projectsRequested?: number;
    projectsSucceeded?: number;
    errorCount?: number;
    prErrorCount?: number;
    wiErrorCount?: number;
    errorSamples?: Array<{ project: string; message: string }>;
    since?: number;
    postsCount?: number;
    prCount?: number;
    wiCount?: number;
  };
  error?: string;
};

type RemoteMeta = NonNullable<RemoteFeedResponse["meta"]>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function formatLookback(hours: number | null) {
  if (hours === null) return "all time";
  const h = Math.max(1, Math.floor(hours));

  const hour = 1;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (h >= year) {
    const years = Math.round((h / year) * 10) / 10;
    return `last ${years} year${years === 1 ? "" : "s"}`;
  }
  if (h >= month) {
    const months = Math.round((h / month) * 10) / 10;
    return `last ${months} month${months === 1 ? "" : "s"}`;
  }
  if (h >= week) {
    const weeks = Math.round((h / week) * 10) / 10;
    return `last ${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (h >= day) {
    const days = Math.round((h / day) * 10) / 10;
    return `last ${days} day${days === 1 ? "" : "s"}`;
  }
  return `last ${h} hour${h === 1 ? "" : "s"}`;
}

function makeScopeKey(cfg: AzdoConfig) {
  const projects = cfg.projects === null ? "*" : [...cfg.projects].sort().join(",");
  // Keep key reasonably small + stable.
  const raw = [
    `org=${cfg.org}`,
    `projects=${projects}`,
    `lookback=${cfg.lookbackHours === null ? "all" : String(cfg.lookbackHours)}`,
    `prTop=${cfg.prTop}`,
    `wiTop=${cfg.wiTop}`,
  ].join("|");
  return encodeURIComponent(raw);
}

function dedupeByIdKeepFirst(posts: FeedPost[]) {
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const p of posts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function personKey(actor: FeedPost["actor"]) {
  return (actor.uniqueName || actor.displayName || "").trim();
}

function toggleFilterValue(current: string | "all", next: string) {
  return current === next ? "all" : next;
}

function normalizeForSearch(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return String(value);
  return String(value).toLowerCase();
}

function postMatchesQuery(post: FeedPost, rawQuery: string) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const hay = [
    post.id,
    post.type,
    post.org,
    post.project,
    post.repo,
    post.branch,
    post.summary,
    post.url,
    post.actor.displayName,
    post.actor.uniqueName,
    post.tags?.join(" "),
    post.workItem?.id,
    post.workItem?.title,
    post.workItem?.state,
    post.workItem?.type,
    post.pullRequest?.id,
    post.pullRequest?.title,
    post.pullRequest?.status,
    post.commit?.sha,
    post.commit?.message,
  ]
    .map(normalizeForSearch)
    .filter(Boolean)
    .join("\n");

  return tokens.every((t) => hay.includes(t));
}

function metric(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function normalizeUserPostState(state: ReturnType<typeof getPostState>): UserPostState {
  return {
    saved: state.saved,
    pinned: state.pinned,
    note: state.note,
    noteUpdatedAt: state.noteUpdatedAt,
    pinnedAt: state.pinnedAt,
  };
}

export function FeedShell() {
  const [stored, setStored] = useState<StoredUserState>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedFilter>({
    showSavedOnly: false,
    type: "all",
    project: "all",
    person: "all",
    workItemType: "all",
    prStatus: "all",
    query: "",
  });
  const [pinnedCollapsedMobile, setPinnedCollapsedMobile] = useState(true);

  const [cfg, setCfg] = useState<AzdoConfig | null>(null);
  const [remotePosts, setRemotePosts] = useState<FeedPost[] | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [newSinceAt, setNewSinceAt] = useState<number | null>(null);
  const [loadOlderAmount, setLoadOlderAmount] = useState<number>(24);
  const [loadOlderUnit, setLoadOlderUnit] = useState<"hours" | "days" | "months">("hours");
  const [remoteMeta, setRemoteMeta] = useState<
    | null
    | RemoteMeta
  >(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStored(loadUserState());
  }, []);

  useEffect(() => {
    // Load AzDO config (PAT/org/scope) from local storage.
    setCfg(loadConfig());
  }, []);

  function updateCfg(patch: Partial<AzdoConfig>) {
    setCfg((prev) => {
      if (!prev) return prev;
      const next: AzdoConfig = {
        ...prev,
        ...patch,
      };
      saveConfig(next);
      return next;
    });
  }

  useEffect(() => {
    saveUserState(stored);
  }, [stored]);

  async function refreshRemote() {
    if (!cfg) return;
    
    // Rate limiting check
    if (!feedRateLimiter.check("feed-refresh")) {
      const retryAfterMs = feedRateLimiter.getTimeUntilReset("feed-refresh");
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      setRemoteError(`Too many requests. Please wait ${retryAfterSec} seconds before refreshing.`);
      return;
    }
    
    const scopeKey = makeScopeKey(cfg);
    setLoadingRemote(true);
    setRemoteError(null);
    setRemoteMeta(null);
    try {
      const prevScrollY = window.scrollY;
      const prevDocHeight = document.documentElement.scrollHeight;

      const res = await fetch("/api/azdo/feed", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest", // CSRF protection
        },
        body: JSON.stringify({
          org: cfg.org,
          pat: cfg.pat,
          projects: cfg.projects,
          hours: cfg.lookbackHours,
          prTop: cfg.prTop,
          wiTop: cfg.wiTop,
        }),
      });
      const data = (await res.json()) as unknown;
      const rec = asRecord(data) as RemoteFeedResponse;
      if (rec?.meta) setRemoteMeta(rec.meta);
      if (!res.ok) throw new Error(typeof rec?.error === "string" ? rec.error : "Failed to load feed");

      const fetched = ((rec.posts ?? []) as FeedPost[]).slice();
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const existing = remotePosts ?? loadFeedCache(scopeKey)?.posts ?? [];
      const existingIds = new Set(existing.map((p) => p.id));
      const fetchedNewIds = fetched.filter((p) => !existingIds.has(p.id)).map((p) => p.id);

      const merged = dedupeByIdKeepFirst([...fetched, ...existing]);
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (fetchedNewIds.length > 0) {
        setNewIds(fetchedNewIds);
        setNewSinceAt(Date.now());
      }

      setRemotePosts(merged);
      saveFeedCache(scopeKey, { fetchedAt: Date.now(), posts: merged });

      // Preserve user's reading position when new items prepend.
      requestAnimationFrame(() => {
        const nextDocHeight = document.documentElement.scrollHeight;
        const delta = nextDocHeight - prevDocHeight;
        const userIsReading = prevScrollY > 120;
        if (userIsReading && delta > 0) {
          window.scrollTo({ top: prevScrollY + delta });
        }
      });
    } catch (e) {
      setRemoteError(e instanceof Error ? e.message : "Unknown error");
      // Keep any cached/previous posts on screen.
    } finally {
      setLoadingRemote(false);
    }
  }

  useEffect(() => {
    if (!cfg) return;
    const scopeKey = makeScopeKey(cfg);

    // Load cached posts immediately (fast, offline-friendly).
    const cached = loadFeedCache(scopeKey);
    if (cached?.posts) {
      setRemotePosts(cached.posts);
    } else {
      setRemotePosts([]);
    }

    // Restore scroll position for this scope.
    const savedY = loadScrollY(scopeKey);
    if (typeof savedY === "number") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY });
      });
    }

    // Background refresh only when stale or missing.
    const staleMs = 5 * 60 * 1000;
    if (!cached || Date.now() - cached.fetchedAt > staleMs) {
      refreshRemote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.org, cfg?.pat, JSON.stringify(cfg?.projects), cfg?.lookbackHours, cfg?.prTop, cfg?.wiTop]);

  // Persist scroll position so returning users continue where they left off.
  useEffect(() => {
    if (!cfg) return;
    const scopeKey = makeScopeKey(cfg);
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveScrollY(scopeKey, window.scrollY);
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [cfg]);

  // Fade the "new" highlight after a short time.
  useEffect(() => {
    if (newIds.length === 0 || !newSinceAt) return;
    const t = window.setTimeout(() => {
      setNewIds([]);
      setNewSinceAt(null);
    }, 12_000);
    return () => window.clearTimeout(t);
  }, [newIds, newSinceAt]);

  const posts = useMemo(() => remotePosts ?? [], [remotePosts]);

  const enriched = useMemo(() => {
    return posts
      .map((p) => {
        const st = normalizeUserPostState(getPostState(stored, p.id));
        return { post: p, state: st };
      })
      .sort((a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime());
  }, [posts, stored]);

  const pinned = useMemo(() => enriched.filter((x) => x.state.pinned), [enriched]);
  const mainList = useMemo(() => {
    const base = filter.showSavedOnly ? enriched.filter((x) => x.state.saved) : enriched;
    return base.filter(({ post }) => {
      if (filter.type !== "all" && post.type !== filter.type) return false;
      if (filter.project !== "all" && post.project !== filter.project) return false;
      if (filter.person !== "all" && personKey(post.actor) !== filter.person) return false;
      if (filter.workItemType !== "all") {
        if (post.type !== "work_item") return false;
        if ((post.workItem?.type ?? "") !== filter.workItemType) return false;
      }
      if (filter.prStatus !== "all") {
        if (post.type !== "pull_request") return false;
        if ((post.pullRequest?.status ?? "") !== filter.prStatus) return false;
      }
      if (!postMatchesQuery(post, filter.query)) return false;
      return true;
    });
  }, [enriched, filter]);

  const stats = useMemo(() => {
    const posts = mainList.map((x) => x.post);
    const projects = new Set<string>();
    const people = new Map<string, string>();
    let wi = 0;
    let prs = 0;

    const byPersonCount = new Map<string, { key: string; name: string; count: number }>();

    for (const p of posts) {
      projects.add(p.project);

      const key = personKey(p.actor);
      if (key) {
        people.set(key, p.actor.displayName);
        const existing = byPersonCount.get(key);
        if (existing) existing.count += 1;
        else byPersonCount.set(key, { key, name: p.actor.displayName, count: 1 });
      }

      if (p.type === "work_item") wi += 1;
      if (p.type === "pull_request") prs += 1;
    }

    const topPeople = Array.from(byPersonCount.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);
    const maxCount = topPeople[0]?.count ?? 0;

    return {
      total: posts.length,
      projects: projects.size,
      workItems: wi,
      prs,
      people: people.size,
      topPeople,
      maxCount,
    };
  }, [mainList]);

  const filterOptions = useMemo(() => {
    const projects = new Set<string>();
    const people = new Map<string, string>();
    const wiTypes = new Set<string>();
    const prStatuses = new Set<string>();

    for (const { post } of enriched) {
      projects.add(post.project);

      const key = personKey(post.actor);
      if (key) people.set(key, post.actor.displayName);

      if (post.type === "work_item" && post.workItem?.type) wiTypes.add(post.workItem.type);
      if (post.type === "pull_request" && post.pullRequest?.status) prStatuses.add(post.pullRequest.status);
    }

    return {
      projects: Array.from(projects).sort((a, b) => a.localeCompare(b)),
      people: Array.from(people.entries())
        .map(([key, displayName]) => ({ key, displayName }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      workItemTypes: Array.from(wiTypes).sort((a, b) => a.localeCompare(b)),
      prStatuses: Array.from(prStatuses).sort((a, b) => a.localeCompare(b)),
    };
  }, [enriched]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return enriched.find((x) => x.post.id === selectedId) ?? null;
  }, [enriched, selectedId]);

  function toggleSaved(id: string) {
    setStored((prev) => {
      const current = getPostState(prev, id);
      return setPostState(prev, id, { saved: !current.saved });
    });
  }

  function togglePinned(id: string) {
    setStored((prev) => {
      const current = getPostState(prev, id);
      const now = new Date().toISOString();
      return setPostState(prev, id, {
        pinned: !current.pinned,
        pinnedAt: !current.pinned ? now : null,
      });
    });
  }

  function setNote(id: string, note: string) {
    setStored((prev) => {
      const trimmed = note.trim();
      if (!trimmed) {
        return setPostState(prev, id, { note: null, noteUpdatedAt: null });
      }
      return setPostState(prev, id, {
        note: note,
        noteUpdatedAt: new Date().toISOString(),
      });
    });
  }

  // Desktop keyboard navigation (optional MVP)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const isTyping =
        el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.getAttribute("contenteditable") === "true");
      if (isTyping) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const ids = mainList.map((x) => x.post.id);
        if (ids.length === 0) return;
        const idx = selectedId ? ids.indexOf(selectedId) : -1;
        const nextIdx = e.key === "j" ? Math.min(ids.length - 1, idx + 1) : Math.max(0, idx - 1);
        setSelectedId(ids[nextIdx]);
      }

      if (e.key === "Enter") {
        if (selectedId) {
          // ensure drawer opens on desktop; on mobile, selection already opens modal
          // (open state derived below)
        }
      }

      if (e.key === "Escape") {
        setSelectedId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mainList, selectedId]);

  const openDetails = Boolean(selectedId);

  const newCount = newIds.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-zinc-950">AzDo Feed</div>
            <div className="text-xs text-zinc-500">The stage is we own.</div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/settings"
              className="inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Settings
            </Link>

            <button
              type="button"
              onClick={() => refreshRemote()}
              disabled={!cfg || loadingRemote}
              className={
                "hidden h-10 items-center rounded-full border px-4 text-sm transition-colors md:inline-flex " +
                (!cfg
                  ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
              }
            >
              {loadingRemote ? "Refreshing…" : "Refresh"}
            </button>

            {cfg && newCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  setNewIds([]);
                  setNewSinceAt(null);
                }}
                className="inline-flex h-10 items-center rounded-full border border-sky-200 bg-sky-50 px-4 text-sm text-sky-900 hover:bg-sky-100"
              >
                {newCount} new
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, showSavedOnly: !f.showSavedOnly }))}
              className={
                "h-10 rounded-full border px-4 text-sm transition-colors " +
                (filter.showSavedOnly
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
              }
            >
              Saved
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter({
                  showSavedOnly: false,
                  type: "all",
                  project: "all",
                  person: "all",
                  workItemType: "all",
                  prStatus: "all",
                  query: "",
                })
              }
              className="hidden h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50 md:inline"
            >
              Reset filters
            </button>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="hidden h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50 md:inline"
            >
              Close details
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!cfg ? (
          <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Connect your Azure DevOps org in <Link href="/settings" className="underline">Settings</Link> to see live activity.
          </div>
        ) : null}

        {remoteError ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Couldn’t load Azure DevOps feed: {remoteError}
          </div>
        ) : null}

        {cfg && remoteMeta && !remoteError && (remoteMeta.wiCount ?? 0) === 0 && (remoteMeta.wiErrorCount ?? 0) > 0 ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Work items didn’t load (PRs did). Common causes: missing PAT scope (<span className="font-medium">Work Items (read)</span>) or WIQL/date-query restrictions. Update your PAT in <Link href="/settings" className="underline">Settings</Link> if needed.

            {remoteMeta.errorSamples && remoteMeta.errorSamples.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-amber-900/90">Show details</summary>
                <div className="mt-2 space-y-2 text-xs text-amber-900/90">
                  {remoteMeta.errorSamples.map((e: { project: string; message: string }, idx: number) => (
                    <div key={idx} className="rounded-xl border border-amber-200 bg-white/50 px-3 py-2">
                      <div className="font-medium">{e.project}</div>
                      <div className="break-words">{e.message}</div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}

        {cfg && remoteMeta && !remoteError ? (
          <details open className="mb-6 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            <summary className="cursor-pointer list-none select-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-zinc-900">Data</span>
                  <span className="text-zinc-400"> · </span>
                  <span>
                    Loaded {remoteMeta.postsCount ?? (remotePosts ? remotePosts.length : 0)} posts
                    {typeof remoteMeta.prCount === "number" || typeof remoteMeta.wiCount === "number"
                      ? ` (PRs: ${remoteMeta.prCount ?? "?"}, Work items: ${remoteMeta.wiCount ?? "?"})`
                      : ""} from {remoteMeta.projectsSucceeded ?? "?"}/{remoteMeta.projectsRequested ?? "?"} projects ({formatLookback(cfg.lookbackHours)}).
                  </span>
                </div>
                <span className="text-xs text-zinc-400">Click to collapse</span>
              </div>
            </summary>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Load older</span>
                <input
                  value={loadOlderAmount}
                  onChange={(e) => setLoadOlderAmount(Number(e.target.value))}
                  type="number"
                  min={1}
                  className="h-10 w-20 rounded-2xl border border-zinc-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
                <select
                  value={loadOlderUnit}
                  onChange={(e) => setLoadOlderUnit(e.target.value as "hours" | "days" | "months")}
                  className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
                >
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                  <option value="months">months</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (cfg.lookbackHours === null) return;
                    const n = Math.max(1, Number(loadOlderAmount) || 1);
                    const deltaHours =
                      loadOlderUnit === "hours"
                        ? n
                        : loadOlderUnit === "days"
                          ? n * 24
                          : n * 24 * 30;
                    updateCfg({ lookbackHours: cfg.lookbackHours + deltaHours });
                  }}
                  disabled={cfg.lookbackHours === null}
                  className={
                    "inline-flex h-10 items-center rounded-full border px-4 text-sm transition-colors " +
                    (cfg.lookbackHours === null
                      ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
                  }
                >
                  Apply
                </button>
              </div>

              <button
                type="button"
                onClick={() => updateCfg({ lookbackHours: null })}
                className={
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm transition-colors " +
                  (cfg.lookbackHours === null
                    ? "border-sky-200 bg-sky-50 text-sky-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
                }
              >
                All time
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = cfg.prTop + 25;
                  updateCfg({ prTop: next });
                }}
                className={
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm transition-colors " +
                  "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }
              >
                Fetch more PRs (+25)
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = cfg.wiTop + 100;
                  updateCfg({ wiTop: next });
                }}
                className={
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm transition-colors " +
                  "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }
              >
                Fetch more work items (+100)
              </button>
            </div>
          </details>
        ) : null}

        <details open className="mb-6 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <summary className="cursor-pointer list-none select-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium text-zinc-900">Filters</span>
                {filter.query.trim() ? <span className="text-zinc-400"> · </span> : null}
                {filter.query.trim() ? <span className="text-zinc-600">Search: “{filter.query.trim()}”</span> : null}
              </div>
              <span className="text-xs text-zinc-400">Click to collapse</span>
            </div>
          </summary>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <input
                value={filter.query}
                onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
                placeholder="Type to filter (project, person, PR/WI ID, title, …)"
                className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />
              {filter.query.trim() ? (
                <button
                  type="button"
                  onClick={() => setFilter((f) => ({ ...f, query: "" }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <select
              value={filter.type}
              onChange={(e) => {
                const nextType = e.target.value as FeedFilter["type"];
                setFilter((f) => ({
                  ...f,
                  type: nextType,
                  // Clear sub-filters when switching types.
                  workItemType: nextType === "work_item" ? f.workItemType : "all",
                  prStatus: nextType === "pull_request" ? f.prStatus : "all",
                }));
              }}
              className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
            >
              <option value="all">All types</option>
              <option value="pull_request">PRs</option>
              <option value="work_item">Work items</option>
            </select>

            <select
              value={filter.project}
              onChange={(e) => setFilter((f) => ({ ...f, project: e.target.value }))}
              className="h-10 max-w-[220px] rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
            >
              <option value="all">All projects</option>
              {filterOptions.projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={filter.person}
              onChange={(e) => setFilter((f) => ({ ...f, person: e.target.value }))}
              className="h-10 max-w-[240px] rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
            >
              <option value="all">All people</option>
              {filterOptions.people.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.displayName}
                </option>
              ))}
            </select>

            <select
              value={filter.workItemType}
              onChange={(e) => setFilter((f) => ({ ...f, workItemType: e.target.value }))}
              disabled={filter.type !== "work_item"}
              className={
                "h-10 rounded-2xl border bg-white px-3 text-sm " +
                (filter.type === "work_item" ? "border-zinc-200 text-zinc-700" : "border-zinc-200 text-zinc-400")
              }
            >
              <option value="all">All work item types</option>
              {filterOptions.workItemTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filter.prStatus}
              onChange={(e) => setFilter((f) => ({ ...f, prStatus: e.target.value }))}
              disabled={filter.type !== "pull_request"}
              className={
                "h-10 rounded-2xl border bg-white px-3 text-sm " +
                (filter.type === "pull_request" ? "border-zinc-200 text-zinc-700" : "border-zinc-200 text-zinc-400")
              }
            >
              <option value="all">All PR statuses</option>
              {filterOptions.prStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setFilter({
                  showSavedOnly: filter.showSavedOnly,
                  type: "all",
                  project: "all",
                  person: "all",
                  workItemType: "all",
                  prStatus: "all",
                  query: "",
                })
              }
              className="ml-auto inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs text-zinc-500">Total records</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{metric(stats.total)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs text-zinc-500">Total projects</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{metric(stats.projects)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs text-zinc-500">Total work items</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{metric(stats.workItems)}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-1.5 bg-sky-400"
                  style={{ width: stats.total > 0 ? `${Math.round((stats.workItems / stats.total) * 100)}%` : "0%" }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs text-zinc-500">Total PRs</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{metric(stats.prs)}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-1.5 bg-indigo-400"
                  style={{ width: stats.total > 0 ? `${Math.round((stats.prs / stats.total) * 100)}%` : "0%" }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs text-zinc-500">Team</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{metric(stats.people)}</div>
              <div className="mt-2 space-y-1">
                {stats.topPeople.length === 0 ? (
                  <div className="text-xs text-zinc-400">No results</div>
                ) : (
                  stats.topPeople.slice(0, 3).map((p) => (
                    <div key={p.key} className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-1.5 bg-zinc-900/70"
                          style={{ width: stats.maxCount > 0 ? `${Math.max(8, Math.round((p.count / stats.maxCount) * 100))}%` : "0%" }}
                        />
                      </div>
                      <div className="w-10 text-right text-xs tabular-nums text-zinc-500">{p.count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {stats.topPeople.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-xs font-medium text-zinc-500">Top contributors (by posts in current view)</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {stats.topPeople.map((p) => (
                  <div key={p.key} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm text-zinc-800">{p.name}</div>
                        <div className="text-xs tabular-nums text-zinc-500">{p.count}</div>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-1.5 bg-sky-500"
                          style={{ width: stats.maxCount > 0 ? `${Math.max(6, Math.round((p.count / stats.maxCount) * 100))}%` : "0%" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </details>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
          <div>
            {/* Pinned */}
            {pinned.length > 0 ? (
              <section className="mb-6">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPinnedCollapsedMobile((v) => !v)}
                    className="text-sm font-semibold text-zinc-900"
                  >
                    Pinned ({pinned.length})
                  </button>
                  <div className="text-xs text-zinc-500">Private to you</div>
                </div>

                <div className={"mt-3 space-y-3 " + (pinnedCollapsedMobile ? "hidden md:block" : "block")}>
                  {pinned
                    .slice()
                    .sort((a, b) => {
                      const aT = a.state.pinnedAt ? new Date(a.state.pinnedAt).getTime() : 0;
                      const bT = b.state.pinnedAt ? new Date(b.state.pinnedAt).getTime() : 0;
                      return bT - aT;
                    })
                    .map(({ post, state }) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        state={state}
                        selected={selectedId === post.id}
                        isNew={newIds.includes(post.id)}
                        onFilterPerson={() => {
                          const key = personKey(post.actor);
                          if (!key) return;
                          setFilter((f) => ({
                            ...f,
                            person: toggleFilterValue(f.person, key),
                          }));
                        }}
                        onFilterProject={() => {
                          setFilter((f) => ({
                            ...f,
                            project: toggleFilterValue(f.project, post.project),
                          }));
                        }}
                        onSelect={() => setSelectedId(post.id)}
                        onToggleSaved={() => toggleSaved(post.id)}
                        onTogglePinned={() => togglePinned(post.id)}
                        onEditNote={() => setSelectedId(post.id)}
                      />
                    ))}
                </div>
              </section>
            ) : null}

            {/* Feed */}
            <section ref={listRef} className="space-y-3">
              {mainList.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600">
                  {filter.showSavedOnly
                    ? "No saved posts yet."
                    : !cfg
                      ? "Connect an org to load activity."
                      : loadingRemote
                        ? "Loading live activity…"
                        : "No activity found for the selected time range / filters."}
                </div>
              ) : (
                mainList.map(({ post, state }) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    state={state}
                    selected={selectedId === post.id}
                    isNew={newIds.includes(post.id)}
                    onFilterPerson={() => {
                      const key = personKey(post.actor);
                      if (!key) return;
                      setFilter((f) => ({
                        ...f,
                        person: toggleFilterValue(f.person, key),
                      }));
                    }}
                    onFilterProject={() => {
                      setFilter((f) => ({
                        ...f,
                        project: toggleFilterValue(f.project, post.project),
                      }));
                    }}
                    onSelect={() => setSelectedId(post.id)}
                    onToggleSaved={() => toggleSaved(post.id)}
                    onTogglePinned={() => togglePinned(post.id)}
                    onEditNote={() => setSelectedId(post.id)}
                  />
                ))
              )}
            </section>
          </div>

          {/* Desktop drawer column placeholder (actual drawer is fixed) */}
          <div className="hidden lg:block" />
        </div>
      </main>

      <DetailPanel
        post={selected?.post ?? null}
        state={selected?.state ?? null}
        open={openDetails}
        onClose={() => setSelectedId(null)}
        onChangeNote={(note) => {
          if (!selected) return;
          setNote(selected.post.id, note);
        }}
      />
    </div>
  );
}
