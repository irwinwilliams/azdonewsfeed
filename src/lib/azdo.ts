import { fetchWithTimeout } from "./fetch-with-timeout";

export type AzdoProject = {
  id: string;
  name: string;
};

export type AzdoPullRequest = {
  pullRequestId: number;
  title: string;
  status: "active" | "abandoned" | "completed" | string;
  creationDate: string;
  closedDate?: string;
  lastUpdateTime: string;
  createdBy?: {
    displayName?: string;
    uniqueName?: string;
    imageUrl?: string;
  };
  repository?: {
    id: string;
    name: string;
    project?: {
      name: string;
    };
  };
};

export type AzdoWiqlResult = {
  workItems?: Array<{ id: number; url: string }>;
};

export type AzdoWorkItem = {
  id: number;
  rev?: number;
  fields?: Record<string, unknown>;
  url?: string;
};

function encodePat(pat: string) {
  // Azure DevOps PAT via Basic auth using empty username.
  return Buffer.from(`:${pat}`, "utf8").toString("base64");
}

export async function azdoFetchJson<T>(
  url: string,
  pat: string,
  init?: RequestInit,
  timeoutMs: number = 30000,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Basic ${encodePat(pat)}`);
  headers.set("Accept", "application/json");
  // Add custom header for CSRF protection
  headers.set("X-Requested-With", "XMLHttpRequest");
  if (!headers.has("Content-Type") && init?.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      headers,
      cache: "no-store",
    },
    timeoutMs,
  );

  if (!res.ok) {
    // Don't expose full error details to prevent information leakage
    throw new Error(`Azure DevOps API error (${res.status})`);
  }

  return (await res.json()) as T;
}

export async function listProjects(org: string, pat: string): Promise<AzdoProject[]> {
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects?api-version=7.1`;
  const data = await azdoFetchJson<{ value: AzdoProject[] }>(url, pat);
  return data.value ?? [];
}

export async function listPullRequestsByProject(
  org: string,
  project: string,
  pat: string,
  top: number,
): Promise<AzdoPullRequest[]> {
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/pullrequests?searchCriteria.status=all&$top=${top}&api-version=7.1`;
  const data = await azdoFetchJson<{ value: AzdoPullRequest[] }>(url, pat);
  return data.value ?? [];
}

export async function queryWorkItemIdsChangedSince(
  org: string,
  project: string,
  pat: string,
  changedSinceIso: string,
  top: number,
): Promise<number[]> {
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`;

  // Some orgs enforce date-only precision in WIQL comparisons.
  // Use YYYY-MM-DD to avoid "You cannot supply a time with the date" validation errors.
  const changedSinceDate = changedSinceIso.includes("T") ? changedSinceIso.split("T")[0] : changedSinceIso;

  // Validate date format to prevent WIQL injection
  if (!/^\d{4}-\d{2}-\d{2}$/.test(changedSinceDate)) {
    throw new Error("Invalid date format");
  }

  // NOTE: Use @project to scope to the current project.
  // Using a fixed ISO string avoids WIQL macro ambiguity.
  const wiql = {
    // WIQL does not support a SQL-style `TOP` clause. Limit client-side.
    query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.ChangedDate] >= '${changedSinceDate}' ORDER BY [System.ChangedDate] DESC`,
  };

  const data = await azdoFetchJson<AzdoWiqlResult>(url, pat, {
    method: "POST",
    body: JSON.stringify(wiql),
  });

  return (data.workItems ?? []).map((w) => w.id).slice(0, Math.max(1, top));
}

export async function getWorkItems(
  org: string,
  project: string,
  pat: string,
  ids: number[],
): Promise<AzdoWorkItem[]> {
  if (ids.length === 0) return [];

  // Keep field list intentionally small for performance.
  const fields = [
    "System.Id",
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.ChangedDate",
    "System.ChangedBy",
  ].join(",");

  const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${ids.join(",")}&fields=${encodeURIComponent(fields)}&api-version=7.1`;
  const data = await azdoFetchJson<{ value: AzdoWorkItem[] }>(url, pat);
  return data.value ?? [];
}
