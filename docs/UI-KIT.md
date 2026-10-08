# Supabox UI Kit

Dark-first, cool near-black neutrals with one lime accent ("signal"). Primitives follow shadcn conventions (slots, `cn()`, cva variants); animated pieces are ported from the Magic UI registry (`inspirations/ui-components/magicui`). Everything lives in `src/components/ui/`, imported as `@/components/ui/<name>`.

## Dependencies added

`motion`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `radix-ui` (unified Radix primitives: Dialog, Tabs, Progress, Label, Slot), `tw-animate-css`.

## Usage rules

1. Semantic tokens only: `bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-danger`. No `dark:` variants, no raw `zinc-*`/`red-*`/`emerald-*` classes. Tokens flip with the theme automatically.
2. Use `cn()` from `@/lib/utils` for conditional classes. Use `flex gap-*` / `grid gap-*`, not `space-*`.
3. One accent. `primary` is the only brand color; status colors (`success`, `warning`, `danger`, `info`) are for state only.
4. Labels sit above inputs (use `Field`). Errors below. Inputs are 44px tall on touch, 40px at `md+`; `size="lg"` buttons are 48px.
5. Every list/data surface needs loading (`Skeleton` sized to content), empty (`EmptyState`) and error (`Alert variant="danger"`) states. No toasts.
6. Motion: ease-out only (`ease-out-strong`), under 300ms for UI, `active:scale-[0.97]` on pressables. Do not animate things used 100+ times a day (annotator canvas, shortcuts). Decorative components are static or hidden under `prefers-reduced-motion`; the root layout wraps the app in `MotionProvider` (`reducedMotion="user"`).
7. Overlays (Dialog, Sheet) manage their own z-index and focus; do not add `z-*` to them.
8. Components using hooks or Radix are client components (`"use client"` already in the file). Server components can import them and pass serializable props. Dynamic data stays inside `<Suspense>` (Cache Components is on).
9. Cards only when elevation expresses hierarchy; prefer `divide-y`/`border-t` and whitespace for dense data.
10. Icons: `lucide-react`, default `size-4`, stroke width 2.

## Tokens (`src/app/globals.css`)

| Token (Tailwind) | Purpose |
| --- | --- |
| `background` / `foreground` | App canvas / body text |
| `card`, `popover` (+ `-foreground`) | Raised surfaces; overlays |
| `primary` (+ `-foreground`) | Signal lime: primary actions, focus, progress, active state |
| `secondary`, `muted`, `accent` (+ `-foreground`) | Neutral fills; `muted-foreground` is secondary text; `accent` is hover/selected surface |
| `border`, `input`, `ring` | Hairlines (alpha), field borders, focus ring |
| `success`, `warning`, `danger` (alias `destructive`), `info` (+ `-foreground`) | Status. Use `bg-danger/14 text-danger` for soft tints |
| `shadow-xs/sm/md/lg`, `--inset-highlight` | Hue-tinted elevation; `[box-shadow:var(--inset-highlight),var(--elev-xs)]` for the card edge |
| `rounded-sm/md/lg/xl/2xl` | Derived from `--radius` (0.625rem) |
| `ease-out-strong`, `ease-in-out-strong`, `ease-drawer` | Motion curves |
| `font-sans`, `font-mono` | Geist / Geist Mono via `next/font` (use `font-mono tabular-nums` for numbers, IDs, coordinates) |

Theme: dark by default; light follows `prefers-color-scheme: light`. `.dark` on `<html>` forces dark, `.light` forces light.

