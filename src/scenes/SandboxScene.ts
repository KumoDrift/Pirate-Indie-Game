import * as Phaser from 'phaser';

import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';
import { createTextButton, type TextButton } from '../game/ui';
import { PROGRESSION_CONFIG } from '../game/progressionConfig';

// ── Player Tuning constants ─────────────────────────────────────
const PLAYER_SPEED = 240;
const SPRITE_SCALE = 0.5; // 256px frames → ~128px on screen

const KNOCKBACK_SPEED = 400;       // Initial knockback velocity (px/s)
const KNOCKBACK_FRICTION = 5;      // Exponential decay factor

const PLAYER_MAX_HEALTH = 5;

const BACKGROUND_KEYS = [
  'bg-port-town',
  'bg-pirate-ship-deck',
  'bg-skeleton-island'
];

const BGM_KEYS = [
  'bgm-battle'
];

// Walkable zone (y range) — top 40% is backdrop, bottom 60% is walkable.
// With origin at bottom-center, the sprite's feet sit at sprite.y.
const WALK_Y_MIN = 420;
const WALK_Y_MAX = 700;
const WALK_X_MIN = 64;
const WALK_X_MAX = 1216; // 1280 - 64

// ── Animation definitions ───────────────────────────────────────
interface AnimDef {
  key: string;
  sheetKey: string;
  endFrame: number;
  fps: number;
  repeat: number;
}

const PIRATE_ANIMS: AnimDef[] = [
  { key: 'pirate-idle',   sheetKey: 'pirate-idle',   endFrame: 9, fps: 6,  repeat: -1 },
  { key: 'pirate-walk',   sheetKey: 'pirate-walk',   endFrame: 8, fps: 10, repeat: -1 },
  { key: 'pirate-attack', sheetKey: 'pirate-attack', endFrame: 7, fps: 10, repeat: 0  },
  { key: 'pirate-hurt',   sheetKey: 'pirate-hurt',   endFrame: 5, fps: 8,  repeat: 0  },
  { key: 'pirate-jump',   sheetKey: 'pirate-jump',   endFrame: 5, fps: 8,  repeat: 0  },
  { key: 'pirate-death',  sheetKey: 'pirate-death',  endFrame: 9, fps: 8,  repeat: 0  },
];

const SKELETON_ANIMS: AnimDef[] = [
  { key: 'skeleton-idle',   sheetKey: 'skeleton-idle',   endFrame: 9, fps: 6,  repeat: -1 },
  { key: 'skeleton-walk',   sheetKey: 'skeleton-walk',   endFrame: 6, fps: 10, repeat: -1 },
  { key: 'skeleton-attack', sheetKey: 'skeleton-attack', endFrame: 7, fps: 10, repeat: 0  },
  { key: 'skeleton-hurt',   sheetKey: 'skeleton-hurt',   endFrame: 5, fps: 8,  repeat: 0  },
  { key: 'skeleton-jump',   sheetKey: 'skeleton-jump',   endFrame: 5, fps: 8,  repeat: 0  },
  { key: 'skeleton-death',  sheetKey: 'skeleton-death',  endFrame: 9, fps: 8,  repeat: 0  },
];

// ── Enemy state structures ──────────────────────────────────────
type EnemyState = 'idle' | 'chase' | 'attack' | 'cooldown' | 'hurt' | 'dead' | 'wait';
type EnemyDeathPhase = 'idle' | 'animating' | 'lying' | 'blinking' | 'disappeared';

interface EnemyInstance {
  sprite: Phaser.GameObjects.Sprite;
  health: number;
  maxHealth: number;
  state: EnemyState;
  deathPhase: EnemyDeathPhase;
  deathTimer: number;
  cooldownTimer: number;
  knockbackVx: number;
  knockbackVy: number;
  hasHitThisSwing: boolean;
}

// ── Coin / Loot Structures ──────────────────────────────────────
interface CoinInstance {
  sprite: Phaser.GameObjects.Sprite;
  glowGraphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spawnX: number;
  spawnY: number;
  targetY: number;
  bounceTimer: number;
  lifetimeTimer: number;
  state: 'pop' | 'idle' | 'magnet' | 'collected';
}

export class SandboxScene extends BaseScene {
  // ── Player ──────────────────────────────────────────────────
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private keyAttack!: Phaser.Input.Keyboard.Key;
  private keyRestart!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private isAttacking = false;
  private isHurt = false;
  private isPlayerDying = false;
  private isPlayerDead = false;
  private playerHealth = PLAYER_MAX_HEALTH;
  private playerHasHitThisSwing = false;

  // Knockback velocity applied to player when hit
  private knockbackVx = 0;
  private knockbackVy = 0;

  // ── Enemy Collection ────────────────────────────────────────
  private enemies: EnemyInstance[] = [];

  // ── BGM Audio State ─────────────────────────────────────────
  private currentBgmKey = '';
  private currentBgm: Phaser.Sound.BaseSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound | null = null;

  // ── Coin / Loot State ───────────────────────────────────────
  private coins: CoinInstance[] = [];

  // ── Progression State ───────────────────────────────────────
  private currentRound = 1;
  private totalEnemiesDefeated = 0;
  private roundEnemiesRemaining = 0;
  private roundEnemiesToSpawn = 0;
  private spawnTimer = 0;
  private currentSpawnInterval = PROGRESSION_CONFIG.baseSpawnIntervalMs;
  private roundIntermissionTimer = 0;
  private inIntermission = false;
  private survivalTime = 0;

  // ── Juice & Polish variables ────────────────────────────────
  private shadowsGraphics!: Phaser.GameObjects.Graphics;
  private redFlashGraphics!: Phaser.GameObjects.Graphics;
  private hitStopTimer = 0;
  private isPlayerInvulnerable = false;
  private playerInvulnerableTimer = 0;
  private playerBlinkTimer = 0;
  private previousHealth = PLAYER_MAX_HEALTH;
  private heartImages: Phaser.GameObjects.Image[] = [];

  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private boneEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private intermissionContainer?: Phaser.GameObjects.Container;

  // ── UI & Debug ──────────────────────────────────────────────
  private backgroundSprite!: Phaser.GameObjects.Image;
  private uiGraphics!: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private worldBoundsRect?: Phaser.GameObjects.Rectangle;

  // HUD Text Elements (to avoid redrawing text labels dynamically on canvas)
  private hudTextRound?: Phaser.GameObjects.Text;
  private hudTextRemaining?: Phaser.GameObjects.Text;
  private hudTextDefeated?: Phaser.GameObjects.Text;
  private hudTextTime?: Phaser.GameObjects.Text;

  // Intermission Overlay Text
  private intermissionTitleText?: Phaser.GameObjects.Text;
  private intermissionSubText?: Phaser.GameObjects.Text;

  // Game Over UI overlay
  private gameOverOverlay?: Phaser.GameObjects.Rectangle;
  private gameOverContainer?: Phaser.GameObjects.Container;
  private gameOverButtons: TextButton[] = [];
  private gameOverActions: (() => void)[] = [];
  private gameOverSelectedIndex = 0;

  constructor() {
    super(SCENE_KEYS.Sandbox);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Sandbox);

    // Reset Player states
    this.isAttacking = false;
    this.isHurt = false;
    this.isPlayerDying = false;
    this.isPlayerDead = false;
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.playerHasHitThisSwing = false;
    this.knockbackVx = 0;
    this.knockbackVy = 0;

