import { drawText, drawRoundRect, drawProgressArc } from '../utils/canvas-helpers.js';
import { Gesture } from '../gesture-engine.js';

export class HUD {
  constructor() {
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.showFps = true;
    this.scoreScale = 1;
    this.lastScore = 0;
  }

  updateFps(dt) {
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  render(ctx, game, width, height, gestureState, dt) {
    // Score pulse effect
    if (game.score !== this.lastScore) {
      this.scoreScale = 1.4;
      this.lastScore = game.score;
    }
    this.scoreScale = Math.max(1, this.scoreScale - 2.0 * (dt || 0.016));

    // Top-center: Score
    ctx.save();
    ctx.translate(width / 2, 35);
    ctx.scale(this.scoreScale, this.scoreScale);
    drawText(ctx, `${game.score}`, 0, 0, {
      font: 'bold 28px "Press Start 2P", monospace',
      color: '#ffffff',
      outlineWidth: 4
    });
    ctx.restore();

    // Top-right: Timer
    const timeRemaining = Math.max(0, game.timeLeft);
    const isLow = timeRemaining <= 10;
    const timeColor = isLow ? '#ff4444' : '#ffffff';
    const timeFont = isLow ? 'bold 22px "Press Start 2P", monospace' : '18px "Press Start 2P", monospace';
    drawText(ctx, `${Math.ceil(timeRemaining)}s`, width - 30, 35, {
      font: timeFont,
      color: timeColor,
      align: 'right',
      outlineWidth: 3
    });

    // Bottom-left: FPS counter
    if (this.showFps) {
      const fpsColor = this.fps < 20 ? '#ff4444' : this.fps < 30 ? '#ffaa00' : '#44cc44';
      drawText(ctx, `${this.fps} FPS`, 15, height - 15, {
        font: '10px "Press Start 2P", monospace',
        color: fpsColor,
        align: 'left',
        baseline: 'bottom',
        outlineWidth: 2
      });
    }

    // Hand not detected warning
    if (!gestureState || !gestureState.detected) {
      drawRoundRect(ctx, width / 2 - 150, height - 80, 300, 45, 10, 'rgba(0, 0, 0, 0.7)');
      drawText(ctx, '✋ Show your hand!', width / 2, height - 57, {
        font: 'bold 14px "Press Start 2P", monospace',
        color: '#ffaa00'
      });
    }

    // Rock hold → pause progress
    if (gestureState && gestureState.gesture === Gesture.ROCK && game.isRunning) {
      const cx = gestureState.palmX * width;
      const cy = gestureState.palmY * height;
      drawProgressArc(ctx, cx, cy, 35, 0.5, '#ffffff');
      drawText(ctx, 'Pausing...', cx, cy - 55, {
        font: '12px "Press Start 2P", monospace',
        color: '#ffffff'
      });
    }
  }
}
