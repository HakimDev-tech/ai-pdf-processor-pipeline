import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { env } from "@/lib/env";
import { analyzeDocument } from "@/lib/analysis/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) return jsonError(400, "Choose a PDF file.");
    if (value.size === 0) return jsonError(400, "The selected file is empty.");
    if (value.size > env.MAX_PDF_BYTES) return jsonError(413, "The PDF exceeds the 20 MB upload limit.");
    if (!value.name.toLowerCase().endsWith(".pdf") || value.type && value.type !== "application/pdf") {
      return jsonError(415, "Only PDF files are supported.");
    }
    const bytes = Buffer.from(await value.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return jsonError(415, "The file signature is not a valid PDF.");
    let parsed: { text: string; numpages: number };
    try { parsed = await pdf(bytes); }
    catch { return jsonError(422, "The PDF could not be parsed. It may be malformed, encrypted, or password-protected."); }
    const text = parsed.text.replace(/\u0000/g, "").trim();
    if (!text) return jsonError(422, "No selectable text was found. Scanned or image-only PDFs are not supported yet.");
    if (parsed.numpages > 250) return jsonError(413, "This PDF has too many pages for the current processing limit.");
    if (text.length > env.MAX_EXTRACTED_CHARS) return jsonError(413, "Extracted text exceeds the current analysis limit. Use a shorter PDF.");
    // pdf-parse exposes the whole text; retain page separation conservatively where form-feed markers exist.
    const pageTexts = text.split("\f").map((page) => page.trim()).filter(Boolean);
    const safePages = pageTexts.length ? pageTexts : [text];
    const analysis = await analyzeDocument(text, safePages);
    // Validate model evidence against extracted text before it reaches the UI.
    const flattened = safePages.map((p) => p.toLowerCase());
    for (const group of [analysis.keyPoints, analysis.datesAndObligations, analysis.risksAndAmbiguities]) {
      for (const finding of group) {
        finding.evidence = finding.evidence.filter((e) => {
          const page = flattened[e.page - 1];
          return Boolean(page && page.includes(e.excerpt.toLowerCase().trim()));
        });
        if (finding.evidence.length === 0 && finding.certainty === "supported") finding.certainty = "uncertain";
      }
    }
    return NextResponse.json({ analysis, metadata: { pages: parsed.numpages, extractedCharacters: text.length } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const map: Record<string, { status: number; message: string }> = {
      AI_PROVIDER_NOT_CONFIGURED: { status: 503, message: "AI provider is not configured. Set GEMINI_API_KEY on the server." },
      AI_RATE_LIMITED: { status: 429, message: "The AI provider is rate-limited. Wait and try again." },
      AI_PROVIDER_UNAVAILABLE: { status: 502, message: "The AI provider is temporarily unavailable." },
      AI_PROVIDER_REJECTED_REQUEST: { status: 502, message: "The AI provider rejected the analysis request." },
      AI_EMPTY_RESPONSE: { status: 502, message: "The AI provider returned no analysis." },
      AI_INVALID_JSON: { status: 502, message: "The AI response could not be parsed. Try again." },
      AI_SCHEMA_INVALID: { status: 502, message: "The AI response did not meet the required structure. Try again." }
    };
    const mapped = map[code];
    if (mapped) return jsonError(mapped.status, mapped.message);
    if (code === "TimeoutError" || code === "AbortError") return jsonError(504, "Analysis timed out. Try a shorter PDF.");
    // Keep provider/network details and document content out of client responses and logs.
    return jsonError(500, "An unexpected processing error occurred. Try again.");
  }
}