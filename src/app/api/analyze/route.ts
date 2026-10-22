import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 20;

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;
  let ownerId: string | null = null;
  let documentId: string | null = null;
  let storageKey: string | null = null;

  try {
    try { supabase = await createSupabaseServerClient(); }
    catch { return jsonError(503, "Supabase is not configured. Configure authentication and storage before using this endpoint."); }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "Sign in before uploading a document.");
    ownerId = user.id;

    const idempotencyKey = request.headers.get("idempotency-key")?.trim().slice(0, 200) || crypto.randomUUID();
    const { data: previousRun, error: previousRunError } = await supabase
      .from("processing_runs").select("id, document_id, state")
      .eq("owner_id", ownerId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (previousRunError) return jsonError(502, "The request could not be checked for a previous attempt.");
    if (previousRun) {
      if (previousRun.state === "completed") {
        const { data: result, error } = await supabase.from("analysis_results").select("result")
          .eq("run_id", previousRun.id).eq("owner_id", ownerId).maybeSingle();
        if (error || !result) return jsonError(502, "The saved result could not be loaded.");
        return NextResponse.json({ analysis: result.result, metadata: { documentId: previousRun.document_id, runId: previousRun.id, replayed: true } });
      }
      if (["queued", "extracting", "analyzing", "validating"].includes(previousRun.state)) {
        return NextResponse.json({ documentId: previousRun.document_id, runId: previousRun.id, state: previousRun.state, queued: true }, { status: 202 });
      }
      return jsonError(409, "This request key belongs to a failed attempt. Select the PDF again to start a fresh attempt.");
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

    documentId = crypto.randomUUID();
    storageKey = `${ownerId}/${documentId}.pdf`;
    const { error: uploadError } = await supabase.storage.from("private-pdfs").upload(storageKey, bytes, {
      contentType: "application/pdf", upsert: false
    });
    if (uploadError) return jsonError(502, "The PDF could not be saved to private storage. Check the Supabase storage configuration.");

    const { error: documentError } = await supabase.from("documents").insert({
      id: documentId, owner_id: ownerId,
      display_name: value.name.replace(/[\\/\\0-\\x1f]/g, "").slice(0, 240) || "Untitled PDF",
      storage_key: storageKey, mime_type: "application/pdf", byte_size: bytes.byteLength,
      status: "processing"
    });
    if (documentError) {
      await supabase.storage.from("private-pdfs").remove([storageKey]);
      return jsonError(502, "The document record could not be saved. Apply all Supabase migrations and retry.");
    }

    const { data: run, error: runError } = await supabase.from("processing_runs").insert({
      document_id: documentId, owner_id: ownerId, run_number: 1, state: "queued",
      idempotency_key: idempotencyKey, provider: "google", model: env.GEMINI_MODEL,
      available_at: new Date().toISOString(), max_attempts: 3
    }).select("id").single();

    if (runError || !run) {
      await supabase.from("documents").delete().eq("id", documentId).eq("owner_id", ownerId);
      await supabase.storage.from("private-pdfs").remove([storageKey]);
      return jsonError(502, "The durable processing job could not be queued. Apply the queue migration and retry.");
    }

    const { error: eventError } = await supabase.from("processing_events").insert({
      run_id: run.id, owner_id: ownerId, event_type: "queued",
      safe_code: "JOB_QUEUED", details: { bytes: bytes.byteLength }
    });
    if (eventError) {
      // Keep the durable job: the worker can still process it, and its state remains observable.
      return NextResponse.json({ documentId, runId: run.id, state: "queued", queued: true, warning: "The queue event could not be recorded." }, { status: 202 });
    }

    return NextResponse.json({ documentId, runId: run.id, state: "queued", queued: true }, { status: 202 });
  } catch {
    if (supabase && ownerId && documentId) {
      await supabase.from("documents").delete().eq("id", documentId).eq("owner_id", ownerId);
    }
    if (supabase && storageKey) await supabase.storage.from("private-pdfs").remove([storageKey]);
    return jsonError(500, "The document could not be queued. Check server configuration and try again.");
  }
}
