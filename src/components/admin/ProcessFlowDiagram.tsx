import { PHASES, isParallel, type Phase, type Step } from "@/lib/process-flow";

interface Props {
  currentStepId?: string;
}

const BOX_LEFT = 150;
const BOX_WIDTH = 280;
const ID_X = 450;
const ID_HEIGHT = 16;
const ID_SPACING = 20;
const ARROW_GAP = 18;
const MIN_BOX_HEIGHT = 44;
const DESC_LINE_HEIGHT = 12;
const PHASE_BAR_WIDTH = 96;

const PAR_COLS = [
  { x: 40, w: 155 },
  { x: 210, w: 155 },
  { x: 380, w: 155 },
];

function stepBoxHeight(descriptions: string[] = []) {
  return Math.max(MIN_BOX_HEIGHT, 30 + descriptions.length * DESC_LINE_HEIGHT);
}

interface LayoutItem {
  phaseId: string;
  phaseColor: string;
  isFirstInPhase: boolean;
  step: { id: string; label: string; descriptions?: string[]; identifiers?: string[] };
  parallel?: {
    options: Step[];
    merged: Step;
  };
  y: number;
  height: number;
}

function computeLayout(phases: typeof PHASES) {
  const items: LayoutItem[] = [];
  let y = 52;

  for (const phase of phases) {
    let firstInPhase = true;
    for (const phaseStep of phase.steps) {
      if (isParallel(phaseStep)) {
        const optH = Math.max(...phaseStep.options.map((o) => stepBoxHeight(o.descriptions)));
        const mergedH = stepBoxHeight(phaseStep.merged.descriptions);
        const total = optH + 14 + 14 + mergedH;
        items.push({
          phaseId: phase.id,
          phaseColor: phase.color,
          isFirstInPhase: firstInPhase,
          step: { id: phaseStep.id, label: phaseStep.label },
          parallel: { options: phaseStep.options, merged: phaseStep.merged },
          y,
          height: total,
        });
        y += total + ARROW_GAP;
      } else {
        const h = stepBoxHeight(phaseStep.descriptions);
        items.push({
          phaseId: phase.id,
          phaseColor: phase.color,
          isFirstInPhase: firstInPhase,
          step: phaseStep,
          y,
          height: h,
        });
        y += h + ARROW_GAP;
      }
      firstInPhase = false;
    }
  }

  return { items, finalY: y };
}

