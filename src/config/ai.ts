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
  /** Longest reply Claude may write, in tokens (about 650 words; answers are asked to be much shorter). */
  maxReplyTokens: 900,
  /** Same for a question that may search the web: Claude's notes between searches count toward it too. */
  maxReplyTokensWeb: 2000,
  /** How many of the latest chat messages are sent with each question. */
  historyMessages: 6,
  /** Questions one visitor may ask per rolling hour. */
  questionsPerHour: 5,
  /** Give up waiting for Claude after this long (a question that searches the web takes longer). */
  timeoutMs: 75_000,
  /** Web searches Claude may run for one question (each reads about 13,000 tokens of results). */
  webSearchMaxUses: 2,
  /** Questions per rolling hour that may use web search (they also count toward `questionsPerHour`). After that the chat answers from the portfolio data only. */
  webQuestionsPerHour: 3,
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

/**
 * What one web-assisted question may cost at most, in US dollars. The server adds up the real cost after each step and stops
 * continuing once it passes this, so a question stays inside roughly 10-20 cents.
 */
export const WEB_COST_CAP_USD = 0.2;

/**
 * Prices used for that estimate, in US dollars per million tokens, and per web search. These are the model's list prices as
 * understood when this was written: CHECK THEM against docs.claude.com when you change CHAT_MODEL (a wrong price only makes
 * the estimate and the cap less exact; `max_uses` still limits the searches).
 */
export const CHAT_PRICES = { inputPerMillion: 3, outputPerMillion: 15, cacheWriteFactor: 1.25, cacheReadFactor: 0.1, perSearch: 0.01 } as const;
