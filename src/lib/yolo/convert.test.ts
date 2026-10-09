// Run: npm run test:yolo  (node --experimental-strip-types src/lib/yolo/convert.test.ts)
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
// @ts-expect-error node strip-types needs the .ts extension
import { boxToYoloLine, boxesToLabelText } from "./convert.ts";
// @ts-expect-error node strip-types needs the .ts extension
import { assignSplits, buildDataYaml } from "./split.ts";
// @ts-expect-error node strip-types needs the .ts extension
import { crc32, zipChunks } from "./zip.ts";
// @ts-expect-error node strip-types needs the .ts extension
import { extOf, safeFileStem, uniqueStems } from "./paths.ts";
import type { ExportSource } from "./build";
import type { ClassDef, ImageRecord, ImageStatus } from "../types";

// build.ts uses extensionless relative imports (bundler style); let Node retry with ".ts".
// registerHooks exists in Node >= 22.15 but not in @types/node 20, hence the local typing.
type Resolve = (specifier: string, context: unknown) => unknown;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: (specifier: string, context: unknown, next: Resolve) => unknown }) => void;
};
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context);
      throw err;
    }
  },
});

// ------------------------------------------------------------ label lines
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 0.25, h: 0.5 }, 2), "2 0.500000 0.500000 0.250000 0.500000");
// clamping: box overhanging the right edge shrinks and recenters
assert.equal(boxToYoloLine({ x: 0.95, y: 0.5, w: 0.2, h: 0.2 }, 0), "0 0.925000 0.500000 0.150000 0.200000");
// overhanging top-left corner
assert.equal(boxToYoloLine({ x: 0.05, y: 0.05, w: 0.2, h: 0.2 }, 1), "1 0.075000 0.075000 0.150000 0.150000");
// full image box
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 1, h: 1 }, 0), "0 0.500000 0.500000 1.000000 1.000000");
// fully outside / zero area / NaN / bad class / sub-pixel box that rounds to zero
assert.equal(boxToYoloLine({ x: 1.5, y: 0.5, w: 0.1, h: 0.1 }, 0), null);
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 0, h: 0.1 }, 0), null);
assert.equal(boxToYoloLine({ x: NaN, y: 0.5, w: 0.1, h: 0.1 }, 0), null);
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, -1), null);
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, 1.5), null);
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 1e-7, h: 0.1 }, 0), null);
// every line is "int f f f f" with 6 decimals and values in [0,1]
for (const line of [boxToYoloLine({ x: 0.123456789, y: 0.987654321, w: 0.3333333, h: 0.0101 }, 7)!]) {
  assert.match(line, /^\d+ (0|1)\.\d{6} (0|1)\.\d{6} (0|1)\.\d{6} (0|1)\.\d{6}$/);
}

// empty label text and unknown class skipped
const idx = new Map([["a", 0], ["b", 1]]);
assert.equal(boxesToLabelText([], idx), "");
assert.equal(boxesToLabelText([{ x: 0.5, y: 0.5, w: 0.1, h: 0.1, classId: "zz" }], idx), "");
assert.equal(
  boxesToLabelText([{ x: 0.5, y: 0.5, w: 0.1, h: 0.1, classId: "a" }], idx),
  "0 0.500000 0.500000 0.100000 0.100000\n",
);
// multiple boxes: one line each, input order, trailing newline
assert.equal(
  boxesToLabelText(
    [
      { x: 0.25, y: 0.25, w: 0.1, h: 0.2, classId: "b" },
      { x: 0.75, y: 0.75, w: 0.3, h: 0.4, classId: "a" },
    ],
    idx,
  ),
  "1 0.250000 0.250000 0.100000 0.200000\n0 0.750000 0.750000 0.300000 0.400000\n",
);

