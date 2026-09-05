export type AeroFlightTrace = 'HIGH' | 'CENTER' | 'LOW';

export interface AeroFlightLineDefinition {
  id: string;
  label: string;
  centerOffsets: readonly number[];
}

export interface AeroFlightLineGatePlan {
  lineIndex: number;
  step: number;
  label: string;
  gapY: number;
  traceY: Record<AeroFlightTrace, number>;
}

export const AERO_FLIGHT_LINES: readonly AeroFlightLineDefinition[] = [
  { id: 'rise', label: 'RISE LINE', centerOffsets: [0.08, -0.02, -0.1] },
  { id: 'fall', label: 'FALL LINE', centerOffsets: [-0.08, 0.02, 0.1] },
  { id: 'weave', label: 'WEAVE LINE', centerOffsets: [-0.08, 0.08, -0.06] },
  { id: 'level', label: 'LEVEL LINE', centerOffsets: [0, 0.04, 0] },
] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getAeroFlightLine = (lineIndex: number): AeroFlightLineDefinition =>
  AERO_FLIGHT_LINES[Math.max(0, lineIndex) % AERO_FLIGHT_LINES.length] ?? AERO_FLIGHT_LINES[0];

export const getAeroFlightLineGatePlan = (
  lineIndex: number,
  step: number,
  height: number,
  gapHeight: number,
): AeroFlightLineGatePlan => {
  const line = getAeroFlightLine(lineIndex);
  const mirror = Math.floor(lineIndex / AERO_FLIGHT_LINES.length) % 2 === 1 ? -1 : 1;
  const normalizedOffset = (line.centerOffsets[Math.min(line.centerOffsets.length - 1, step)] ?? 0) * mirror;
  const margin = 60;
  const minCenter = margin + gapHeight / 2;
  const maxCenter = Math.max(minCenter, height - margin - gapHeight / 2);
  const center = clamp(height / 2 + normalizedOffset * height, minCenter, maxCenter);
  const routeOffset = Math.min(22, Math.max(14, gapHeight * 0.22));
  return {
    lineIndex,
    step,
    label: line.label,
    gapY: center - gapHeight / 2,
    traceY: {
      HIGH: center - routeOffset,
      CENTER: center,
      LOW: center + routeOffset,
    },
  };
};

export const classifyAeroFlightTrace = (
  playerY: number,
  traceY: Record<AeroFlightTrace, number>,
): AeroFlightTrace => {
  const entries = Object.entries(traceY) as [AeroFlightTrace, number][];
  return entries.reduce((best, candidate) =>
    Math.abs(playerY - candidate[1]) < Math.abs(playerY - best[1]) ? candidate : best,
  )[0];
};

export const isAeroFlightTraceHit = (
  playerY: number,
  traceY: Record<AeroFlightTrace, number>,
  trace: AeroFlightTrace,
  gapHeight: number,
): boolean => Math.abs(playerY - traceY[trace]) <= Math.min(15, Math.max(10, gapHeight * 0.16));

export const getAeroFlightLineBonus = (
  lineIndex: number,
  flowActive: boolean,
  grazeCombo: number,
): number => 400 + (lineIndex % 4) * 80 + (flowActive ? 250 : 0) + Math.min(6, grazeCombo) * 30;

export const getAeroFlightLineMaxCenterDelta = (
  height: number,
  gapHeight: number,
): number => {
  let maximum = 0;
  for (let lineIndex = 0; lineIndex < AERO_FLIGHT_LINES.length * 2; lineIndex++) {
    let previous: number | null = null;
    for (let step = 0; step < 3; step++) {
      const plan = getAeroFlightLineGatePlan(lineIndex, step, height, gapHeight);
      const center = plan.gapY + gapHeight / 2;
      if (previous !== null) maximum = Math.max(maximum, Math.abs(center - previous));
      previous = center;
    }
  }
  return maximum;
};

export const isAeroFlightLineReachableEnvelope = (
  height: number,
  gapHeight: number,
): boolean => getAeroFlightLineMaxCenterDelta(height, gapHeight) <= height * 0.2;
