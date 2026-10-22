"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Analysis = {
  title: string; category: string; language: string; summary: string;
  keyPoints: { text: string; certainty: string; evidence: { page: number; excerpt: string }[] }[];
  datesAndObligations: { text: string; certainty: string; evidence: { page: number; excerpt: string }[] }[];
  risksAndAmbiguities: { text: string; certainty: string; evidence: { page: number; excerpt: string }[] }[];
  recommendations: string[]; limitations: string[];
};

type SavedDocument = {
  id: string; display_name: string; status: string; page_count: number | null;
  byte_size: number; created_at: string; latestAnalysis: Analysis | null;
};

export default function Home() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [requestKey, setRequestKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const refreshHistory = useCallback(async () => {
    setHistoryBusy(true);
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setDocuments(payload.documents as SavedDocument[]);
      else if (response.status !== 401) { setError(true); setMessage(payload.error ?? "History could not be loaded."); }
    } catch { setError(true); setMessage("History could not be loaded. Check your connection."); }
    finally { setHistoryBusy(false); }
  }, []);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  async function deleteDocument(id: string) {
    if (!window.confirm("Delete this PDF, its saved analysis, and processing history? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const response = await fetch("/api/documents/" + id, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Deletion failed.");
      setDocuments((current) => current.filter((document) => document.id !== id));
      setMessage("Document and saved history deleted."); setError(false);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Deletion failed."); setError(true); }
    finally { setDeletingId(null); }
  }

  async function submit() {
    if (!file) { setError(true); setMessage("Choose a PDF file first."); return; }
    setBusy(true); setMessage(""); setError(false); setAnalysis(null);
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch("/api/analyze", { method: "POST", headers: { "idempotency-key": requestKey || crypto.randomUUID() }, body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Analysis failed.");
      setAnalysis(payload.analysis as Analysis);
      setMessage("Analysis completed. Review evidence and uncertainty before relying on any finding.");
      setError(false);
      await refreshHistory();
    } catch (e) {
      setError(true); setMessage(e instanceof Error ? e.message : "Request failed. Try again.");
    } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/" aria-label="Papertrail home">papertrail<span>.</span></Link><div style={{display:"flex",alignItems:"center",gap:18}}><Link href="/login" style={{fontSize:13,textDecoration:"none"}}>Sign in / Create account</Link><span className="mono">Document intelligence / 01</span></div></header>
    <section className="hero"><div className="mono">READ LESS. VERIFY MORE.</div><h1>Documents deserve<br/>better than a summary.</h1><p>Turn a text-based PDF into structured findings you can inspect. Important claims are paired with page-level excerpts; uncertainty stays visible instead of being smoothed away.</p></section>
    <section className="layout-grid">
      <div className="panel"><div className="mono">01 / INPUT</div><h2>Analyze a document</h2><p className="muted">Upload one text-based PDF. Maximum 20 MB. Scanned/image-only PDFs require OCR, which is not supported in this version.</p>
        <div className="upload"><label htmlFor="pdf" className="mono">SELECT PDF FILE</label><input id="pdf" className="file-input" type="file" accept="application/pdf,.pdf" onChange={e=>{setFile(e.target.files?.[0] ?? null);setRequestKey(crypto.randomUUID());setAnalysis(null);setMessage("");}}/><button className="button" onClick={submit} disabled={busy}>{busy ? "Analyzing document…" : "Analyze PDF"}</button><p className="muted">The file is sent to this server for text extraction and to Google Gemini for analysis. Do not upload sensitive or confidential documents.</p></div>
        {message && <p className={`notice ${error ? "error" : "success"}`} role="status">{message}</p>}
      </div>
      <aside className="panel"><div className="mono">02 / METHOD</div><h2>Evidence before confidence</h2><p className="muted">A small, deliberate workflow designed to make source limitations legible.</p><ol className="steps"><li><span className="num">01</span><span><b>Validate</b><br/>Check file type, size and PDF readability.</span></li><li><span className="num">02</span><span><b>Extract</b><br/>Keep page boundaries so findings can point back to source text.</span></li><li><span className="num">03</span><span><b>Structure</b><br/>Validate the model response before showing it.</span></li><li><span className="num">04</span><span><b>Inspect</b><br/>Compare each finding with its cited page excerpt.</span></li></ol></aside>
    </section>
    <section className="panel" style={{marginBottom:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div><div className="mono">03 / LIBRARY</div><h2>Document history</h2><p className="muted">Saved PDFs and the latest persisted analysis for this account.</p></div>
        <button className="button" onClick={() => void refreshHistory()} disabled={historyBusy}>{historyBusy ? "Refreshing…" : "Refresh history"}</button>
      </div>
      {historyBusy && documents.length === 0 ? <p className="muted">Loading saved documents…</p> :
        documents.length === 0 ? <p className="muted">No saved documents found. Sign in and analyze a PDF to create your first entry.</p> :
        <div style={{display:"grid",gap:12,marginTop:18}}>
          {documents.map((document) => <article key={document.id} className="notice" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
            <div style={{minWidth:0,flex:"1 1 300px"}}>
              <b style={{overflowWrap:"anywhere"}}>{document.display_name}</b>
              <p className="muted">{document.status} · {document.page_count ?? "?"} pages · {(document.byte_size / 1024 / 1024).toFixed(2)} MB · {new Date(document.created_at).toLocaleString()}</p>
              {document.latestAnalysis ? <><p style={{margin:"8px 0"}}>{document.latestAnalysis.title || "Untitled analysis"}</p><button className="button" onClick={() => {setAnalysis(document.latestAnalysis);window.scrollTo({top:0,behavior:"smooth"});}}>View latest analysis</button></> : <p className="muted">No saved analysis result.</p>}
            </div>
            <button className="button" onClick={() => void deleteDocument(document.id)} disabled={deletingId === document.id}>{deletingId === document.id ? "Deleting…" : "Delete"}</button>
          </article>)}
        </div>}
    </section>
    {analysis && <section className="panel" style={{marginBottom:48}}><div className="mono">ANALYSIS RESULT</div><h2>{analysis.title || "Untitled document"}</h2><p className="muted">{analysis.category} · {analysis.language}</p><h3>Executive summary</h3><p style={{lineHeight:1.7}}>{analysis.summary}</p>
      {([[ "Key points", analysis.keyPoints ],["Dates and obligations",analysis.datesAndObligations],["Risks and ambiguities",analysis.risksAndAmbiguities]] as const).map(([heading,items])=><div key={heading}><h3>{heading}</h3>{items.length===0?<p className="muted">No items returned.</p>:items.map((item,i)=><article key={heading+i} className="notice" style={{marginBottom:10}}><b>{item.text}</b><p className="muted">Certainty: {item.certainty}</p>{item.evidence.map((ev,j)=><blockquote key={j} style={{borderLeft:"2px solid #315c50",paddingLeft:12,margin:"10px 0",fontSize:13}}>Page {ev.page}: “{ev.excerpt}”</blockquote>)}</article>)}</div>)}
      <h3>Recommendations</h3><ul>{analysis.recommendations.map((x,i)=><li key={i}>{x}</li>)}</ul><h3>Limitations</h3><ul>{analysis.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul><button className="button" onClick={()=>{const blob=new Blob([JSON.stringify(analysis,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="papertrail-analysis.json";a.click();URL.revokeObjectURL(url);}}>Export validated JSON</button>
    </section>}
    <footer className="foot"><span>Papertrail · Early technical MVP</span><span>No OCR · Saved history requires Supabase configuration</span></footer>
  </main>;
}