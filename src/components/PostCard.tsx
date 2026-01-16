"use client";

import Image from "next/image";
import type { FeedPost, UserPostState } from "@/lib/types";
import { formatRelativeTime } from "@/components/time";
import { BookmarkIcon, NoteIcon, PinIcon } from "@/components/icons";

type Props = {
  post: FeedPost;
  state: UserPostState;
  selected: boolean;
  isNew?: boolean;
  onFilterPerson?: () => void;
  onFilterProject?: () => void;
  onSelect: () => void;
  onToggleSaved: () => void;
  onTogglePinned: () => void;
  onEditNote: () => void;
};

function typeLabel(type: FeedPost["type"]) {
  switch (type) {
    case "commit":
      return "Commit";
    case "pull_request":
      return "PR";
    case "work_item":
      return "Work item";
    case "build":
      return "Build";
  }
}

function initials(name: string) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? cleaned[0];
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  const out = (first + last).toUpperCase();
  return out.slice(0, 2);
}

export function PostCard({
  post,
  state,
  selected,
  isNew,
  onFilterPerson,
  onFilterProject,
  onSelect,
  onToggleSaved,
  onTogglePinned,
  onEditNote,
}: Props) {
  const needsAttention = Boolean(post.needsAttention);
  const showNew = Boolean(isNew);
  const avatarUrl = post.actor.avatarUrl;
  const avatarInitials = initials(post.actor.displayName);

  return (
    <div
      className={
        "group relative rounded-2xl border bg-white/70 px-4 py-3 shadow-sm backdrop-blur transition-colors " +
        (selected ? "border-sky-300 bg-white" : "border-zinc-200 hover:border-sky-200") +
        (needsAttention ? " border-l-4 border-l-amber-400" : "") +
        (showNew ? " ring-1 ring-sky-200 bg-sky-50/40" : "")
      }
      role="article"
      aria-label={`Post: ${post.summary}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
        aria-label={`Open details for ${post.summary}`}
      >
        <div className="flex items-start gap-3">
          <div className="relative mt-1 h-9 w-9 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-[12px] font-semibold tracking-wide text-sky-900">
              {avatarInitials}
            </div>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={post.actor.displayName}
                width={36}
                height={36}
                unoptimized
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-9 w-9 rounded-full object-cover"
                onError={(e) => {
                  // If the image fails (auth/cors), gracefully reveal initials.
                  (e.currentTarget as HTMLImageElement).style.opacity = "0";
                }}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {onFilterPerson ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterPerson();
                  }}
                  className="inline-flex max-w-full items-center rounded-full border border-transparent px-2 py-0.5 text-left font-medium text-zinc-950 hover:border-sky-200 hover:bg-sky-50"
                  aria-label={`Filter by ${post.actor.displayName}`}
                >
                  <span className="truncate">{post.actor.displayName}</span>
                </button>
              ) : (
                <div className="font-medium text-zinc-950 sm:truncate">
                  <span className="break-words">{post.actor.displayName}</span>
                </div>
              )}
              <span className="text-zinc-300">•</span>
              <div className="text-sm text-zinc-500">{formatRelativeTime(post.createdAt)}</div>
              {showNew ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-900">
                  New
                </span>
              ) : null}
              <span className="sm:ml-auto rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-600">
                {typeLabel(post.type)}
              </span>
            </div>
            <div className="mt-1 text-[15px] leading-6 text-zinc-800 md:line-clamp-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {onFilterProject ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFilterProject();
                    }}
                    className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 font-medium text-zinc-950 hover:border-sky-200 hover:bg-sky-50"
                    aria-label={`Filter by project ${post.project}`}
                  >
                    {post.project}
                  </button>
                ) : (
                  <span className="font-medium text-zinc-950">{post.project}</span>
                )}
                {post.repo ? <span className="text-zinc-500">/</span> : null}
                {post.repo ? <span className="text-zinc-700">{post.repo}</span> : null}
              </div>
              <div className="break-words text-zinc-800">{post.summary}</div>
            </div>
            {state.note ? (
              <div className="mt-2 text-sm text-sky-700 md:line-clamp-1">
                Note: {state.note}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActionButton
          label={state.pinned ? "Unpin" : "Pin"}
          onClick={onTogglePinned}
          active={state.pinned}
        >
          <PinIcon className="h-4 w-4" />
        </ActionButton>
        <ActionButton
          label={state.saved ? "Unsave" : "Save"}
          onClick={onToggleSaved}
          active={state.saved}
        >
          <BookmarkIcon className="h-4 w-4" />
        </ActionButton>
        <ActionButton
          label={state.note ? "Edit note" : "Add note"}
          onClick={onEditNote}
          active={Boolean(state.note)}
        >
          <NoteIcon className="h-4 w-4" />
        </ActionButton>

        <a
          className="ml-auto text-sm text-zinc-500 hover:text-zinc-900"
          href={post.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </a>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        "inline-flex h-9 items-center gap-2 rounded-full border px-2.5 text-sm transition-colors sm:h-10 sm:px-3 " +
        (active
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
      }
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
