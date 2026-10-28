// Settings for the Claude-powered import. Change the model here.
// Pricing differs a lot between models — see https://docs.claude.com for current rates.
export const AI_MODEL = "claude-sonnet-5-5";

/** Largest screenshot / PDF accepted (Claude's own request limit is higher). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const PDF_TYPE = "application/pdf";
export const AI_ACCEPT_ATTR = [...IMAGE_TYPES, PDF_TYPE, ".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"].join(",");

/** The model for the Ask AI chat (change it here; it can differ from the import's model, e.g. a cheaper one). */
export const CHAT_MODEL = AI_MODEL;

/** Limits for the Ask AI chat: they keep the cost per visitor small. */
export const CHAT_LIMITS = {
  /** Longest question a visitor can send, in characters. */
  maxQuestionChars: 500,
  /** Longest reply Claude may write, in tokens (about 500 words). */
  maxReplyTokens: 700,
  /** How many of the latest chat messages are sent with each question. */
  historyMessages: 6,
  /** Questions one visitor may ask per rolling hour. */
  questionsPerHour: 5,
  /** Give up waiting for Claude after this long. */
  timeoutMs: 60_000,
  /** Largest portfolio snapshot the server accepts, in characters. */
  maxSnapshotChars: 24_000,
} as const;

/** The clickable example questions above the Ask AI box. */
export const EXAMPLE_QUESTIONS = [
  "What are the main risks of my portfolio?",
  "What should I consider trimming or adding?",
  "How can I increase my potential income?",
  "How do I lower the duration of my portfolio?",
] as const;
