"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const result = mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === "sign-up" && !result.data.session) {
        setMessage("Account created. Check your email to confirm the address, then sign in.");
      } else {
        window.location.assign("/");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setBusy(false); }
  }

  return <main className="shell"><header className="topbar"><Link className="brand" href="/">papertrail<span>.</span></Link><span className="mono">ACCOUNT ACCESS</span></header>
    <section className="hero"><div className="mono">PRIVATE WORKSPACE</div><h1>{mode === "sign-in" ? "Sign in." : "Create an account."}</h1><p>Authentication is handled by your configured Supabase project. Documents are stored privately and access is scoped to your account.</p></section>
    <section className="panel" style={{maxWidth:480,marginBottom:80}}><form onSubmit={submit} style={{display:"grid",gap:16}}>
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:6,border:"1px solid var(--line)",background:"white"}}/></label>
      <label>Password<input required minLength={8} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:6,border:"1px solid var(--line)",background:"white"}}/></label>
      <button className="button" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
    </form>
    {message && <p className="notice" role="status" style={{marginTop:16}}>{message}</p>}
    <p className="muted" style={{marginTop:20}}>{mode === "sign-in" ? "New to Papertrail?" : "Already have an account?"} <button onClick={()=>{setMode(mode === "sign-in" ? "sign-up" : "sign-in");setMessage("");}} style={{background:"none",border:0,color:"var(--accent)",textDecoration:"underline",cursor:"pointer"}}>{mode === "sign-in" ? "Create account" : "Sign in"}</button></p>
    </section></main>;
}