Custom animation utilities: `animate-gradient`, `animate-marquee`, `animate-meteor`, `animate-shimmer`, `animate-shine`, `animate-pulse-dot`, `animate-fade-up`, plus `tw-animate-css` (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`).

## Primitives

| Component | Import | Props / notes |
| --- | --- | --- |
| `Button`, `buttonVariants` | `@/components/ui/button` | `variant`: default, secondary, outline, ghost, destructive, soft, link. `size`: sm (32), default (40), lg (48), icon, icon-sm, icon-lg. `loading` (spinner + disabled), `asChild` (wrap `<Link>`). |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | `@/components/ui/card` | Header is a 2-col grid; put a `CardAction` (button/badge) at the top right. |
| `Badge` | `@/components/ui/badge` | `variant`: neutral, default, outline, success, warning, danger, info. `dot`, `pulse` (live state). |
| `Input`, `Textarea`, `Select`, `fieldControlClass` | `@/components/ui/input` | Native elements styled. `aria-invalid` shows the danger ring. `Select` is a styled native `<select>`. |
| `Label` | `@/components/ui/label` | Radix label. |
| `Field` | `@/components/ui/field` | `label`, `htmlFor`, `hint?`, `error?`; children = the control. |
| `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | `@/components/ui/dialog` | `DialogContent showClose?`. Always include a `DialogTitle`. |
| `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter`, `SheetClose` | `@/components/ui/sheet` | `SheetContent side="right" | "left" | "top" | "bottom"` (bottom = mobile drawer with grabber and safe-area padding). |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/components/ui/tabs` | Radix tabs, segmented-control look. |
| `Progress` | `@/components/ui/progress` | `value` 0-100, `tone`: primary, success, warning, danger. Animates via `scaleX`. |
| `Skeleton` | `@/components/ui/skeleton` | Give it the real content's size. |
| `Spinner` | `@/components/ui/spinner` | Prefer Skeleton for layout; Spinner for inline waits. |
| `Alert`, `AlertTitle`, `AlertDescription` | `@/components/ui/alert` | `variant`: info, success, warning, danger. Inline feedback (replaces toasts). |
| `EmptyState` | `@/components/ui/empty-state` | `icon?`, `title`, `description?`, `action?`. |
| `Stat` | `@/components/ui/stat` | `label`, `value` (string or `<NumberTicker />`), `detail?`, `icon?`. |
| `Separator` | `@/components/ui/separator` | `orientation`. |
| `Kbd` | `@/components/ui/kbd` | Keyboard hint chip. |
| `MotionProvider` | `@/components/ui/motion-provider` | Already mounted in `layout.tsx`. |

## Animated components (Magic UI ports)

All respect `prefers-reduced-motion`. Defaults use theme tokens.

| Component | Import | Props / usage |
| --- | --- | --- |
| `BlurFade` | `@/components/ui/blur-fade` | Entrance fade+rise+blur. `delay`, `duration`, `direction`, `offset`, `inView`. Stagger with `delay={i * 0.05}`. Use on page load, not on frequent updates. |
| `NumberTicker` | `@/components/ui/number-ticker` | `value`, `startValue`, `direction`, `delay`, `decimalPlaces`. Counts up in view. Shows final value under reduced motion. |
| `BorderBeam` | `@/components/ui/border-beam` | Child of a `relative rounded-*` box. `size`, `duration`, `colorFrom`, `colorTo`, `reverse`, `borderWidth`. One per screen (hero / upload / active card). |
| `ShineBorder` | `@/components/ui/shine-border` | Same placement. `shineColor`, `duration`, `borderWidth`. |
| `ShimmerButton` | `@/components/ui/shimmer-button` | Native button props + `shimmerColor`, `shimmerDuration`, `background`, `borderRadius`. Hero CTA only. |
| `AnimatedGradientText` | `@/components/ui/animated-gradient-text` | `speed`, `colorFrom`, `colorTo`. Inline `<span>` for one headline word. |
| `Marquee` | `@/components/ui/marquee` | `reverse`, `pauseOnHover`, `vertical`, `repeat`; tune with `[--duration:30s] [--gap:1rem]`. Becomes scrollable when reduced motion is on. |
| `Meteors` | `@/components/ui/meteors` | `number`, `angle`; parent `relative overflow-hidden`. Login/hero backdrop only. Hidden when reduced motion. |
| `GridPattern` | `@/components/ui/grid-pattern` | `width`, `height`, `squares`; color via `stroke-*`/`fill-*`. Fade with `mask-[radial-gradient(...)]`. |
| `DotPattern` | `@/components/ui/dot-pattern` | `width`, `height`, `cr`; color via `text-*`. Static, server-renderable. |

## Examples

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

<Card>
  <CardHeader>
    <CardTitle>Street signs</CardTitle>
    <CardDescription>1,240 images, 8 classes</CardDescription>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
    <Badge variant="success" dot>Labeling</Badge>
    <Field label="Dataset name" htmlFor="name" error={err}>
      <Input id="name" aria-invalid={!!err} />
    </Field>
    <Button loading={pending}>Save</Button>
  </CardContent>
</Card>
```
