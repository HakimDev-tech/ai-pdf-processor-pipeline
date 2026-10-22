import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "Invalid document identifier." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view processing status." }, { status: 401 });

    const { data: document, error: documentError } = await supabase.from("documents")
      .select("id, status").eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (documentError) return NextResponse.json({ error: "Processing status could not be loaded." }, { status: 502 });
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const { data: run, error: runError } = await supabase.from("processing_runs")
      .select("id, state, attempt_count, max_attempts, failure_code, created_at, finished_at")
      .eq("document_id", id).eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (runError) return NextResponse.json({ error: "Processing status could not be loaded." }, { status: 502 });
    if (!run) return NextResponse.json({ documentId: id, documentStatus: document.status, state: document.status });

    if (run.state === "completed") {
      const { data: result, error: resultError } = await supabase.from("analysis_results")
        .select("result").eq("run_id", run.id).eq("owner_id", user.id).maybeSingle();
      if (resultError || !result) return NextResponse.json({ error: "The completed analysis result could not be loaded." }, { status: 502 });
      return NextResponse.json({ documentId: id, runId: run.id, state: run.state, attempt: run.attempt_count, analysis: result.result });
    }
    return NextResponse.json({
      documentId: id, runId: run.id, state: run.state, attempt: run.attempt_count,
      maxAttempts: run.max_attempts, error: run.state === "failed" ? run.failure_code : undefined
    });
  } catch {
    return NextResponse.json({ error: "Processing status is unavailable. Check server configuration." }, { status: 503 });
  }
}
