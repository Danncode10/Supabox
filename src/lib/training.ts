import "server-only";
import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import "@/lib/yolo-supabase";
import { getExportBackend } from "@/lib/yolo/backend";
import { planExport } from "@/lib/yolo/build";
import { localPath } from "@/lib/local-paths";

/**
 * One-click local training for the Testing tab. Runs Python on the machine serving the app,
 * so it is only enabled for `next dev` on localhost (see localTrainingAllowed). Jobs run as
 * detached processes and report through JSON status files under the gitignored models/ folder.
 */

const run = promisify(execFile);
const ROOT = localPath();
const MODELS = localPath("models");
const VENV_PY = localPath(".venv", "bin", "python");
const SETUP_STATUS = localPath("models", "_setup.json");
const SETUP_LOG = localPath("models", "_setup.log");
const PIP = "pip install --timeout 120 --retries 10 ultralytics onnx onnxslim";

export type SetupState = {
  /** python3 found on PATH. */
  python: boolean;
  /** .venv exists and imports ultralytics + onnx. */
  ready: boolean;
  job: "idle" | "running" | "error";
  message?: string;
};

export type TrainState = {
  state: "idle" | "preparing" | "training" | "exporting" | "done" | "error" | "stopped";
  epoch?: number;
  epochs?: number;
  mAP50?: number | null;
  images?: number;
  /** While preparing: files written so far out of `total`. */
  prepared?: number;
  total?: number;
  device?: string;
  message?: string;
  startedAt?: string;
  updatedAt?: string;
  pid?: number;
};

