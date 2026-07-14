import { createStore, type Store } from './store';
import { SCENE_KEYS, type DebugState } from './types';

export const DEFAULT_DEBUG_STATE: DebugState = {
  activeScene: SCENE_KEYS.Boot,
  paused: false,
  showWorldBounds: false,
  showVisualBounds: false,
  showHitboxes: false,
  showAttackboxes: false,
  activeBgm: 'bgm-battle',
  activeBg: 'bg-port-town',
  pointer: { x: 0, y: 0 },
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    pointerDown: false
  }
};

export function createDebugStore(): Store<DebugState> {
  return createStore<DebugState>(DEFAULT_DEBUG_STATE);
}
