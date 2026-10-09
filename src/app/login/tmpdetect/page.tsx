"use client";
import { useEffect, useState } from "react";
import { YoloRunner } from "@/components/admin/yolo-runner";
export default function Page() {
  const [out, setOut] = useState("running");
  useEffect(() => {
    (async () => {
      try {
        const model = await (await fetch("http://127.0.0.1:8918/m.onnx")).arrayBuffer();
        const r = await YoloRunner.create(model, 640);
        const img = new Image(); img.src = "http://127.0.0.1:8918/bus.jpg"; img.crossOrigin = "anonymous"; await img.decode();
        const { detections, ms } = await r.detect(img, img.naturalWidth, img.naturalHeight, 0.4);
        const again = await r.detect(img, img.naturalWidth, img.naturalHeight, 0.4);
        setOut(JSON.stringify({ backend: r.backend, ms: Math.round(ms), warmMs: Math.round(again.ms), dets: detections.map(d => [d.classIndex, +d.score.toFixed(2), Math.round(d.x), Math.round(d.y), Math.round(d.x + d.w), Math.round(d.y + d.h)]) }));
      } catch (e) { setOut("ERR " + (e as Error).message); }
    })();
  }, []);
  return <pre id="out">{out}</pre>;
}
