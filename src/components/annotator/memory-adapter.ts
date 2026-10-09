import type { ClassDef, DraftBox, ImageRecord } from "@/lib/types";
import type { AnnotatorAdapter } from "./adapter";

const COLORS = ["#ff5a5f", "#1e90ff", "#2ecc71", "#f5a623", "#9b59b6"];
const NAMES = ["car", "person", "bike", "sign", "other"];

function svgFor(i: number, w: number, h: number): string {
  const hue = (i * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="hsl(${hue},40%,35%)"/><circle cx="${w * 0.3}" cy="${h * 0.4}" r="${h * 0.15}" fill="hsl(${hue},60%,70%)"/><rect x="${w * 0.55}" y="${h * 0.5}" width="${w * 0.25}" height="${h * 0.3}" fill="hsl(${hue},50%,55%)"/><text x="50%" y="12%" font-size="${h * 0.08}" text-anchor="middle" fill="white" font-family="sans-serif">demo ${i + 1}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Demo adapter used until the Supabase-backed one exists. State lives in memory only. */
export function createMemoryAdapter(): AnnotatorAdapter {
  const classes: ClassDef[] = NAMES.map((name, index) => ({
    id: `c${index}`,
    datasetId: "demo",
    name,
    index,
    color: COLORS[index],
  }));
  const images: ImageRecord[] = Array.from({ length: 6 }, (_, i) => ({
    id: `img${i}`,
    datasetId: "demo",
    name: `image_${2103 + i}`,
    number: 2103 + i,
    storagePath: `demo/image_${2103 + i}.jpg`,
    width: i % 2 ? 1280 : 960,
    height: i % 2 ? 720 : 1280,
    bytes: 0,
    status: "unlabeled",
    labeledBy: null,
    labeledAt: null,
    createdAt: new Date(0).toISOString(),
  }));
  const boxes = new Map<string, DraftBox[]>();
  const wait = () => new Promise((r) => setTimeout(r, 120));

  return {
    async loadSession(datasetId) {
      await wait();
      return {
        datasetName: "Demo dataset",
        isAdmin: false,
        classes: classes.map((c) => ({ ...c, datasetId })),
        images: images.map((im) => ({ ...im, datasetId })),
      };
    },
    async loadImage(imageId) {
      await wait();
      const i = images.findIndex((im) => im.id === imageId);
      if (i < 0) throw new Error("Image not found");
      return { url: svgFor(i, images[i].width, images[i].height), boxes: boxes.get(imageId) ?? [] };
    },
    async saveBoxes(imageId, next) {
      await wait();
      boxes.set(imageId, next.map((b) => ({ ...b })));
    },
    async setImageStatus(imageId, status) {
      await wait();
      const im = images.find((x) => x.id === imageId);
      if (im) im.status = status;
    },
    async thumbnailUrls(ids) {
      const out: Record<string, string> = {};
      for (const id of ids) {
        const i = images.findIndex((im) => im.id === id);
        if (i >= 0) out[id] = svgFor(i, images[i].width, images[i].height);
      }
      return out;
    },
  };
}