/** Spawning processes from a route is only acceptable on the developer's own machine. */
export function localTrainingAllowed(request: Request): boolean {
  if (process.env.NODE_ENV !== "development" && process.env.SUPABOX_LOCAL_TRAINING !== "1") return false;
  // request.url reports the bind address (0.0.0.0) under next dev; the Host header is what the browser used.
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function alive(pid?: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function tail(file: string, lines = 6): Promise<string> {
  try {
    const text = await readFile(file, "utf8");
    return text.trim().split(/\r?\n/).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

let readyCache: { at: number; ready: boolean } | null = null;

async function venvReady(): Promise<boolean> {
  if (readyCache && Date.now() - readyCache.at < 30_000) return readyCache.ready;
  let ready = false;
  try {
    await stat(VENV_PY);
    await run(VENV_PY, ["-c", "import ultralytics, onnx"], { timeout: 60_000 });
    ready = true;
  } catch {
    ready = false;
  }
  readyCache = { at: Date.now(), ready };
  return ready;
}

async function hasPython(): Promise<boolean> {
  try {
    await run("python3", ["--version"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

export async function setupState(): Promise<SetupState> {
  const job = await readJson<{ pid?: number; state: string; message?: string }>(SETUP_STATUS);
  const running = job?.state === "running" && alive(job.pid);
  if (running) return { python: true, ready: false, job: "running", message: await tail(SETUP_LOG, 1) };
  readyCache = job?.state === "running" ? null : readyCache; // just finished: re-check
  const [python, ready] = await Promise.all([hasPython(), venvReady()]);
  if (!ready && job && job.state !== "idle") {
    return { python, ready, job: "error", message: (await tail(SETUP_LOG, 4)) || job.message || "Setup did not finish" };
  }
  return { python, ready, job: "idle" };
}

/** python3 -m venv .venv && pip install ..., detached, logged to models/_setup.log. */
export async function startSetup(): Promise<void> {
  const cur = await readJson<{ pid?: number; state: string }>(SETUP_STATUS);
  if (cur?.state === "running" && alive(cur.pid)) return;
  await mkdir(MODELS, { recursive: true });
  const log = createWriteStream(SETUP_LOG, { flags: "w" });
  await new Promise((r) => log.once("open", r));
  const child = spawn("/bin/sh", ["-c", `python3 -m venv .venv && .venv/bin/${PIP}`], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", log, log],
  });
  readyCache = null;
  await writeFile(SETUP_STATUS, JSON.stringify({ state: "running", pid: child.pid, startedAt: new Date().toISOString() }));
  child.on("exit", (code) => {
    readyCache = null;
    void writeFile(SETUP_STATUS, JSON.stringify({ state: code === 0 ? "idle" : "error", message: `exit ${code}` }));
  });
  child.unref();
}

function dir(datasetId: string) {
  return localPath("models", datasetId.toLowerCase());
}

export async function trainState(datasetId: string): Promise<TrainState> {
  const d = dir(datasetId);
  const s = await readJson<TrainState>(path.join(d, "train-status.json"));
  if (!s) return { state: "idle" };
  if ((s.state === "training" || s.state === "exporting") && !alive(s.pid)) {
    return { ...s, state: "error", message: (await tail(path.join(d, "train.log"), 4)) || "Training stopped unexpectedly" };
  }
  return s;
}

async function writeState(datasetId: string, s: TrainState) {
  await mkdir(dir(datasetId), { recursive: true });
  await writeFile(path.join(dir(datasetId), "train-status.json"), JSON.stringify({ ...s, updatedAt: new Date().toISOString() }));
}

/**
 * Writes the dataset's done images + labels to models/<id>/data (same layout as the YOLOv8 zip),
 * then starts scripts/train_local.py in the background. Must be called inside the request,
 * because reading the dataset uses the signed-in user's cookies.
 */
export async function startTraining(datasetId: string, epochs: number): Promise<TrainState> {
  const cur = await trainState(datasetId);
  if (cur.state === "preparing" || ((cur.state === "training" || cur.state === "exporting") && alive(cur.pid))) {
    throw new Error("Training is already running for this dataset");
  }
  if (!(await venvReady())) throw new Error("YOLO is not installed yet. Click Set up first.");

  const backend = await getExportBackend();
  if (!backend) throw new Error("Export backend is not configured");
  const startedAt = new Date().toISOString();
  await writeState(datasetId, { state: "preparing", startedAt, message: "Writing images and labels" });

  const d = dir(datasetId);
  const dataDir = path.join(d, "data");
  try {
    const plan = await planExport(datasetId, backend, { status: "done" });
    if (plan.imageCount === 0) throw new Error("No images are marked done yet");
    await rm(dataDir, { recursive: true, force: true });
    const total = plan.imageCount * 2 + 1; // each image, its label file, and data.yaml
    let prepared = 0;
    for await (const entry of plan.entries) {
      const file = path.join(dataDir, entry.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, typeof entry.data === "function" ? await entry.data() : entry.data);
      prepared++;
      if (prepared % 4 === 0 || prepared === total) {
        await writeState(datasetId, { state: "preparing", startedAt, images: plan.imageCount, prepared, total, message: "Downloading your images" });
      }
    }

    const statusFile = path.join(d, "train-status.json");
    const log = createWriteStream(path.join(d, "train.log"), { flags: "w" });
    await new Promise((r) => log.once("open", r));
    const child = spawn(
      VENV_PY,
      ["scripts/train_local.py", "--dataset", datasetId, "--data-dir", dataDir, "--status-file", statusFile, "--epochs", String(epochs)],
      { cwd: ROOT, detached: true, stdio: ["ignore", log, log], env: { ...process.env, PYTHONUNBUFFERED: "1" } },
    );
    const state: TrainState = { state: "training", epoch: 0, epochs, images: plan.imageCount, startedAt, pid: child.pid, message: "Starting" };
    await writeState(datasetId, state);
    child.on("exit", async (code) => {
      const now = await readJson<TrainState>(statusFile);
      if (code !== 0 && now && now.state !== "error" && now.state !== "stopped") {
        await writeState(datasetId, { ...now, state: "error", message: (await tail(path.join(d, "train.log"), 4)) || `exit ${code}` });
      }
    });
    child.unref();
    return state;
  } catch (e) {
    const failed: TrainState = { state: "error", startedAt, message: (e as Error).message };
    await writeState(datasetId, failed);
    throw e;
  }
}

export async function stopTraining(datasetId: string): Promise<void> {
  const s = await trainState(datasetId);
  if (s.pid && alive(s.pid)) {
    try {
      process.kill(-s.pid, "SIGTERM"); // detached: the whole process group (dataloader workers too)
    } catch {
      process.kill(s.pid, "SIGTERM");
    }
  }
  await writeState(datasetId, { ...s, state: "stopped", message: "Stopped" });
}
