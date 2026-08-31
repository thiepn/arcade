export type MatrixProtocol = 'FORWARD' | 'REVERSE' | 'MIRROR' | 'REVERSE_MIRROR';

export const MATRIX_PROTOCOLS: MatrixProtocol[] = [
  'FORWARD',
  'REVERSE',
  'MIRROR',
  'REVERSE_MIRROR',
];

export const getMatrixProtocolForRound = (round: number): MatrixProtocol => {
  const safeRound = Math.max(1, Math.floor(round));
  const blockIndex = Math.floor((safeRound - 1) / 2);
  return MATRIX_PROTOCOLS[blockIndex % MATRIX_PROTOCOLS.length];
};

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
  if (protocol === 'MIRROR' || protocol === 'REVERSE_MIRROR') {
    transformed = transformed.map(mirrorMatrixNode);
  }
  if (protocol === 'REVERSE' || protocol === 'REVERSE_MIRROR') {
    transformed.reverse();
  }
  return transformed;
};

export const getMatrixProtocolPrompt = (protocol: MatrixProtocol): string => {
  switch (protocol) {
    case 'FORWARD':
      return 'REPEAT IN ORDER';
    case 'REVERSE':
      return 'INPUT IN REVERSE';
    case 'MIRROR':
      return 'MIRROR EACH PAD';
    case 'REVERSE_MIRROR':
      return 'REVERSE + MIRROR';
  }
};
