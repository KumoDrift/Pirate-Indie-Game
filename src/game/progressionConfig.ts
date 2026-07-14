/**
 * Round Progression Configuration Settings
 * Feel free to tweak these values to balance the game's difficulty,
 * spawn pacing, and enemy limits.
 */
export const PROGRESSION_CONFIG = {
  // ── Round Settings ──────────────────────────────────────────
  intermissionDurationMs: 2500,  // Brief pause (2-3s) between rounds
  maxSimultaneousEnemies: 4,      // Caps how many enemies can be on screen at once

  // ── Spawn Pacing ────────────────────────────────────────────
  baseSpawnIntervalMs: 2000,     // Initial delay between enemy spawns
  spawnIntervalDecreasePerRoundMs: 150, // Reduces spawn interval per round
  minSpawnIntervalMs: 800,       // Cap spawn speed so player has time to react

  // ── Enemy Settings ──────────────────────────────────────────
  enemyMaxHealth: 3,
  enemySpeed: 120,               // Slower than player (240)
  enemyAttackRange: 90,
  enemyAttackCooldownMs: 1500,
  enemyAttackHitFrame: 4,        // Frame at which the attack "connects"
  enemyStalkDistance: 180,       // Minimum distance waiting enemies keep from player
  enemyStalkSpeedMultiplier: 0.45, // Speed multiplier for waiting enemies (makes them crawl/stalk slowly)

  // ── Enemy Death Timings (Configurable) ──────────────────────
  enemyLyingMs: 1000,            // Time spent collapsed on ground
  enemyBlinkingMs: 1000,         // Time spent blinking
  enemyRespawnMs: 1000,          // Delay after disappearing before respawning

  // ── Coin/Loot Drop Settings ─────────────────────────────────
  coinDropRate: 1.0,             // 100% chance for a defeated skeleton to drop a coin
  coinLifetimeMs: 1500,          // Time the coin rests on the ground (1.5 seconds)
  coinBlinkDurationMs: 500,      // Duration the coin blinks before disappearing (0.5 seconds)
  coinHpRestored: 1,             // Exactly 1 HP restored per coin
  coinPickupRadius: 65,          // Forgiving radius for smooth collection
  coinMagnetSpeed: 550,          // Speed at which the coin flies to the player
  coinBounceHeight: 45,          // Max vertical bounce height for the pop-out animation
  coinPopOutDurationMs: 400,     // Time in milliseconds for the pop-out animation to complete

  // ── Helper: Fibonacci Progression ───────────────────────────
  /**
   * Generates Fibonacci count of enemies per round:
   * Round 1: 1
   * Round 2: 2
   * Round 3: 3
   * Round 4: 5
   * Round 5: 8
   * Round 6: 13
   * ...
   */
  getEnemiesCountForRound(round: number): number {
    if (round <= 1) return 1;
    if (round === 2) return 2;
    let prev = 1;
    let curr = 2;
    for (let i = 3; i <= round; i++) {
      const next = prev + curr;
      prev = curr;
      curr = next;
    }
    return curr;
  }
};
