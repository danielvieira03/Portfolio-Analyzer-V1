import { IMAGE_TYPES, MAX_UPLOAD_BYTES, PDF_TYPE } from "@/config/ai";
import { AiError, extractHoldings } from "@/lib/ai/claude";
import { errorResponse, isSameOrigin } from "@/lib/ai/route-helpers";
import { extractionToTable } from "@/lib/ai/to-rows";

export const runtime = "nodejs";
export const maxDuration = 120;

const BY_EXTENSION: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", pdf: PDF_TYPE,
};

/** Receives a screenshot or PDF, has Claude read it, and returns rows for the import preview. Nothing is stored. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new AiError("bad_file", "No file was received.");
    if (file.size === 0) throw new AiError("bad_file", "That file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AiError("bad_file", `That file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Try a smaller screenshot or fewer pages.`);
    }
    const mediaType = file.type || BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";
    if (mediaType !== PDF_TYPE && !(IMAGE_TYPES as readonly string[]).includes(mediaType)) {
      throw new AiError("bad_file", "Please upload a PNG, JPEG, WebP or GIF screenshot, or a PDF.");
    }
    const { extraction, usage } = await extractHoldings(Buffer.from(await file.arrayBuffer()), mediaType);
    console.log(`[import] Claude read ${file.name}: ${extraction.holdings.length} rows, ${usage.inputTokens} in / ${usage.outputTokens} out tokens`);
    return Response.json({ ok: true, ...extractionToTable(extraction), issues: extraction.issues, usage });
  } catch (e) {
    return errorResponse(e);
  }
}
