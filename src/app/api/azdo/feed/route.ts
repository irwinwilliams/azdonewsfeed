import type { FeedPost } from "@/lib/types";
import {
  getWorkItems,
  listPullRequestsByProject,
  listProjects,
  queryWorkItemIdsChangedSince,
} from "@/lib/azdo";
import { feedRequestSchema, sanitizeError } from "@/lib/validation";

export const dynamic = "force-dynamic";

function prVerb(status: string) {
  switch (status) {
    case "completed":
      return "completed";
    case "abandoned":
      return "abandoned";
    default:
      return "updated";
  }
}

export async function POST(req: Request) {
  try {
    // Verify request has custom header (CSRF protection)
    const requestedWith = req.headers.get("X-Requested-With");
    if (!requestedWith || requestedWith !== "XMLHttpRequest") {
      return Response.json(
        { error: "Invalid request" },
        { status: 403 },
      );
    }

    const body = await req.json();
    
    // Validate input with Zod
    const validated = feedRequestSchema.parse(body);
    
    const org = validated.org;
    const pat = validated.pat;
    const hours = validated.hours ?? 24;
    const prTop = validated.prTop ?? 50;
    const wiTop = validated.wiTop ?? 100;

    const since = hours === null ? 0 : Date.now() - hours * 60 * 60 * 1000;

    const scopeProjects = validated.projects;

    const allProjects = scopeProjects ?? (await listProjects(org, pat)).map((p) => p.name);

    const posts: FeedPost[] = [];

    const errors: Array<{ project: string; message: string }> = [];
    const prErrors: Array<{ project: string; message: string }> = [];
    const wiErrors: Array<{ project: string; message: string }> = [];
    let projectsSucceeded = 0;

    async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
      const queue = items.slice();
      const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
        while (queue.length) {
          const item = queue.shift();
          if (item === undefined) return;
          await fn(item);
        }
      });
      await Promise.all(workers);
    }

    const changedSinceIso = new Date(since).toISOString();

    // MVP “real data”: PR + Work Item activity across projects.
    await mapWithConcurrency(allProjects, 5, async (project) => {
      try {
        let prs: Awaited<ReturnType<typeof listPullRequestsByProject>> = [];
        let prError: string | null = null;
        try {
          prs = await listPullRequestsByProject(org, project, pat, prTop);
        } catch (e) {
          prError = e instanceof Error ? e.message : "Unknown error";
        }

        let workItems: Awaited<ReturnType<typeof getWorkItems>> = [];
        let wiError: string | null = null;
        try {
          // If all-time, `changedSinceIso` is epoch.
          const wiIds = await queryWorkItemIdsChangedSince(org, project, pat, changedSinceIso, wiTop);

          // Work item endpoint has practical limits; batch in chunks.
          const out: Awaited<ReturnType<typeof getWorkItems>> = [];
          const chunkSize = 200;
          for (let i = 0; i < wiIds.length; i += chunkSize) {
            const chunk = wiIds.slice(i, i + chunkSize);
            const items = await getWorkItems(org, project, pat, chunk);
            out.push(...items);
          }
          workItems = out;
        } catch (e) {
          wiError = e instanceof Error ? e.message : "Unknown error";
        }

        // Only treat the whole project as failed if both sources fail.
        if (prError && wiError) {
          throw new Error(`PRs: ${prError}; Work items: ${wiError}`);
        }

        projectsSucceeded += 1;

        if (prError) errors.push({ project, message: `PRs: ${prError}` });
        if (wiError) errors.push({ project, message: `Work items: ${wiError}` });
        if (prError) prErrors.push({ project, message: prError });
        if (wiError) wiErrors.push({ project, message: wiError });

        for (const pr of prs) {
          const createdAt = pr.lastUpdateTime ?? pr.creationDate;
          const t = new Date(createdAt).getTime();
          if (!Number.isFinite(t) || t < since) continue;

          const repoName = pr.repository?.name;
          const prId = pr.pullRequestId;
          const url = repoName
            ? `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repoName)}/pullrequest/${prId}`
            : `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}`;

          const actorName = pr.createdBy?.displayName ?? "Someone";
          const actorUnique = pr.createdBy?.uniqueName ?? "";
          const actorAvatar = pr.createdBy?.imageUrl ?? null;

          posts.push({
            id: `pr:${project}:${repoName ?? ""}:${prId}:${createdAt}`,
            type: "pull_request",
            org,
            project,
            repo: repoName,
            actor: {
              displayName: actorName,
              uniqueName: actorUnique,
              avatarUrl: actorAvatar,
            },
            createdAt,
            summary: `${prVerb(pr.status)} PR #${prId}: ${pr.title}`,
            url,
            pullRequest: {
              id: prId,
              title: pr.title,
              status: pr.status,
            },
          });
        }

        for (const wi of workItems) {
          const fields = (wi.fields ?? {}) as Record<string, unknown>;
          const changedAt = typeof fields["System.ChangedDate"] === "string" ? fields["System.ChangedDate"] : undefined;
          const t = changedAt ? new Date(changedAt).getTime() : NaN;
          if (!Number.isFinite(t) || t < since) continue;

          const id = Number((fields["System.Id"] as unknown) ?? wi.id);
          const title = typeof fields["System.Title"] === "string" ? fields["System.Title"] : "Work item";
          const state = typeof fields["System.State"] === "string" ? fields["System.State"] : "";
          const type = typeof fields["System.WorkItemType"] === "string" ? fields["System.WorkItemType"] : "Work Item";

          const changedBy = fields["System.ChangedBy"];
          const changedByRec = changedBy && typeof changedBy === "object" ? (changedBy as Record<string, unknown>) : null;
          const displayName = changedByRec && typeof changedByRec["displayName"] === "string" ? changedByRec["displayName"] : null;
          const uniqueName = changedByRec && typeof changedByRec["uniqueName"] === "string" ? changedByRec["uniqueName"] : null;
          const avatarUrl = changedByRec && typeof changedByRec["imageUrl"] === "string" ? changedByRec["imageUrl"] : null;

          const actorName = displayName ?? uniqueName ?? "Someone";
          const actorUnique = uniqueName ?? "";

          const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_workitems/edit/${id}`;

          posts.push({
            id: `wi:${project}:${id}:${wi.rev ?? ""}:${changedAt ?? ""}`,
            type: "work_item",
            org,
            project,
            actor: {
              displayName: actorName,
              uniqueName: actorUnique,
              avatarUrl,
            },
            createdAt: changedAt ?? new Date().toISOString(),
            summary: `updated ${type} ${id}${state ? ` → ${state}` : ""}: ${title}`,
            url,
            workItem: {
              id,
              title,
              state,
              type,
            },
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push({ project, message });
      }
    });

    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (projectsSucceeded === 0 && allProjects.length > 0) {
      const first = errors[0]?.message ?? "Unable to fetch Azure DevOps data";
      return Response.json(
        {
          error: first,
          meta: {
            projectsRequested: allProjects.length,
            projectsSucceeded,
            errorCount: errors.length,
            since,
          },
        },
        { status: 502 },
      );
    }

    return Response.json({
      posts,
      meta: {
        projectsRequested: allProjects.length,
        projectsSucceeded,
        errorCount: errors.length,
        prErrorCount: prErrors.length,
        wiErrorCount: wiErrors.length,
        errorSamples: errors.slice(0, 3),
        since,
        postsCount: posts.length,
        prCount: posts.filter((p) => p.type === "pull_request").length,
        wiCount: posts.filter((p) => p.type === "work_item").length,
      },
    });
  } catch (err) {
    const message = sanitizeError(err);
    const status = err instanceof Error && err.message.includes("Validation") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
