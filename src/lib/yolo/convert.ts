import type { BoxXYWH } from "../types";

const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

const fmt = (n: number): string => clamp01(n).toFixed(6);

/**
 * Clamp a normalized center-format box so it stays inside the image.
 * Returns null when the box is degenerate (zero or negative area after clamping).
 */
export function normalizeBox(box: BoxXYWH): BoxXYWH | null {
  if (![box.x, box.y, box.w, box.h].every(Number.isFinite)) return null;
  // Convert to corners, clamp corners, convert back (keeps the box inside 0..1).
  const x1 = clamp01(box.x - box.w / 2);
  const x2 = clamp01(box.x + box.w / 2);
  const y1 = clamp01(box.y - box.h / 2);
  const y2 = clamp01(box.y + box.h / 2);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return null;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, w, h };
}

/** One YOLO label line: "class cx cy w h" with 6 decimals. Null for degenerate boxes or bad class. */
export function boxToYoloLine(box: BoxXYWH, classIndex: number): string | null {
  if (!Number.isInteger(classIndex) || classIndex < 0) return null;
  const b = normalizeBox(box);
  if (!b) return null;
  const w = fmt(b.w);
  const h = fmt(b.h);
  // Sub-pixel boxes that round to zero size are useless to YOLO; drop them.
  if (Number(w) === 0 || Number(h) === 0) return null;
  return `${classIndex} ${fmt(b.x)} ${fmt(b.y)} ${w} ${h}`;
}

/**
 * Full label file contents. Empty string (valid background image) when no valid boxes.
 * Boxes whose class is unknown are skipped.
 */
export function boxesToLabelText(
  boxes: Array<BoxXYWH & { classId: string }>,
  classIndexById: ReadonlyMap<string, number>,
): string {
  const lines: string[] = [];
  for (const box of boxes) {
    const idx = classIndexById.get(box.classId);
    if (idx === undefined) continue;
    const line = boxToYoloLine(box, idx);
    if (line) lines.push(line);
  }
  return lines.length ? lines.join("\n") + "\n" : "";
}
