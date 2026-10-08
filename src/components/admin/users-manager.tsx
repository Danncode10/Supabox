"use client";

import { useCallback, useEffect, useState } from "react";
import type { ManagedUser, Role } from "@/lib/types";
import { Mail, ShieldCheck, UserPlus, Users, UserX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "./ui";

type Row = ManagedUser;

export function UsersManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("labeler");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<Row[]>("/api/admin/users"));
    } catch (e) {
      setErr((e as Error).message);
    }
    setLoaded(true);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle><h2>Add user</h2></CardTitle>
          <CardDescription>Creates an account they can sign in to right away. Share the password with them.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api("/api/admin/users", { method: "POST", body: JSON.stringify({ email, password, role }) });
                setEmail("");
                setPassword("");
              });
            }}
          >
            <Field label="Email" htmlFor="u-email">
              <Input id="u-email" type="email" required autoComplete="off" placeholder="name@team.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="u-password" hint="At least 6 characters.">
              <Input id="u-password" type="text" required minLength={6} autoComplete="new-password" placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Role" htmlFor="u-role">
              <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="labeler">Labeler</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Button size="lg" className="w-full" loading={busy} disabled={!email || password.length < 6}>
              {!busy && <UserPlus aria-hidden />}
              Add user
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="u-list-h" className="flex flex-col gap-4">
        <h2 id="u-list-h" className="text-lg font-semibold tracking-tight">Users</h2>

        {err && (
          <Alert variant="danger">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        {!loaded && (
          <div className="flex flex-col gap-3" aria-busy>
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )}

        {loaded && !err && rows.length === 0 && (
          <EmptyState icon={<Users />} title="No users yet" description="Add a user to let someone sign in." />
        )}

        {rows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={r.id}>
                <BlurFade delay={i * 0.04}>
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 [box-shadow:var(--inset-highlight),var(--elev-xs)] sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                        {r.role === "admin" ? <ShieldCheck className="size-4 text-primary" aria-hidden /> : <Mail className="size-4" aria-hidden />}
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="truncate font-medium">{r.email}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={r.role === "admin" ? "default" : "neutral"}>{r.role}</Badge>
                          {!r.lastSignInAt && <Badge variant="outline">never signed in</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-1 sm:flex-none md:h-10"
                        disabled={busy}
                        onClick={() => run(() => api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: r.id, role: r.role === "admin" ? "labeler" : "admin" }) }))}
                      >
                        Make {r.role === "admin" ? "labeler" : "admin"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-muted-foreground hover:bg-danger/14 hover:text-danger md:size-10"
                        disabled={busy}
                        aria-label={`Remove ${r.email}`}
                        onClick={() => {
                          if (confirm(`Delete ${r.email}? Their account is removed and they can no longer sign in.`)) {
                            void run(() => api(`/api/admin/users?id=${encodeURIComponent(r.id)}`, { method: "DELETE" }));
                          }
                        }}
                      >
                        <UserX aria-hidden />
                      </Button>
                    </div>
                  </div>
                </BlurFade>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
