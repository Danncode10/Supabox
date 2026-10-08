"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setMessage("This email is not allowed to sign in, or sending failed. Ask an admin to add you.");
      return;
    }
    setStep("code");
    setMessage("Check your email for a 6-digit code (or tap the link).");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setMessage("Invalid or expired code. Try again.");
      return;
    }
    const next = new URLSearchParams(location.search).get("next") ?? "/";
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Sign in to Supabox</h1>
      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm">Email</label>
          <input
            id="email" type="email" required autoComplete="email" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-lg border border-current/30 bg-transparent px-3 text-base"
          />
          <button disabled={busy} className="h-12 rounded-lg bg-foreground text-background disabled:opacity-50">
            {busy ? "Sending..." : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label htmlFor="code" className="text-sm">6-digit code</label>
          <input
            id="code" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={8}
            value={code} onChange={(e) => setCode(e.target.value)}
            className="h-12 rounded-lg border border-current/30 bg-transparent px-3 text-center text-xl tracking-widest"
          />
          <button disabled={busy} className="h-12 rounded-lg bg-foreground text-background disabled:opacity-50">
            {busy ? "Verifying..." : "Sign in"}
          </button>
          <button type="button" onClick={() => setStep("email")} className="h-12 text-sm underline">
            Use a different email
          </button>
        </form>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </main>
  );
}
