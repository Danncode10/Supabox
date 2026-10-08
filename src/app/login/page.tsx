"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ScanSearch } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Input } from "@/components/ui/input";
import { Meteors } from "@/components/ui/meteors";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setBusy(false);
      setError("Wrong email or password.");
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
                <h1>Sign in to Supabox</h1>
              </CardTitle>
              <CardDescription>Use the account your admin created for you.</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={signIn} className="flex flex-col gap-4">
                <Field label="Email" htmlFor="email">
                  <Input
                    id="email" type="email" required autoComplete="email" inputMode="email"
                    placeholder="you@team.com" className="h-12"
                    aria-invalid={!!error || undefined}
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Password" htmlFor="password">
                  <Input
                    id="password" type="password" required autoComplete="current-password"
                    className="h-12"
                    aria-invalid={!!error || undefined}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Button size="lg" loading={busy} className="w-full">
                  {!busy && <LogIn aria-hidden />}
                  {busy ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              {error && (
                <Alert variant="danger" className="mt-4">
                  <AlertDescription className="text-foreground">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <BorderBeam size={110} duration={10} borderWidth={1.5} />
          </Card>
        </BlurFade>

        <p className="text-center text-xs text-muted-foreground">
          No account yet? Ask your admin to create one.
        </p>
      </div>
    </main>
  );
}
