export type MergeValueBoard = Array<Array<number | null>>;

export interface MergeCoordinate {
  col: number;
  row: number;
}

export interface MergeDecision {
  source: MergeCoordinate;
  target: MergeCoordinate;
  resultValue: number;
}

const scoreCompare = (left: number[], right: number[]) => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

const neighbors = (board: MergeValueBoard, col: number, row: number): MergeCoordinate[] => {
  const cols = board.length;
  const rows = board[0]?.length ?? 0;
  return [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ].filter(({ col: nextCol, row: nextRow }) =>
    nextCol >= 0 && nextCol < cols && nextRow >= 0 && nextRow < rows,
  );
};

const sameCoordinate = (left: MergeCoordinate, right: MergeCoordinate) =>
  left.col === right.col && left.row === right.row;

const getDestinationScore = (
  board: MergeValueBoard,
  first: MergeCoordinate,
  second: MergeCoordinate,
  destination: MergeCoordinate,
  focusColumn: number,
) => {
  const value = board[first.col]?.[first.row];
  if (value === null || value === undefined) return [Number.NEGATIVE_INFINITY];

  const resultValue = value * 2;
  const centerColumn = (board.length - 1) / 2;
  const sideDirection = focusColumn < centerColumn ? -1 : 1;
  const chainNeighbors = neighbors(board, destination.col, destination.row).filter((candidate) =>
    !sameCoordinate(candidate, first) &&
    !sameCoordinate(candidate, second) &&
    board[candidate.col]?.[candidate.row] === resultValue,
  ).length;

  // The ranking is intentionally mirror-equivariant:
  // 1) prefer a destination that can immediately continue a cascade,
  // 2) prefer the lower cell (gravity),
  // 3) prefer the side nearest the player's latest drop,
  // 4) then the board center, with the drop side as the final symmetric tie-break.
  return [
    chainNeighbors,
    destination.row,
    -Math.abs(destination.col - focusColumn),
    -Math.abs(destination.col - centerColumn),
    destination.col * sideDirection,
  ];
};

export const findNextMergeDecision = (
  board: MergeValueBoard,
  focusColumn: number,
): MergeDecision | null => {
  const cols = board.length;
  const rows = board[0]?.length ?? 0;
  if (cols === 0 || rows === 0) return null;

  const safeFocusColumn = Math.max(0, Math.min(cols - 1, focusColumn));
  const centerColumn = (cols - 1) / 2;
  const sideDirection = safeFocusColumn < centerColumn ? -1 : 1;

  let best: { score: number[]; decision: MergeDecision } | null = null;

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const value = board[col]?.[row];
      if (value === null || value === undefined) continue;

      for (const [dc, dr] of [[1, 0], [0, 1]] as const) {
        const nextCol = col + dc;
        const nextRow = row + dr;
        if (nextCol >= cols || nextRow >= rows || board[nextCol]?.[nextRow] !== value) continue;

        const first = { col, row };
        const second = { col: nextCol, row: nextRow };
        const firstScore = getDestinationScore(board, first, second, first, safeFocusColumn);
        const secondScore = getDestinationScore(board, first, second, second, safeFocusColumn);
        const destination = scoreCompare(firstScore, secondScore) >= 0 ? first : second;
        const source = sameCoordinate(destination, first) ? second : first;
        const destinationScore = scoreCompare(firstScore, secondScore) >= 0 ? firstScore : secondScore;

        const pairCenter = (col + nextCol) / 2;
        const pairScore = [
          destinationScore[0],
          Math.max(row, nextRow),
          -Math.abs(pairCenter - safeFocusColumn),
          dc === 0 ? 1 : 0,
          -Math.abs(pairCenter - centerColumn),
          pairCenter * sideDirection,
        ];

        const candidate = {
          score: pairScore,
          decision: {
            source,
            target: destination,
            resultValue: value * 2,
          },
        };

        if (!best || scoreCompare(candidate.score, best.score) > 0) best = candidate;
      }
    }
  }

  return best?.decision ?? null;
};

export const compactMergeColumns = (board: MergeValueBoard): MergeValueBoard =>
  board.map((column) => {
    const values = column.filter((value): value is number => value !== null);
    return Array<number | null>(column.length - values.length).fill(null).concat(values);
  });

export const resolveMergeCascadeValues = (
  input: MergeValueBoard,
  focusColumn: number,
) => {
  let board = input.map((column) => [...column]);
  let score = 0;
  let merges = 0;

  while (true) {
    const decision = findNextMergeDecision(board, focusColumn);
    if (!decision) break;

    board[decision.target.col][decision.target.row] = decision.resultValue;
    board[decision.source.col][decision.source.row] = null;
    board = compactMergeColumns(board);
    score += decision.resultValue;
    merges++;
  }

  return { board, score, merges };
};
