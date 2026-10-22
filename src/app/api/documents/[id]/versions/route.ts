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
    if (authError || !user) return NextResponse.json({ error: "Sign in to view processing versions." }, { status: 401 });

    const { data: document, error: documentError } = await supabase.from("documents")
      .select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (documentError) return NextResponse.json({ error: "Processing versions could not be loaded." }, { status: 502 });
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const { data: runs, error: runsError } = await supabase.from("processing_runs")
      .select("id, run_number, state, attempt_count, max_attempts, failure_code, created_at, finished_at")
      .eq("document_id", id).eq("owner_id", user.id).order("run_number", { ascending: false }).limit(50);
    if (runsError) return NextResponse.json({ error: "Processing versions could not be loaded." }, { status: 502 });
    const runIds = (runs ?? []).map((run) => run.id);
    if (runIds.length === 0) return NextResponse.json({ versions: [] });

    const { data: results, error: resultsError } = await supabase.from("analysis_results")
      .select("run_id, result, created_at").eq("document_id", id).eq("owner_id", user.id).in("run_id", runIds);
    if (resultsError) return NextResponse.json({ error: "Saved analysis versions could not be loaded." }, { status: 502 });
    const byRun = new Map((results ?? []).map((result) => [result.run_id, result]));
    return NextResponse.json({
      versions: (runs ?? []).map((run) => ({
        ...run,
        analysis: byRun.get(run.id)?.result ?? null,
        analysisCreatedAt: byRun.get(run.id)?.created_at ?? null
      }))
    });
  } catch {
    return NextResponse.json({ error: "Processing versions are unavailable." }, { status: 503 });
  }
}