// ------------------------------------------------------------ splits
const items = Array.from({ length: 10 }, (_, i) => ({ number: 2103 + i }));
const a = assignSplits(items, undefined, 1);
const b = assignSplits([...items].reverse(), undefined, 1);
for (const it of items) assert.equal(a.get(it), [...b].find(([k]) => k.number === it.number)![1]);
const counts = { train: 0, val: 0, test: 0 };
for (const s of a.values()) counts[s]++;
assert.deepEqual(counts, { train: 8, val: 2, test: 0 });
assert.equal([...assignSplits([{ number: 1 }]).values()][0], "train");
assert.equal([...assignSplits([{ number: 1 }, { number: 2 }]).values()].filter((s) => s === "val").length, 1);
assert.equal(assignSplits([]).size, 0);
// train/val/test 70/20/10 on 20 items
{
  const many = Array.from({ length: 20 }, (_, i) => ({ number: i }));
  const c = { train: 0, val: 0, test: 0 };
  for (const s of assignSplits(many, { train: 0.7, val: 0.2, test: 0.1 }).values()) c[s]++;
  assert.deepEqual(c, { train: 14, val: 4, test: 2 });
}
// 2 items with test ratio: still keeps one train image
{
  const c = { train: 0, val: 0, test: 0 };
  for (const s of assignSplits([{ number: 1 }, { number: 2 }], { train: 0.5, val: 0.25, test: 0.25 }).values()) c[s]++;
  assert.equal(c.train, 1);
}
assert.throws(() => assignSplits(items, { train: 0, val: 0, test: 0 }));

// ------------------------------------------------------------ data.yaml
const yamlHeader = "# Exported by Supabox. Train from this folder: yolo detect train data=data.yaml model=yolov8n.pt\n";
assert.equal(
  buildDataYaml(["cat", "dog"], false),
  `${yamlHeader}path: .\ntrain: images/train\nval: images/val\n\nnc: 2\nnames:\n  0: "cat"\n  1: "dog"\n`,
);
assert.equal(
  buildDataYaml(["a"], { test: true }),
  `${yamlHeader}path: .\ntrain: images/train\nval: images/val\ntest: images/test\n\nnc: 1\nnames:\n  0: "a"\n`,
);
assert.match(buildDataYaml(["a"], { val: "train" }), /\nval: images\/train\n/);
assert.match(buildDataYaml([], {}), /\nnc: 0\nnames: \{\}\n$/);
// tricky class names are quoted safely
assert.match(
  buildDataYaml(['traffic: light', 'say "hi"', "#tag", "yes", "Đèn"], {}),
  /  0: "traffic: light"\n  1: "say \\"hi\\""\n  2: "#tag"\n  3: "yes"\n  4: "Đèn"\n/,
);

// ------------------------------------------------------------ paths
assert.equal(safeFileStem("image_2103"), "image_2103");
assert.equal(safeFileStem('a<b>c:d"e/f\\g|h?i*j'), "a_b_c_d_e_f_g_h_i_j");
assert.equal(safeFileStem("con"), "con_");
assert.equal(safeFileStem("trailing. "), "trailing");
assert.equal(safeFileStem("../etc"), "_etc");
assert.equal(safeFileStem(""), "image");
assert.equal(extOf("ds/image_1.JPEG"), "jpg");
assert.equal(extOf("ds/image_1.png"), "png");
assert.equal(extOf("ds/image_1.webp"), "webp");
assert.equal(extOf("ds/image_1"), "jpg");
{
  const list = [{ n: "Img" }, { n: "img" }, { n: "x" }];
  const st = uniqueStems(list, (i) => i.n);
  assert.deepEqual(list.map((i) => st.get(i)), ["Img", "img_2", "x"]);
}

// ------------------------------------------------------------ zip
assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
const chunks: Uint8Array[] = [];
for await (const c of zipChunks([
  { path: "a.txt", data: new TextEncoder().encode("hi") },
  { path: "d/b.txt", data: async () => new Uint8Array() },
])) chunks.push(c);
const total = Buffer.concat(chunks);
assert.equal(total.readUInt32LE(0), 0x04034b50);
assert.equal(total.readUInt16LE(total.length - 22 + 10), 2);
await assert.rejects(async () => {
  for await (const _ of zipChunks([{ path: "../x", data: new Uint8Array() }])) void _;
});

// ------------------------------------------------------------ planExport (fixture source)
const { planExport } = await import("./build");

const cls = (id: string, index: number, name: string): ClassDef => ({ id, datasetId: "d", name, index, color: "#ffffff" });
const img = (id: string, number: number, status: ImageStatus, ext = "jpg"): ImageRecord => ({
  id, datasetId: "d", name: `image_${number}`, number, storagePath: `d/image_${number}.${ext}`,
  width: 100, height: 100, bytes: 1, status, labeledBy: null, labeledAt: null, createdAt: "",
});

