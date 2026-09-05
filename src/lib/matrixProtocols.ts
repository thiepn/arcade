import { requestP22GameplayEvent } from './p22GameplayEvents';

export type MatrixProtocol = 'FORWARD' | 'REVERSE' | 'MIRROR' | 'REVERSE_MIRROR';

export const MATRIX_PROTOCOLS: MatrixProtocol[] = [
  'FORWARD',
  'REVERSE',
  'MIRROR',
  'REVERSE_MIRROR',
];

export interface MatrixProtocolSuite {
  name: string;
  protocols: readonly [MatrixProtocol, MatrixProtocol, MatrixProtocol, MatrixProtocol];
}

export const P22_MATRIX_PROTOCOL_SUITES: readonly MatrixProtocolSuite[] = [
  { name: 'ECHO PAIR', protocols: ['FORWARD', 'REVERSE', 'FORWARD', 'REVERSE'] },
  { name: 'MIRROR LADDER', protocols: ['MIRROR', 'FORWARD', 'MIRROR', 'REVERSE'] },
  { name: 'CROSS RECALL', protocols: ['REVERSE_MIRROR', 'REVERSE', 'MIRROR', 'FORWARD'] },
  { name: 'SWITCH LOGIC', protocols: ['FORWARD', 'MIRROR', 'REVERSE', 'REVERSE_MIRROR'] },
  { name: 'DUAL FLIP', protocols: ['REVERSE', 'REVERSE_MIRROR', 'FORWARD', 'MIRROR'] },
  { name: 'MASTER SUITE', protocols: ['MIRROR', 'REVERSE', 'REVERSE_MIRROR', 'FORWARD'] },
] as const;

export interface MatrixProtocolSnapshot {
  round: number;
  suiteName: string;
  suiteStep: number;
  suiteLength: number;
  protocol: MatrixProtocol;
  nextProtocol: MatrixProtocol;
}

let activeSnapshot: MatrixProtocolSnapshot = {
  round: 1,
  suiteName: 'FOUNDATION',
  suiteStep: 0,
  suiteLength: 8,
  protocol: 'FORWARD',
  nextProtocol: 'FORWARD',
};

const getFoundationProtocol = (round: number): MatrixProtocol => {
  const blockIndex = Math.floor((round - 1) / 2);
  return MATRIX_PROTOCOLS[blockIndex % MATRIX_PROTOCOLS.length];
};

const resolveMatrixProtocol = (safeRound: number): MatrixProtocolSnapshot => {
  if (safeRound <= 8) {
    const protocol = getFoundationProtocol(safeRound);
    const nextProtocol = safeRound < 8
      ? getFoundationProtocol(safeRound + 1)
      : P22_MATRIX_PROTOCOL_SUITES[0].protocols[0];
    return {
      round: safeRound,
      suiteName: 'FOUNDATION',
      suiteStep: safeRound - 1,
      suiteLength: 8,
      protocol,
      nextProtocol,
    };
  }

  const offset = safeRound - 9;
  const suiteIndex = Math.floor(offset / 4) % P22_MATRIX_PROTOCOL_SUITES.length;
  const suiteStep = offset % 4;
  const suite = P22_MATRIX_PROTOCOL_SUITES[suiteIndex];
  const nextProtocol = suiteStep < suite.protocols.length - 1
    ? suite.protocols[suiteStep + 1]
    : P22_MATRIX_PROTOCOL_SUITES[(suiteIndex + 1) % P22_MATRIX_PROTOCOL_SUITES.length].protocols[0];
  return {
    round: safeRound,
    suiteName: suite.name,
    suiteStep,
    suiteLength: suite.protocols.length,
    protocol: suite.protocols[suiteStep],
    nextProtocol,
  };
};

export const getMatrixProtocolForRound = (round: number): MatrixProtocol => {
  const safeRound = Math.max(1, Math.floor(round));
  activeSnapshot = resolveMatrixProtocol(safeRound);
  requestP22GameplayEvent({
    gameId: 'matrix',
    kind: 'matrix-protocol-start',
    label: activeSnapshot.suiteName,
    secondaryLabel: activeSnapshot.protocol,
    value: safeRound,
    index: activeSnapshot.suiteStep,
    aux: activeSnapshot.suiteLength,
    meta: { nextProtocol: activeSnapshot.nextProtocol },
  });
  return activeSnapshot.protocol;
};

export const getActiveMatrixProtocolSnapshot = (): MatrixProtocolSnapshot => ({ ...activeSnapshot });

export const mirrorMatrixNode = (node: number): number => {
  const safeNode = Math.max(0, Math.min(8, Math.floor(node)));
  const row = Math.floor(safeNode / 3);
  const col = safeNode % 3;
  return row * 3 + (2 - col);
};

export const applyMatrixProtocol = (
  sequence: readonly number[],
  protocol: MatrixProtocol,
): number[] => {
  let transformed = [...sequence];
  if (protocol === 'MIRROR' || protocol === 'REVERSE_MIRROR') transformed = transformed.map(mirrorMatrixNode);
  if (protocol === 'REVERSE' || protocol === 'REVERSE_MIRROR') transformed.reverse();
  return transformed;
};

export const getMatrixProtocolPrompt = (protocol: MatrixProtocol): string => {
  switch (protocol) {
    case 'FORWARD': return 'REPEAT IN ORDER';
    case 'REVERSE': return 'INPUT IN REVERSE';
    case 'MIRROR': return 'MIRROR EACH PAD';
    case 'REVERSE_MIRROR': return 'REVERSE + MIRROR';
  }
};
