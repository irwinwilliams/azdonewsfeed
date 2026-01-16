"use client";

import type { FeedPost, UserPostState } from "@/lib/types";
import { CloseIcon } from "@/components/icons";
import { formatRelativeTime } from "@/components/time";

type Props = {
  post: FeedPost | null;
  state: UserPostState | null;
  open: boolean;
  onClose: () => void;
  onChangeNote: (note: string) => void;
};

export function DetailPanel({ post, state, open, onClose, onChangeNote }: Props) {
  if (!open) return null;

  // Mobile: full-screen overlay; Desktop: right-side drawer.
  return (
    <div className="fixed inset-0 z-50 md:inset-auto md:bottom-0 md:right-0 md:top-0 md:z-40 md:w-[420px]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/20 md:hidden"
        onClick={onClose}
        role="presentation"
      />

      <div className="absolute inset-0 md:static md:h-full md:border-l md:border-zinc-200 md:bg-white/80 md:backdrop-blur">
        <div className="flex h-full flex-col bg-white md:bg-transparent">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-zinc-500">
                {post ? `${post.project}${post.repo ? ` / ${post.repo}` : ""}` : "Details"}
              </div>
              <div className="truncate text-base font-semibold text-zinc-950">
                {post ? post.summary : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto px-4 py-4">
            {!post || !state ? (
              <div className="text-sm text-zinc-600">Select a post to see details.</div>
            ) : (
              <>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-sm text-zinc-600">Actor</div>
                  <div className="font-medium text-zinc-950">{post.actor.displayName}</div>
                  <div className="mt-2 text-sm text-zinc-600">When</div>
                  <div className="text-zinc-900">{formatRelativeTime(post.createdAt)}</div>
                  <div className="mt-2 text-sm text-zinc-600">Link</div>
                  <a
                    className="break-words text-sky-700 hover:text-sky-900"
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {post.url}
                  </a>
                </div>

                {post.type === "pull_request" && post.pullRequest ? (
                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-zinc-900">Pull request</div>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                        {post.pullRequest.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-zinc-600">Title</div>
                    <div className="text-zinc-950">{post.pullRequest.title}</div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-zinc-600">PR ID</div>
                        <div className="text-zinc-900">#{post.pullRequest.id}</div>
                      </div>
                      <div>
                        <div className="text-sm text-zinc-600">Repo</div>
                        <div className="text-zinc-900">{post.repo ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {post.type === "work_item" && post.workItem ? (
                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-zinc-900">Work item</div>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                        {post.workItem.type}
                      </span>
                      {post.workItem.state ? (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                          {post.workItem.state}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-zinc-600">Title</div>
                    <div className="text-zinc-950">{post.workItem.title}</div>
                    <div className="mt-2 text-sm text-zinc-600">ID</div>
                    <div className="text-zinc-900">#{post.workItem.id}</div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="text-sm font-medium text-zinc-900">Note (private)</div>
                  <div className="mt-2">
                    <textarea
                      className="min-h-[120px] w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                      placeholder="Add a private note…"
                      value={state.note ?? ""}
                      onChange={(e) => onChangeNote(e.target.value)}
                    />
                    <div className="mt-2 text-xs text-zinc-500">
                      {state.noteUpdatedAt ? `Saved ${formatRelativeTime(state.noteUpdatedAt)}` : "Auto-saves as you type"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
