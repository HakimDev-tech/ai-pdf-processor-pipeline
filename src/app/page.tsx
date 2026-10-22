"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SignalField from "@/components/SignalField";

type Analysis = {
  title: string; category: string; language: string; summary: string;
  keyPoints: { text: string; certainty: string; evidence: { page: number; excerpt: string }[] }[];
  datesAndObligations: { text: string; certainty: string; evidence: { page: number; excerpt: string }[] }[];
  risksAndAmbiguities: { text: string; certainty: string; evidence: { page: number; excerpt: string }[] }[];
  recommendations: string[]; limitations: string[];
};

type AnalysisVersion = { id: string; run_number: number; state: string; attempt_count: number; max_attempts: number; failure_code: string | null; created_at: string; finished_at: string | null; analysis: Analysis | null; analysisCreatedAt: string | null };

type SavedDocument = {
  id: string; display_name: string; status: string; page_count: number | null;
  byte_size: number; created_at: string; latestAnalysis: Analysis | null;
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [versionsByDocument, setVersionsByDocument] = useState<Record<string, AnalysisVersion[]>>({});
  const [versionsBusyId, setVersionsBusyId] = useState<string | null>(null);
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

  async function loadVersions(id: string) {
    setVersionsBusyId(id);
    try {
      const response = await fetch("/api/documents/" + id + "/versions", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Versions could not be loaded.");
      setVersionsByDocument((current) => ({ ...current, [id]: payload.versions as AnalysisVersion[] }));
    } catch (e) {
      setError(true); setMessage(e instanceof Error ? e.message : "Versions could not be loaded.");
    } finally { setVersionsBusyId(null); }
  }

  async function reprocessDocument(id: string) {
    if (!window.confirm("Create a new immutable analysis version? This sends the PDF to Gemini again and may consume API quota.")) return;
    try {
      const response = await fetch("/api/documents/" + id + "/reprocess", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Reprocessing could not be queued.");
      setMessage("Version " + payload.runNumber + " queued for processing.");
      setError(false);
      await refreshHistory();
      await loadVersions(id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Reprocessing could not be queued.");
      setError(true);
    }
  }

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
      let payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Analysis could not be queued.");
      if (response.status === 202 && payload.documentId) {
        setMessage("PDF saved to the durable queue. Waiting for a worker…");
        let completed = false;
        for (let attempt = 0; attempt < 150; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const statusResponse = await fetch("/api/documents/" + payload.documentId + "/status", { cache: "no-store" });
          const statusPayload = await statusResponse.json();
          if (!statusResponse.ok) throw new Error(statusPayload.error ?? "Could not retrieve processing status.");
          if (statusPayload.state === "completed" && statusPayload.analysis) {
            payload = statusPayload;
            completed = true;
            break;
          }
          if (statusPayload.state === "failed" || statusPayload.state === "needs_attention") {
            throw new Error("Processing failed after " + (statusPayload.attempt ?? 0) + " attempt(s). Code: " + (statusPayload.error ?? "PROCESSING_FAILED") + ". The saved document remains in history.");
          }
          if (attempt % 10 === 9) setMessage("Document remains safely queued or is being processed. Attempt " + (statusPayload.attempt ?? 0) + " of " + (statusPayload.maxAttempts ?? 3) + "…");
        }
        if (!completed) {
          setMessage("The document is saved and processing continues in the background. Refresh history to check its status.");
          setError(false);
          await refreshHistory();
          return;
        }
      }
      if (!payload.analysis) throw new Error("The worker completed without returning a saved analysis result.");
      setAnalysis(payload.analysis as Analysis);
      setMessage("Analysis completed. Review evidence and uncertainty before relying on any finding.");
      setError(false);
      await refreshHistory();
    } catch (e) {
      setError(true); setMessage(e instanceof Error ? e.message : "Request failed. Try again.");
    } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Papertrail home"><span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span className="brand-word">papertrail<span className="brand-period">.</span></span></Link>
      <nav className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
        <a href="#workspace" onClick={() => setMenuOpen(false)}>Workspace <span>01</span></a>
        <a href="#method" onClick={() => setMenuOpen(false)}>Method <span>02</span></a>
        <a href="#library" onClick={() => setMenuOpen(false)}>Library <span>03</span></a>
        <Link className="nav-account" href="/login" onClick={() => setMenuOpen(false)}>Sign in <span aria-hidden="true">↗</span></Link>
      </nav>
      <button className={`menu-toggle ${menuOpen ? "is-open" : ""}`} type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span></span><span></span></button>
    </header>
    <section className="hero" id="top">
      <div className="hero-copy">
        <div className="eyebrow"><span className="status-pulse"></span> DOCUMENT INTELLIGENCE <span className="eyebrow-index">FIELD NOTES / 001</span></div>
        <h1>Read between<br/>the <em>lines.</em></h1>
        <p>Documents are full of details that summaries flatten. Papertrail turns dense PDFs into structured findings — with the source, page, and uncertainty still attached.</p>
        <div className="hero-actions"><a className="hero-cta" href="#workspace">Inspect a document <span aria-hidden="true">↘</span></a><span className="hero-meta">PDF → EVIDENCE → DECISION</span></div>
      </div>
      <div className="hero-stage" aria-label="Animated illustration of a document being decomposed into evidence">
        <SignalField />
        <div className="stage-corner stage-corner-tl">FIG. 01 <span>·</span> TRACEABLE INPUT</div>
        <div className="stage-corner stage-corner-br">PAGE / SIGNAL / SOURCE <span className="stage-live"><i></i> LIVE FIELD</span></div>
        <div className="stage-chip stage-chip-a"><span className="chip-dot"></span> Evidence linked <b>↗</b></div>
        <div className="stage-chip stage-chip-b"><span className="chip-bars"><i></i><i></i><i></i></span> Ambiguity preserved</div>
      </div>
      <div className="hero-index" aria-hidden="true"><span>01</span><span className="index-line"></span><span>03</span></div>
    </section>
    <section className="layout-grid" id="workspace">
      <div className="panel upload-panel"><div className="panel-heading"><span className="section-index">01</span><div><div className="mono">INPUT / INGESTION</div><h2>Start with a source.</h2></div><span className="panel-glyph" aria-hidden="true">↗</span></div><p className="muted">Upload one text-based PDF. Maximum 20 MB. Scanned/image-only PDFs require OCR, which is not supported in this version.</p>
        <div className="upload"><div className="upload-orbit" aria-hidden="true"><span>PDF</span><i></i><i></i><i></i></div><label htmlFor="pdf" className="mono">SELECT PDF FILE</label><input id="pdf" className="file-input" type="file" accept="application/pdf,.pdf" onChange={e=>{setFile(e.target.files?.[0] ?? null);setRequestKey(crypto.randomUUID());setAnalysis(null);setMessage("");}}/><button className="button" onClick={submit} disabled={busy}>{busy ? "Analyzing document…" : "Analyze PDF"}</button><p className="muted">The file is sent to this server for text extraction and to Google Gemini for analysis. Do not upload sensitive or confidential documents.</p></div>
        {message && <p className={`notice ${error ? "error" : "success"}`} role="status">{message}</p>}
      </div>
      <aside className="panel method-panel" id="method"><div className="panel-heading"><span className="section-index">02</span><div><div className="mono">METHOD / PIPELINE</div><h2>Evidence before confidence.</h2></div></div><p className="muted">A small, deliberate workflow designed to make source limitations legible.</p><ol className="steps"><li><span className="num">01</span><span><b>Validate</b><br/>Check file type, size and PDF readability.</span></li><li><span className="num">02</span><span><b>Extract</b><br/>Keep page boundaries so findings can point back to source text.</span></li><li><span className="num">03</span><span><b>Structure</b><br/>Validate the model response before showing it.</span></li><li><span className="num">04</span><span><b>Inspect</b><br/>Compare each finding with its cited page excerpt.</span></li></ol></aside>
    </section>
    <section className="panel library-panel" id="library" style={{marginBottom:24}}>
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
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                <button className="button" onClick={() => void loadVersions(document.id)} disabled={versionsBusyId === document.id}>{versionsBusyId === document.id ? "Loading versions…" : "Version history"}</button>
                <button className="button" onClick={() => void reprocessDocument(document.id)} disabled={document.status === "processing"}>Create new version</button>
              </div>
              {versionsByDocument[document.id] && <div style={{display:"grid",gap:8,marginTop:12}}>
                {versionsByDocument[document.id].map((version) => <div key={version.id} className="notice">
                  <b>Version {version.run_number}</b><span className="muted"> · {version.state} · {version.attempt_count}/{version.max_attempts} attempts</span>
                  <p className="muted">{new Date(version.created_at).toLocaleString()}{version.failure_code ? " · " + version.failure_code : ""}</p>
                  {version.analysis && <button className="button" onClick={() => {setAnalysis(version.analysis);window.scrollTo({top:0,behavior:"smooth"});}}>View this version</button>}
                </div>)}
              </div>}
            </div>
            <button className="button" onClick={() => void deleteDocument(document.id)} disabled={deletingId === document.id}>{deletingId === document.id ? "Deleting…" : "Delete"}</button>
          </article>)}
        </div>}
    </section>
    {analysis && <section className="panel analysis-panel" id="analysis" style={{marginBottom:48}}><div className="mono">ANALYSIS RESULT</div><h2>{analysis.title || "Untitled document"}</h2><p className="muted">{analysis.category} · {analysis.language}</p><h3>Executive summary</h3><p style={{lineHeight:1.7}}>{analysis.summary}</p>
      {([[ "Key points", analysis.keyPoints ],["Dates and obligations",analysis.datesAndObligations],["Risks and ambiguities",analysis.risksAndAmbiguities]] as const).map(([heading,items])=><div key={heading}><h3>{heading}</h3>{items.length===0?<p className="muted">No items returned.</p>:items.map((item,i)=><article key={heading+i} className="notice" style={{marginBottom:10}}><b>{item.text}</b><p className="muted">Certainty: {item.certainty}</p>{item.evidence.map((ev,j)=><blockquote key={j} style={{borderLeft:"2px solid #315c50",paddingLeft:12,margin:"10px 0",fontSize:13}}>Page {ev.page}: “{ev.excerpt}”</blockquote>)}</article>)}</div>)}
      <h3>Recommendations</h3><ul>{analysis.recommendations.map((x,i)=><li key={i}>{x}</li>)}</ul><h3>Limitations</h3><ul>{analysis.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul><button className="button" onClick={()=>{const blob=new Blob([JSON.stringify(analysis,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="papertrail-analysis.json";a.click();URL.revokeObjectURL(url);}}>Export validated JSON</button>
    </section>}
    <footer className="foot"><div className="foot-brand"><span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span> papertrail<span className="brand-period">.</span></div><span>Made for careful reading, not confident guessing.</span><a href="#top">Back to top ↑</a><span className="foot-note">NO OCR · WORKER SCHEDULER REQUIRED</span></footer>
  </main>;
}