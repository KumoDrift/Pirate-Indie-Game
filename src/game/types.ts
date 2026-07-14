export const SCENE_KEYS = {
  Boot: 'BootScene',
  Splash: 'SplashScene',
  MainMenu: 'MainMenuScene',
  Sandbox: 'SandboxScene',
  Settings: 'SettingsScene'
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

export type GameProfile = 'landscape' | 'portrait';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, Size {}

export interface GameProfileConfig {
  id: GameProfile;
  label: string;
  width: number;
  height: number;
}

export interface GameSettings {
  volume: number;
  muted: boolean;
}

export interface InputSnapshot {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  pointerDown: boolean;
}

export interface PointerSnapshot {
  x: number;
  y: number;
}

export interface DebugState {
  activeScene: SceneKey;
  paused: boolean;
  showWorldBounds: boolean;
  showVisualBounds: boolean;
  showHitboxes: boolean;
  showAttackboxes: boolean;
  activeBgm: string;
  activeBg: string;
  pointer: PointerSnapshot;
  input: InputSnapshot;
}
