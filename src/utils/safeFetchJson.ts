/**
 * Safe JSON parsing and HTTP fetch utilities.
 * Prevents "Invalid JSON" / "Unexpected token < in JSON" errors on static/PHP hosts
 * (such as InfinityFree) when endpoints return HTML error pages, warnings, or empty bodies.
 */

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return fallback;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Attempt to extract JSON object or array if PHP prepended a warning/notice
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // fall through
      }
    }
    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1)) as T;
      } catch {
        // fall through
      }
    }
    return fallback;
  }
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "file:" &&
      (url.startsWith("./") || url.startsWith("/"))
    ) {
      return { ok: false, status: 0, data: null };
    }
    const res = await fetch(url, options);
    const text = await res.text();
    const cleaned = text.replace(/^\uFEFF/, "").trim();

    if (!cleaned) {
      return { ok: false, status: res.status, data: null };
    }

    // Reject pure HTML responses (e.g. SPA index.html fallback or InfinityFree HTML error pages)
    if (
      cleaned.startsWith("<!doctype") ||
      cleaned.startsWith("<!DOCTYPE") ||
      cleaned.startsWith("<html") ||
      cleaned.startsWith("<HTML")
    ) {
      return { ok: false, status: res.status, data: null };
    }

    const parsed = safeJsonParse<T | null>(cleaned, null);
    if (parsed === null) {
      return { ok: false, status: res.status, data: null };
    }

    return { ok: res.ok, status: res.status, data: parsed };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