    // Reset Progression states
    this.currentRound = 1;
    this.totalEnemiesDefeated = 0;
    this.roundEnemiesRemaining = 0;
    this.roundEnemiesToSpawn = 0;
    this.spawnTimer = 0;
    this.currentSpawnInterval = PROGRESSION_CONFIG.baseSpawnIntervalMs;
    this.roundIntermissionTimer = 0;
    this.inIntermission = false;
    this.survivalTime = 0;

    // Reset Juice variables
    this.hitStopTimer = 0;
    this.isPlayerInvulnerable = false;
    this.playerInvulnerableTimer = 0;
    this.playerBlinkTimer = 0;
    this.previousHealth = PLAYER_MAX_HEALTH;
    this.heartImages = [];

    // Reset Enemy collection
    this.enemies.forEach(e => e.sprite.destroy());
    this.enemies = [];

    // Clean up UI leftovers
    this.clearGameOverUI();
    this.destroyHUDTexts();

    const cam = this.cameras.main;

    // ── Background ────────────────────────────────────────────
    const debugState = this.app.debugStore.getState();
    this.backgroundSprite = this.add.image(cam.centerX, cam.centerY, debugState.activeBg);
    this.backgroundSprite.setDisplaySize(cam.width, cam.height);

    // ── Register all animations (idempotent) ──────────────────
    const allAnims = [...PIRATE_ANIMS, ...SKELETON_ANIMS];
    for (const def of allAnims) {
      if (!this.anims.exists(def.key)) {
        this.anims.create({
          key: def.key,
          frames: this.anims.generateFrameNumbers(def.sheetKey, {
            start: 0,
            end: def.endFrame,
          }),
          frameRate: def.fps,
          repeat: def.repeat,
        });
      }
    }

    // ── Player sprite ─────────────────────────────────────────
    this.player = this.add.sprite(cam.centerX - 200, 560, 'pirate-idle');
    this.player.setOrigin(0.5, 1.0);
    this.player.setScale(SPRITE_SCALE);
    this.player.play('pirate-idle');

