/** Filename helpers for archive entries that must unzip cleanly on Windows, macOS and Linux. */

export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp"] as const;

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/**
 * Make a single path segment (no extension) safe: strips path separators, Windows-forbidden
 * characters and control chars, trims trailing dots/spaces, avoids reserved device names.
 */
export function safeFileStem(name: string): string {
  let s = name
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[.\s]+$/, "")
    .replace(/\s+/g, "_");
  if (s.length > 150) s = s.slice(0, 150);
  if (!s) s = "image";
  if (WINDOWS_RESERVED.test(s)) s = `${s}_`;
  return s;
}

/** Lowercase image extension taken from a storage path; `jpeg` becomes `jpg`, unknown falls back to `jpg`. */
export function extOf(storagePath: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(storagePath);
  const ext = m ? m[1].toLowerCase() : "jpg";
  if (ext === "jpeg") return "jpg";
  return (IMAGE_EXTS as readonly string[]).includes(ext) ? ext : "jpg";
}

/**
 * Assign every item a unique, case-insensitively distinct stem (Windows and macOS file systems
 * are case-insensitive). Collisions get `_2`, `_3`, ... suffixes in input order.
 */
export function uniqueStems<T>(items: readonly T[], nameOf: (t: T) => string): Map<T, string> {
  const used = new Set<string>();
  const out = new Map<T, string>();
  for (const it of items) {
    const base = safeFileStem(nameOf(it));
    let stem = base;
    for (let i = 2; used.has(stem.toLowerCase()); i++) stem = `${base}_${i}`;
    used.add(stem.toLowerCase());
    out.set(it, stem);
  }
  return out;
}
