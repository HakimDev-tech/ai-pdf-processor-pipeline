import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "Invalid document identifier." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to reprocess a document." }, { status: 401 });

    const { data: document, error: documentError } = await supabase.from("documents")
      .select("id, status").eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (documentError) return NextResponse.json({ error: "The document could not be checked." }, { status: 502 });
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const { data: latest, error: latestError } = await supabase.from("processing_runs")
      .select("run_number, state").eq("document_id", id).eq("owner_id", user.id)
      .order("run_number", { ascending: false }).limit(1).maybeSingle();
    if (latestError) return NextResponse.json({ error: "Previous processing versions could not be checked." }, { status: 502 });
    if (latest && ["queued", "extracting", "analyzing", "validating"].includes(latest.state)) {
      return NextResponse.json({ error: "This document already has an active processing run." }, { status: 409 });
    }

    const nextRunNumber = (latest?.run_number ?? 0) + 1;
    const idempotencyKey = crypto.randomUUID();
    const { data: run, error: insertError } = await supabase.from("processing_runs").insert({
      document_id: id, owner_id: user.id, run_number: nextRunNumber, state: "queued",
      idempotency_key: idempotencyKey, provider: "google", model: env.GEMINI_MODEL,
      available_at: new Date().toISOString(), max_attempts: 3
    }).select("id, run_number").single();
    if (insertError || !run) {
      return NextResponse.json({ error: "A new immutable processing version could not be queued. Refresh history and retry." }, { status: 409 });
    }

    const { error: updateError } = await supabase.from("documents").update({
      status: "processing", updated_at: new Date().toISOString()
    }).eq("id", id).eq("owner_id", user.id);
    if (updateError) {
      await supabase.from("processing_runs").update({ state: "failed", failure_code: "DOCUMENT_STATE_UPDATE_FAILED", finished_at: new Date().toISOString() }).eq("id", run.id).eq("owner_id", user.id);
      return NextResponse.json({ error: "The new version was created but document status could not be updated." }, { status: 502 });
    }

    await supabase.from("processing_events").insert({
      run_id: run.id, owner_id: user.id, event_type: "queued",
      safe_code: "REPROCESS_VERSION_QUEUED", details: { runNumber: run.run_number }
    });
    return NextResponse.json({ documentId: id, runId: run.id, runNumber: run.run_number, state: "queued" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Reprocessing could not be started. Check server configuration." }, { status: 503 });
  }
}
