import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "Invalid document identifier." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to delete a document." }, { status: 401 });

    const { data: document, error: lookupError } = await supabase
      .from("documents")
      .select("id, storage_key")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (lookupError) return NextResponse.json({ error: "The document could not be checked for deletion." }, { status: 502 });
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const { error: storageError } = await supabase.storage.from("private-pdfs").remove([document.storage_key]);
    if (storageError) return NextResponse.json({ error: "The stored PDF could not be deleted. The document record was kept." }, { status: 502 });

    const { error: deleteError } = await supabase.from("documents").delete().eq("id", id).eq("owner_id", user.id);
    if (deleteError) return NextResponse.json({ error: "The PDF object was removed, but its database record could not be deleted. Retry or contact the administrator." }, { status: 502 });

    return NextResponse.json({ deleted: true, id });
  } catch {
    return NextResponse.json({ error: "Deletion failed due to a server configuration or storage error." }, { status: 503 });
  }
}