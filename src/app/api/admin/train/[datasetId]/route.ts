import { fail, ok, requireAdmin } from "@/lib/supabase/api";
import { UUID_RE } from "@/lib/supabase/images";
import {
  localTrainingAllowed, setupState, startSetup, startTraining, stopTraining, trainState,
  type SetupState, type TrainState,
} from "@/lib/training";

export const maxDuration = 300;

export type TrainingStatus =
  | { allowed: false }
  | { allowed: true; setup: SetupState; train: TrainState };

async function guard(request: Request, ctx: { params: Promise<{ datasetId: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { datasetId } = await ctx.params;
  if (!UUID_RE.test(datasetId)) return fail(422, "invalid_dataset", "Invalid dataset id");
  return { datasetId, allowed: localTrainingAllowed(request) };
}

/** GET -> ApiResult<TrainingStatus>. Polled by the Testing tab while a job runs. */
export async function GET(request: Request, ctx: { params: Promise<{ datasetId: string }> }) {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  if (!g.allowed) return ok<TrainingStatus>({ allowed: false });
  const train = await trainState(g.datasetId);
  // A running training job proves YOLO is installed; skip the slow import probe while it runs.
  const running = train.state === "preparing" || train.state === "training" || train.state === "exporting";
  const setup: SetupState = running ? { python: true, ready: true, job: "idle" } : await setupState();
  return ok<TrainingStatus>({ allowed: true, setup, train });
}

/** POST { action: "setup" | "train" | "stop", epochs? } -> ApiResult<TrainingStatus> */
export async function POST(request: Request, ctx: { params: Promise<{ datasetId: string }> }) {
  const g = await guard(request, ctx);
  if (g instanceof Response) return g;
  if (!g.allowed) return fail(403, "local_only", "Training runs only on localhost with npm run dev");
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  try {
    if (action === "setup") await startSetup();
    else if (action === "train") {
      const epochs = Number.isInteger(body?.epochs) ? Math.min(300, Math.max(1, body.epochs)) : 50;
      await startTraining(g.datasetId, epochs);
    } else if (action === "stop") await stopTraining(g.datasetId);
    else return fail(422, "invalid_action", "action must be setup, train or stop");
  } catch (e) {
    return fail(409, "training_failed", (e as Error).message);
  }
  // Training only starts once YOLO is installed, so skip the slow "can Python import it" probe.
  const train = await trainState(g.datasetId);
  const setup: SetupState = action === "setup" ? await setupState() : { python: true, ready: true, job: "idle" };
  return ok<TrainingStatus>({ allowed: true, setup, train });
}
