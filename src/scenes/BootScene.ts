import { registerGeneratedAssets } from '../game/generatedAssets';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

export class BootScene extends BaseScene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  preload(): void {
    this.load.image('bg-port-town',          'assets/backgrounds/bg_port_town_dock.png');
    this.load.image('bg-pirate-ship-deck',   'assets/backgrounds/bg_pirate_ship_deck.png');
    this.load.image('bg-skeleton-island',    'assets/backgrounds/bg_skeleton_island.png');

    // ── Pirate spritesheets ─────────────────────────────────────
    // All sheets: 256×256 frames, 5 columns × 2 rows, no spacing/margin.
    // Verified against actual PNGs (1280×512) and per-animation manifests.
    const frameConfig = { frameWidth: 256, frameHeight: 256 };

    this.load.spritesheet('pirate-idle',   'assets/lobit/pirate/animations/w/idle/spritesheet.png',   frameConfig);
    this.load.spritesheet('pirate-walk',   'assets/lobit/pirate/animations/w/walk/spritesheet.png',   frameConfig);
    this.load.spritesheet('pirate-attack', 'assets/lobit/pirate/animations/w/attack/spritesheet.png', frameConfig);
    this.load.spritesheet('pirate-hurt',   'assets/lobit/pirate/animations/w/hurt/spritesheet.png',   frameConfig);
    this.load.spritesheet('pirate-jump',   'assets/lobit/pirate/animations/w/jump/spritesheet.png',   frameConfig);
    this.load.spritesheet('pirate-death',  'assets/lobit/pirate/animations/w/death/spritesheet.png',  frameConfig);

    // ── Skeleton spritesheets ────────────────────────────────────
    // Same 256×256 frame grid as pirate. Verified against 1280×512 PNGs.
    this.load.spritesheet('skeleton-idle',   'assets/lobit/skeleton/animations/w/idle/spritesheet.png',   frameConfig);
    this.load.spritesheet('skeleton-walk',   'assets/lobit/skeleton/animations/w/walk/spritesheet.png',   frameConfig);
    this.load.spritesheet('skeleton-attack', 'assets/lobit/skeleton/animations/w/attack/spritesheet.png', frameConfig);
    this.load.spritesheet('skeleton-hurt',   'assets/lobit/skeleton/animations/w/hurt/spritesheet.png',   frameConfig);
    this.load.spritesheet('skeleton-jump',   'assets/lobit/skeleton/animations/w/jump/spritesheet.png',   frameConfig);
    this.load.spritesheet('skeleton-death',  'assets/lobit/skeleton/animations/w/death/spritesheet.png',  frameConfig);

    this.load.audio('bgm-battle',     'assets/bgm/bgm_battle.wav');

    // ── Sound Effects (SFX) ─────────────────────────────────────
    this.load.audio('sfx-swing',          'assets/sfx/swordswing.mp3');
    this.load.audio('sfx-player-hurt',    'assets/sfx/playerdie.mp3');
    this.load.audio('sfx-enemy-hurt',     'assets/sfx/enemyhurt.mp3');
    this.load.audio('sfx-round-complete', 'assets/sfx/roundcomplete.wav');
    this.load.audio('sfx-game-over',      'assets/sfx/gameover.wav');
    this.load.audio('sfx-coin-pickup',    'assets/sfx/coin_pickup.mp3');
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Boot);
    registerGeneratedAssets(this);
    this.scene.start(SCENE_KEYS.Splash);
  }
}
