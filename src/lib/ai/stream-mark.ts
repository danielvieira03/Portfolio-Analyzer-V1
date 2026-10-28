// The chat answer travels as plain text with a few control markers mixed in (so one simple stream carries everything):
//  - SEARCH_MARK: Claude started a web search (the screen shows "Searching the web…")
//  - NOWEB_MARK: web search is paused for this visitor this hour (sent once, first)
//  - SOURCES_MARK + JSON: the web pages the answer used (sent last)
//  - STREAM_ERROR_MARK + message: something went wrong half way
// `parseChatStream` turns what has arrived so far into what the screen shows. Pure and tested.

export const STREAM_ERROR_MARK = "\u001eERROR:";
export const SEARCH_MARK = "\u001eSEARCH";
export const NOWEB_MARK = "\u001eNOWEB";
export const SOURCES_MARK = "\u001eSOURCES:";

export interface ChatSource {
  title: string;
  url: string;
}

export interface ParsedStream {
  text: string;
  /** A search has started and no answer text has followed it yet. */
  searching: boolean;
  /** At least one web search ran for this question. */
  usedWeb: boolean;
  webPaused: boolean;
  sources: ChatSource[];
  error: string | null;
}

export function parseChatStream(raw: string): ParsedStream {
  let body = raw;
  let error: string | null = null;
  let sources: ChatSource[] = [];

  const err = body.indexOf(STREAM_ERROR_MARK);
  if (err !== -1) {
    error = body.slice(err + STREAM_ERROR_MARK.length) || "Something went wrong. Please try again.";
    body = body.slice(0, err);
  }
  const src = body.indexOf(SOURCES_MARK);
  if (src !== -1) {
    try {
      const parsed = JSON.parse(body.slice(src + SOURCES_MARK.length));
      if (Array.isArray(parsed)) sources = parsed.filter((s): s is ChatSource => typeof s?.url === "string" && /^https?:\/\//.test(s.url)).map((s) => ({ url: s.url, title: typeof s.title === "string" && s.title ? s.title : s.url }));
    } catch {
      /* a partly arrived list: show the answer without sources until it is complete */
    }
    body = body.slice(0, src);
  }
  const lastSearch = body.lastIndexOf(SEARCH_MARK);
  const searching = lastSearch !== -1 && body.slice(lastSearch + SEARCH_MARK.length).replace(NOWEB_MARK, "").trim() === "";
  return {
    text: body.split(SEARCH_MARK).join("\n").split(NOWEB_MARK).join("").trim(),
    searching,
    usedWeb: lastSearch !== -1,
    webPaused: body.includes(NOWEB_MARK),
    sources,
    error,
  };
}
