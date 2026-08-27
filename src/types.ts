export type GameCategory = 'Reflex' | 'Puzzle' | 'Timing' | 'Typing' | 'Physics' | 'Strategy';

export interface GameDefinition {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: GameCategory;
  sessionLength: string; // e.g. "1-2 min"
  accentColor: string; // Tailwind color or hex
  accentGlow: string;
  accentBg: string;
  instructions: string;
  controlsHint: string;
  icon: string;
}

export type AppTheme =
  | 'default'
  | 'retro-monochrome'
  | 'cyberpunk'
  | 'matrix-emerald'
  | 'sunset-amber';

export interface UserStats {
  highScores: Record<string, number>;
  playCounts: Record<string, number>;
  totalPlayTimeSeconds: Record<string, number>;
  favorites: string[];
  recentlyPlayed: string[];
  soundEnabled: boolean;
  hapticsEnabled?: boolean;
  volume: number;
  theme?: AppTheme;
}

export interface GameComponentProps {
  onGameOver: (finalScore: number) => void;
  onScoreUpdate: (currentScore: number) => void;
  isPaused: boolean;
  soundEnabled: boolean;
  onRestartRequest?: () => void;
}
