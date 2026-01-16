# AzDoNewsFeed — Product Requirements Document (PRD)

**Product name:** AzDoNewsFeed  
**Doc owner:** (you)  
**Last updated:** 2026-01-14  
**Status:** Draft (workshopping)

## 1) Summary
AzDoNewsFeed is a calm, Slack-like news feed for Azure DevOps (AzDO), inspired by the scannability of a Twitter/X timeline. It aggregates activity across projects into a single, continuously scrollable stream of succinct posts. Users can see who did what (commits, pull requests, work item/PBI updates) without clicking in and out of projects.

## 2) Problem Statement
In Azure DevOps, activity is distributed across projects, repos, boards, and pipelines. Leaders, engineers, PMs, and stakeholders often want a quick “what changed recently?” view across all projects (or a curated subset). Today this requires manual navigation and context switching.

### Pain points
- No unified, fast-scanning “org-wide feed” experience.
- Hard to track cross-project changes and momentum.
- Poor visibility into *who* is moving which PBIs forward.
- Context switching overhead and missed updates.

## 3) Goals & Success Metrics
### Goals (MVP)
- Provide a single timeline of recent activity across selected AzDO scope.
- Make posts succinct but actionable (who/what/where/when + deep link).
- Support filtering by project, repo, actor, and event type.
- Work with a Personal Access Token (PAT) as the first auth method.

### Success metrics
- **Time-to-insight:** user can find “what happened today?” in < 30 seconds.
- **Adoption:** % of invited users who connect PAT and view feed weekly.
- **Engagement:** median posts scrolled per session; saves/bookmarks (if implemented).
- **Coverage:** % of relevant event types available vs targeted scope.
- **Reliability:** feed loads successfully > 99% sessions.

## 4) Non-Goals (MVP)
- Writing actions back to AzDO (commenting, editing work items).
- A full “social network” (likes, reposts, follows) beyond basic bookmarking.
- Advanced analytics or long-term historical warehousing.
- Multi-tenant SaaS with billing (assume single-org/internal initially).

## 5) Target Users & Personas
1. **Engineering Manager / Tech Lead**
   - Needs: cross-project awareness, risk signals, review throughput.
2. **Product Manager**
   - Needs: PBI movement, status changes, scope churn, who’s unblocked.
3. **Engineer**
   - Needs: changes in dependencies, PR merges, build breaks, upstream commits.
4. **Stakeholder / Exec** (optional)
   - Needs: high-level momentum; minimal jargon; curated filters.

## 6) User Stories (MVP)
- As a user, I can connect a PAT and choose an AzDO organization.
- As a user, I can select scope: all projects or a subset.
- As a user, I can view a live-ish timeline of recent updates.
- As a user, I can filter by event type (commits, PRs, work items/PBIs).
- As a user, I can click a post to open the item in AzDO.
- As a user, I can hide noisy repos/projects temporarily.
- As a user, I can **save** a post for later.
- As a user, I can **pin** a post so it stays easy to find.
- As a user, I can add a **personal note** to a post (private).
- As a user, I can use the app comfortably on **mobile and desktop**.

## 7) Feed Content: Event Types
MVP focuses on a small set of high-signal events, then expands.

### MVP event types
1. **Commit pushed** (Git)
2. **Pull request created / updated / completed**
3. **Work item updated** (esp. PBIs: state, assignment, tags, iteration)

### Phase 2 candidates
- Build run failed/succeeded
- Release/deployment events
- Comments on PRs / work items
- Test plan updates

## 8) “Post” Model (Canonical Feed Item)
A feed item is rendered as a compact “post”, similar to a tweet:

### Required fields
- `id` (string): stable ID used for dedupe (see below)
- `type` (enum): `commit` | `pull_request` | `work_item`
- `org` (string)
- `project` (string)
- `actor`:
  - `displayName` (string)
  - `uniqueName` (string, often email)
  - `avatarUrl` (string | null)
- `createdAt` (ISO timestamp)
- `summary` (string): a 1–2 line human-readable summary
- `url` (string): deep link to AzDO

