export type Split = "train" | "val" | "test";

export interface SplitRatios {
  train: number;
  val: number;
  test: number;
}

export const DEFAULT_RATIOS: SplitRatios = { train: 0.8, val: 0.2, test: 0 };

/** mulberry32 PRNG: small, fast, deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically assign each item a split. Items are first sorted by `number`
 * (so input order never matters), then shuffled with a seeded PRNG.
 * With >= 2 items and a non-zero val ratio, val gets at least 1 item.
 */
export function assignSplits<T extends { number: number }>(
  items: readonly T[],
  ratios: SplitRatios = DEFAULT_RATIOS,
  seed = 42,
): Map<T, Split> {
  const sum = ratios.train + ratios.val + ratios.test;
  if (!(sum > 0) || ratios.train < 0 || ratios.val < 0 || ratios.test < 0) {
    throw new Error("Invalid split ratios");
  }
  const sorted = [...items].sort((a, b) => a.number - b.number);
  const rand = mulberry32(seed);
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }
  const n = sorted.length;
  let nTest = Math.round((n * ratios.test) / sum);
  let nVal = Math.round((n * ratios.val) / sum);
  if (ratios.val > 0 && n >= 2 && nVal === 0) nVal = 1;
  if (nVal + nTest > n - (n >= 2 ? 1 : 0)) {
    // always keep at least one training image when possible
    nTest = Math.min(nTest, Math.max(0, n - 1 - nVal));
    nVal = Math.min(nVal, Math.max(0, n - 1 - nTest));
  }
  const out = new Map<T, Split>();
  sorted.forEach((item, i) => {
    out.set(item, i < nVal ? "val" : i < nVal + nTest ? "test" : "train");
  });
  return out;
}

function yamlString(s: string): string {
  // JSON strings are valid YAML double-quoted scalars (quotes, colons, '#', unicode all safe).
  return JSON.stringify(s);
}

export interface DataYamlOptions {
  /** Emit `test: images/test`. Only set when the archive actually has test images. */
  test?: boolean;
  /**
   * Folder used for `val`. "train" when no image landed in val (tiny datasets), because
   * Ultralytics refuses to start when the val path does not exist.
   */
  val?: "val" | "train";
}

/**
 * data.yaml for Ultralytics YOLO (v5/v8/11). `names` must be ordered by class index 0..N-1.
 * `path: .` resolves against the working directory, so run `yolo detect train data=data.yaml`
 * from the unzipped folder (or replace `.` with the absolute folder path).
 */
export function buildDataYaml(names: readonly string[], opts: boolean | DataYamlOptions = {}): string {
  const o: DataYamlOptions = typeof opts === "boolean" ? { test: opts } : opts;
  const lines = [
    "# Exported by Supabox. Train from this folder: yolo detect train data=data.yaml model=yolov8n.pt",
    "path: .",
    "train: images/train",
    `val: images/${o.val ?? "val"}`,
  ];
  if (o.test) lines.push("test: images/test");
  lines.push("");
  lines.push(`nc: ${names.length}`);
  if (names.length === 0) lines.push("names: {}");
  else {
    lines.push("names:");
    names.forEach((n, i) => lines.push(`  ${i}: ${yamlString(n)}`));
  }
  return lines.join("\n") + "\n";
}
