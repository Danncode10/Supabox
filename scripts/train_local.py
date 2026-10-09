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
    ap.add_argument("zip", type=Path, help="YOLOv8 .zip downloaded from the Export tab")
    ap.add_argument("--dataset", required=True, help="dataset id (shown in the Testing tab)")
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--model", default="yolov8n.pt", help="starting weights; yolov8n is fastest for live video")
    ap.add_argument("--device", default=None, help="override: mps, cpu, 0 ...")
    args = ap.parse_args()

    if not UUID.match(args.dataset):
        sys.exit("--dataset must be the dataset id (a UUID), shown in the Testing tab")
    if not args.zip.is_file():
        sys.exit(f"zip not found: {args.zip}")
    try:
        from ultralytics import YOLO
    except ImportError:
        sys.exit("ultralytics is not installed. Run: pip install ultralytics onnx")

    out = ROOT / "models" / args.dataset.lower()
    data_dir = out / "data"
    shutil.rmtree(data_dir, ignore_errors=True)
    data_dir.mkdir(parents=True)
    with zipfile.ZipFile(args.zip) as z:
        z.extractall(data_dir)

    # The export's data.yaml says `path: .` (relative to the shell's folder). Pin it absolute.
    yaml_path = data_dir / "data.yaml"
    text = yaml_path.read_text()
    text = re.sub(r"(?m)^path:.*$", f"path: {json.dumps(str(data_dir))}", text, count=1)
    yaml_path.write_text(text)

    device = args.device or pick_device()
    print(f"Training {args.model} for {args.epochs} epochs on {device} ...")
    model = YOLO(args.model)
    results = model.train(
        data=str(yaml_path), epochs=args.epochs, imgsz=args.imgsz, device=device,
        project=str(out / "runs"), name="train", exist_ok=True, plots=False,
    )
    best = Path(model.trainer.best)

    print("Exporting to ONNX ...")
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
    print(f"\nDone: {out / 'best.onnx'}\nOpen the dataset's Testing tab on localhost to try it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
