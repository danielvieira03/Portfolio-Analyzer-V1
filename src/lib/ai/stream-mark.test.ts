import { describe, expect, it } from "vitest";
import { NOWEB_MARK, SEARCH_MARK, SOURCES_MARK, STREAM_ERROR_MARK, parseChatStream } from "./stream-mark";

describe("parseChatStream", () => {
  it("plain text is just text", () => {
    expect(parseChatStream("Hello **there**")).toMatchObject({ text: "Hello **there**", searching: false, usedWeb: false, webPaused: false, sources: [], error: null });
  });
  it("shows searching until answer text follows the search", () => {
    expect(parseChatStream(`Let me check.${SEARCH_MARK}`)).toMatchObject({ text: "Let me check.", searching: true, usedWeb: true });
    expect(parseChatStream(`Let me check.${SEARCH_MARK}Rates rose.`)).toMatchObject({ text: "Let me check.\nRates rose.", searching: false, usedWeb: true });
  });
  it("reads the sources list and keeps only real web links", () => {
    const list = JSON.stringify([{ title: "Fed", url: "https://federalreserve.gov/a" }, { title: "Bad", url: "javascript:alert(1)" }, { url: "https://x.com/y" }]);
    const p = parseChatStream(`Answer.${SOURCES_MARK}${list}`);
    expect(p.text).toBe("Answer.");
    expect(p.sources).toEqual([{ title: "Fed", url: "https://federalreserve.gov/a" }, { title: "https://x.com/y", url: "https://x.com/y" }]);
  });
  it("copes with a sources list that has only partly arrived", () => {
    expect(parseChatStream(`Answer.${SOURCES_MARK}[{"title":"F`)).toMatchObject({ text: "Answer.", sources: [] });
  });
  it("marks a paused web search and strips the marker", () => {
    expect(parseChatStream(`${NOWEB_MARK}From your data.`)).toMatchObject({ text: "From your data.", webPaused: true, usedWeb: false, searching: false });
  });
  it("reports an error and drops nothing before it", () => {
    expect(parseChatStream(`Partial${STREAM_ERROR_MARK}Too slow.`)).toMatchObject({ text: "Partial", error: "Too slow." });
    expect(parseChatStream(STREAM_ERROR_MARK).error).toBe("Something went wrong. Please try again.");
  });
});
