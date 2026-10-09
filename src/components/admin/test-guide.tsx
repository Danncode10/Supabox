"use client";

import { useState } from "react";
import { Check, ChevronRight, CircleHelp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const SETUP = [
  "cd ~/Desktop/Supabox",
  "python3 -m venv .venv",
  "source .venv/bin/activate",
  "pip install --timeout 120 --retries 10 ultralytics onnx onnxslim",
].join("\n");

/** Multi-line command block that wraps instead of scrolling sideways, with one copy button. */
function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg border border-border bg-background">
      <pre className="whitespace-pre-wrap break-words py-3 pl-4 pr-12 font-mono text-xs leading-relaxed text-foreground">
        {text.split("\n").map((line) => (
          <span key={line} className="block">
            <span className="select-none text-muted-foreground">$ </span>
            {line}
          </span>
        ))}
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute right-1.5 top-1.5"
        aria-label={copied ? "Copied" : "Copy commands"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked; text is still selectable */
          }
        }}
      >
        {copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
      </Button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <h3 className="font-semibold leading-tight">{title}</h3>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

const code = "whitespace-nowrap rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground";

/** Step-by-step guide: export, set up Python once, train locally, then test here. */
export function TestGuide({ trainCmd }: { trainCmd: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="md:h-10">
          <CircleHelp aria-hidden />
          How to use
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl grid-cols-[minmax(0,1fr)] gap-6">
        <DialogHeader>
          <DialogTitle>Train and test your model</DialogTitle>
          <DialogDescription>
            Train a YOLOv8 model on this Mac from your labels, then test it here on a photo or live camera.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-6">
          <Step n={1} title="Download the dataset">
            <p>
              Open the <strong className="text-foreground">Export</strong> tab and click <strong className="text-foreground">Download YOLOv8 .zip</strong>.
              Leave it zipped in Downloads.
            </p>
          </Step>

          <Step n={2} title="Install YOLO (first time only)">
            <p>Open Terminal (⌘ Space, type Terminal), paste these and press Return:</p>
            <CodeBlock text={SETUP} />
            <p>Downloads PyTorch (about 1 GB), so give it a few minutes.</p>
          </Step>

          <Step n={3} title="Train">
            <p>In the same Terminal window:</p>
            <CodeBlock text={trainCmd} />
            <p>
              Uses your Mac&apos;s GPU; about 5 to 15 minutes for 40 images on an M1. Wait for <code className={code}>Done: …/best.onnx</code>.
            </p>
          </Step>

          <Step n={4} title="Test it here">
            <p>
              Click <strong className="text-foreground">Reload local model</strong>, then use <strong className="text-foreground">Photo</strong> or{" "}
              <strong className="text-foreground">Live camera</strong>. Missing detections? Lower the confidence slider. Wrong boxes? Raise it.
            </p>
          </Step>
        </ol>

        <details className="group rounded-xl border border-border text-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-90" aria-hidden />
            Troubleshooting
          </summary>
          <ul className="list-disc space-y-2 px-4 pb-4 pl-9 text-muted-foreground">
            <li><strong className="text-foreground">pip times out:</strong> just run the install command again. It resumes where it stopped.</li>
            <li><strong className="text-foreground">&quot;ultralytics is not installed&quot;:</strong> you are outside the venv. Run <code className={code}>source .venv/bin/activate</code>.</li>
            <li><strong className="text-foreground">Shows CPU (WASM), not WebGPU:</strong> use Chrome for the fastest live camera. Safari still works, just slower.</li>
            <li><strong className="text-foreground">Camera blocked:</strong> click the camera icon in the address bar, allow it, then press Start camera again.</li>
            <li><strong className="text-foreground">It detects other people as your class:</strong> the model has only seen one kind of thing. Add photos that also contain other people or objects, box only your class, export and train again.</li>
            <li><strong className="text-foreground">Testing on another computer or the live site:</strong> the <code className={code}>models/</code> folder only exists on this Mac. Use <strong className="text-foreground">Choose .onnx file</strong> and pick <code className={code}>models/&lt;dataset&gt;/best.onnx</code>.</li>
            <li><strong className="text-foreground">New Terminal window:</strong> run <code className={code}>cd ~/Desktop/Supabox</code> and <code className={code}>source .venv/bin/activate</code> before training again.</li>
            <li><strong className="text-foreground">Zip has another name:</strong> change the <code className={code}>~/Downloads/….zip</code> path in the train command.</li>
          </ul>
        </details>
      </DialogContent>
    </Dialog>
  );
}
