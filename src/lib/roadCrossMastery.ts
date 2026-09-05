import { requestP22GameplayEvent } from './p22GameplayEvents';

export type RoadCrossLaneKind = 'grass' | 'road' | 'train' | 'river';

export interface RoadCrossDistrict {
  name: 'NEON SUBURB' | 'RUSH CIRCUIT' | 'FLOOD CHANNEL' | 'RAILWORKS';
  pattern: readonly RoadCrossLaneKind[];
}

export const ROAD_CROSS_DISTRICT_LENGTH = 8;
export const ROAD_CROSS_DISTRICTS: readonly RoadCrossDistrict[] = [
  { name: 'NEON SUBURB', pattern: ['grass', 'road', 'grass', 'road', 'river', 'grass', 'road', 'train'] },
  { name: 'RUSH CIRCUIT', pattern: ['grass', 'road', 'road', 'grass', 'road', 'train', 'road', 'grass'] },
  { name: 'FLOOD CHANNEL', pattern: ['grass', 'river', 'river', 'grass', 'road', 'river', 'train', 'grass'] },
  { name: 'RAILWORKS', pattern: ['grass', 'train', 'road', 'grass', 'train', 'river', 'road', 'grass'] },
] as const;

export const getRoadCrossDistrictLevel = (row: number): number => {
  if (row <= 3) return 0;
  return Math.floor((row - 4) / ROAD_CROSS_DISTRICT_LENGTH);
};

export const getRoadCrossDistrictStartRow = (districtLevel: number): number => {
  const level = Math.max(0, Math.floor(districtLevel));
  return level === 0 ? 0 : 4 + level * ROAD_CROSS_DISTRICT_LENGTH;
};

export const getRoadCrossDistrict = (row: number): RoadCrossDistrict => {
  const level = getRoadCrossDistrictLevel(row);
  const district = ROAD_CROSS_DISTRICTS[level % ROAD_CROSS_DISTRICTS.length];
  requestP22GameplayEvent({
    gameId: 'roadcross',
    kind: 'road-district-start',
    label: district.name,
    value: getRoadCrossDistrictStartRow(level),
    index: level,
  });
  return district;
};

export const getRoadCrossLaneType = (row: number): RoadCrossLaneKind => {
  if (row <= 3) return 'grass';
  const level = getRoadCrossDistrictLevel(row);
  const district = ROAD_CROSS_DISTRICTS[level % ROAD_CROSS_DISTRICTS.length];
  const offset = (row - 4) % ROAD_CROSS_DISTRICT_LENGTH;
  return district.pattern[offset] ?? 'grass';
};

export const getRoadCrossCheckpointBonus = (districtLevel: number): number => {
  const base = districtLevel <= 0 ? 0 : 500 + districtLevel * 150;
  if (districtLevel <= 0) return base;
  const routeBonus = requestP22GameplayEvent({
    gameId: 'roadcross',
    kind: 'road-checkpoint-bonus',
    value: Math.max(0, Math.floor(districtLevel)),
  });
  return base + routeBonus;
};
