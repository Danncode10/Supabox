"use client";

import { useCallback, useEffect, useState } from "react";
import type { AllowedEmail, Role } from "@/lib/types";
import { api, btnDanger, btnGhost, btnPrimary, card, input, label } from "./ui";

type Row = AllowedEmail & { signedUp: boolean };

export function UsersManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("labeler");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<Row[]>("/api/admin/users"));
    } catch (e) {
      setErr((e as Error).message);
    }
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
    <div className="space-y-6">
      <form
        className={`${card} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("/api/admin/users", { method: "POST", body: JSON.stringify({ email, role }) });
            setEmail("");
          });
        }}
      >
        <h2 className="text-lg font-semibold">Add email</h2>
        <div>
          <label htmlFor="u-email" className={label}>Email</label>
          <input id="u-email" type="email" required autoComplete="off" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="u-role" className={label}>Role</label>
          <select id="u-role" className={input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="labeler">Labeler</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className={`${btnPrimary} w-full`} disabled={busy || !email}>Add</button>
      </form>

      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.email} className={`${card} flex flex-wrap items-center gap-3`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.email}</p>
              <p className="text-sm text-zinc-500">{r.role}{r.signedUp ? "" : " (not signed in yet)"}</p>
            </div>
            <button
              className={btnGhost}
              disabled={busy}
              onClick={() => run(() => api("/api/admin/users", { method: "POST", body: JSON.stringify({ email: r.email, role: r.role === "admin" ? "labeler" : "admin" }) }))}
            >
              Make {r.role === "admin" ? "labeler" : "admin"}
            </button>
            <button
              className={btnDanger}
              disabled={busy}
              onClick={() => {
                if (confirm(`Remove ${r.email}? They will lose access and their account is deleted.`)) {
                  void run(() => api(`/api/admin/users?email=${encodeURIComponent(r.email)}`, { method: "DELETE" }));
                }
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
