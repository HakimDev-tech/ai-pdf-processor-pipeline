"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "./login.css";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-shell">
      <header className="account-topbar">
        <Link className="account-brand" href="/" aria-label="Papertrail home">
          <span className="account-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>papertrail<span className="account-brand-period">.</span></span>
        </Link>
        <span className="account-topbar-label">ACCOUNT ACCESS</span>
      </header>

      <div className="account-content">
        <section className="account-intro" aria-labelledby="account-title">
          <p className="account-eyebrow"><span /> PRIVATE WORKSPACE</p>
          <h1 id="account-title">{mode === "sign-in" ? <>Your documents.<br /><em>In clear focus.</em></> : <>A workspace<br /><em>of your own.</em></>}</h1>
          <p className="account-description">A private space for document intelligence. Your files and their analysis stay scoped to your account.</p>
          <div className="account-proof" aria-label="Privacy principles">
            <span><b>01</b> Private storage</span>
            <span><b>02</b> Traceable evidence</span>
          </div>
        </section>

        <section className="account-card" aria-label={mode === "sign-in" ? "Sign in" : "Create account"}>
          <div className="account-card-heading">
            <span className="mono">PAPERTRAIL / ACCESS</span>
            <span className="account-step">{mode === "sign-in" ? "01" : "02"} <span>/ 02</span></span>
          </div>
          <h2>{mode === "sign-in" ? "Welcome back." : "Create your account."}</h2>
          <p className="account-card-copy">{mode === "sign-in" ? "Sign in to continue to your workspace." : "Set up your private document workspace."}</p>

          <form className="account-form" onSubmit={submit}>
            <label htmlFor="account-email">Email address
              <input id="account-email" required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label htmlFor="account-password">Password
              <input id="account-password" required minLength={8} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </label>
            <button className="account-submit" disabled={busy}>
              <span>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in to Papertrail" : "Create account"}</span>
              {!busy && <span aria-hidden="true">↗</span>}
            </button>
          </form>

          {message && <p className="account-notice" role="status">{message}</p>}
          <p className="account-switch">
            {mode === "sign-in" ? "New to Papertrail?" : "Already have an account?"}
            <button type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>
              {mode === "sign-in" ? "Create account" : "Sign in"}
            </button>
          </p>
          <p className="account-security"><span aria-hidden="true">◇</span> Authentication secured by your Supabase project</p>
        </section>
      </div>

      <footer className="account-footer">
        <span>PAPERTRAIL © 2026</span>
        <span>DOCUMENT INTELLIGENCE / PRIVATE BY DESIGN</span>
      </footer>
    </main>
  );
}