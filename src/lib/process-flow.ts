export type Step = {
  id: string;
  label: string;
  descriptions?: string[];
  identifiers?: string[];
};

export type ParallelGroup = {
  type: "parallel";
  id: string;
  label: string;
  options: Step[];
  merged: Step;
};

export type PhaseStep = Step | ParallelGroup;

export type Phase = {
  id: string;
  label: string;
  color: string;
  steps: PhaseStep[];
};

export const PHASES: Phase[] = [
  {
    id: "onboarding",
    label: "Onboarding",
    color: "#2563eb",
    steps: [
      {
        id: "school-setup",
        label: "School signs contract",
        descriptions: ["School admin created in platform"],
        identifiers: ["school_id"],
      },
      {
        type: "parallel",
        id: "roster-intake",
        label: "Roster intake",
        options: [
          {
            id: "roster-csv",
            label: "School sends roster",
            descriptions: ["CSV: name, grade, classroom"],
          },
          {
            id: "roster-manual",
            label: "Manual entry",
            descriptions: ["Megan keys in student list"],
          },
          {
            id: "roster-parent",
            label: "Parent self-registers",
            descriptions: ["Parent adds child via link"],
          },
        ],
        merged: {
          id: "student-records",
          label: "Student record created",
          descriptions: ["Unique token generated, linked to school + classroom"],
          identifiers: ["student_token", "school_id + grade"],
        },
      },
    ],
  },
  {
    id: "pre-shoot",
    label: "Pre-Shoot",
    color: "#0d9488",
    steps: [
      {
        id: "generate-flyers",
        label: "Generate take-home flyers",
        descriptions: [
          "Each flyer has unique QR code encoding student_token",
          "QR links to: shutterday.com/p/{student_token}",
        ],
        identifiers: ["student_token"],
      },
      {
        id: "distribute-flyers",
        label: "Flyers distributed to students",
        descriptions: ["Bundled by classroom, sent home in backpacks"],
      },
      {
        id: "parent-registration",
        label: "Parent scans QR code",
        descriptions: [
          "Creates parent account (or logs in)",
          "Auto-linked to their child's record",
        ],
        identifiers: ["parent_id", "student_token"],
      },
    ],
  },
  {
    id: "picture-day",
    label: "Picture Day",
    color: "#ea580c",
    steps: [
      {
        id: "photograph",
        label: "Photograph students",
        descriptions: [
          "Scan student QR card or match by class roster",
          "Each photo file tagged with student_token",
        ],
        identifiers: ["student_token", "photo_id"],
      },
      {
        id: "upload-photos",
        label: "Upload & process photos",
        descriptions: ["Batch upload, auto-match to students, generate proofs"],
        identifiers: ["photo_id → student_token"],
      },
    ],
  },
  {
    id: "selection",
    label: "Selection",
    color: "#7c3aed",
    steps: [
      {
        id: "notify-parents",
        label: "Notify parent: proofs ready",
        descriptions: ["Email/SMS with direct link to child's proof gallery"],
        identifiers: ["parent_id"],
      },
      {
        id: "proof-gallery",
        label: "Parent views proof gallery",
        descriptions: ["Watermarked previews, select favorites"],
      },
      {
        id: "order-placed",
        label: "Select package + photos",
        descriptions: ["Choose poses, sizes, add-ons (class composite, etc.)"],
        identifiers: ["order_id"],
      },
      {
        id: "payment",
        label: "Payment (Stripe / Venmo / Zelle)",
        descriptions: ["Order confirmed, receipt sent to parent"],
        identifiers: ["payment_id"],
      },
    ],
  },
  {
    id: "fulfillment",
    label: "Fulfillment",
    color: "#dc2626",
    steps: [
      {
        id: "process-orders",
        label: "Process & fulfill orders",
        descriptions: ["Print, package by classroom, or digital download"],
        identifiers: ["order_id → student_token"],
      },
      {
        id: "delivery",
        label: "Deliver to school or ship home",
        descriptions: ["Bundled by classroom, labeled with student name"],
      },
    ],
  },
];

export function isParallel(step: PhaseStep): step is ParallelGroup {
  return "type" in step;
}

export function getPhase(stepId: string): Phase | undefined {
  for (const phase of PHASES) {
    for (const step of phase.steps) {
      if (isParallel(step)) {
        if (
          step.id === stepId ||
          step.merged.id === stepId ||
          step.options.some((o) => o.id === stepId)
        ) {
          return phase;
        }
      } else if (step.id === stepId) {
        return phase;
      }
    }
  }
  return undefined;
}

export function getStep(stepId: string): Step | undefined {
  for (const phase of PHASES) {
    for (const step of phase.steps) {
      if (isParallel(step)) {
        if (step.merged.id === stepId) return step.merged;
        const opt = step.options.find((o) => o.id === stepId);
        if (opt) return opt;
      } else if (step.id === stepId) {
        return step;
      }
    }
  }
  return undefined;
}

export function flatSteps(): Step[] {
  const result: Step[] = [];
  for (const phase of PHASES) {
    for (const step of phase.steps) {
      if (isParallel(step)) {
        result.push(...step.options, step.merged);
      } else {
        result.push(step);
      }
    }
  }
  return result;
}
