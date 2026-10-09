// Run: npm run test:detect
import assert from "node:assert/strict";
// @ts-expect-error node strip-types needs the .ts extension
import { decodeYolov8, letterbox, nms, toChw } from "./detect.ts";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// Letterbox: a 1280x960 image into 640 scales by 0.5 and pads 80px top and bottom.
const lb = letterbox(1280, 960, 640);
close(lb.scale, 0.5);
close(lb.padX, 0);
close(lb.padY, 80);

// CHW layout: one red pixel then one blue pixel.
const chw = toChw(new Uint8ClampedArray([255, 0, 0, 255]), 1);
assert.deepEqual(Array.from(chw), [1, 0, 0]);
assert.equal(chw[0], 1);

// Decode: 2 classes, 3 anchors. Anchor 0 = class 1 at 0.9; anchor 1 overlaps it (suppressed);
// anchor 2 below confidence.
const n = 3;
const rows = 4 + 2;
const data = new Float32Array(rows * n);
const set = (row: number, i: number, v: number) => (data[row * n + i] = v);
// cx, cy, w, h in letterboxed pixels
[[320, 320, 100, 100], [322, 321, 100, 100], [100, 100, 10, 10]].forEach(([cx, cy, w, h], i) => {
  set(0, i, cx); set(1, i, cy); set(2, i, w); set(3, i, h);
});
set(5, 0, 0.9); set(5, 1, 0.8); set(4, 2, 0.1);
const dets = decodeYolov8(data, { dims: [1, rows, n], box: lb, srcW: 1280, srcH: 960 });
assert.equal(dets.length, 1);
assert.equal(dets[0].classIndex, 1);
close(dets[0].score, 0.9);
// (320-0)/0.5 = 640 center x, (320-80)/0.5 = 480 center y, 200x200 source box
close(dets[0].x, 540);
close(dets[0].y, 380);
close(dets[0].w, 200);
close(dets[0].h, 200);

// NMS keeps overlapping boxes of different classes.
const a = { classIndex: 0, score: 0.9, x: 0, y: 0, w: 10, h: 10 };
assert.equal(nms([a, { ...a, classIndex: 1, score: 0.8 }], 0.45).length, 2);
assert.equal(nms([a, { ...a, score: 0.8 }], 0.45).length, 1);

assert.throws(() => decodeYolov8(new Float32Array(4), { dims: [1, 4, 1], box: lb, srcW: 1, srcH: 1 }));
console.log("ok");
