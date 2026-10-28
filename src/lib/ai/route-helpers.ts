import { AiError } from "./claude";

/**
 * The app has no login, so refuse requests that don't come from its own pages. This stops
 * another website in the browser from triggering paid Claude calls through localhost.
 */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  return !origin || new URL(origin).host === req.headers.get("host");
}

const STATUS: Record<AiError["code"], number> = {
  no_key: 503, auth: 502, credit: 402, rate_limit: 429, connection: 502,
  refused: 422, too_long: 422, bad_file: 422, failed: 500, limit: 429, empty_portfolio: 422,
};

export function errorResponse(e: unknown) {
  if (e instanceof AiError) return Response.json({ ok: false, error: e.message, code: e.code }, { status: STATUS[e.code] });
  console.error(e);
  return Response.json({ ok: false, error: "Unexpected error." }, { status: 500 });
}
