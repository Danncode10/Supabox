export const btn =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
export const btnPrimary = `${btn} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`;
export const btnGhost = `${btn} border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800`;
export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-700`;
export const input =
  "min-h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-700";
export const label = "mb-1 block text-sm font-medium";
export const card = "rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800";

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** Fetches an ApiResult endpoint and returns data or throws with the server message. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json.data as T;
}
