#!/usr/bin/env python3
"""Train a YOLOv8 model locally from a Supabox export, for the Testing tab.

    pip install ultralytics onnx
    python3 scripts/train_local.py ~/Downloads/Joshua.zip --dataset <dataset-id>

Unzips the export into models/<dataset-id>/data, trains on the fastest local device
(Apple GPU "mps", then CUDA, then CPU), exports best.pt to ONNX and writes
models/<dataset-id>/best.onnx + meta.json. models/ is gitignored. Open the dataset's
Testing tab on localhost and the model loads automatically.
"""
import argparse
import json
import os
import re
import shutil
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def pick_device() -> str:
    import torch

    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "0"
    return "cpu"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("zip", type=Path, nargs="?", help="YOLOv8 .zip downloaded from the Export tab")
    ap.add_argument("--data-dir", type=Path, help="already-unpacked dataset folder (used by the Train button)")
    ap.add_argument("--status-file", type=Path, help="write JSON progress here (used by the Train button)")
    ap.add_argument("--dataset", required=True, help="dataset id (shown in the Testing tab)")
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--model", default="yolov8n.pt", help="starting weights; yolov8n is fastest for live video")
    ap.add_argument("--device", default=None, help="override: mps, cpu, 0 ...")
    args = ap.parse_args()

    if not UUID.match(args.dataset):
        sys.exit("--dataset must be the dataset id (a UUID), shown in the Testing tab")
    out = ROOT / "models" / args.dataset.lower()
    status_file = args.status_file.resolve() if args.status_file else None
    if args.data_dir:
        args.data_dir = args.data_dir.resolve()
    if args.zip:
        args.zip = args.zip.expanduser().resolve()
    # Ultralytics downloads base weights (yolov8n.pt, AMP check models) into the working
    # directory; keep them in the gitignored models/ folder instead of the repo root.
    (ROOT / "models").mkdir(exist_ok=True)
    os.chdir(ROOT / "models")

    def status(**fields):
        if not status_file:
            return
        cur = {}
        try:
            cur = json.loads(status_file.read_text())
        except Exception:
            pass
        cur.update(fields, updatedAt=time.strftime("%Y-%m-%dT%H:%M:%S%z"))
        tmp = status_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(cur))
        tmp.replace(status_file)

    if args.data_dir:
        data_dir = args.data_dir.resolve()
    else:
        if not args.zip or not args.zip.is_file():
            sys.exit(f"zip not found: {args.zip}")
        data_dir = out / "data"
        shutil.rmtree(data_dir, ignore_errors=True)
        data_dir.mkdir(parents=True)
        with zipfile.ZipFile(args.zip) as z:
            z.extractall(data_dir)
    try:
        from ultralytics import YOLO
    except ImportError:
        status(state="error", message="YOLO is not installed. Click Set up first.")
        sys.exit("ultralytics is not installed. Run: pip install ultralytics onnx")

    # The export's data.yaml says `path: .` (relative to the shell's folder). Pin it absolute.
    yaml_path = data_dir / "data.yaml"
    text = yaml_path.read_text()
    text = re.sub(r"(?m)^path:.*$", f"path: {json.dumps(str(data_dir))}", text, count=1)
    yaml_path.write_text(text)

    device = args.device or pick_device()
    print(f"Training {args.model} for {args.epochs} epochs on {device} ...")
    status(state="training", epoch=0, epochs=args.epochs, device=device, message=f"Training on {device}")
    model = YOLO(args.model)

    def on_epoch_end(trainer):
        m = getattr(trainer, "metrics", {}) or {}
        status(state="training", epoch=min(trainer.epoch + 1, trainer.epochs), epochs=trainer.epochs, mAP50=m.get("metrics/mAP50(B)"))

    model.add_callback("on_fit_epoch_end", on_epoch_end)
    results = model.train(
        data=str(yaml_path), epochs=args.epochs, imgsz=args.imgsz, device=device,
        project=str(out / "runs"), name="train", exist_ok=True, plots=False,
    )
    best = Path(model.trainer.best)

    print("Exporting to ONNX ...")
    status(state="exporting", message="Converting the model for the browser")
    onnx_path = Path(YOLO(str(best)).export(format="onnx", imgsz=args.imgsz, opset=12, simplify=True))
    shutil.copyfile(onnx_path, out / "best.onnx")

    trained = YOLO(str(best))
    names = [trained.names[i] for i in sorted(trained.names)]
    metrics = getattr(results, "results_dict", {}) or {}
    meta = {
        "names": names,
        "imgsz": args.imgsz,
        "baseModel": args.model,
        "epochs": args.epochs,
        "device": device,
        "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "mAP50": metrics.get("metrics/mAP50(B)"),
        "mAP50_95": metrics.get("metrics/mAP50-95(B)"),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    status(state="done", message="Model ready", mAP50=meta["mAP50"])
    print(f"\nDone: {out / 'best.onnx'}\nOpen the dataset's Testing tab on localhost to try it.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except BaseException as e:  # surface crashes to the Train button
        if "--status-file" in sys.argv:
            f = Path(sys.argv[sys.argv.index("--status-file") + 1])
            f.write_text(json.dumps({"state": "error", "message": f"{type(e).__name__}: {e}"[:500]}))
        raise
