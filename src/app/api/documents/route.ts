import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view document history." }, { status: 401 });

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("id, display_name, status, page_count, byte_size, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (documentsError) return NextResponse.json({ error: "Document history could not be loaded." }, { status: 502 });

    const ids = (documents ?? []).map((document) => document.id);
    if (ids.length === 0) return NextResponse.json({ documents: [] });

    const { data: results, error: resultsError } = await supabase
      .from("analysis_results")
      .select("document_id, result, created_at")
      .eq("owner_id", user.id)
      .in("document_id", ids)
      .order("created_at", { ascending: false });
    if (resultsError) return NextResponse.json({ error: "Document history loaded, but analysis results could not be retrieved." }, { status: 502 });

    const latestByDocument = new Map<string, { result: unknown; created_at: string }>();
    for (const row of results ?? []) {
      if (!latestByDocument.has(row.document_id)) latestByDocument.set(row.document_id, { result: row.result, created_at: row.created_at });
    }

    return NextResponse.json({
      documents: (documents ?? []).map((document) => ({
        ...document,
        latestAnalysis: latestByDocument.get(document.id)?.result ?? null,
        analysisCreatedAt: latestByDocument.get(document.id)?.created_at ?? null
      }))
    });
  } catch {
    return NextResponse.json({ error: "Document history is unavailable. Check server configuration." }, { status: 503 });
  }
}