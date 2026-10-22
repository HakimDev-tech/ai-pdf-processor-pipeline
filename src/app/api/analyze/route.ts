import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { env } from "@/lib/env";
import { analyzeDocument } from "@/lib/analysis/gemini";
import { validateAnalysisEvidence } from "@/lib/analysis/evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;
  let ownerId: string | null = null;
  let documentId: string | null = null;
  let runId: string | null = null;
  let storageKey: string | null = null;
  try {
    try {
      supabase = await createSupabaseServerClient();
    } catch {
      return jsonError(503, "Supabase is not configured. Configure authentication and storage before using this endpoint.");
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "Sign in before uploading a document.");
    ownerId = user.id;

    const idempotencyKey = request.headers.get("idempotency-key")?.trim().slice(0, 200) || crypto.randomUUID();
    const { data: previousRun, error: previousRunError } = await supabase
      .from("processing_runs")
      .select("id, document_id, state")
      .eq("owner_id", ownerId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (previousRunError) return jsonError(502, "The request could not be checked for a previous attempt.");
    if (previousRun) {
      if (previousRun.state === "completed") {
        const { data: previousResult, error: previousResultError } = await supabase
          .from("analysis_results")
          .select("result")
          .eq("run_id", previousRun.id)
          .eq("owner_id", ownerId)
          .maybeSingle();
        if (previousResultError || !previousResult) return jsonError(502, "A completed request exists, but its saved result could not be loaded.");
        return NextResponse.json({ analysis: previousResult.result, metadata: { documentId: previousRun.document_id, runId: previousRun.id, replayed: true } });
      }
      return jsonError(409, previousRun.state === "failed"
        ? "This request key belongs to a failed attempt. Select the PDF again to start a fresh attempt."
        : "This request is already being processed. Wait for it to finish before retrying.");
    }

    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) return jsonError(400, "Choose a PDF file.");
    if (value.size === 0) return jsonError(400, "The selected file is empty.");
    if (value.size > env.MAX_PDF_BYTES) return jsonError(413, "The PDF exceeds the 20 MB upload limit.");
    if (!value.name.toLowerCase().endsWith(".pdf") || (value.type && value.type !== "application/pdf")) {
      return jsonError(415, "Only PDF files are supported.");
    }
    const bytes = Buffer.from(await value.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return jsonError(415, "The file signature is not a valid PDF.");
    if (bytes.includes(Buffer.from("/Encrypt"))) return jsonError(422, "Encrypted/password-protected PDFs are not supported.");

    let parsed: { text: string; numpages: number };
    try { parsed = await pdf(bytes); }
    catch { return jsonError(422, "The PDF could not be parsed. It may be malformed, encrypted, or password-protected."); }
    const text = parsed.text.replace(/\u0000/g, "").trim();
    if (!text) return jsonError(422, "No selectable text was found. Scanned or image-only PDFs are not supported yet.");
    if (parsed.numpages > 250) return jsonError(413, "This PDF has too many pages for the current processing limit.");
    if (text.length > env.MAX_EXTRACTED_CHARS) return jsonError(413, "Extracted text exceeds the current analysis limit. Use a shorter PDF.");

    documentId = crypto.randomUUID();
    storageKey = `${ownerId}/${documentId}.pdf`;
    const { error: uploadError } = await supabase.storage.from("private-pdfs").upload(storageKey, bytes, {
      contentType: "application/pdf", upsert: false
    });
    if (uploadError) return jsonError(502, "The PDF could not be saved to private storage. Check the Supabase migration and storage configuration.");

    const { error: documentError } = await supabase.from("documents").insert({
      id: documentId, owner_id: ownerId, display_name: value.name.replace(/[\\/\\0-\\x1f]/g, "").slice(0, 240) || "Untitled PDF",
      storage_key: storageKey, mime_type: "application/pdf", byte_size: bytes.byteLength,
      page_count: parsed.numpages, extracted_characters: text.length, status: "processing"
    });
    if (documentError) {
      await supabase.storage.from("private-pdfs").remove([storageKey]);
      return jsonError(502, "The document record could not be saved. Apply the database migration and retry.");
    }
    const { data: run, error: runError } = await supabase.from("processing_runs").insert({
      document_id: documentId, owner_id: ownerId, run_number: 1, state: "analyzing",
      idempotency_key: idempotencyKey, provider: "google", model: env.GEMINI_MODEL, started_at: new Date().toISOString()
    }).select("id").single();
    if (runError || !run) {
      await supabase.from("documents").delete().eq("id", documentId).eq("owner_id", ownerId);
      await supabase.storage.from("private-pdfs").remove([storageKey]);
      return jsonError(502, "A processing record could not be created. Retry the upload.");
    }
    runId = run.id;

    const pageTexts = text.split("\f").map((page) => page.trim());
    const safePages = pageTexts.length ? pageTexts : [text];
    const analysis = await analyzeDocument(text, safePages);
    const validatedAnalysis = validateAnalysisEvidence(analysis, safePages);
    const { error: resultError } = await supabase.from("analysis_results").insert({
      run_id: runId, document_id: documentId, owner_id: ownerId, schema_version: "1", prompt_version: "1", result: validatedAnalysis
    });
    if (resultError) throw new Error("RESULT_PERSISTENCE_FAILED");
    await supabase.from("processing_runs").update({ state: "completed", finished_at: new Date().toISOString() }).eq("id", runId).eq("owner_id", ownerId);
    await supabase.from("documents").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", documentId).eq("owner_id", ownerId);
    await supabase.from("processing_events").insert({ run_id: runId, owner_id: ownerId, event_type: "completed", safe_code: "ANALYSIS_COMPLETED", details: { pages: parsed.numpages, extractedCharacters: text.length } });
    return NextResponse.json({ analysis: validatedAnalysis, metadata: { documentId, runId, pages: parsed.numpages, extractedCharacters: text.length } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (supabase && ownerId && runId) {
      await supabase.from("processing_runs").update({ state: "failed", failure_code: code.slice(0, 80), finished_at: new Date().toISOString() }).eq("id", runId).eq("owner_id", ownerId);
      if (documentId) await supabase.from("documents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", documentId).eq("owner_id", ownerId);
      await supabase.from("processing_events").insert({ run_id: runId, owner_id: ownerId, event_type: "failed", safe_code: code.slice(0, 80), details: {} });
    }
    const map: Record<string, { status: number; message: string }> = {
      AI_PROVIDER_NOT_CONFIGURED: { status: 503, message: "AI provider is not configured. Set GEMINI_API_KEY on the server." },
      AI_RATE_LIMITED: { status: 429, message: "The AI provider is rate-limited. Wait and try again." },
      AI_PROVIDER_UNAVAILABLE: { status: 502, message: "The AI provider is temporarily unavailable." },
      AI_PROVIDER_REJECTED_REQUEST: { status: 502, message: "The AI provider rejected the analysis request." },
      AI_EMPTY_RESPONSE: { status: 502, message: "The AI provider returned no analysis." },
      AI_INVALID_JSON: { status: 502, message: "The AI response could not be parsed. Try again." },
      AI_SCHEMA_INVALID: { status: 502, message: "The AI response did not meet the required structure. Try again." },
      RESULT_PERSISTENCE_FAILED: { status: 502, message: "The analysis was generated but could not be saved. Retry after checking database configuration." }
    };
    const mapped = map[code];
    if (mapped) return jsonError(mapped.status, mapped.message);
    if (code === "TimeoutError" || code === "AbortError") return jsonError(504, "Analysis timed out. Try a shorter PDF.");
    return jsonError(500, "An unexpected processing error occurred. Check server configuration and try again.");
  }
}