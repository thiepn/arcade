import { requestP22GameplayEvent } from './p22GameplayEvents';

export const ROAD_CROSS_COLUMNS = 9;
export const ROAD_CROSS_WORLD_TILE_SIZE = 46;
export const ROAD_CROSS_WORLD_WIDTH = ROAD_CROSS_COLUMNS * ROAD_CROSS_WORLD_TILE_SIZE;
export const ROAD_CROSS_HORIZONTAL_PADDING = 8;

export interface RoadCrossBoardMetrics {
  scale: number;
  renderedWidth: number;
  offsetX: number;
}

export const getRoadCrossBoardMetrics = (viewportWidth: number): RoadCrossBoardMetrics => {
  const safeWidth = Math.max(1, viewportWidth);
  const availableWidth = Math.max(1, safeWidth - ROAD_CROSS_HORIZONTAL_PADDING * 2);
  const scale = Math.min(1, availableWidth / ROAD_CROSS_WORLD_WIDTH);
  const renderedWidth = ROAD_CROSS_WORLD_WIDTH * scale;
  const offsetX = (safeWidth - renderedWidth) / 2;
  return { scale, renderedWidth, offsetX };
};

export const canAcceptRoadCrossMove = (jumpProgress: number): boolean => jumpProgress >= 0.999;

export const noteRoadCrossAcceptedMove = (dCol: number, dRow: number): number => {
  const direction = dRow > 0 ? 'forward' : dRow < 0 ? 'backward' : dCol > 0 ? 'right' : 'left';
  return requestP22GameplayEvent({
    gameId: 'roadcross',
    kind: 'road-move-accepted',
    label: direction,
  });
};
