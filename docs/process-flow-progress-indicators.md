# Plan: Data-Driven Process Flow + In-App Progress Indicators

## Context
The admin Process Flow diagram is currently a hand-crafted SVG with hardcoded positions and labels. The user wants a single source of truth — a TypeScript config — that drives both the diagram and compact "phase + current step" progress bars on relevant event/school pages. Changing the config should update both.

---

## Architecture

### Single source of truth: `src/lib/process-flow.ts`
Defines all phases and steps as typed data. Both the diagram renderer and the progress bar component import from here.

```ts
// Step shapes
type Step = {
  id: string;
  label: string;
  descriptions?: string[];   // diagram detail lines
  identifiers?: string[];    // purple ID tags shown in diagram
};

type ParallelGroup = {
  type: "parallel";
  options: Step[];           // side-by-side "or" options (no individual IDs in progress bar)
  merged: Step;              // the step that follows the merge
};

type PhaseStep = Step | ParallelGroup;

type Phase = {
  id: string;
  label: string;
  color: string;
  steps: PhaseStep[];
};
```

Helper exports:
- `PHASES: Phase[]` — the full config
- `getPhase(stepId)` — returns the Phase containing a given step
- `getStep(stepId)` — returns a Step by ID
- `flatSteps()` — flattened array of all Steps (no parallel groups) for progress logic

---

## Files to create / modify

### 1. `src/lib/process-flow.ts` *(new)*
The config. Five phases: ONBOARDING, PRE-SHOOT, PICTURE DAY, SELECTION, FULFILLMENT — matching the current diagram exactly including the 3-way parallel group in ONBOARDING.

### 2. `src/components/admin/ProcessFlowDiagram.tsx` *(major rewrite)*
Renders the SVG from config data. No hardcoded labels, descriptions, or colors — all come from `PHASES`. Layout is computed programmatically:

**Layout algorithm:**
- Cursor `y` starts at 52 (below title/subtitle text)
- For each phase, for each step:
  - Draw colored phase bar at `(10, y+4)` on first step of phase
  - **Linear step**: box at `(150, y)`, height = `30 + descriptions.length * 12 + identifiers.length * 0` (min 44px)
  - **Parallel group**: 3 side-by-side boxes at computed column positions (`x=40`, `210`, `380`), "or" labels between, converging arrows, then merged step below
  - ID tags: stacked purple tags at `x=450`, `y+4` each, spacing 20px
  - Arrow from box bottom to next step: 18px gap
- Canvas height computed from final `y` + footer height
- Footer "identifier chain" box drawn last

Accepts optional `currentStepId?: string` prop — highlights the matching phase bar and step box.

### 3. `src/components/ProcessProgress.tsx` *(new)*
Compact horizontal progress indicator. Props: `currentStepId: string`.

Visual: all 5 phase names in a row with arrows. Current phase is colored (using phase color), past phases show a ✓, future phases are muted gray. Below the bar: current step label in small muted text.

```
✓ Onboarding  →  ✓ Pre-Shoot  →  ● Picture Day  →  ○ Selection  →  ○ Fulfillment
                                    Upload & match photos
```

Uses `getPhase(currentStepId)` and `getStep(currentStepId)` from the config. No click behavior (informational only).

### 4. Pages that get `<ProcessProgress>` *(each adds one import + one JSX line)*

| Page | currentStepId | Position in page |
|------|--------------|-----------------|
| `schools/[schoolId]/page.tsx` | `"roster-intake"` | Below school name, above tabs |
| `events/[eventId]/page.tsx` | `"generate-flyers"` | Below event name/date, above action buttons |
| `events/[eventId]/shoot/page.tsx` | `"photograph"` | Below school name/date |
| `events/[eventId]/photos/page.tsx` | `"upload-photos"` | Below page title |
| `events/[eventId]/proofs/page.tsx` | `"notify-parents"` | Below page title |

Also pass `currentStepId` through to `ProcessFlowDiagram` on the admin Process Flow page so the diagram highlights the step that matches the user's current context — or leave it unhighlighted (no current step) on that standalone page.

---

## Step IDs in config (canonical list)

| Phase | Step IDs |
|-------|----------|
| onboarding | `school-setup`, `roster-intake` (parallel group → `student-records`) |
| pre-shoot | `generate-flyers`, `distribute-flyers`, `parent-registration` |
| picture-day | `photograph`, `upload-photos` |
| selection | `notify-parents`, `proof-gallery`, `order-placed`, `payment` |
| fulfillment | `process-orders`, `delivery` |

---

## Verification
1. Run `npx tsc --noEmit` — zero errors
2. Visit `/admin/process-flow` — diagram renders identically to current (visually verify phase colors, step labels, ID tags, arrows, parallel group)
3. Visit `/dashboard/schools/[schoolId]` — progress bar shows "Onboarding" phase highlighted, step "Import roster"
4. Visit `/dashboard/events/[eventId]` — "Pre-Shoot" highlighted
5. Visit shoot day, photos, proofs pages — correct phase highlighted on each
6. Edit a step label in `process-flow.ts`, check both the diagram and progress bar update
