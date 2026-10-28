// A rolling-window question limit for the Ask AI chat. Pure: the caller passes the stored timestamps and the clock.
// The server uses it per visitor (by IP, in memory, best effort: there is no database and the host may run several
// copies of the server); the browser uses it on its own saved timestamps so the friendly message shows at once.

const HOUR_MS = 60 * 60 * 1000;

export interface LimitCheck {
  allowed: boolean;
  /** Timestamps still inside the window (after this question, when it was allowed). */
  stamps: number[];
  /** When refused: milliseconds until the oldest counted question leaves the window. */
  retryAfterMs: number;
}

/** Counts a question at `now` unless `limit` questions were already asked in the last `windowMs`. */
export function checkLimit(stamps: number[], now: number, limit: number, windowMs = HOUR_MS): LimitCheck {
  const recent = stamps.filter((t) => t > now - windowMs && t <= now);
  if (recent.length >= limit) return { allowed: false, stamps: recent, retryAfterMs: Math.max(0, Math.min(...recent) + windowMs - now) };
  return { allowed: true, stamps: [...recent, now], retryAfterMs: 0 };
}

/** The message shown when the limit is hit. */
export function limitMessage(limit: number): string {
  return `You hit your ${limit} question limit for the hour. Try again in a few moments.`;
}
