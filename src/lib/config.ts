"use client";

export type AzdoConfig = {
  org: string;
  pat: string;
  projects: string[] | null; // null means all projects
  // null means “all time”
  lookbackHours: number | null;
  prTop: number;
  wiTop: number;
};

const STORAGE_KEY = "azdonewsfeed:config:v1";

export function loadConfig(): AzdoConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const record = parsed as Record<string, unknown>;
    const org = record["org"];
    const pat = record["pat"];
    if (typeof org !== "string" || typeof pat !== "string" || !org || !pat) return null;

    const rawLookback = record["lookbackHours"];
    const lookbackHours =
      rawLookback === null
        ? null
        : typeof rawLookback === "number" && Number.isFinite(rawLookback)
          ? rawLookback <= 0
            ? null
            : Math.max(1, rawLookback)
          : 24 * 7;

    const rawPrTop = record["prTop"];
    const prTop =
      typeof rawPrTop === "number" && Number.isFinite(rawPrTop) ? Math.max(5, rawPrTop) : 50;

    const rawWiTop = record["wiTop"];
    const wiTop =
      typeof rawWiTop === "number" && Number.isFinite(rawWiTop) ? Math.max(10, rawWiTop) : 100;

    return {
      org,
      pat,
      projects: Array.isArray(record["projects"])
        ? (record["projects"] as unknown[]).map((p) => String(p))
        : record["projects"] === null
          ? null
          : null,
      lookbackHours,
      prTop,
      wiTop,
    };
  } catch {
    return null;
  }
}

export function saveConfig(cfg: AzdoConfig) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // no-op
  }
}

export function clearConfig() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
