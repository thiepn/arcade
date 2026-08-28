export const BLOCK_DROP_COLS = 10;
export const BLOCK_DROP_ROWS = 20;
export const BLOCK_DROP_DESKTOP_CELL_MAX = 32;
export const BLOCK_DROP_MOBILE_CELL_MAX = 28;

export interface BlockDropLayout {
  cellSize: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  previewSize: number;
  previewCellSize: number;
  holdX: number;
  nextX: number;
  previewY: number;
  isDesktop: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const getBlockDropLayout = (
  width: number,
  height: number,
): BlockDropLayout => {
  const safeWidth = Math.max(280, width);
  const safeHeight = Math.max(420, height);
  const isDesktop = safeWidth >= 640;
  const horizontalReserve = isDesktop ? 220 : 108;
  const verticalReserve = isDesktop ? 76 : 92;
  const maxCell = isDesktop
    ? BLOCK_DROP_DESKTOP_CELL_MAX
    : BLOCK_DROP_MOBILE_CELL_MAX;

  const widthCell = Math.floor(
    Math.max(1, safeWidth - horizontalReserve) / BLOCK_DROP_COLS,
  );
  const heightCell = Math.floor(
    Math.max(1, safeHeight - verticalReserve) / BLOCK_DROP_ROWS,
  );
  const cellSize = clamp(Math.min(widthCell, heightCell, maxCell), 16, maxCell);
  const boardW = BLOCK_DROP_COLS * cellSize;
  const boardH = BLOCK_DROP_ROWS * cellSize;
  const boardX = Math.round((width - boardW) / 2);
  const boardY = Math.round((height - boardH) / 2);

  const sideSpace = Math.max(42, (width - boardW) / 2 - 10);
  const desiredPreview = cellSize * (isDesktop ? 3.25 : 3);
  const previewSize = clamp(Math.min(desiredPreview, sideSpace), 42, 104);
  const previewCellSize = clamp(Math.floor(previewSize / 5), 8, 19);
  const previewGap = Math.max(5, Math.min(14, (width - boardW) * 0.08));
  const holdX = Math.max(4, boardX - previewGap - previewSize);
  const nextX = Math.min(
    width - previewSize - 4,
    boardX + boardW + previewGap,
  );
  const previewY = Math.max(44, boardY + Math.min(30, cellSize));

  return {
    cellSize,
    boardX,
    boardY,
    boardW,
    boardH,
    previewSize,
    previewCellSize,
    holdX,
    nextX,
    previewY,
    isDesktop,
  };
};

export interface BlockDropHoldState<T extends string> {
  current: T;
  next: T;
  hold: T | null;
  canHold: boolean;
}

export interface BlockDropHoldResult<T extends string>
  extends BlockDropHoldState<T> {
  changed: boolean;
}

export const resolveBlockDropHold = <T extends string>(
  state: BlockDropHoldState<T>,
  drawNext: () => T,
): BlockDropHoldResult<T> => {
  if (!state.canHold) return { ...state, changed: false };

  if (state.hold === null) {
    return {
      current: state.next,
      next: drawNext(),
      hold: state.current,
      canHold: false,
      changed: true,
    };
  }

  return {
    current: state.hold,
    next: state.next,
    hold: state.current,
    canHold: false,
    changed: true,
  };
};