### Optional fields
- `repo` (string)
- `branch` (string)
- `workItem`:
  - `id` (number)
  - `title` (string)
  - `state` (string)
  - `type` (string) — e.g., Product Backlog Item
- `pullRequest`:
  - `id` (number)
  - `title` (string)
  - `status` (string)
- `commit`:
  - `sha` (string)
  - `message` (string)
- `tags` (string[])
- `userState` (per-user, private):
  - `saved` (boolean)
  - `pinned` (boolean)
  - `note` (string | null)
  - `noteUpdatedAt` (ISO timestamp | null)

### Dedupe & ordering
- Default sort: reverse chronological by `createdAt`.
- Dedupe key: prefer a deterministic ID based on source identifiers:
  - Commit: `commit:{project}:{repo}:{sha}`
  - PR: `pr:{project}:{repo}:{pullRequestId}:{lastUpdateTime}` (or a stable PR id + change counter)
  - Work item: `wi:{project}:{id}:{rev}`

## 9) Scope, Freshness, and Ranking
### Scope
- **Org** (required): single org first.
- **Project selection:** all projects by default, with ability to exclude.

### Freshness (MVP)
- Polling-based refresh every N seconds (e.g., 30–60s), plus manual refresh.
- Infinite scroll pagination: “load older” by time window / continuation token.

### Ranking
- MVP: purely chronological.
- Later: “high-signal” ranking (e.g., PR completed, PBI state changed) with optional “Top” tab.

## 10) UX Requirements
### Look & feel (design direction)
- Calm, “blue-ocean” aesthetic: light surfaces, generous whitespace, soft separators.
- Scan-first typography: readable line-height, subtle hierarchy, minimal chrome.
- Motion is gentle: soft skeletons, subtle hover, no auto-jumping the scroll position.

### Progressive & adaptive (responsive)
- Mobile-first layout; desktop gains space and shortcuts.
- Breakpoints:
  - **Mobile:** single column; detail drawer becomes a full-height modal.
  - **Tablet:** single column + modal/drawer hybrid.
  - **Desktop:** centered feed column + right-side detail drawer.
- Touch targets meet mobile guidelines (minimum ~44px).
- Keyboard navigation supported on desktop (optional MVP): j/k navigation, Enter opens details, Esc closes.

### Onboarding
- Landing page explains value, required PAT scopes, and security statement.
- PAT entry + org name.
- Scope selection: all projects vs selected.

### Feed
- Infinite scroll timeline (newest at top).
- New activity appears via a small “N new updates” pill at the top (user opts in to jump).
- Filter chips: project, event type, actor, repo.
- Search box (optional MVP): by work item id/title keywords.
- Post card shows: actor avatar/name, summary, project/repo, time, event icon.

### Pin / Save / Notes
- Each post has lightweight actions (icon buttons): **Save**, **Pin**, **Add note**.
- Saved and pinned state is immediately reflected in UI (optimistic).
- Notes open a small inline composer or a drawer section; notes are private to the user.
- Views:
  - Default feed: chronological.
  - Pinned: a compact “Pinned” section at top (collapsible on mobile).
  - Saved: filter chip or tab to view saved posts.

### Negative events (signal without stress)
When “negative” items are introduced (e.g., build failures in phase 2), they should stand out without turning the UI into an alert dashboard:
- Use a muted accent (e.g., soft coral/amber) via a thin left border + icon, not a full red card.
- Keep copy factual and calm (no “URGENT” language).
- Optional filter chip: `Needs attention` (off by default).

### Details
- Clicking a post opens a side panel (detail drawer) with:
  - key metadata
  - a slightly expanded description
  - direct link to AzDO

### Empty states & errors
- Empty: “No recent activity in your selected scope.”
- Auth error: “PAT invalid/expired” with instructions.
- Rate limit / throttling: “We’re being rate-limited; backing off.”

