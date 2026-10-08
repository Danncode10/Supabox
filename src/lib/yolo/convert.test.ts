// Run: node --experimental-strip-types src/lib/yolo/convert.test.ts
import assert from "node:assert/strict";
// @ts-expect-error node strip-types needs the .ts extension
import { boxToYoloLine, boxesToLabelText } from "./convert.ts";
// @ts-expect-error node strip-types needs the .ts extension
import { assignSplits, buildDataYaml } from "./split.ts";
// @ts-expect-error node strip-types needs the .ts extension
import { crc32, zipChunks } from "./zip.ts";

// basic formatting
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 0.25, h: 0.5 }, 2), "2 0.500000 0.500000 0.250000 0.500000");
// clamping: box overhanging the right edge shrinks and recenters
assert.equal(boxToYoloLine({ x: 0.95, y: 0.5, w: 0.2, h: 0.2 }, 0), "0 0.925000 0.500000 0.150000 0.200000");
// fully outside / zero area / NaN / bad class
assert.equal(boxToYoloLine({ x: 1.5, y: 0.5, w: 0.1, h: 0.1 }, 0), null);
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 0, h: 0.1 }, 0), null);
assert.equal(boxToYoloLine({ x: NaN, y: 0.5, w: 0.1, h: 0.1 }, 0), null);
assert.equal(boxToYoloLine({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, -1), null);
// empty label text and unknown class skipped
const idx = new Map([["a", 0]]);
assert.equal(boxesToLabelText([], idx), "");
assert.equal(boxesToLabelText([{ x: 0.5, y: 0.5, w: 0.1, h: 0.1, classId: "zz" }], idx), "");
assert.equal(
  boxesToLabelText([{ x: 0.5, y: 0.5, w: 0.1, h: 0.1, classId: "a" }], idx),
  "0 0.500000 0.500000 0.100000 0.100000\n",
);

// split determinism and order independence
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

// yaml
assert.equal(
  buildDataYaml(["cat", "dog"], false),
  'path: .\ntrain: images/train\nval: images/val\nnc: 2\nnames: ["cat", "dog"]\n',
);

// crc32 known value
assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);

// zip: collect and verify signature/entry count
const chunks: Uint8Array[] = [];
for await (const c of zipChunks([
  { path: "a.txt", data: new TextEncoder().encode("hi") },
  { path: "d/b.txt", data: async () => new Uint8Array() },
])) chunks.push(c);
const total = Buffer.concat(chunks);
assert.equal(total.readUInt32LE(0), 0x04034b50);
assert.equal(total.readUInt16LE(total.length - 22 + 10), 2);
console.log("ok");
