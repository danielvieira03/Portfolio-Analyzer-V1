// Settings for the Claude-powered import. Change the model here.
// Pricing differs a lot between models — see https://docs.claude.com for current rates.
export const AI_MODEL = "claude-sonnet-5-5";

/** Largest screenshot / PDF accepted (Claude's own request limit is higher). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const PDF_TYPE = "application/pdf";
export const AI_ACCEPT_ATTR = [...IMAGE_TYPES, PDF_TYPE, ".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"].join(",");
