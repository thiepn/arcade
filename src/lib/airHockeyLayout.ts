export const AIR_HOCKEY_MIN_ASPECT = 0.64;
export const AIR_HOCKEY_MAX_ASPECT = 0.82;
export const AIR_HOCKEY_MAX_TABLE_WIDTH = 680;
export const AIR_HOCKEY_MAX_TABLE_HEIGHT = 800;

export interface AirHockeyTableLayout {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  goalWidth: number;
  motionScale: number;
  aspect: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const getAirHockeyTargetAspect = (
  viewportWidth: number,
  viewportHeight: number,
): number => {
  const viewportAspect = Math.max(1, viewportWidth) / Math.max(1, viewportHeight);
  const blend = clamp((viewportAspect - 0.62) / 0.52, 0, 1);
  return AIR_HOCKEY_MIN_ASPECT +
    (AIR_HOCKEY_MAX_ASPECT - AIR_HOCKEY_MIN_ASPECT) * blend;
};

export const getAirHockeyTableLayout = (
  viewportWidth: number,
  viewportHeight: number,
): AirHockeyTableLayout => {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);

  // Reserve screen space for the HUD and difficulty controls, but let those
  // insets compress on short mobile/browser-chrome viewports so the table can
  // never be positioned outside the actual rendered stage.
  const sideInset = clamp(width * 0.028, Math.min(6, width * 0.03), Math.min(24, width * 0.08));
  const topInset = clamp(height * 0.07, Math.min(30, height * 0.08), Math.min(62, height * 0.16));
  const bottomInset = clamp(height * 0.082, Math.min(38, height * 0.1), Math.min(70, height * 0.18));
  const availableWidth = Math.max(1, width - sideInset * 2);
  const availableHeight = Math.max(1, height - topInset - bottomInset);
  const aspect = getAirHockeyTargetAspect(width, height);

  let tableWidth = Math.min(availableWidth, AIR_HOCKEY_MAX_TABLE_WIDTH);
  let tableHeight = tableWidth / aspect;

  if (tableHeight > availableHeight || tableHeight > AIR_HOCKEY_MAX_TABLE_HEIGHT) {
    tableHeight = Math.min(availableHeight, AIR_HOCKEY_MAX_TABLE_HEIGHT);
    tableWidth = tableHeight * aspect;
  }

  tableWidth = Math.max(1, Math.min(tableWidth, availableWidth, AIR_HOCKEY_MAX_TABLE_WIDTH));
  tableHeight = Math.max(1, Math.min(tableHeight, availableHeight, AIR_HOCKEY_MAX_TABLE_HEIGHT));

  const left = (width - tableWidth) / 2;
  const top = topInset + (availableHeight - tableHeight) / 2;
  const motionScale = clamp(
    Math.min(tableWidth / 368, tableHeight / 468),
    0.68,
    1.35,
  );
  const goalMin = Math.min(92, tableWidth * 0.3);
  const goalMax = Math.min(190, tableWidth * 0.38);
  const goalWidth = clamp(tableWidth * 0.34, goalMin, Math.max(goalMin, goalMax));

  return {
    left,
    top,
    right: left + tableWidth,
    bottom: top + tableHeight,
    width: tableWidth,
    height: tableHeight,
    centerX: left + tableWidth / 2,
    centerY: top + tableHeight / 2,
    goalWidth,
    motionScale,
    aspect: tableWidth / tableHeight,
  };
};