## 11) Security & Privacy
### PAT handling (MVP)
- PAT is sensitive. Requirements:
  - Never log PAT.
  - Store PAT only in server-side secrets or encrypted storage.
  - Prefer session-only storage for early MVP (user must paste per session) OR encrypted at rest with user-controlled key.

### Recommended PAT scopes (to validate during implementation)
- Code (read)
- Work Items (read)
- Pull Requests (read) if separated

### Compliance expectations
- Principle of least privilege.
- Auditability: basic request logging without secrets.
- Data minimization: store only what’s needed for the feed.

## 12) Technical Approach (MVP)
### Architecture options
1. **Client-only (direct-to-AzDO)**
   - Pros: quick prototype
   - Cons: exposes PAT in browser; CORS; difficult to secure
2. **Backend-for-frontend (recommended MVP)**
   - Web app talks to a small backend API.
   - Backend calls AzDO REST with PAT.
   - Adds caching, dedupe, throttling, normalization.

### MVP choice
- Use a lightweight backend-for-frontend.
- Store minimal normalized feed items in memory (or SQLite) for a single user, then expand.

### Data sources (Azure DevOps)
Primary candidates (to confirm with implementation):
- Projects list: `_apis/projects`
- Git commits: `_apis/git/repositories/{repoId}/commits` (or pushes)
- Pull requests: `_apis/git/repositories/{repoId}/pullrequests`
- Work item updates:
  - either query recent updates via Work Item Query / WIQL
  - or call revisions/updates endpoints for changed items in a time window

### Constraints
- API rate limiting and org size: polling all repos/projects naïvely will not scale.
- Need incremental sync strategy:
  - per-scope “last seen” timestamps
  - backoff and caching

## 13) Functional Requirements (MVP)
- FR1: Connect PAT + org; validate token.
- FR2: Discover projects; allow include/exclude.
- FR3: Fetch and render a unified feed of events.
- FR4: Filter by project and event type.
- FR5: Pagination/infinite scroll.
- FR6: Each post links to the AzDO resource.
- FR7: Users can pin and save posts.
- FR8: Users can create/edit/delete a private note per post.

## 14) Non-Functional Requirements
- **Performance:** initial feed load < 2s on typical org; render 100 posts smoothly.
- **Reliability:** graceful degradation under throttling.
- **Scalability:** handle 50+ projects via caching and incremental fetch.
- **Security:** no PAT in client logs; secrets redaction; TLS only.
- **Observability:** basic metrics (requests, latency, errors, throttles).
- **Responsiveness:** excellent UX from small phones to large desktops.
- **Durability (MVP):** saved/pinned/notes persist across refresh (at least locally).

## 15) MVP Milestones
### Milestone 0 — Spike (1–2 days)
- Prove AzDO endpoints for:
  - list projects
  - list repos per project
  - fetch commits/PRs
  - fetch recent work item changes

### Milestone 1 — Feed MVP (3–7 days)
- Web UI with timeline + filters.
- Backend aggregator normalizes events into `Post` model.
- Pagination and manual refresh.

### Milestone 2 — Quality + Scale (1–2 weeks)
- Caching, dedupe, throttling/backoff.
- Better work-item change detection.
- Basic persistence (SQLite) and multi-session support.

### Milestone 3 — Hooks (optional)
- Replace/augment polling with Service Hooks/webhooks.
- Near-real-time updates.

## 16) Open Questions
- Do we target **single org** only, or multi-org accounts?
- What is the “source of truth” for work item updates at scale (WIQL vs updates API vs service hooks)?
- Required PAT scopes for each event type (exact minimal set)?
- Should we include pipelines/builds in MVP or phase 2?
- How should we handle identity mapping + avatars across orgs?

---

## Appendix A — Example Posts
- **Commit**: “Alex pushed 3 commits to `feature/auth` in `Payments` (project: Billing)”
- **PR**: “Priya completed PR #184: ‘Add retry policy’ in `CoreServices`”
- **Work item**: “Jordan moved PBI 9321 ‘Checkout instrumentation’ from ‘Active’ → ‘Resolved’”
