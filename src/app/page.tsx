import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Download,
  Gauge,
  Images,
  ScanSearch,
  Settings2,
  Smartphone,
  Tags,
} from "lucide-react";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Marquee } from "@/components/ui/marquee";
import { Meteors } from "@/components/ui/meteors";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  {
    icon: Smartphone,
    title: "Built for thumbs",
    body: "Draw, nudge and relabel boxes on a phone with 48px targets and pinch zoom.",
  },
  {
    icon: Tags,
    title: "Contiguous classes",
    body: "Class indices stay 0..N-1 so every export drops straight into YOLOv8 training.",
  },
  {
    icon: Gauge,
    title: "Free-tier aware",
    body: "Live storage and database meters warn you before uploads are blocked.",
  },
] as const;

const TAGS = [
  "YOLOv8 export",
  "Supabase Storage",
  "Row level security",
  "Email code sign-in",
  "Touch-first canvas",
  "Image compression",
  "Per-dataset naming",
  "Progress tracking",
];

/** Brand mark: signal square with a corner-bracket crop. */
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground [box-shadow:var(--inset-highlight),var(--elev-xs)]">
        <ScanSearch className="size-4.5" aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-tight">Supabox</span>
    </Link>
  );
}

async function HeaderActions() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return null;
  return (
    <Button asChild variant="outline" size="default">
      <Link href="/admin">
        <Settings2 aria-hidden />
        Admin
      </Link>
    </Button>
  );
}

/** Static annotation mock: decorative only. */
function CanvasPreview() {
  return (
    <div
      aria-hidden
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-card [box-shadow:var(--inset-highlight),var(--elev-lg)]"
    >
      <GridPattern
        width={28}
        height={28}
        className="mask-[linear-gradient(to_bottom,white,transparent_85%)] fill-transparent stroke-foreground/8"
      />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-primary/10 to-transparent" />

      <div className="absolute left-[8%] top-[22%] h-[44%] w-[38%] rounded-md border-2 border-primary bg-primary/10">
        <span className="absolute -top-6 left-[-2px] rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary-foreground">
          0 car 0.94
        </span>
      </div>
      <div className="absolute right-[10%] top-[14%] h-[30%] w-[26%] rounded-md border-2 border-info bg-info/10">
        <span className="absolute -top-6 left-[-2px] rounded-sm bg-info px-1.5 py-0.5 font-mono text-[11px] font-medium text-info-foreground">
          1 sign 0.88
        </span>
      </div>
      <div className="absolute bottom-[12%] right-[18%] h-[26%] w-[30%] rounded-md border-2 border-warning bg-warning/10">
        <span className="absolute -top-6 left-[-2px] rounded-sm bg-warning px-1.5 py-0.5 font-mono text-[11px] font-medium text-warning-foreground">
          2 cone 0.91
        </span>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg border border-border bg-popover/90 px-3 py-2 backdrop-blur-sm">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">image_0042.jpg</span>
        <Badge variant="success" dot>3 boxes</Badge>
      </div>
      <BorderBeam size={120} duration={9} borderWidth={1.5} />
    </div>
  );
}

async function DatasetPicker() {
  const supabase = await createClient();
  const { data: datasets, error } = await supabase
    .from("datasets")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <EmptyState
        icon={<Boxes />}
        title="Could not load datasets"
        description={error.message}
      />
    );
  }

  if (!datasets || datasets.length === 0) {
    return (
      <EmptyState
        icon={<Images />}
        title="No datasets yet"
        description="An admin needs to create a dataset and upload images before labeling can start."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {datasets.map((d, i) => (
        <li key={d.id}>
          <BlurFade delay={i * 0.05}>
            <Link
              href={`/label/${d.id}`}
              className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 outline-none transition-[transform,background-color,border-color] duration-150 ease-out-strong [box-shadow:var(--inset-highlight),var(--elev-xs)] hover:border-input hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.98]"
            >
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="truncate text-base font-semibold tracking-tight">{d.name}</span>
                <Badge
                  variant={d.status === "active" ? "success" : d.status === "exported" ? "info" : "neutral"}
                  dot
                  pulse={d.status === "active"}
                >
                  {d.status}
                </Badge>
              </span>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
          </BlurFade>
        </li>
      ))}
    </ul>
  );
}

function DatasetPickerSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-160 overflow-hidden">
        <GridPattern
          width={44}
          height={44}
          className="mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,white,transparent)] fill-transparent stroke-foreground/6"
        />
        <div className="absolute left-1/2 top-[-12rem] size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <Meteors number={10} />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <Suspense fallback={<Skeleton className="h-10 w-24 rounded-lg" />}>
          <HeaderActions />
        </Suspense>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-4 pb-20 pt-8 sm:px-6 md:pt-16">
        {/* Hero */}
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]" aria-labelledby="hero-h">
          <div className="flex flex-col items-start gap-6">
            <BlurFade>
              <Badge variant="default" dot pulse>
                YOLO annotation, on any device
              </Badge>
            </BlurFade>
            <BlurFade delay={0.05}>
              <h1 id="hero-h" className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Label images fast.
                <br />
                Ship <AnimatedGradientText>training-ready</AnimatedGradientText> datasets.
              </h1>
            </BlurFade>
            <BlurFade delay={0.1}>
              <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Supabox is a small team annotation workspace. Upload photos, draw boxes with your thumbs,
                track progress and export a clean YOLOv8 ZIP, all inside the Supabase free tier.
              </p>
            </BlurFade>
            <BlurFade delay={0.15} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href="#datasets">
                  Start labeling
                  <ArrowRight aria-hidden />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href="#how">
                  <Download aria-hidden />
                  How it works
                </a>
              </Button>
            </BlurFade>
          </div>

          <BlurFade delay={0.2} direction="left" offset={12}>
            <CanvasPreview />
          </BlurFade>
        </section>

        {/* Datasets */}
        <section id="datasets" className="flex scroll-mt-8 flex-col gap-5" aria-labelledby="ds-h">
          <div className="flex flex-col gap-1">
            <h2 id="ds-h" className="text-2xl font-semibold tracking-tight">Pick a dataset</h2>
            <p className="text-sm text-muted-foreground">Open one to continue where the queue left off.</p>
          </div>
          <Suspense fallback={<DatasetPickerSkeleton />}>
            <DatasetPicker />
          </Suspense>
        </section>

        {/* Features */}
        <section id="how" className="flex scroll-mt-8 flex-col gap-8" aria-labelledby="how-h">
          <h2 id="how-h" className="text-2xl font-semibold tracking-tight">From phone to training run</h2>
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="bg-card p-6">
                <BlurFade delay={i * 0.06} inView className="flex flex-col gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/12 text-primary">
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </BlurFade>
              </li>
            ))}
          </ul>

          <Marquee pauseOnHover className="[--duration:36s] [--gap:0.75rem] mask-[linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]">
            {TAGS.map((t) => (
              <Badge key={t} variant="outline" className="px-3 py-1.5 text-sm">
                {t}
              </Badge>
            ))}
          </Marquee>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>Supabox</span>
          <span className="font-mono text-xs">YOLOv8 / Supabase</span>
        </div>
      </footer>
    </div>
  );
}
