import * as Phaser from 'phaser';

const UI_BUTTON_SIZE = { width: 320, height: 60 };
const UI_PANEL_SIZE = { width: 520, height: 420 };

function generateRectangleTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  fillColor: number,
  strokeColor = 0x0f172a
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.add.graphics();

  graphics.fillStyle(fillColor, 1);
  graphics.fillRect(0, 0, width, height);
  graphics.lineStyle(3, strokeColor, 1);
  graphics.strokeRect(1.5, 1.5, width - 3, height - 3);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function registerGeneratedAssets(scene: Phaser.Scene): void {
  generateRectangleTexture(
    scene,
    'ui-button',
    UI_BUTTON_SIZE.width,
    UI_BUTTON_SIZE.height,
    0x1e293b,
    0x7dd3fc
  );
  generateRectangleTexture(
    scene,
    'ui-button-active',
    UI_BUTTON_SIZE.width,
    UI_BUTTON_SIZE.height,
    0x334155,
    0xf8fafc
  );
  generateRectangleTexture(
    scene,
    'ui-panel',
    UI_PANEL_SIZE.width,
    UI_PANEL_SIZE.height,
    0x111827,
    0x475569
  );

  generateCoinTexture(scene);
  generateSparkTexture(scene);
  generateBoneTexture(scene);
  generateHeartTexture(scene);
  generateEmptyHeartTexture(scene);
}

function generateCoinTexture(scene: Phaser.Scene): void {
  const key = 'coin-loot';
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.add.graphics();

  // Outer gold rim (darker orange-gold)
  graphics.fillStyle(0xd97706, 1);
  graphics.fillCircle(16, 16, 16);

  // Main coin face (bright gold)
  graphics.fillStyle(0xfacc15, 1);
  graphics.fillCircle(16, 16, 13.5);

  // Inner raised gold border (mid gold)
  graphics.fillStyle(0xf59e0b, 1);
  graphics.fillCircle(16, 16, 9);

  // Pirate cross design detail in the center
  graphics.lineStyle(2, 0xd97706, 1);
  graphics.strokeCircle(16, 16, 5);
  graphics.lineBetween(16, 13, 16, 19);
  graphics.lineBetween(13, 16, 19, 16);

  graphics.generateTexture(key, 32, 32);
  graphics.destroy();
}

function generateSparkTexture(scene: Phaser.Scene): void {
  const key = 'particle-spark';
  if (scene.textures.exists(key)) return;

  const graphics = scene.add.graphics();
  graphics.fillStyle(0xf97316, 1); // orange-500
  graphics.fillRect(0, 0, 6, 6);
  graphics.fillStyle(0xfacc15, 1); // yellow-400 inner
  graphics.fillRect(1.5, 1.5, 3, 3);

  graphics.generateTexture(key, 6, 6);
  graphics.destroy();
}

function generateBoneTexture(scene: Phaser.Scene): void {
  const key = 'particle-bone';
  if (scene.textures.exists(key)) return;

  const graphics = scene.add.graphics();
  graphics.fillStyle(0xe2e8f0, 1); // slate-200
  graphics.fillRect(0, 0, 8, 5);
  graphics.fillStyle(0xcbd5e1, 1); // slate-300 shadow
  graphics.fillRect(0, 3.5, 8, 1.5);

  graphics.generateTexture(key, 8, 5);
  graphics.destroy();
}

function generateHeartTexture(scene: Phaser.Scene): void {
  const key = 'particle-heart';
  if (scene.textures.exists(key)) return;

  const graphics = scene.add.graphics();
  graphics.fillStyle(0xef4444, 1); // rose-500
  graphics.fillCircle(10, 10, 8);
  graphics.fillCircle(22, 10, 8);
  graphics.fillTriangle(2.2, 11, 29.8, 11, 16, 28);

  graphics.generateTexture(key, 32, 32);
  graphics.destroy();
}

function generateEmptyHeartTexture(scene: Phaser.Scene): void {
  const key = 'particle-heart-empty';
  if (scene.textures.exists(key)) return;

  const graphics = scene.add.graphics();
  graphics.fillStyle(0x1e293b, 0.85); // Slate dark background
  graphics.lineStyle(2, 0xef4444, 1); // Red outline
  graphics.strokeCircle(10, 10, 8);
  graphics.strokeCircle(22, 10, 8);
  graphics.beginPath();
  graphics.moveTo(2.2, 11);
  graphics.lineTo(16, 28);
  graphics.lineTo(29.8, 11);
  graphics.strokePath();

  graphics.fillStyle(0xfca5a5, 0.1); // Translucent pink inner
  graphics.fillCircle(10, 10, 8);
  graphics.fillCircle(22, 10, 8);
  graphics.fillTriangle(2.2, 11, 29.8, 11, 16, 28);

  graphics.generateTexture(key, 32, 32);
  graphics.destroy();
}
