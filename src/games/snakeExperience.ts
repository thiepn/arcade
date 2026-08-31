export interface SnakeGridPoint {
  x: number;
  y: number;
}

const FIREWALL_PATTERNS: readonly (readonly SnakeGridPoint[])[] = [
  [
    { x: 6, y: 5 },
    { x: 6, y: 6 },
    { x: 6, y: 7 },
  ],
  [
    { x: 14, y: 14 },
    { x: 15, y: 14 },
    { x: 16, y: 14 },
  ],
  [
    { x: 15, y: 6 },
    { x: 15, y: 7 },
    { x: 15, y: 8 },
    { x: 15, y: 9 },
  ],
  [
    { x: 5, y: 15 },
    { x: 6, y: 15 },
    { x: 7, y: 15 },
    { x: 8, y: 15 },
  ],
];

export const getSnakeFirewallStage = (snakeLength: number): number =>
  Math.min(FIREWALL_PATTERNS.length, Math.max(0, Math.floor((snakeLength - 4) / 4)));

export const getSnakeFirewallCells = (
  stage: number,
  blockedKeys: ReadonlySet<string> = new Set<string>(),
): SnakeGridPoint[] => {
  const cappedStage = Math.max(0, Math.min(FIREWALL_PATTERNS.length, Math.floor(stage)));
  const seen = new Set<string>();
  const cells: SnakeGridPoint[] = [];

  for (const pattern of FIREWALL_PATTERNS.slice(0, cappedStage)) {
    for (const cell of pattern) {
      const key = `${cell.x},${cell.y}`;
      if (blockedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      cells.push({ ...cell });
    }
  }

  return cells;
};