export function ProcessFlowDiagram({ currentStepId }: Props) {
  const { items, finalY } = computeLayout(PHASES);
  const footerY = finalY + 10;
  const svgHeight = footerY + 70;
  const svgWidth = 720;

  const elements: React.ReactNode[] = [];

  items.forEach((item, idx) => {
    const { phaseColor, isFirstInPhase, step, parallel, y } = item;
    const isLastItem = idx === items.length - 1;

    // Determine if this item involves the current step
    const isCurrentItem = currentStepId
      ? parallel
        ? step.id === currentStepId ||
          parallel.merged.id === currentStepId ||
          parallel.options.some((o) => o.id === currentStepId)
        : step.id === currentStepId
      : false;

    // Phase bar on first step of each phase
    if (isFirstInPhase) {
      const phaseName = PHASES.find((p) => p.id === item.phaseId)?.label ?? item.phaseId;
      elements.push(
        <rect
          key={`phase-${item.phaseId}`}
          x={10} y={y + 4}
          width={PHASE_BAR_WIDTH} height={22}
          rx={4}
          fill={phaseColor}
          opacity={isCurrentItem ? 1 : 0.85}
        />,
        <text
          key={`phase-label-${item.phaseId}`}
          x={10 + PHASE_BAR_WIDTH / 2} y={y + 19}
          className="pf-text pf-phase-label"
          textAnchor="middle"
        >
          {phaseName.toUpperCase()}
        </text>
      );
    }

    if (!parallel) {
      // Linear step
      const h = item.height;
      const ids = step.identifiers ?? [];
      const descs = step.descriptions ?? [];
      const isCurrent = currentStepId === step.id;
      const strokeColor = isCurrent ? phaseColor : "#d1d5db";
      const strokeW = isCurrent ? 2 : 1.2;
      const fillColor = isCurrent ? `${phaseColor}18` : "#fff";

      elements.push(
        <rect key={`box-${step.id}`} x={BOX_LEFT} y={y} width={BOX_WIDTH} height={h} rx={6}
          fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} />,
        <text key={`title-${step.id}`} x={BOX_LEFT + BOX_WIDTH / 2} y={y + 18}
          className="pf-text pf-step-title" textAnchor="middle">
          {step.label}
        </text>
      );
      descs.forEach((d: string, i: number) => {
        elements.push(
          <text key={`desc-${step.id}-${i}`} x={BOX_LEFT + BOX_WIDTH / 2} y={y + 30 + i * DESC_LINE_HEIGHT}
            className="pf-text pf-step-detail" textAnchor="middle">
            {d}
          </text>
        );
      });
      ids.forEach((id: string, i: number) => {
        const tagY = y + 4 + i * ID_SPACING;
        elements.push(
          <rect key={`id-bg-${step.id}-${i}`} x={ID_X} y={tagY} width={130} height={ID_HEIGHT} rx={3} className="pf-id-bg" />,
          <text key={`id-${step.id}-${i}`} x={ID_X + 65} y={tagY + 11} className="pf-text pf-id-tag" textAnchor="middle">
            {id}
          </text>
        );
      });
      if (!isLastItem) {
        elements.push(
          <line key={`arrow-${step.id}`}
            x1={BOX_LEFT + BOX_WIDTH / 2} y1={y + h}
            x2={BOX_LEFT + BOX_WIDTH / 2} y2={y + h + ARROW_GAP}
            className="pf-arrow" />
        );
      }
    } else {
      // Parallel group
      const { options, merged } = parallel;
      const optH = Math.max(...options.map((o) => stepBoxHeight(o.descriptions)));
      const mergedH = stepBoxHeight(merged.descriptions);
      const convergeY = y + optH + 14;
      const mergeY = convergeY + 14;
      const isMergedCurrent = currentStepId === merged.id;
      const mergedStrokeColor = isMergedCurrent ? phaseColor : "#7c3aed";
      const mergedStrokeW = isMergedCurrent ? 2 : 1.5;
      const mergedFill = isMergedCurrent ? `${phaseColor}18` : "#fff";

      // Option boxes
      options.forEach((opt: Step, ci: number) => {
        const col = PAR_COLS[ci];
        const h = stepBoxHeight(opt.descriptions);
        elements.push(
          <rect key={`par-box-${opt.id}`} x={col.x} y={y} width={col.w} height={h} rx={6} className="pf-step-box" />,
          <text key={`par-title-${opt.id}`} x={col.x + col.w / 2} y={y + 18}
            className="pf-text pf-step-title" textAnchor="middle">
            {opt.label}
          </text>
        );
        (opt.descriptions ?? []).forEach((d: string, di: number) => {
          elements.push(
            <text key={`par-desc-${opt.id}-${di}`} x={col.x + col.w / 2} y={y + 30 + di * DESC_LINE_HEIGHT}
              className="pf-text pf-step-detail" textAnchor="middle">
              {d}
            </text>
          );
        });
        if (ci < options.length - 1) {
          const nextCol = PAR_COLS[ci + 1];
          elements.push(
            <text key={`or-${ci}`}
              x={col.x + col.w + (nextCol.x - col.x - col.w) / 2}
              y={y + h / 2 + 4}
              className="pf-text pf-or-label" textAnchor="middle">
              or
            </text>
          );
        }
      });

      // Converging arrows
      const midX = PAR_COLS[1].x + PAR_COLS[1].w / 2;
      options.forEach((opt: Step, ci: number) => {
        const col = PAR_COLS[ci];
        const colMid = col.x + col.w / 2;
        const h = stepBoxHeight(opt.descriptions);
        elements.push(
          <line key={`conv-${opt.id}`}
            x1={colMid} y1={y + h} x2={colMid} y2={convergeY}
            className="pf-arrow" />
        );
      });
      const leftMid = PAR_COLS[0].x + PAR_COLS[0].w / 2;
      const rightMid = PAR_COLS[2].x + PAR_COLS[2].w / 2;
      elements.push(
        <line key="merge-h" x1={leftMid} y1={convergeY} x2={rightMid} y2={convergeY} stroke="#9ca3af" strokeWidth={1.5} />,
        <line key="merge-v" x1={midX} y1={convergeY} x2={midX} y2={mergeY} className="pf-arrow" />
      );

      // Merged box
      const mergedIds = merged.identifiers ?? [];
      const mergedDescs = merged.descriptions ?? [];
      elements.push(
        <rect key={`merged-box-${merged.id}`} x={BOX_LEFT} y={mergeY} width={BOX_WIDTH} height={mergedH} rx={6}
          fill={mergedFill} stroke={mergedStrokeColor} strokeWidth={mergedStrokeW} />,
        <text key={`merged-title-${merged.id}`} x={BOX_LEFT + BOX_WIDTH / 2} y={mergeY + 18}
          className="pf-text pf-step-title" textAnchor="middle">
          {merged.label}
        </text>
      );
      mergedDescs.forEach((d: string, di: number) => {
        elements.push(
          <text key={`merged-desc-${di}`} x={BOX_LEFT + BOX_WIDTH / 2} y={mergeY + 30 + di * DESC_LINE_HEIGHT}
            className="pf-text pf-step-detail" textAnchor="middle">
            {d}
          </text>
        );
      });
      mergedIds.forEach((id: string, i: number) => {
        const tagY = mergeY + 4 + i * ID_SPACING;
        elements.push(
          <rect key={`merged-id-bg-${i}`} x={ID_X} y={tagY} width={130} height={ID_HEIGHT} rx={3} className="pf-id-bg" />,
          <text key={`merged-id-${i}`} x={ID_X + 65} y={tagY + 11} className="pf-text pf-id-tag" textAnchor="middle">
            {id}
          </text>
        );
      });

      if (!isLastItem) {
        elements.push(
          <line key="post-merge-arrow"
            x1={BOX_LEFT + BOX_WIDTH / 2} y1={mergeY + mergedH}
            x2={BOX_LEFT + BOX_WIDTH / 2} y2={mergeY + mergedH + ARROW_GAP}
            className="pf-arrow" />
        );
      }
    }
  });

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} xmlns="http://www.w3.org/2000/svg" role="img" className="w-full h-auto">
      <title>ShutterDay End-to-End Process Flow</title>
      <desc>Process diagram showing how school data flows into the platform, through picture day, to parent proof selection and delivery, with unique identifiers tracked throughout.</desc>
      <style>{`
        .pf-text { font-family: system-ui, -apple-system, sans-serif; }
        .pf-title { font-size: 15px; font-weight: 700; fill: #1a1a1a; }
        .pf-phase-label { font-size: 11px; font-weight: 700; fill: white; }
        .pf-step-box { fill: #fff; stroke: #d1d5db; stroke-width: 1.2; }
        .pf-step-title { font-size: 11px; font-weight: 600; fill: #1a1a1a; }
        .pf-step-detail { font-size: 9.5px; fill: #6b7280; }
        .pf-id-tag { font-size: 8.5px; font-weight: 600; fill: #7c3aed; }
        .pf-id-bg { fill: #f5f3ff; stroke: #c4b5fd; stroke-width: 0.8; }
        .pf-arrow { stroke: #9ca3af; stroke-width: 1.5; fill: none; marker-end: url(#pf-arw); }
        .pf-or-label { font-size: 9px; fill: #9ca3af; font-style: italic; }
      `}</style>
      <defs>
        <marker id="pf-arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
        </marker>
      </defs>

      <text x="20" y="24" className="pf-text pf-title">ShutterDay — End-to-End Process Flow</text>
      <text x="20" y="40" className="pf-text pf-step-detail">Unique identifiers shown in purple track each student from intake through delivery</text>

      {elements}

      <rect x="40" y={footerY} width="640" height="52" rx="6" fill="#f5f5f5" stroke="#7c3aed" strokeWidth="1.5" />
      <text x="60" y={footerY + 18} className="pf-text pf-step-title" fill="#7c3aed">Identifier chain:</text>
      <text x="60" y={footerY + 34} className="pf-text pf-step-detail" fontSize="10px">school_id → student_token (the spine) → parent_id → photo_id → order_id → payment_id</text>
      <text x="60" y={footerY + 46} className="pf-text pf-step-detail" fontSize="10px">The student_token is the universal key — printed on the QR flyer, scanned at shoot, linked to proofs, traced through to delivery.</text>
    </svg>
  );
}
