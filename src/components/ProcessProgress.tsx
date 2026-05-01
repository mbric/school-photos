"use client";

import { PHASES, getPhase, getStep } from "@/lib/process-flow";

interface Props {
  currentStepId: string;
}

export function ProcessProgress({ currentStepId }: Props) {
  const currentPhase = getPhase(currentStepId);
  const currentStep = getStep(currentStepId);

  if (!currentPhase) return null;

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === currentPhase.id);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 flex-wrap">
        {PHASES.map((phase, i) => {
          const isPast = i < currentPhaseIndex;
          const isCurrent = i === currentPhaseIndex;
          const isFuture = i > currentPhaseIndex;

          return (
            <div key={phase.id} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-medium"
                  style={{
                    color: isCurrent ? phase.color : isPast ? "#16a34a" : "#9ca3af",
                  }}
                >
                  {isPast ? "✓" : isCurrent ? "●" : "○"}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{
                    color: isCurrent ? phase.color : isPast ? "#374151" : "#9ca3af",
                  }}
                >
                  {phase.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <span className="text-xs text-muted-foreground mx-0.5">→</span>
              )}
            </div>
          );
        })}
      </div>
      {currentStep && (
        <p className="text-xs text-muted-foreground mt-1 ml-0.5">{currentStep.label}</p>
      )}
    </div>
  );
}
