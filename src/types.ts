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

export interface ScoreDetails {
  rawScore: number;
  modeId: string;
  scoreVersion: number;
}

export interface UserStats {
  scoreVersion?: number;
  legacyHighScores?: Record<string, number>;
  bestScoreDetails?: Record<string, ScoreDetails>;
  /** Highest native engine score earned in each game. Not comparable across games. */
  rawHighScores?: Record<string, number>;
  /** Best normalized Arcade Points per game. Used for cross-game ranking. */
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
  onGameOver: (finalScore: number, modeId?: string) => void;
  onScoreUpdate: (currentScore: number, modeId?: string) => void;
  onModeChange?: (modeId: string) => void;
  isPaused: boolean;
  soundEnabled: boolean;
  onRestartRequest?: () => void;
}
