"use client";

import { Fragment } from "react";
import { PHASES, getPhase } from "@/lib/process-flow";

interface Props {
  currentStepId: string;
  phaseIds?: string[];
}

export function ProcessProgress({ currentStepId, phaseIds }: Props) {
  const currentPhase = getPhase(currentStepId);
  if (!currentPhase) return null;

  const phases = phaseIds ? PHASES.filter((p) => phaseIds.includes(p.id)) : PHASES;
  const currentPhaseIndex = phases.findIndex((p) => p.id === currentPhase.id);

  return (
    <div className="flex w-full items-start">
      {phases.map((phase, i) => {
        const isPast = i < currentPhaseIndex;
        const isCurrent = i === currentPhaseIndex;
        const isLast = i === phases.length - 1;

        return (
          <Fragment key={phase.id}>
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  isCurrent
                    ? "text-white border-transparent"
                    : isPast
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-gray-300 text-gray-400 bg-white"
                }`}
                style={isCurrent ? { backgroundColor: phase.color, borderColor: phase.color } : {}}
              >
                {isPast ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-medium mt-1.5 text-center whitespace-nowrap ${
                  isCurrent ? "text-foreground" : isPast ? "text-muted-foreground" : "text-gray-400"
                }`}
              >
                {phase.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mt-4 ${
                  i < currentPhaseIndex ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
