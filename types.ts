export enum Role {
  VILLAGER = 'VILLAGER',
  WEREWOLF = 'WEREWOLF',
  SEER = 'SEER',
  BODYGUARD = 'BODYGUARD',
  MEDIUM = 'MEDIUM'
}

export enum GamePhase {
  SETUP = 'SETUP',
  DAY_DISCUSSION = 'DAY_DISCUSSION',
  DAY_VOTE = 'DAY_VOTE',
  NIGHT_ACTION = 'NIGHT_ACTION',
  GAME_OVER = 'GAME_OVER'
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isAlive: boolean;
  avatar: string; // URL or emoji
  personality: string; // Specific trait for the AI
  voteTargetId?: string; // Who they voted for today
  protected?: boolean; // If protected by bodyguard
}

export interface LogEntry {
  id: string;
  phase: GamePhase;
  day: number; // Add day info to log
  speakerId: string; // "GAME_MASTER" or player ID
  content: string;
  type: 'chat' | 'system' | 'action' | 'death';
  visibleTo?: string[]; // IDs of players who can see this. If undefined/empty, public.
}

export interface GameState {
  players: Player[];
  phase: GamePhase;
  dayCount: number;
  turnIndex: number;
  logs: LogEntry[];
  winner: 'VILLAGERS' | 'WEREWOLVES' | null;
  activeSpeakerId: string | null;
  // Discussion Logic
  currentDiscussionRound: number;
  maxDiscussionRounds: number;
}

export interface AgentActionResponse {
  targetId: string;
  reasoning: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.VILLAGER]: '村人',
  [Role.WEREWOLF]: '人狼',
  [Role.SEER]: '占い師',
  [Role.BODYGUARD]: '騎士',
  [Role.MEDIUM]: '霊媒師'
};

export const ROLE_EMOJIS: Record<Role, string> = {
  [Role.VILLAGER]: '🧑‍🌾',
  [Role.WEREWOLF]: '🐺',
  [Role.SEER]: '🔮',
  [Role.BODYGUARD]: '🛡️',
  [Role.MEDIUM]: '👻'
};