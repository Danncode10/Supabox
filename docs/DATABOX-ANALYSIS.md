# Databox analysis: reused vs redesigned

Old repo (`inspirations/databox`): fork of SkalskiP/make-sense, React + TypeScript + Vite + Redux, GPL-3.0, localhost-first with local folders, no auth. Its MASTERPLAN's "Future Direction" note (Supabase cloud mode, reset after export, `image_2103` naming, mobile) is exactly what Supabox now is.

## Reuse (concepts, not code)
| Databox | Supabox |
|---|---|
| `RectLabelsExporter.wrapRectLabelIntoYOLO`: center xywh normalized by image size, clamped to [0,1], 6 decimals, class index from label list | Same math, but boxes are stored already normalized so export is a string format step on the server |
| YOLO output = `images/`, `labels/`, `data.yaml`; JSON annotations are the editable source of truth and YOLO is generated | Same: Postgres rows are the source of truth, YOLO ZIP generated on demand |
| train/val/test splits | Kept (train/val default, test optional) |
| Class list with ordered ids | `classes.idx` contiguous per dataset |
| Bbox-only focus for the thesis workflow | Bbox-only v1 |
| Reset after export + custom start number (planning note) | First-class features |

## Drop
- Redux store, singleton `ContextManager`/render-engine/`ImageRepository` layers, SCSS views.
- Polygon, line, point, tag labels; VOC/COCO/CSV import/export; TensorFlow SSD/YOLOv5/PoseNet and Roboflow AI; Make Sense landing page and social/marketing views.
- Local folder dataset layer and GPL fork lineage (Supabox is a fresh codebase; no upstream code copied, only the YOLO format concept).

## Redesign
- Storage: browser memory / local folders -> Supabase Postgres + private Storage bucket with free-tier budgeting.
- Coordinates: pixel rects -> normalized xywh on disk, independent of display resolution.
- Editor: desktop mouse canvas -> Pointer Events touch canvas (pinch/pan, big handles, bottom sheet class picker, autosave).
- Identity: none -> email-allowlist auth with admin/labeler roles under RLS.
- Admin tooling: upload with auto-naming, usage meter, user invites, export, reset.
- Framework: Vite SPA -> Next.js 16 App Router (Proxy, async `params`, Route Handlers) on Vercel.