function fixture(images: ImageRecord[], classes: ClassDef[], boxes: Record<string, Array<{ x: number; y: number; w: number; h: number; classId: string }>>): ExportSource {
  return {
    listClasses: async () => classes,
    listImages: async () => images,
    listBoxes: async (ids: string[]) => new Map(ids.filter((i) => boxes[i]).map((i) => [i, boxes[i]])),
    downloadImage: async (p: string) => new TextEncoder().encode(`bytes:${p}`),
  };
}

async function collect(plan: { entries: AsyncGenerator<{ path: string; data: Uint8Array | (() => Promise<Uint8Array>) }> }) {
  const out = new Map<string, string>();
  for await (const e of plan.entries) {
    const d = typeof e.data === "function" ? await e.data() : e.data;
    out.set(e.path, new TextDecoder().decode(d));
  }
  return out;
}

{
  // classes with a gap in idx (0, 5) are re-numbered densely to 0, 1
  const classes = [cls("c5", 5, "dog"), cls("c0", 0, "cat")];
  const images = [
    img("i1", 1, "done"), img("i2", 2, "done", "png"), img("i3", 3, "in_progress"),
    img("i4", 4, "unlabeled"), img("i5", 5, "skipped"), img("i6", 6, "done"),
  ];
  const boxes = {
    i1: [{ x: 0.5, y: 0.5, w: 0.2, h: 0.2, classId: "c5" }, { x: 0.2, y: 0.2, w: 0.1, h: 0.1, classId: "c0" }],
    i3: [{ x: 0.5, y: 0.5, w: 0.2, h: 0.2, classId: "c0" }],
    i5: [{ x: 0.5, y: 0.5, w: 0.2, h: 0.2, classId: "c0" }],
  };
  const src = fixture(images, classes, boxes);

  const done = await planExport("d", src, { seed: 1 });
  assert.equal(done.imageCount, 3);
  assert.equal(done.labelCount, 2);
  const files = await collect(done);
  const paths = [...files.keys()];
  assert.equal(paths[0], "data.yaml");
  assert.match(files.get("data.yaml")!, /nc: 2\nnames:\n  0: "cat"\n  1: "dog"\n/);
  // every image has a sibling label with the same split + stem
  const imgs = paths.filter((p) => p.startsWith("images/"));
  assert.equal(imgs.length, 3);
  for (const p of imgs) {
    const m = /^images\/(train|val|test)\/(image_\d+)\.(jpg|png)$/.exec(p);
    assert.ok(m, p);
    assert.ok(files.has(`labels/${m[1]}/${m[2]}.txt`), `label for ${p}`);
  }
  assert.ok(imgs.some((p) => p.endsWith("image_2.png")));
  const l1 = paths.find((p) => /^labels\/\w+\/image_1\.txt$/.test(p))!;
  assert.equal(files.get(l1), "1 0.500000 0.500000 0.200000 0.200000\n0 0.200000 0.200000 0.100000 0.100000\n");
  const l6 = paths.find((p) => /^labels\/\w+\/image_6\.txt$/.test(p))!;
  assert.equal(files.get(l6), ""); // done with no boxes -> empty background label
  assert.ok(!paths.some((p) => p.includes("image_3") || p.includes("image_5")));
  assert.equal(done.splitCounts.val, 1);

  const all = await planExport("d", src, { seed: 1, status: "all" });
  assert.equal(all.imageCount, 5); // skipped is never exported
  const allFiles = await collect(all);
  assert.ok(![...allFiles.keys()].some((p) => p.includes("image_5")));
  assert.ok([...allFiles.keys()].some((p) => /^labels\/\w+\/image_4\.txt$/.test(p)));

  // a single done image: no val split exists, so data.yaml points val at train
  const one = await planExport("d", fixture([img("x", 9, "done")], classes, {}), {});
  const oneFiles = await collect(one);
  assert.match(oneFiles.get("data.yaml")!, /\nval: images\/train\n/);
  assert.deepEqual([...oneFiles.keys()].sort(), ["data.yaml", "images/train/image_9.jpg", "labels/train/image_9.txt"]);

  // test split only listed when it has images
  const withTest = await planExport("d", src, { status: "all", ratios: { train: 0.6, val: 0.2, test: 0.2 } });
  const wt = await collect(withTest);
  assert.match(wt.get("data.yaml")!, /\ntest: images\/test\n/);
  assert.ok([...wt.keys()].some((p) => p.startsWith("images/test/")));
}

console.log("ok");