    this.player.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (anim.key === 'pirate-attack') {
        this.isAttacking = false;
        this.player.play('pirate-idle');
      }
      if (anim.key === 'pirate-hurt') {
        this.isHurt = false;
        this.player.play('pirate-idle');
      }
      if (anim.key === 'pirate-death') {
        this.isPlayerDead = true;

        // Freeze all movement and gameplay elements
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.enemies.forEach(e => {
          e.knockbackVx = 0;
          e.knockbackVy = 0;
          e.sprite.anims.pause();
        });

        // Stop all gameplay animations
        this.player.anims.pause();

        // Show polished Game Over Overlay
        this.showGameOverUI();
      }
    });

    // ── Shadows Graphics layer ────────────────────────────────
    this.shadowsGraphics = this.add.graphics();
    this.shadowsGraphics.setDepth(10);

    // ── Red Flash layer ───────────────────────────────────────
    this.redFlashGraphics = this.add.graphics();
    this.redFlashGraphics.setDepth(990);

    // ── UI Graphics layer ─────────────────────────────────────
    this.uiGraphics = this.add.graphics();
    this.uiGraphics.setDepth(1000);

    // ── Debug layer ───────────────────────────────────────────
    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(1010);

    // ── Particle Emitters ──────────────────────────────────────
    this.sparkEmitter = this.add.particles(0, 0, 'particle-spark', {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0.1 },
      lifespan: { min: 300, max: 600 },
      gravityY: 150,
      emitting: false
    });
    this.sparkEmitter.setDepth(800);

    this.boneEmitter = this.add.particles(0, 0, 'particle-bone', {
      speed: { min: 80, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0.2 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 400, max: 800 },
      gravityY: 300,
      emitting: false
    });
    this.boneEmitter.setDepth(800);

    // ── Create static HUD text elements for clear layout ──────
    this.createHUDTexts();

    // ── Input ─────────────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.keyAttack = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyRestart = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      this.scene.start(SCENE_KEYS.MainMenu);
    });

    // ── Sound & BGM Setup ─────────────────────────────────────
    this.playBgm(debugState.activeBgm);

    const unsubscribe = this.app.debugStore.subscribe((state) => {
      if (state.activeBgm !== this.currentBgmKey) {
        this.playBgm(state.activeBgm);
      }
      if (this.backgroundSprite && state.activeBg !== this.backgroundSprite.texture.key) {
        this.backgroundSprite.setTexture(state.activeBg);
        this.backgroundSprite.setDisplaySize(this.cameras.main.width, this.cameras.main.height);
      }
    });

    // Clean up Game Over UI and BGM subscription on Scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      if (this.currentBgm) {
        this.currentBgm.stop();
        this.currentBgm = null;
      }
      if (this.shadowsGraphics) {
        this.shadowsGraphics.destroy();
      }
      if (this.redFlashGraphics) {
        this.redFlashGraphics.destroy();
      }
      if (this.sparkEmitter) {
        this.sparkEmitter.destroy();
      }
      if (this.boneEmitter) {
        this.boneEmitter.destroy();
      }
      this.clearGameOverUI();
      this.destroyHUDTexts();

      // Clean up remaining coins
      this.coins.forEach((c) => {
        c.sprite.destroy();
        c.glowGraphics.destroy();
      });
      this.coins = [];
    });

    // ── Start Round 1 ─────────────────────────────────────────
    this.startRound(1);

    this.createFooterHint('WASD / Arrows to move • Z to attack • ESC for menu');
  }

  update(time: number, delta: number): void {
    const state = this.app.debugStore.getState();
    const dt = delta / 1000;

    // ── Hit Stop / Freeze Frame Logic ────────────────────────
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= delta; // delta is in ms
      
      // Pause all sprite animations to freeze the visual frame
      if (this.player.anims.isPlaying) {
        this.player.anims.pause();
      }
      this.enemies.forEach((e) => {
        if (e.sprite.anims.isPlaying) {
          e.sprite.anims.pause();
        }
      });
      return; // Skip updates
    } else {
      // Resume animations if they were paused by hitStop
      if (this.player.anims.isPaused && !this.isPlayerDead && !this.isPlayerDying) {
        this.player.anims.resume();
      }
      this.enemies.forEach((e) => {
        if (e.sprite.anims.isPaused && (e.state !== 'dead' || e.deathPhase === 'animating')) {
          e.sprite.anims.resume();
        }
      });
    }

    // ── Invulnerability Blinking Logic ───────────────────────
    if (this.isPlayerInvulnerable) {
      this.playerInvulnerableTimer -= delta;
      this.playerBlinkTimer += delta;
      if (this.playerBlinkTimer >= 50) {
        this.playerBlinkTimer = 0;
        this.player.alpha = this.player.alpha === 1 ? 0.35 : 1.0;
      }
      if (this.playerInvulnerableTimer <= 0) {
        this.isPlayerInvulnerable = false;
        this.player.alpha = 1.0;
      }
    }

    // ── Shadows drawing ───────────────────────────────────────
    if (this.shadowsGraphics) {
      this.shadowsGraphics.clear();
      this.shadowsGraphics.fillStyle(0x000000, 0.28);
      // Draw player shadow
      if (this.player.active && !this.isPlayerDead) {
        this.shadowsGraphics.fillEllipse(this.player.x, this.player.y - 2, 54, 14);
      }
      // Draw enemy shadows
      this.enemies.forEach((e) => {
        if (e.sprite.active && e.state !== 'dead') {
          this.shadowsGraphics.fillEllipse(e.sprite.x, e.sprite.y - 2, 44, 12);
        }
      });
    }

    // ── Depth sorting ──────────────────────────────────────────
    this.player.setDepth(20 + this.player.y);
    this.enemies.forEach((e) => {
      e.sprite.setDepth(20 + e.sprite.y);
    });

    // ── Gather input snapshot ─────────────────────────────────
    const up    = this.cursors.up?.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down?.isDown  || this.wasd.down.isDown;
    const left  = this.cursors.left?.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right?.isDown || this.wasd.right.isDown;
    const attack = Phaser.Input.Keyboard.JustDown(this.keyAttack);

    const inputSnapshot = {
      up, down, left, right, attack,
      pointerDown: this.input.activePointer.isDown,
    };

    this.app.debugStore.patchState({
      pointer: { x: this.input.activePointer.x, y: this.input.activePointer.y },
      input: inputSnapshot,
    });

    if (state.paused) return;

    // ── Handle Player Death State (Game Over Screen Interaction) ──
    if (this.isPlayerDead) {
      if (
        Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
        Phaser.Input.Keyboard.JustDown(this.wasd.up)
      ) {
        const next = Phaser.Math.Wrap(this.gameOverSelectedIndex - 1, 0, this.gameOverButtons.length);
        this.setGameOverSelection(next);
      } else if (
        Phaser.Input.Keyboard.JustDown(this.cursors.down!) ||
        Phaser.Input.Keyboard.JustDown(this.wasd.down)
      ) {
        const next = Phaser.Math.Wrap(this.gameOverSelectedIndex + 1, 0, this.gameOverButtons.length);
        this.setGameOverSelection(next);
      } else if (
        Phaser.Input.Keyboard.JustDown(this.keyRestart) ||
        Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
        Phaser.Input.Keyboard.JustDown(this.keyAttack)
      ) {
        const action = this.gameOverActions[this.gameOverSelectedIndex];
        if (action) action();
      }
      this.drawUI(time);
      this.drawDebugBounds(state);
      return;
    }

    // ── If player is dying (playing death animation), block all input ─
    if (this.isPlayerDying) {
      // Still apply player knockback and decay
      if (Math.abs(this.knockbackVx) > 1 || Math.abs(this.knockbackVy) > 1) {
        this.player.x += this.knockbackVx * dt;
        this.player.y += this.knockbackVy * dt;
        const decay = Math.exp(-KNOCKBACK_FRICTION * dt);
        this.knockbackVx *= decay;
        this.knockbackVy *= decay;
        this.player.x = Phaser.Math.Clamp(this.player.x, WALK_X_MIN, WALK_X_MAX);
        this.player.y = Phaser.Math.Clamp(this.player.y, WALK_Y_MIN, WALK_Y_MAX);
      }
      this.updateEnemies(dt);
      this.drawUI(time);
      this.drawDebugBounds(state);
      return;
    }

    // ── Intermission Update ───────────────────────────────────
    if (this.inIntermission) {
      this.roundIntermissionTimer -= dt * 1000;
      if (this.intermissionSubText) {
        this.intermissionSubText.setText(
          `Next round starts in ${(Math.max(0, this.roundIntermissionTimer) / 1000).toFixed(1)}s`
        );
      }
      if (this.roundIntermissionTimer <= 0) {
        this.inIntermission = false;
        
        // Slide out the banner container
        const container = this.intermissionContainer;
        if (container) {
          this.tweens.add({
            targets: container,
            x: this.cameras.main.width,
            duration: 400,
            ease: 'Back.easeIn',
            onComplete: () => {
              container.destroy();
            }
          });
        }
        this.intermissionContainer = undefined;
        this.intermissionTitleText = undefined;
        this.intermissionSubText = undefined;

        this.currentRound++;
        this.startRound(this.currentRound);
      }

      // Allow basic player movement/idle during intermission
      this.updatePlayerMovement(up, down, left, right, attack, dt);
      this.updateEnemies(dt);
      this.updateCoins(dt);
      this.drawUI(time);
      this.drawDebugBounds(state);
      return;
    }

    // ── General Clock ─────────────────────────────────────────
    this.survivalTime += dt;

    // ── Controlled Wave Spawning ──────────────────────────────
    this.updateSpawning(dt);

    // ── Apply knockback (player) ──────────────────────────────
    if (Math.abs(this.knockbackVx) > 1 || Math.abs(this.knockbackVy) > 1) {
      this.player.x += this.knockbackVx * dt;
      this.player.y += this.knockbackVy * dt;

      const decay = Math.exp(-KNOCKBACK_FRICTION * dt);
      this.knockbackVx *= decay;
      this.knockbackVy *= decay;

      this.player.x = Phaser.Math.Clamp(this.player.x, WALK_X_MIN, WALK_X_MAX);
      this.player.y = Phaser.Math.Clamp(this.player.y, WALK_Y_MIN, WALK_Y_MAX);
    } else {
      this.knockbackVx = 0;
      this.knockbackVy = 0;
    }

    // ── Update Player Actions & Movement ──────────────────────
    this.updatePlayerMovement(up, down, left, right, attack, dt);

    // ── Player Hit Registration onto Enemy ────────────────────
    if (this.isAttacking && !this.playerHasHitThisSwing) {
      const frame = this.player.anims.currentFrame?.index;
      if (frame && frame >= 4 && frame <= 6) {
        this.playerHasHitThisSwing = true;
        this.applyHitToEnemy();
      }
    }

    // ── Update Enemy AI and Interactions ──────────────────────
    this.updateEnemies(dt);
    this.updateCoins(dt);

    // ── Draw Health Bars & Debug Bounds ───────────────────────
    this.drawUI(time);
    this.drawDebugBounds(state);

    // ── Debug world bounds overlay ────────────────────────────
    if (state.showWorldBounds && !this.worldBoundsRect) {
      this.worldBoundsRect = this.add
        .rectangle(0, 0, this.cameras.main.width, this.cameras.main.height)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xf43f5e);
    } else if (!state.showWorldBounds && this.worldBoundsRect) {
      this.worldBoundsRect.destroy();
      this.worldBoundsRect = undefined;
    }
  }

  // ── Spawn logic ─────────────────────────────────────────────
  private startRound(roundNum: number): void {
    const totalEnemies = PROGRESSION_CONFIG.getEnemiesCountForRound(roundNum);
    this.roundEnemiesRemaining = totalEnemies;
    this.roundEnemiesToSpawn = totalEnemies;

    // Scale spawn speed as rounds progress, capped at min limit
    const difficultyInterval = PROGRESSION_CONFIG.baseSpawnIntervalMs - (roundNum - 1) * PROGRESSION_CONFIG.spawnIntervalDecreasePerRoundMs;
    this.currentSpawnInterval = Math.max(difficultyInterval, PROGRESSION_CONFIG.minSpawnIntervalMs);

    this.spawnTimer = 0; // Trigger first spawn immediately
    this.inIntermission = false;

    this.destroyIntermissionTexts();

    // Resume BGM if it was stopped during intermission
    if (this.currentBgm && !this.currentBgm.isPlaying) {
      this.currentBgm.play();
    }

    // Change background every 3 rounds
    const bgIndex = Math.floor((roundNum - 1) / 3) % BACKGROUND_KEYS.length;
    const bgKey = BACKGROUND_KEYS[bgIndex];
    const currentState = this.app.debugStore.getState();
    if (currentState.activeBg !== bgKey) {
      this.app.debugStore.patchState({ activeBg: bgKey });
    }

    // Change BGM every 3 rounds
    const bgmIndex = Math.floor((roundNum - 1) / 3) % BGM_KEYS.length;
    const targetBgmKey = BGM_KEYS[bgmIndex];
    if (currentState.activeBgm !== targetBgmKey) {
      this.app.debugStore.patchState({ activeBgm: targetBgmKey });
    }
  }

  private updateSpawning(dt: number): void {
    if (this.roundEnemiesToSpawn <= 0) return;

    // Count how many enemies are currently alive on screen
    const activeCount = this.enemies.filter(e => e.state !== 'dead').length;

    // Cap simultaneous spawns
    if (activeCount >= PROGRESSION_CONFIG.maxSimultaneousEnemies) return;

    this.spawnTimer -= dt * 1000;
    if (this.spawnTimer <= 0) {
      this.spawnSingleEnemy();
      this.roundEnemiesToSpawn--;
      this.spawnTimer = this.currentSpawnInterval;
    }
  }

  private spawnSingleEnemy(): void {
    // Randomize spawn edge
    const spawnOnLeft = Math.random() < 0.5;
    const spawnX = spawnOnLeft ? WALK_X_MIN : WALK_X_MAX;

    // Randomize Y within walkable area to prevent clustering at exact same point
    const spawnY = Phaser.Math.Between(WALK_Y_MIN, WALK_Y_MAX);

    const enemySprite = this.add.sprite(spawnX, spawnY, 'skeleton-idle');
    enemySprite.setOrigin(0.5, 1.0);
    enemySprite.setScale(SPRITE_SCALE);
    enemySprite.play('skeleton-idle');

    const enemyInstance: EnemyInstance = {
      sprite: enemySprite,
      health: PROGRESSION_CONFIG.enemyMaxHealth,
      maxHealth: PROGRESSION_CONFIG.enemyMaxHealth,
      state: 'chase',
      deathPhase: 'idle',
      deathTimer: 0,
      cooldownTimer: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      hasHitThisSwing: false,
    };

    // Register independent animation completes for this instance
    enemySprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (anim.key === 'skeleton-attack' && enemyInstance.state !== 'dead') {
        enemyInstance.state = 'cooldown';
        enemyInstance.cooldownTimer = PROGRESSION_CONFIG.enemyAttackCooldownMs;
        enemySprite.play('skeleton-idle');
      }
      if (anim.key === 'skeleton-hurt' && enemyInstance.state !== 'dead') {
        enemyInstance.state = 'chase';
        enemySprite.play('skeleton-idle');
      }
    });

    this.enemies.push(enemyInstance);
  }

  // ── Player Movement update ──────────────────────────────────
  private updatePlayerMovement(
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
    attack: boolean,
    dt: number
  ): void {
    if (this.isPlayerDying || this.isPlayerDead) return;

    if (attack && !this.isAttacking && !this.isHurt) {
      this.isAttacking = true;
      this.playerHasHitThisSwing = false;
      this.player.play('pirate-attack');
      this.sound.play('sfx-swing', { volume: 0.3 });
    }

    if (!this.isAttacking && !this.isHurt) {
      const dx = (left ? -1 : 0) + (right ? 1 : 0);
      const dy = (up ? -1 : 0) + (down ? 1 : 0);

      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const nx = dx / len;
        const ny = dy / len;

        this.player.x = Phaser.Math.Clamp(
          this.player.x + nx * PLAYER_SPEED * dt,
          WALK_X_MIN,
          WALK_X_MAX,
        );
        this.player.y = Phaser.Math.Clamp(
          this.player.y + ny * PLAYER_SPEED * dt,
          WALK_Y_MIN,
          WALK_Y_MAX,
        );
      }

      if (dx < 0) {
        this.player.setFlipX(false);
      } else if (dx > 0) {
        this.player.setFlipX(true);
      }

      const isMoving = len > 0;
      const currentKey = this.player.anims.currentAnim?.key;

      if (isMoving && currentKey !== 'pirate-walk') {
        this.player.play('pirate-walk');
      } else if (!isMoving && currentKey !== 'pirate-idle') {
        this.player.play('pirate-idle');
      }
    }
  }

  // ── Enemy Management & Physics updates ──────────────────────
  private updateEnemies(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;

    // ── 1. Apply Natural Separation forces (Prevent clustering) ──
    for (let i = 0; i < this.enemies.length; i++) {
      const eA = this.enemies[i];
      if (eA.state === 'dead') continue;

      for (let j = i + 1; j < this.enemies.length; j++) {
        const eB = this.enemies[j];
        if (eB.state === 'dead') continue;

        const dx = eA.sprite.x - eB.sprite.x;
        const dy = eA.sprite.y - eB.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Displace enemies slightly if they are overlapping/too close
        const minDistance = 55;
        if (dist < minDistance && dist > 0) {
          const force = (minDistance - dist) * 1.5;
          const pushX = (dx / dist) * force * dt;
          const pushY = (dy / dist) * force * dt;

          eA.sprite.x = Phaser.Math.Clamp(eA.sprite.x + pushX, WALK_X_MIN, WALK_X_MAX);
          eA.sprite.y = Phaser.Math.Clamp(eA.sprite.y + pushY, WALK_Y_MIN, WALK_Y_MAX);
          eB.sprite.x = Phaser.Math.Clamp(eB.sprite.x - pushX, WALK_X_MIN, WALK_X_MAX);
          eB.sprite.y = Phaser.Math.Clamp(eB.sprite.y - pushY, WALK_Y_MIN, WALK_Y_MAX);
        }
      }
    }

    // ── 2. Update AI state & velocities for each instance ──────
    const aliveEnemies = this.enemies.filter(e => e.state !== 'dead');
    const sortedAlive = [...aliveEnemies].sort((a, b) => {
      const distA = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, px, py);
      const distB = Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, px, py);
      return distA - distB;
    });
    const activeAttackers = sortedAlive.slice(0, 2);

    this.enemies.forEach((e) => {
      // Apply knockback
      if (Math.abs(e.knockbackVx) > 1 || Math.abs(e.knockbackVy) > 1) {
        e.sprite.x += e.knockbackVx * dt;
        e.sprite.y += e.knockbackVy * dt;

        const decay = Math.exp(-KNOCKBACK_FRICTION * dt);
        e.knockbackVx *= decay;
        e.knockbackVy *= decay;

        e.sprite.x = Phaser.Math.Clamp(e.sprite.x, WALK_X_MIN, WALK_X_MAX);
        e.sprite.y = Phaser.Math.Clamp(e.sprite.y, WALK_Y_MIN, WALK_Y_MAX);
      } else {
        e.knockbackVx = 0;
        e.knockbackVy = 0;
      }

      if (e.state === 'dead') {
        this.updateSingleEnemyDeath(e, dt);
        return;
      }

      // Proximity details for behavior and facing
      const distX = px - e.sprite.x;
      const distY = py - e.sprite.y;
      const dist = Math.sqrt(distX * distX + distY * distY);

      // Force waiting state if not in the top 2 closest alive enemies
      const isAttacker = activeAttackers.includes(e);
      if (!isAttacker) {
        if (e.state === 'chase') {
          e.state = 'wait';
          e.sprite.play('skeleton-idle');
        }
      } else {
        if (e.state === 'wait') {
          e.state = 'chase';
        }
      }

      // If player is dying, skeletons ignore player, return to idle
      if (this.isPlayerDying) {
        e.state = 'cooldown';
        e.sprite.play('skeleton-idle');
        return;
      }

      // AI States
      switch (e.state) {
        case 'chase':
          // Orient towards player
          e.sprite.setFlipX(distX >= 0);

          const isPlayerRunning = this.player.anims.currentAnim?.key === 'pirate-walk';
          if (dist < PROGRESSION_CONFIG.enemyAttackRange && !isPlayerRunning) {
            e.state = 'attack';
            e.hasHitThisSwing = false;
            e.sprite.play('skeleton-attack');
            this.sound.play('sfx-swing', { volume: 0.3 });
            break;
          }

          if (dist > 0) {
            const nx = distX / dist;
            const ny = distY / dist;

            e.sprite.x = Phaser.Math.Clamp(
              e.sprite.x + nx * PROGRESSION_CONFIG.enemySpeed * dt,
              WALK_X_MIN,
              WALK_X_MAX,
            );
            e.sprite.y = Phaser.Math.Clamp(
              e.sprite.y + ny * PROGRESSION_CONFIG.enemySpeed * dt,
              WALK_Y_MIN,
              WALK_Y_MAX,
            );
          }

          if (e.sprite.anims.currentAnim?.key !== 'skeleton-walk') {
            e.sprite.play('skeleton-walk');
          }
          break;

        case 'attack':
          if (!e.hasHitThisSwing && !this.isHurt && !this.isPlayerDying && !this.isPlayerDead) {
            const currentFrame = e.sprite.anims.currentFrame;
            if (currentFrame && currentFrame.index >= PROGRESSION_CONFIG.enemyAttackHitFrame) {
              e.hasHitThisSwing = true;

              const ex = e.sprite.x;
              const ey = e.sprite.y;
              const eFlip = e.sprite.flipX;

              const attackRect = new Phaser.Geom.Rectangle(
                eFlip ? ex + 20 : ex - 90,
                ey - 80,
                70,
                60
              );
              const playerHitbox = new Phaser.Geom.Rectangle(
                px - 17,
                py - 90,
                34,
                90
              );

              if (Phaser.Geom.Rectangle.Overlaps(attackRect, playerHitbox)) {
                this.applyHitToPlayer(e);
              }
            }
          }
          break;

        case 'cooldown':
          e.cooldownTimer -= dt * 1000;
          if (e.cooldownTimer <= 0) {
            e.state = 'chase';
          }
          break;

        case 'hurt':
          break;

        case 'wait':
          // Orient towards player
          e.sprite.setFlipX(distX >= 0);

          // Stalk player slowly if outside keep distance
          if (dist > PROGRESSION_CONFIG.enemyStalkDistance) {
            const nx = distX / dist;
            const ny = distY / dist;

            e.sprite.x = Phaser.Math.Clamp(
              e.sprite.x + nx * (PROGRESSION_CONFIG.enemySpeed * PROGRESSION_CONFIG.enemyStalkSpeedMultiplier) * dt,
              WALK_X_MIN,
              WALK_X_MAX
            );
            e.sprite.y = Phaser.Math.Clamp(
              e.sprite.y + ny * (PROGRESSION_CONFIG.enemySpeed * PROGRESSION_CONFIG.enemyStalkSpeedMultiplier) * dt,
              WALK_Y_MIN,
              WALK_Y_MAX
            );

            if (e.sprite.anims.currentAnim?.key !== 'skeleton-walk') {
              e.sprite.play('skeleton-walk');
            }
          } else {
            if (e.sprite.anims.currentAnim?.key !== 'skeleton-idle') {
              e.sprite.play('skeleton-idle');
            }
          }
          break;
      }
    });

    // ── 3. Clean out completely disappeared enemies from list ──
    this.enemies = this.enemies.filter((e) => {
      if (e.state === 'dead' && e.deathPhase === 'disappeared' && e.deathTimer <= 0) {
        e.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private updateSingleEnemyDeath(e: EnemyInstance, dt: number): void {
    const dtMs = dt * 1000;

    switch (e.deathPhase) {
      case 'animating':
        e.deathTimer -= dtMs;
        if (e.deathTimer <= 0) {
          e.deathPhase = 'lying';
          e.deathTimer = PROGRESSION_CONFIG.enemyLyingMs;
        }
        break;

      case 'lying':
        e.deathTimer -= dtMs;
        if (e.deathTimer <= 0) {
          e.deathPhase = 'blinking';
          e.deathTimer = PROGRESSION_CONFIG.enemyBlinkingMs;
        }
        break;

      case 'blinking':
        e.deathTimer -= dtMs;
        e.sprite.alpha = Math.floor(this.time.now / 100) % 2 === 0 ? 1 : 0;

        if (e.deathTimer <= 0) {
          e.deathPhase = 'disappeared';
          e.sprite.alpha = 0;
          e.sprite.visible = false;
          e.deathTimer = PROGRESSION_CONFIG.enemyRespawnMs;

          // Check if all enemies in the current round are defeated
          // (both active on screen and remaining in wave)
          const activeAliveCount = this.enemies.filter(x => x.state !== 'dead').length;
          if (this.roundEnemiesRemaining === 0 && activeAliveCount === 0 && !this.inIntermission && !this.isPlayerDead) {
            this.triggerRoundIntermission();
          }
        }
        break;

      case 'disappeared':
        e.deathTimer -= dtMs;
        break;
    }
  }

  // ── Intermission Trigger ────────────────────────────────────
  private triggerRoundIntermission(): void {
    this.inIntermission = true;
    this.roundIntermissionTimer = PROGRESSION_CONFIG.intermissionDurationMs;

    // Stop active BGM and play complete fanfare audio
    if (this.currentBgm) {
      this.currentBgm.stop();
    }
    this.sound.play('sfx-round-complete', { volume: 0.3 });

    const cam = this.cameras.main;

    // Create a container to hold the sliding banner
    this.intermissionContainer = this.add.container(-cam.width, 0);
    this.intermissionContainer.setDepth(150);

    // 1. Dark semi-transparent horizontal banner band
    const banner = this.add.rectangle(0, cam.centerY, cam.width, 110, 0x0f172a, 0.75);
    banner.setOrigin(0, 0.5);

    // 2. Glowing emerald/gold lines on top/bottom of banner
    const topLine = this.add.rectangle(0, cam.centerY - 55, cam.width, 3, 0x10b981); // Emerald line
    topLine.setOrigin(0, 0.5);
    const bottomLine = this.add.rectangle(0, cam.centerY + 55, cam.width, 3, 0xf59e0b); // Gold/Amber line
    bottomLine.setOrigin(0, 0.5);

    // 3. Title text "ROUND X COMPLETE" (emerald-green text with bold style)
    this.intermissionTitleText = this.add.text(cam.centerX, cam.centerY - 20, `ROUND ${this.currentRound} COMPLETE`, {
      fontSize: '34px',
      color: '#34d399', // Emerald green
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#064e3b',
      strokeThickness: 4
    }).setOrigin(0.5);

    // 4. Sub-text countdown
    this.intermissionSubText = this.add.text(
      cam.centerX,
      cam.centerY + 25,
      `Next round starts in ${(PROGRESSION_CONFIG.intermissionDurationMs / 1000).toFixed(1)}s`,
      {
        fontSize: '18px',
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);

    // Add all to container
    this.intermissionContainer.add([banner, topLine, bottomLine, this.intermissionTitleText, this.intermissionSubText]);

    // Slide in tween
    this.tweens.add({
      targets: this.intermissionContainer,
      x: 0,
      duration: 500,
      ease: 'Back.easeOut'
    });
  }

  private destroyIntermissionTexts(): void {
    if (this.intermissionContainer) {
      this.intermissionContainer.destroy();
      this.intermissionContainer = undefined;
      this.intermissionTitleText = undefined;
      this.intermissionSubText = undefined;
    }
  }

  // ── Damage Application methods ──────────────────────────────
  private applyHitToPlayer(enemy: EnemyInstance): void {
    if (this.isPlayerDying || this.isPlayerDead) return;

    // Check if player is invulnerable
    if (this.isPlayerInvulnerable) {
      return;
    }

    // Do not damage the player if they are actively running/moving
    const isPlayerRunning = this.player.anims.currentAnim?.key === 'pirate-walk';
    if (isPlayerRunning) {
      return;
    }

    this.playerHealth -= 1;

    const dx = this.player.x - enemy.sprite.x;
    const dy = this.player.y - enemy.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.knockbackVx = (dx / dist) * KNOCKBACK_SPEED;
      this.knockbackVy = (dy / dist) * KNOCKBACK_SPEED;
    } else {
      this.knockbackVx = this.player.flipX ? KNOCKBACK_SPEED : -KNOCKBACK_SPEED;
      this.knockbackVy = 0;
    }

    if (this.playerHealth <= 0) {
      this.isPlayerDying = true;
      this.playerHealth = 0;
      this.isHurt = false;
      this.isAttacking = false;
      this.player.play('pirate-death');

      // Stop active BGM track and play defeat sfx
      if (this.currentBgm) {
        this.currentBgm.stop();
      }
      this.sound.play('sfx-game-over', { volume: 0.3 });
    } else {
      this.isHurt = true;
      this.isAttacking = false;
      this.player.play('pirate-hurt');
      this.sound.play('sfx-player-hurt', { volume: 0.3 });

      this.player.setFlipX(dx < 0);

      // Trigger invulnerability cooldown
      this.isPlayerInvulnerable = true;
      this.playerInvulnerableTimer = 1000; // 1 second
      this.playerBlinkTimer = 0;

      // Trigger camera effects
      this.cameras.main.flash(150, 255, 255, 255); // White flash
      this.cameras.main.shake(200, 0.01); // Medium camera shake
    }
  }

  private applyHitToEnemy(): void {
    // A player strike can hit multiple enemies if they are active, alive, and within player attack range.
    // This allows crowd-control gameplay.
    const px = this.player.x;
    const py = this.player.y;
    const pFlip = this.player.flipX;

    const attackRect = new Phaser.Geom.Rectangle(
      pFlip ? px + 15 : px - 110,
      py - 85,
      95,
      70
    );

    this.enemies.forEach((e) => {
      if (e.state === 'dead') return;

      const enemyHitbox = new Phaser.Geom.Rectangle(
        e.sprite.x - 25,
        e.sprite.y - 110,
        50,
        110
      );

      if (Phaser.Geom.Rectangle.Overlaps(attackRect, enemyHitbox)) {
        // Calculate knockback direction
        const dx = e.sprite.x - px;
        const dy = e.sprite.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          e.knockbackVx = (dx / dist) * KNOCKBACK_SPEED;
          e.knockbackVy = (dy / dist) * KNOCKBACK_SPEED;
        } else {
          e.knockbackVx = e.sprite.flipX ? -KNOCKBACK_SPEED : KNOCKBACK_SPEED;
          e.knockbackVy = 0;
        }

        e.health -= 1;
        this.sound.play('sfx-enemy-hurt', { volume: 0.3 });

        if (e.health <= 0) {
          e.state = 'dead';
          e.deathPhase = 'animating';
          e.deathTimer = 1250; // Death animation duration (10 frames at 8fps = 1250ms)
          e.health = 0;
          e.sprite.play('skeleton-death');

          this.roundEnemiesRemaining--;
          this.totalEnemiesDefeated++;

          // Spawn reward coin
          this.spawnCoin(e.sprite.x, e.sprite.y);

          // Major screen shake, hit stop, and bone explosion
          this.hitStopTimer = 150;
          this.cameras.main.shake(250, 0.015);
          this.boneEmitter.explode(20, e.sprite.x, e.sprite.y - 45);

          // Check if we just defeated the last enemy in the round (and no pending spawns)
          const activeAliveCount = this.enemies.filter(x => x.state !== 'dead').length;
          if (this.roundEnemiesRemaining === 0 && activeAliveCount === 0 && !this.inIntermission && !this.isPlayerDead) {
            this.triggerRoundIntermission();
          }
        } else {
          e.state = 'hurt';
          e.sprite.play('skeleton-hurt');
          e.sprite.setFlipX(dx < 0);

          // Minor screen shake, hit stop, sparks and bones burst
          this.hitStopTimer = 50;
          this.cameras.main.shake(100, 0.005);
          this.sparkEmitter.explode(8, e.sprite.x, e.sprite.y - 45);
          this.boneEmitter.explode(4, e.sprite.x, e.sprite.y - 45);
        }
      }
    });
  }

  // ── Background Music Controls ───────────────────────────────
  private playBgm(key: string): void {
    if (this.currentBgm) {
      this.currentBgm.stop();
    }
    
    this.currentBgmKey = key;
    this.currentBgm = this.sound.add(key, { loop: true, volume: 0.08 }); // Reduced volume for ear-pleasing background level
    this.currentBgm.play();
  }

  // ── HUD Text Controls ───────────────────────────────────────
  private createHUDTexts(): void {
    const cam = this.cameras.main;

    const textStyle = {
      color: '#e2e8f0',
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold'
    };

    // Right side HUD layout
    this.hudTextRound = this.add.text(cam.width - 240, 20, 'ROUND: 1', textStyle).setDepth(1020).setScrollFactor(0);
    this.hudTextRemaining = this.add.text(cam.width - 240, 42, 'ENEMIES LEFT: 0', textStyle).setDepth(1020).setScrollFactor(0);
    this.hudTextDefeated = this.add.text(cam.width - 240, 64, 'DEFEATED: 0', textStyle).setDepth(1020).setScrollFactor(0);
    this.hudTextTime = this.add.text(cam.width - 240, 86, 'TIME: 00:00', textStyle).setDepth(1020).setScrollFactor(0);

    // Left side health hearts HUD layout
    const startX = 40;
    const startY = 40;
    for (let i = 0; i < PLAYER_MAX_HEALTH; i++) {
      const heart = this.add.image(startX + i * 36, startY, 'particle-heart');
      heart.setDepth(1020);
      heart.setScrollFactor(0);
      this.heartImages.push(heart);
    }
    this.previousHealth = this.playerHealth;
  }

  private destroyHUDTexts(): void {
    if (this.hudTextRound) this.hudTextRound.destroy();
    if (this.hudTextRemaining) this.hudTextRemaining.destroy();
    if (this.hudTextDefeated) this.hudTextDefeated.destroy();
    if (this.hudTextTime) this.hudTextTime.destroy();

    this.hudTextRound = undefined;
    this.hudTextRemaining = undefined;
    this.hudTextDefeated = undefined;
    this.hudTextTime = undefined;

    this.heartImages.forEach(h => h.destroy());
    this.heartImages = [];

    this.destroyIntermissionTexts();
  }

  // ── Draw HUD / Health Bars ──────────────────────────────────
  private drawUI(time: number): void {
    this.uiGraphics.clear();
    const cam = this.cameras.main;

    // ── 1. Draw Glassmorphic Panels for HUD ──────────────────
    // Left side panel background (glowing red border if low HP)
    const lowHp = this.playerHealth <= 1;
    const bezelColor = lowHp && Math.floor(time / 200) % 2 === 0 ? 0xef4444 : 0x334155;
    this.uiGraphics.fillStyle(0x0f172a, 0.65);
    this.uiGraphics.fillRoundedRect(20, 15, 210, 50, 10);
    this.uiGraphics.lineStyle(2, bezelColor, 0.8);
    this.uiGraphics.strokeRoundedRect(20, 15, 210, 50, 10);

    // Right side panel background
    this.uiGraphics.fillStyle(0x0f172a, 0.65);
    this.uiGraphics.fillRoundedRect(cam.width - 260, 12, 240, 96, 10);
    this.uiGraphics.lineStyle(2, 0x334155, 0.8);
    this.uiGraphics.strokeRoundedRect(cam.width - 260, 12, 240, 96, 10);

    // ── 2. Update text fields in HUD ──────────────────────────
    if (this.hudTextRound) {
      this.hudTextRound.setText(`ROUND: ${this.currentRound}`);
    }
    if (this.hudTextRemaining) {
      this.hudTextRemaining.setText(`ENEMIES LEFT: ${this.roundEnemiesRemaining}`);
    }
    if (this.hudTextDefeated) {
      this.hudTextDefeated.setText(`DEFEATED: ${this.totalEnemiesDefeated}`);
    }
    if (this.hudTextTime) {
      const minutes = Math.floor(this.survivalTime / 60).toString().padStart(2, '0');
      const seconds = Math.floor(this.survivalTime % 60).toString().padStart(2, '0');
      this.hudTextTime.setText(`TIME: ${minutes}:${seconds}`);
    }

    // ── 3. Update Health Hearts HUD ───────────────────────────
    this.heartImages.forEach((heart, i) => {
      heart.setVisible(i < this.playerHealth);
    });

    // Trigger scale pulse yoyo tween on HP change
    if (this.playerHealth !== this.previousHealth) {
      this.heartImages.forEach((heart, i) => {
        if (i < this.playerHealth) {
          this.tweens.add({
            targets: heart,
            scale: 1.45,
            duration: 100,
            yoyo: true,
            ease: 'Quad.easeOut'
          });
        }
      });
      this.previousHealth = this.playerHealth;
    }

    // ── 4. Draw Enemy Health Bars (Above heads, if alive) ─────
    this.enemies.forEach((e) => {
      if (e.state === 'dead' || !e.sprite.active) return;

      const ex = e.sprite.x;
      const ey = e.sprite.y;
      const eWidth = 60;
      const eHeight = 8;
      const barX = ex - eWidth / 2;
      const barY = ey - 140;

      // Background bezel
      this.uiGraphics.fillStyle(0x0f172a, 0.8);
      this.uiGraphics.fillRect(barX - 2, barY - 2, eWidth + 4, eHeight + 4);
      this.uiGraphics.lineStyle(1, 0x475569, 1);
      this.uiGraphics.strokeRect(barX - 2, barY - 2, eWidth + 4, eHeight + 4);

      // Fill
      if (e.health > 0) {
        const fillWidth = eWidth * (e.health / e.maxHealth);
        this.uiGraphics.fillStyle(0xf43f5e, 1);
        this.uiGraphics.fillRect(barX, barY, fillWidth, eHeight);
      }
    });

    // ── 5. Draw Red Low-Health Warning Flash ──────────────────
    if (this.redFlashGraphics) {
      this.redFlashGraphics.clear();
      // Only draw flash when health is below 2 (1 or 0)
      if (this.playerHealth < 2 && !this.isPlayerDead && !this.isPlayerDying) {
        // Pulse alpha between 0.04 and 0.28 over a 1.2-second period
        const pulse = 0.16 + Math.sin(time / 200) * 0.12;
        this.redFlashGraphics.fillStyle(0xef4444, pulse);
        this.redFlashGraphics.fillRect(0, 0, cam.width, cam.height);
      }
    }
  }

  // ── Polished Game Over UI overlay ───────────────────────────
  private showGameOverUI(): void {
    const cam = this.cameras.main;

    // Dark screen overlay
    this.gameOverOverlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x090d16, 0.85);
    this.gameOverOverlay.setOrigin(0, 0);
    this.gameOverOverlay.setDepth(10000);

    // Container for panel & text
    this.gameOverContainer = this.add.container(0, 0);
    this.gameOverContainer.setDepth(10010);

    // Panel background
    const panel = this.add.image(cam.centerX, cam.centerY, 'ui-panel');
    this.gameOverContainer.add(panel);

    // Title
    const title = this.add.text(cam.centerX, cam.centerY - 130, 'GAME OVER', {
      color: '#f43f5e',
      fontFamily: 'monospace',
      fontSize: '44px',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.gameOverContainer.add(title);

    // Subtitle / Stats summary
    const mins = Math.floor(this.survivalTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(this.survivalTime % 60).toString().padStart(2, '0');
    const statsText = `Survived: ${mins}:${secs} | Round reached: ${this.currentRound}\nTotal Skeletons Defeated: ${this.totalEnemiesDefeated}`;

    const subtitle = this.add.text(cam.centerX, cam.centerY - 60, statsText, {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '15px',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);
    this.gameOverContainer.add(subtitle);

    // Buttons Setup
    this.gameOverButtons = [];
    this.gameOverActions = [];
    this.gameOverSelectedIndex = 0;

    const btnConfigs = [
      {
        label: 'Restart',
        action: () => {
          this.clearGameOverUI();
          this.scene.restart();
        }
      },
      {
        label: 'Back to Menu',
        action: () => {
          this.clearGameOverUI();
          this.scene.start(SCENE_KEYS.MainMenu);
        }
      }
    ];

    btnConfigs.forEach((cfg, index) => {
      const btn = createTextButton(this, {
        x: cam.centerX,
        y: cam.centerY + 45 + index * 80,
        width: 320,
        height: 60,
        label: cfg.label,
        onClick: cfg.action,
        onHover: () => this.setGameOverSelection(index)
      });
      this.gameOverContainer?.add(btn.group);
      this.gameOverButtons.push(btn);
      this.gameOverActions.push(cfg.action);
    });

    this.setGameOverSelection(0);
  }

  private setGameOverSelection(index: number): void {
    this.gameOverSelectedIndex = index;
    this.gameOverButtons.forEach((btn, idx) => {
      btn.setSelected(idx === index);
    });
  }

  private clearGameOverUI(): void {
    if (this.gameOverOverlay) {
      this.gameOverOverlay.destroy();
      this.gameOverOverlay = undefined;
    }
    if (this.gameOverContainer) {
      this.gameOverContainer.destroy();
      this.gameOverContainer = undefined;
    }
    this.gameOverButtons = [];
    this.gameOverActions = [];
  }

  // ── Debug Bounds Rendering ──────────────────────────────────
  private drawDebugBounds(state: any): void {
    this.debugGraphics.clear();

    const showVisual = state.showVisualBounds;
    const showHitbox = state.showHitboxes;
    const showAttackbox = state.showAttackboxes;

    if (!showVisual && !showHitbox && !showAttackbox) {
      return;
    }

    // Colors
    const colorVisual = 0x10b981; // Green
    const colorHitbox = 0x3b82f6; // Blue
    const colorAttack = 0xef4444; // Red

    // ── Draw Pirate ───────────────────────────────────────────
    if (this.player && this.player.active && !this.isPlayerDead) {
      const px = this.player.x;
      const py = this.player.y;
      const pFlip = this.player.flipX;

      if (showVisual) {
        this.debugGraphics.lineStyle(2, colorVisual, 1);
        this.debugGraphics.strokeRect(px - 64, py - 128, 128, 128);
      }

      if (showHitbox) {
        this.debugGraphics.lineStyle(2, colorHitbox, 1);
        this.debugGraphics.strokeRect(px - 17, py - 90, 34, 90);
      }

      if (showAttackbox && this.isAttacking) {
        const frame = this.player.anims.currentFrame?.index;
        if (frame && frame >= 4 && frame <= 6) {
          this.debugGraphics.lineStyle(2, colorAttack, 1);
          if (!pFlip) {
            this.debugGraphics.strokeRect(px - 110, py - 85, 95, 70);
          } else {
            this.debugGraphics.strokeRect(px + 15, py - 85, 95, 70);
          }
        }
      }
    }

    // ── Draw Skeletons ────────────────────────────────────────
    this.enemies.forEach((e) => {
      if (e.state === 'dead' || !e.sprite.active) return;

      const ex = e.sprite.x;
      const ey = e.sprite.y;
      const eFlip = e.sprite.flipX;

      if (showVisual) {
        this.debugGraphics.lineStyle(2, colorVisual, 1);
        this.debugGraphics.strokeRect(ex - 64, ey - 128, 128, 128);
      }

      if (showHitbox) {
        this.debugGraphics.lineStyle(2, colorHitbox, 1);
        this.debugGraphics.strokeRect(ex - 25, ey - 110, 50, 110);
      }

      if (showAttackbox && e.state === 'attack') {
        const frame = e.sprite.anims.currentFrame?.index;
        if (frame && frame >= 4 && frame <= 6) {
          this.debugGraphics.lineStyle(2, colorAttack, 1);
          if (!eFlip) {
            this.debugGraphics.strokeRect(ex - 90, ey - 80, 70, 60);
          } else {
            this.debugGraphics.strokeRect(ex + 20, ey - 80, 70, 60);
          }
        }
      }
    });
  }

  // ── Coin / Loot Mechanics ──────────────────────────────────
  private spawnCoin(x: number, y: number): void {
    if (Math.random() > PROGRESSION_CONFIG.coinDropRate) {
      return;
    }

    // Spawn coin slightly offset vertically (mid-air / chest level)
    const coinSprite = this.add.sprite(x, y - 40, 'coin-loot');
    coinSprite.setScale(1.1);
    coinSprite.setDepth(15);

    const glowGraphics = this.add.graphics();
    glowGraphics.setDepth(14);

    // Horizontal drift in direction of player (40 to 80 px/s)
    const toPlayerX = this.player.x - x;
    const dirX = toPlayerX >= 0 ? 1 : -1;
    const vx = dirX * (40 + Math.random() * 40);
    // Vertical pop-up velocity (-180 to -260 px/s)
    const vy = -180 - Math.random() * 80;

    const coin: CoinInstance = {
      sprite: coinSprite,
      glowGraphics: glowGraphics,
      x: x,
      y: y - 40,
      vx: vx,
      vy: vy,
      spawnX: x,
      spawnY: y, // Landing ground target
      targetY: y,
      bounceTimer: 0,
      lifetimeTimer: PROGRESSION_CONFIG.coinLifetimeMs + PROGRESSION_CONFIG.coinBlinkDurationMs,
      state: 'pop'
    };

    this.coins.push(coin);
  }

  private updateCoins(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;

    this.coins = this.coins.filter((coin) => {
      const { sprite, glowGraphics } = coin;

      if (!sprite.active) {
        glowGraphics.destroy();
        return false;
      }

      switch (coin.state) {
        case 'pop': {
          // Physics simulation for bounce
          coin.vy += 700 * dt; // Gravity acceleration
          coin.x += coin.vx * dt;
          coin.y += coin.vy * dt;

          // Stay within walkable horizontal screen boundaries
          coin.x = Phaser.Math.Clamp(coin.x, WALK_X_MIN, WALK_X_MAX);

          // Landing check
          if (coin.y >= coin.spawnY) {
            coin.y = coin.spawnY;
            if (coin.vy > 80) {
              coin.vy = -coin.vy * 0.45; // Dampened bounce
              coin.vx *= 0.6;            // Friction on landing
            } else {
              coin.vy = 0;
              coin.vx = 0;
              coin.state = 'idle';
            }
          }
          sprite.setPosition(coin.x, coin.y);
          break;
        }

        case 'idle': {
          coin.lifetimeTimer -= dt * 1000;

          // Magnet range check (relative to player waist y - 20)
          const dist = Phaser.Math.Distance.Between(px, py - 20, coin.x, coin.y);
          if (dist < PROGRESSION_CONFIG.coinPickupRadius && !this.isPlayerDead && !this.isPlayerDying) {
            coin.state = 'magnet';
          } else if (coin.lifetimeTimer <= 0) {
            sprite.destroy();
            glowGraphics.destroy();
            return false;
          } else if (coin.lifetimeTimer <= PROGRESSION_CONFIG.coinBlinkDurationMs) {
            // Blink when close to expiring
            const blink = Math.floor(coin.lifetimeTimer / 100) % 2 === 0;
            sprite.alpha = blink ? 1 : 0.25;
          }
          break;
        }

        case 'magnet': {
          // Fly to player center/chest
          const targetX = px;
          const targetY = py - 25;
          const dx = targetX - coin.x;
          const dy = targetY - coin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 15) {
            this.collectCoin(coin);
            return false;
          }

          const moveStep = PROGRESSION_CONFIG.coinMagnetSpeed * dt;
          if (moveStep >= dist) {
            this.collectCoin(coin);
            return false;
          }

          coin.x += (dx / dist) * moveStep;
          coin.y += (dy / dist) * moveStep;
          sprite.setPosition(coin.x, coin.y);
          break;
        }
      }

      // Draw dynamic pulsing glow & core
      glowGraphics.clear();
      if (sprite.alpha > 0.25 || coin.state !== 'idle' || Math.floor(coin.lifetimeTimer / 100) % 2 === 0) {
        const pulse = 1 + Math.sin(this.time.now / 150) * 0.12;

        // Semi-transparent outer golden circle
        glowGraphics.fillStyle(0xfef08a, 0.18 * sprite.alpha);
        glowGraphics.fillCircle(coin.x, coin.y, 20 * pulse);

        // Core white-gold star/center
        glowGraphics.fillStyle(0xffffff, 0.75 * sprite.alpha);
        glowGraphics.fillCircle(coin.x, coin.y, 3.5);
      }

      return true;
    });
  }

  private collectCoin(coin: CoinInstance): void {
    coin.sprite.destroy();
    coin.glowGraphics.destroy();

    // Satisfying pickup sound
    this.sound.play('sfx-coin-pickup', { volume: 0.45 });

    // Restore exactly 1 HP (up to max 5)
    this.playerHealth = Phaser.Math.Clamp(this.playerHealth + PROGRESSION_CONFIG.coinHpRestored, 0, PLAYER_MAX_HEALTH);

    // Expand-and-fade ring visual effect
    const ring = this.add.graphics();
    ring.setDepth(20);
    this.tweens.addCounter({
      from: 5,
      to: 35,
      duration: 250,
      onUpdate: (tween) => {
        const val = tween.getValue() ?? 5;
        const alpha = 1 - (val - 5) / 30;
        ring.clear();
        ring.lineStyle(2.5, 0xfef08a, alpha);
        ring.strokeCircle(coin.x, coin.y, val);
      },
      onComplete: () => {
        ring.destroy();
      }
    });
  }
}
