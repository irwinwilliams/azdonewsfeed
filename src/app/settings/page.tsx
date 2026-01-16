"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clearConfig, loadConfig, saveConfig, type AzdoConfig } from "@/lib/config";
import { projectsRateLimiter } from "@/lib/ratelimit";

type Project = { id: string; name: string };

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; projects: Project[] }
  | { status: "error"; message: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default function SettingsPage() {
  const existing = useMemo(() => loadConfig(), []);

  const [org, setOrg] = useState(existing?.org ?? "");
  const [pat, setPat] = useState(existing?.pat ?? "");
  const [useAllProjects, setUseAllProjects] = useState(existing?.projects === null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>(existing?.projects ?? []);
  const [allTime, setAllTime] = useState(existing?.lookbackHours === null);
  const [lookbackAmount, setLookbackAmount] = useState<number>(() => {
    const h = typeof existing?.lookbackHours === "number" ? existing.lookbackHours : 24 * 7;
    // Default display: prefer whole weeks/days/months/years when divisible.
    if (h % (24 * 365) === 0) return h / (24 * 365);
    if (h % (24 * 30) === 0) return h / (24 * 30);
    if (h % (24 * 7) === 0) return h / (24 * 7);
    if (h % 24 === 0) return h / 24;
    return h;
  });
  const [lookbackUnit, setLookbackUnit] = useState<"hours" | "days" | "weeks" | "months" | "years">(() => {
    const h = typeof existing?.lookbackHours === "number" ? existing.lookbackHours : 24 * 7;
    if (h % (24 * 365) === 0) return "years";
    if (h % (24 * 30) === 0) return "months";
    if (h % (24 * 7) === 0) return "weeks";
    if (h % 24 === 0) return "days";
    return "hours";
  });
  const [prTop, setPrTop] = useState<number>(existing?.prTop ?? 50);
  const [wiTop, setWiTop] = useState<number>(existing?.wiTop ?? 100);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  function toHours(amount: number, unit: "hours" | "days" | "weeks" | "months" | "years") {
    const n = Math.max(1, Number(amount) || 1);
    let hours: number;
    switch (unit) {
      case "hours":
        hours = n;
        break;
      case "days":
        hours = n * 24;
        break;
      case "weeks":
        hours = n * 24 * 7;
        break;
      case "months":
        hours = n * 24 * 30;
        break;
      case "years":
        hours = n * 24 * 365;
        break;
    }
    // Cap at 8760 hours (1 year) to match API validation
    return Math.min(hours, 8760);
  }

  useEffect(() => {
    // If we have no prior config, default to all-projects true.
    if (!existing) setUseAllProjects(true);
  }, [existing]);

  async function testConnection() {
    // Rate limiting check
    if (!projectsRateLimiter.check("test-connection")) {
      const retryAfterMs = projectsRateLimiter.getTimeUntilReset("test-connection");
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      setTest({ 
        status: "error", 
        message: `Too many requests. Please wait ${retryAfterSec} seconds before testing again.` 
      });
      return;
    }
    
    setTest({ status: "testing" });
    try {
      const res = await fetch("/api/azdo/projects", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest", // CSRF protection
        },
        body: JSON.stringify({ org, pat }),
      });

      const data = (await res.json()) as unknown;
      const rec = asRecord(data);
      const error = rec["error"];
      if (!res.ok) throw new Error(typeof error === "string" ? error : "Failed to connect");

      const rawProjects = rec["projects"];
      const projects = Array.isArray(rawProjects) ? (rawProjects as Project[]) : [];
      setTest({ status: "ok", projects });

      // If user hasn't chosen projects yet, default select all (when not using all-projects).
      if (!useAllProjects && selectedProjects.length === 0) {
        setSelectedProjects(projects.map((p) => p.name));
      }
    } catch (e) {
      setTest({ status: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  function onToggleProject(name: string) {
    setSelectedProjects((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  }

  function onSave() {
    const cfg: AzdoConfig = {
      org: org.trim(),
      pat: pat.trim(),
      projects: useAllProjects ? null : selectedProjects,
      lookbackHours: allTime ? null : Math.max(1, toHours(lookbackAmount, lookbackUnit)),
      prTop: Math.max(5, Number(prTop) || 50),
      wiTop: Math.max(10, Number(wiTop) || 100),
    };

    saveConfig(cfg);
  }

  function onClear() {
    clearConfig();
    setOrg("");
    setPat("");
    setUseAllProjects(true);
    setSelectedProjects([]);
    setAllTime(true);
    setLookbackAmount(1);
    setLookbackUnit("weeks");
    setPrTop(50);
    setWiTop(100);
    setTest({ status: "idle" });
  }

  const canTest = org.trim().length > 0 && pat.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-zinc-950">Settings</div>
            <div className="text-xs text-zinc-500">Connect Azure DevOps via PAT</div>
          </div>
          <div className="ml-auto">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Back to feed
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Security Warning Banner */}
        <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-amber-900">Security Notice</h3>
              <p className="mt-1 text-sm text-amber-800">
                Your Personal Access Token (PAT) is stored in browser localStorage. This is suitable for development but has security limitations:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-700">
                <li>PATs are accessible via JavaScript and browser DevTools</li>
                <li>Use a PAT with minimal permissions (read-only access to Code and Work Items)</li>
                <li>Never use a PAT with administrative or write permissions</li>
                <li>Your PAT is only sent to Azure DevOps APIs, never to third-party servers</li>
                <li>Clear your browser data to remove stored credentials</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canTest) testConnection();
            }}
          >
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-900">Organization</span>
              <input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="e.g. contoso"
                className="h-11 rounded-2xl border border-zinc-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />
              <span className="text-xs text-zinc-500">This is the org name in https://dev.azure.com/&lt;org&gt;</span>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-900">Personal Access Token (PAT)</span>
              <input
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="Paste PAT"
                type="password"
                className="h-11 rounded-2xl border border-zinc-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />
              <span className="text-xs text-zinc-500">
                <strong>⚠️ Use read-only permissions only.</strong> Your PAT is stored locally in this browser.
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-zinc-900">Time range</span>
                <div className="flex items-center gap-2">
                  <input
                    id="alltime"
                    type="checkbox"
                    checked={allTime}
                    onChange={(e) => setAllTime(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <label htmlFor="alltime" className="text-sm text-zinc-700">
                    All time
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={lookbackAmount}
                    onChange={(e) => setLookbackAmount(Number(e.target.value))}
                    type="number"
                    min={1}
                    disabled={allTime}
                    className="h-11 w-28 rounded-2xl border border-zinc-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                  <select
                    value={lookbackUnit}
                    onChange={(e) => setLookbackUnit(e.target.value as "hours" | "days" | "weeks" | "months" | "years")}
                    disabled={allTime}
                    className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
                  >
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                    <option value="years">years</option>
                  </select>
                </div>
                <span className="text-xs text-zinc-500">
                  If not all-time, this is a rolling lookback window.
                </span>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium text-zinc-900">PR fetch cap (per project)</span>
                <input
                  value={prTop}
                  onChange={(e) => setPrTop(Number(e.target.value))}
                  type="number"
                  min={5}
                  className="h-11 rounded-2xl border border-zinc-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
                <span className="text-xs text-zinc-500">Higher = more complete, but slower / more API calls.</span>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium text-zinc-900">Work item fetch cap (per project)</span>
                <input
                  value={wiTop}
                  onChange={(e) => setWiTop(Number(e.target.value))}
                  type="number"
                  min={10}
                  className="h-11 rounded-2xl border border-zinc-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
                <span className="text-xs text-zinc-500">Higher = more complete, but can be much slower on large orgs.</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canTest || test.status === "testing"}
                onClick={testConnection}
                className={
                  "inline-flex h-11 items-center rounded-full border px-4 text-sm transition-colors " +
                  (canTest
                    ? "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                    : "border-zinc-200 bg-zinc-50 text-zinc-400")
                }
              >
                {test.status === "testing" ? "Testing…" : "Test connection"}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSave();
                }}
                className="inline-flex h-11 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Save
              </button>

              <button
                type="button"
                onClick={onClear}
                className="inline-flex h-11 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Clear
              </button>
            </div>

            {test.status === "error" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {test.message}
              </div>
            ) : null}

            {test.status === "ok" ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="text-sm font-medium text-zinc-900">Projects</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="all"
                    type="checkbox"
                    checked={useAllProjects}
                    onChange={(e) => setUseAllProjects(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <label htmlFor="all" className="text-sm text-zinc-700">
                    Use all projects
                  </label>
                </div>

                {!useAllProjects ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {test.projects.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={selectedProjects.includes(p.name)}
                          onChange={() => onToggleProject(p.name)}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-zinc-600">All projects selected.</div>
                )}

                <div className="mt-3 text-xs text-zinc-500">
                  Tip: click Save, then return to the feed.
                </div>
              </div>
            ) : null}
          </form>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          PAT scopes needed (typical): Code (read) for PRs, and Work Items (read) for work items.
        </div>
      </main>
    </div>
  );
}
