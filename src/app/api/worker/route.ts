import { createClient } from "@supabase/supabase-js";
import pdf from "pdf-parse";
import { env } from "@/lib/env";
import { analyzeDocument } from "@/lib/analysis/gemini";
import { validateAnalysisEvidence } from "@/lib/analysis/evidence";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClaimedRun = {
  run_id: string;
  document_id: string;
  owner_id: string;
  storage_key: string;
  display_name: string;
  attempt_count: number;
};

function serviceClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("WORKER_NOT_CONFIGURED");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function transient(code: string) {
  return ["AI_RATE_LIMITED", "AI_PROVIDER_UNAVAILABLE", "AI_INVALID_JSON", "AI_SCHEMA_INVALID", "RESULT_PERSISTENCE_FAILED", "RUN_COMPLETION_WRITE_FAILED", "PDF_STORAGE_READ_FAILED", "TimeoutError", "AbortError"].includes(code);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized worker invocation." }, { status: 401 });
  }

  let supabase;
  try { supabase = serviceClient(); }
  catch { return Response.json({ error: "Worker service configuration is missing." }, { status: 503 }); }

  const workerId = crypto.randomUUID();
  const { data: exhausted, error: exhaustedError } = await supabase.rpc("fail_exhausted_processing_runs");
  if (exhaustedError) return Response.json({ error: "Queue reconciliation failed." }, { status: 502 });

  const { data, error } = await supabase.rpc("claim_next_processing_run", { p_worker_id: workerId });
  if (error) return Response.json({ error: "Could not claim a queued document." }, { status: 502 });
  const job = (data as ClaimedRun[] | null)?.[0];
  if (!job) return Response.json({ processed: false, exhausted: exhausted ?? 0, message: "No eligible queued job." });

  const { error: startedEventError } = await supabase.from("processing_events").insert({
    run_id: job.run_id, owner_id: job.owner_id, event_type: "started",
    safe_code: "WORKER_CLAIMED", details: { attempt: job.attempt_count }
  });
  if (startedEventError) {
    await supabase.from("processing_runs").update({
      state: "queued", available_at: new Date(Date.now() + 15000).toISOString(),
      worker_id: null, lease_expires_at: null, last_error_code: "EVENT_WRITE_FAILED"
    }).eq("id", job.run_id).eq("worker_id", workerId);
    return Response.json({ error: "Could not record worker start." }, { status: 502 });
  }

  try {
    const { data: object, error: downloadError } = await supabase.storage
      .from("private-pdfs").download(job.storage_key);
    if (downloadError || !object) throw new Error("PDF_STORAGE_READ_FAILED");

    const bytes = Buffer.from(await object.arrayBuffer());
    if (bytes.length === 0 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("PDF_INVALID_SIGNATURE");
    }
    if (bytes.length > env.MAX_PDF_BYTES) throw new Error("PDF_TOO_LARGE");
    if (bytes.includes(Buffer.from("/Encrypt"))) throw new Error("PDF_ENCRYPTED");

    let parsed: { text: string; numpages: number };
    try { parsed = await pdf(bytes); } catch { throw new Error("PDF_PARSE_FAILED"); }
    const extractedText = parsed.text.replace(/\u0000/g, "");
    const text = extractedText.trim();
    if (!text) throw new Error("PDF_NO_SELECTABLE_TEXT");
    if (parsed.numpages > 250) throw new Error("PDF_TOO_MANY_PAGES");
    if (text.length > env.MAX_EXTRACTED_CHARS) throw new Error("PDF_TEXT_TOO_LONG");

    await supabase.from("processing_runs").update({ state: "analyzing" })
      .eq("id", job.run_id).eq("worker_id", workerId);
    const pages = extractedText.split("\f").map((page) => page.trim());
    const analysis = await analyzeDocument(pages.length ? pages : [text]);
    const validated = validateAnalysisEvidence(analysis, pages.length ? pages : [text]);

    await supabase.from("processing_runs").update({ state: "validating" })
      .eq("id", job.run_id).eq("worker_id", workerId);

    const { error: resultError } = await supabase.from("analysis_results").insert({
      run_id: job.run_id, document_id: job.document_id, owner_id: job.owner_id,
      schema_version: "1", prompt_version: "1", result: validated
    });
    if (resultError) {
      // A previous attempt may have committed the result before losing its lease.
      // Keep that immutable result; never overwrite it with a retry's new output.
      if (resultError.code === "23505") {
        const { data: existingResult, error: existingResultError } = await supabase.from("analysis_results")
          .select("id").eq("run_id", job.run_id).eq("owner_id", job.owner_id).maybeSingle();
        if (existingResultError || !existingResult) throw new Error("RESULT_PERSISTENCE_FAILED");
      } else {
        throw new Error("RESULT_PERSISTENCE_FAILED");
      }
    }

    const finishedAt = new Date().toISOString();
    const { error: completionError } = await supabase.from("processing_runs").update({
      state: "completed", finished_at: finishedAt, lease_expires_at: null,
      worker_id: null, failure_code: null, last_error_code: null
    }).eq("id", job.run_id).eq("worker_id", workerId);
    if (completionError) throw new Error("RUN_COMPLETION_WRITE_FAILED");

    await supabase.from("documents").update({ status: "completed", updated_at: finishedAt })
      .eq("id", job.document_id).eq("owner_id", job.owner_id);
    await supabase.from("processing_events").insert({
      run_id: job.run_id, owner_id: job.owner_id, event_type: "completed",
      safe_code: "ANALYSIS_COMPLETED",
      details: { pages: parsed.numpages, extractedCharacters: text.length, attempt: job.attempt_count }
    });
    return Response.json({ processed: true, runId: job.run_id, state: "completed", attempt: job.attempt_count });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "UNKNOWN";
    const retry = transient(code) && job.attempt_count < 3;
    const delayMs = Math.min(5 * 60_000, 15_000 * (2 ** Math.max(0, job.attempt_count - 1)));
    const next = new Date(Date.now() + delayMs).toISOString();
    const state = retry ? "queued" : "failed";
    await supabase.from("processing_runs").update({
      state, failure_code: retry ? null : code, last_error_code: code,
      available_at: retry ? next : new Date().toISOString(),
      finished_at: retry ? null : new Date().toISOString(),
      worker_id: null, lease_expires_at: null
    }).eq("id", job.run_id).eq("worker_id", workerId);
    await supabase.from("documents").update({
      status: retry ? "processing" : "failed", updated_at: new Date().toISOString()
    }).eq("id", job.document_id).eq("owner_id", job.owner_id);
    await supabase.from("processing_events").insert({
      run_id: job.run_id, owner_id: job.owner_id, event_type: retry ? "retry_scheduled" : "failed",
      safe_code: code, details: { attempt: job.attempt_count, retryAt: retry ? next : null }
    });
    return Response.json({
      processed: true, runId: job.run_id, state, retryAt: retry ? next : null,
      error: retry ? "Temporary failure; retry scheduled." : "Processing failed."
    }, { status: 200 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
