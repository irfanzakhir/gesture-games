import { initCamera, drawPiP } from './camera.js';
import { initHandTracker, detectHands } from './hand-tracker.js';
import { GestureEngine, Gesture } from './gesture-engine.js';
import { GameManager, GameState } from './game-manager.js';
import { HUD } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { Transition } from './ui/transition.js';
import { clearCanvas, drawText, drawRoundRect, drawCircle } from './utils/canvas-helpers.js';
import { audio } from './utils/audio.js';

// Import games
import { BalloonPop } from './games/balloon-pop/balloon-pop.js';
import { FruitSlice } from './games/fruit-slice/fruit-slice.js';
import { RockPaperScissors } from './games/rock-paper-scissors/rps.js';
import { SteeringWheel } from './games/steering-wheel/steering-wheel.js';

async function main() {
  // 1. Get canvas and setup
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  
  const gameManager = new GameManager(canvas, ctx);
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameManager.resize(canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // 2. Init subsystems (show loading progress)
  const loadingEl = document.getElementById('loading');
  const loadingTextEl = loadingEl?.querySelector('div:last-child') || loadingEl;
  
  function setLoadingText(text) {
    if (loadingTextEl) loadingTextEl.textContent = text;
  }

  setLoadingText('Accessing camera...');
  const video = document.getElementById('webcam');
  await initCamera(video);

  setLoadingText('Loading hand tracking model...');
  const handLandmarker = await initHandTracker();

  // 3. Init game systems
  const gestureEngine = new GestureEngine();
  const hud = new HUD();
  const transition = new Transition();
  
  // 4. Register games
  gameManager.registerGame(BalloonPop);
  gameManager.registerGame(FruitSlice);
  gameManager.registerGame(RockPaperScissors);
  gameManager.registerGame(SteeringWheel);
  
  // 5. Create menu
  const menu = new Menu(gameManager.games);
  menu.onSelect(async (index) => {
    transition.start(async () => {
      await gameManager._startGame(index);
    });
  });

  // 6. Init audio on first interaction
  window.addEventListener('click', () => {
    if (audio.init) audio.init();
  }, { once: true });

  // 7. Hide loading, start calibration
  if (loadingEl) loadingEl.style.display = 'none';
  gameManager.setReady();

  // 8. Main game loop
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap dt to prevent spiral
    lastTime = now;

    // Detect hands
    const handResult = detectHands(handLandmarker, video, now);
    const gestureState = gestureEngine.update(handResult, now);

    // Update
    hud.updateFps(dt);
    transition.update(dt);

    const state = gameManager.state;

    // --- Render ---
    clearCanvas(ctx, canvas.width, canvas.height, '#0f0f23');

    switch (state) {
      case GameState.CALIBRATION:
        gameManager.update(dt, gestureState);
        drawCalibrationScreen(ctx, canvas.width, canvas.height, gestureState);
        break;

      case GameState.MENU:
        menu.update(dt, gestureState, canvas.width, canvas.height);
        menu.render(ctx, canvas.width, canvas.height, gestureState);
        break;

      case GameState.PLAYING:
      case GameState.PAUSED:
        gameManager.update(dt, gestureState);
        if (gameManager.activeGame) {
          gameManager.activeGame.render(ctx);
          hud.render(ctx, gameManager.activeGame, canvas.width, canvas.height, gestureState, dt);
        }
        if (state === GameState.PAUSED) {
          drawPauseOverlay(ctx, canvas.width, canvas.height);
        }
        break;

      case GameState.GAME_OVER:
        gameManager.update(dt, gestureState);
        if (gameManager.activeGame) {
          gameManager.activeGame.render(ctx);
        }
        drawGameOverScreen(ctx, canvas.width, canvas.height, gameManager.activeGame, gameManager.gameOverTimer, gameManager.GAME_OVER_DURATION);
        break;
    }

    // PiP webcam overlay
    drawPiP(ctx, video, canvas.width, canvas.height);

    // Transition overlay (on top of everything)
    transition.render(ctx, canvas.width, canvas.height);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

function drawCalibrationScreen(ctx, w, h, gestureState) {
  const t = Date.now() / 1000;
  
  // Big title
  ctx.save();
  const scale = 1 + Math.sin(t * 2) * 0.05;
  ctx.translate(w / 2, h / 2 - 60);
  ctx.scale(scale, scale);
  drawText(ctx, 'GESTURE', 0, -30, {
    font: 'bold 56px "Press Start 2P", monospace',
    color: '#00ffff',
    outlineColor: '#003344',
    outlineWidth: 6
  });
  drawText(ctx, 'GAMES', 0, 40, {
    font: 'bold 56px "Press Start 2P", monospace',
    color: '#ff44aa',
    outlineColor: '#440022',
    outlineWidth: 6
  });
  ctx.restore();

  // Instructions
  if (!gestureState || !gestureState.detected) {
    const pulse = 0.5 + Math.sin(t * 4) * 0.5;
    drawText(ctx, '✋ Show your hand to start', w / 2, h / 2 + 80, {
      font: 'bold 20px "Press Start 2P", monospace',
      color: `rgba(255, 170, 0, ${pulse})`
    });
  } else {
    drawText(ctx, 'Hand detected! ✓', w / 2, h / 2 + 80, {
      font: 'bold 20px "Press Start 2P", monospace',
      color: '#00ff88'
    });
    
    // Draw hand landmark dots as preview
    if (gestureState.rawLandmarks) {
      for (const lm of gestureState.rawLandmarks) {
        // Mirror X for display (same as gesture engine)
        const lx = (1 - lm.x) * w;
        const ly = lm.y * h;
        drawCircle(ctx, lx, ly, 4, '#00ff88', '#ffffff', 1);
      }
    }
  }
}

function drawPauseOverlay(ctx, w, h) {
  // Semi-transparent dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, w, h);
  
  drawText(ctx, 'PAUSED', w / 2, h / 2 - 60, {
    font: 'bold 48px "Press Start 2P", monospace',
    color: '#ffffff',
    outlineWidth: 4
  });
  
  drawText(ctx, '✋ Open palm to resume', w / 2, h / 2 + 20, {
    font: '16px "Press Start 2P", monospace',
    color: '#aaaaaa'
  });
  drawText(ctx, '👎 Thumbs down to quit', w / 2, h / 2 + 60, {
    font: '16px "Press Start 2P", monospace',
    color: '#aaaaaa'
  });
}

function drawGameOverScreen(ctx, w, h, game, timer, maxTimer) {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, w, h);
  
  drawText(ctx, 'GAME OVER', w / 2, h / 2 - 100, {
    font: 'bold 48px "Press Start 2P", monospace',
    color: '#ff4444',
    outlineWidth: 4
  });
  
  const score = game ? game.score : 0;
  const highScore = game ? game.highScore : 0;

  drawText(ctx, `Score: ${score}`, w / 2, h / 2 - 10, {
    font: 'bold 32px "Press Start 2P", monospace',
    color: '#ffffff'
  });

  if (score >= highScore && score > 0) {
    const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
    drawText(ctx, '★ NEW HIGH SCORE! ★', w / 2, h / 2 + 40, {
      font: '18px "Press Start 2P", monospace',
      color: `rgba(255, 215, 0, ${pulse})`
    });
  } else {
    drawText(ctx, `Best: ${highScore}`, w / 2, h / 2 + 40, {
      font: '18px "Press Start 2P", monospace',
      color: '#888888'
    });
  }

  // Auto-return progress bar
  const progress = Math.min(1, timer / maxTimer);
  const barWidth = 300;
  drawRoundRect(ctx, w / 2 - barWidth / 2, h / 2 + 90, barWidth, 8, 4, '#333333');
  drawRoundRect(ctx, w / 2 - barWidth / 2, h / 2 + 90, barWidth * progress, 8, 4, '#00ff88');
  
  drawText(ctx, '👍 Thumbs up to continue', w / 2, h / 2 + 130, {
    font: '14px "Press Start 2P", monospace',
    color: '#aaaaaa'
  });
}

main().catch(console.error);
