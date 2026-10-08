"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ScanSearch, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Input } from "@/components/ui/input";
import { Meteors } from "@/components/ui/meteors";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setIsError(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setIsError(true);
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
    setIsError(false);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setIsError(true);
      setMessage("Invalid or expired code. Try again.");
      return;
    }
    const next = new URLSearchParams(location.search).get("next") ?? "/";
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <main className="relative isolate flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <GridPattern
          width={44}
          height={44}
          className="mask-[radial-gradient(ellipse_60%_55%_at_50%_45%,white,transparent)] fill-transparent stroke-foreground/7"
        />
        <div className="absolute left-1/2 top-1/3 size-120 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <Meteors number={12} />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <BlurFade className="flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground [box-shadow:var(--inset-highlight),var(--elev-xs)]">
            <ScanSearch className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">Supabox</span>
        </BlurFade>

        <BlurFade delay={0.06}>
          <Card className="relative gap-6 overflow-hidden py-6 [box-shadow:var(--inset-highlight),var(--elev-lg)]">
            <CardHeader>
              <CardTitle className="text-xl">
                <h1>{step === "email" ? "Sign in to Supabox" : "Enter your code"}</h1>
              </CardTitle>
              <CardDescription>
                {step === "email"
                  ? "We email you a one-time code. Only invited addresses can sign in."
                  : <>Sent to <span className="font-medium text-foreground">{email.trim().toLowerCase()}</span></>}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {step === "email" ? (
                <form key="email" onSubmit={sendCode} className="flex animate-fade-up flex-col gap-4">
                  <Field label="Email" htmlFor="email">
                    <Input
                      id="email" type="email" required autoComplete="email" inputMode="email"
                      placeholder="you@team.com" className="h-12"
                      aria-invalid={isError || undefined}
                      value={email} onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Button size="lg" loading={busy} className="w-full">
                    {!busy && <Mail aria-hidden />}
                    {busy ? "Sending..." : "Email me a code"}
                  </Button>
                </form>
              ) : (
                <form key="code" onSubmit={verify} className="flex animate-fade-up flex-col gap-4">
                  <Field label="6-digit code" htmlFor="code">
                    <Input
                      id="code" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={8}
                      autoFocus placeholder="000000"
                      aria-invalid={isError || undefined}
                      value={code} onChange={(e) => setCode(e.target.value)}
                      className="h-14 text-center font-mono text-2xl tracking-[0.5em] tabular-nums md:h-14 md:text-2xl"
                    />
                  </Field>
                  <Button size="lg" loading={busy} className="w-full">
                    {!busy && <ShieldCheck aria-hidden />}
                    {busy ? "Verifying..." : "Sign in"}
                  </Button>
                  <Button
                    type="button" variant="ghost" size="lg" className="w-full text-muted-foreground"
                    onClick={() => { setStep("email"); setMessage(null); setIsError(false); setCode(""); }}
                  >
                    Use a different email
                  </Button>
                </form>
              )}
              <div className={cn(message && "mt-4")}>
                {message && (
                  <Alert variant={isError ? "danger" : "success"}>
                    <AlertDescription className="text-foreground">{message}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <BorderBeam size={110} duration={10} borderWidth={1.5} />
          </Card>
        </BlurFade>

        <p className="text-center text-xs text-muted-foreground">
          Not on the list? Ask an admin to add your email.
        </p>
      </div>
    </main>
  );
}
