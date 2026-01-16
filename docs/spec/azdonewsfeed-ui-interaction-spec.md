# AzDoNewsFeed — UI Interaction Spec (MVP)

**Last updated:** 2026-01-14  
**Scope:** Feed UI behaviors for Pin / Save / Notes, and mobile/desktop adaptive layout.

## 1) Core Interaction Model
### 1.1 Feed + Drawer (progressive disclosure)
- The feed is the primary surface. It is always scrollable and never replaced by details.
- Selecting a post reveals more information in a detail surface:
  - **Desktop (>= md):** a right-side drawer (persistent panel).
  - **Mobile (< md):** a full-height modal sheet (overlay).
- The URL does **not** change for simple selection (MVP), but selection is reflected in UI state.

### 1.2 New activity
- Polling/refresh may introduce new posts.
- New posts should not auto-scroll the user.
- Instead, show a subtle banner/pill at top: “N new updates”.
  - Tap/click merges and scrolls to top.
  - Dismiss keeps user in place; new items remain queued until next action.

### 1.3 Post identity & persistence
- All per-user state is keyed by the canonical post ID (e.g., `commit:...`, `pr:...`, `wi:...`).
- Per-user state is private and stored locally (MVP):
  - `saved` boolean
  - `pinned` boolean
  - `note` string | null
  - `noteUpdatedAt` timestamp | null

## 2) Adaptive Layout
### 2.1 Breakpoint behavior
- **Mobile (< md)**
  - Single column.
  - Detail is a full-height modal (sheet) with its own internal scroll.
  - Pinned section collapses by default.
  - Actions must be large touch targets (~44px).
- **Tablet (md to lg)**
  - Single column feed.
  - Detail uses a modal/drawer hybrid (overlay pinned to right or full-height sheet depending on space).
- **Desktop (>= lg)**
  - Centered feed column.
  - Right-side drawer is persistent and does not cover the feed.

### 2.2 Keyboard navigation (desktop)
- Optional MVP (recommended):
  - `j` / `k`: move selection down/up.
  - `Enter`: open details (if not already open).
  - `Esc`: close details.
- Keyboard shortcuts never steal focus when a text input/textarea is active.

## 3) Post Card Behaviors
### 3.1 Click targets
- Clicking the post body selects it (opens details surface).
- Clicking action icons does **not** open details.

### 3.2 Save
- Save toggles `saved` state.
- UI affordance:
  - icon toggles filled/outlined.
  - optional subtle toast: “Saved” / “Removed from saved”.
- Save is **optimistic** and persists immediately.

### 3.3 Pin
- Pin toggles `pinned` state.
- Pinned posts appear in a “Pinned” section at top.
- Pinned section rules:
  - Desktop: expanded by default.
  - Mobile: collapsed by default with a small “Pinned (N)” header.
- Pinned ordering:
  - newest pinned first by the pin time (MVP: when toggled on).

### 3.4 Notes
- A post may have a single private note.
- Notes entry points:
  - In details: dedicated “Note” section.
  - On card: note icon indicates whether a note exists.
- Editing rules:
  - Opening the note editor focuses the textarea.
  - Notes auto-save on:
    - blur
    - `Cmd+Enter` (explicit save)
  - Clearing a note (empty text) deletes the note.
- Visual feedback:
  - show “Saved” timestamp subtly (e.g., “Saved 2m ago”).

## 4) Filters and Views
### 4.1 Default view
- Default feed is chronological.

### 4.2 Pinned view
- Pinned section is displayed above the feed.
- Pinned section can be collapsed/expanded.

### 4.3 Saved filter
- Saved can be accessed as:
  - a filter chip (“Saved”), or
  - a lightweight tab toggle.
- When enabled, the main list shows only saved posts; pinned section remains visible.

## 5) Empty/Error States
- Empty feed: calm message with suggestion to widen scope.
- Empty saved: “No saved posts yet.”
- Storage unavailable (private browsing): fall back to in-memory state and show a one-time banner.

## 6) Analytics (optional)
- Track only high-level events (no PAT, no content):
  - `post_opened`, `post_saved`, `post_pinned`, `note_saved`.

## 7) Accessibility Requirements
- All icon buttons have accessible labels.
- Drawer/modal traps focus; `Esc` closes.
- Contrast meets WCAG AA.
- Reduced motion respected.
