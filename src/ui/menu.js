import { drawText, drawRoundRect, drawCircle, drawProgressArc, drawEmoji, clearCanvas } from '../utils/canvas-helpers.js';
import { Gesture } from '../gesture-engine.js';

export class Menu {
  constructor(games) {
    this.games = games;  // Array of game classes
    this.hoveredIndex = -1;
    this.hoverTime = 0;
    this.SELECT_HOLD_TIME = 1.5; // seconds to hold to select
    this.selectedCallback = null;

    // UI layout params
    this.cardWidth = 200;
    this.cardHeight = 280;
    this.gap = 40;
  }

  onSelect(callback) {
    this.selectedCallback = callback;
  }

  update(dt, gestureState, canvasWidth, canvasHeight) {
    if (!gestureState || !gestureState.detected) {
      this.hoveredIndex = -1;
      this.hoverTime = 0;
      return;
    }

    const cursorX = gestureState.palmX * canvasWidth;
    const cursorY = gestureState.palmY * canvasHeight;

    const totalWidth = this.games.length * this.cardWidth + (this.games.length - 1) * this.gap;
    const startX = (canvasWidth - totalWidth) / 2;
    const startY = (canvasHeight - this.cardHeight) / 2;

    let currentlyHovered = -1;

    for (let i = 0; i < this.games.length; i++) {
      const cardX = startX + i * (this.cardWidth + this.gap);
      const cardY = startY;

      if (cursorX >= cardX && cursorX <= cardX + this.cardWidth &&
        cursorY >= cardY && cursorY <= cardY + this.cardHeight) {
        currentlyHovered = i;
        break;
      }
    }

    if (currentlyHovered !== -1 && gestureState.gesture === Gesture.POINT) {
      if (this.hoveredIndex === currentlyHovered) {
        this.hoverTime += dt;
        if (this.hoverTime >= this.SELECT_HOLD_TIME) {
          if (this.selectedCallback) {
            this.selectedCallback(this.hoveredIndex);
          }
          this.hoverTime = 0;
          this.hoveredIndex = -1;
        }
      } else {
        this.hoveredIndex = currentlyHovered;
        this.hoverTime = 0;
      }
    } else {
      this.hoveredIndex = currentlyHovered;
      this.hoverTime = 0;
    }
  }

  render(ctx, width, height, gestureState) {
    clearCanvas(ctx, width, height, '#0f0f23');

    // Title
    drawText(ctx, 'GESTURE GAMES', width / 2, 70, {
      font: 'bold 40px "Press Start 2P", monospace',
      color: '#00ffff',
      outlineColor: '#003344',
      outlineWidth: 4
    });
    drawText(ctx, '☝️ Point at a game to select', width / 2, 130, {
      font: '14px "Press Start 2P", monospace',
      color: '#888888',
      outlineWidth: 2
    });

    const totalWidth = this.games.length * this.cardWidth + (this.games.length - 1) * this.gap;
    const startX = (width - totalWidth) / 2;
    const startY = (height - this.cardHeight) / 2;

    for (let i = 0; i < this.games.length; i++) {
      const meta = this.games[i].meta || { name: 'Unknown', color: '#444', icon: '❓', difficulty: 'Normal' };
      const cardX = startX + i * (this.cardWidth + this.gap);
      const cardY = startY;

      const isHovered = this.hoveredIndex === i;
      const scale = isHovered ? 1.05 : 1.0;

      ctx.save();
      ctx.translate(cardX + this.cardWidth / 2, cardY + this.cardHeight / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(cardX + this.cardWidth / 2), -(cardY + this.cardHeight / 2));

      // Card background gradient
      const gradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + this.cardHeight);
      gradient.addColorStop(0, meta.color || '#444444');
      gradient.addColorStop(1, '#1a1a2e');

      if (isHovered) {
        ctx.shadowColor = meta.color || '#ffffff';
        ctx.shadowBlur = 25;
      }

      drawRoundRect(ctx, cardX, cardY, this.cardWidth, this.cardHeight, 15, gradient, isHovered ? '#ffffff' : null);
      ctx.shadowBlur = 0;

      // Icon
      drawEmoji(ctx, meta.icon, cardX + this.cardWidth / 2, cardY + 80, 60);

      // Name
      drawText(ctx, meta.name, cardX + this.cardWidth / 2, cardY + 160, {
        font: 'bold 14px "Press Start 2P", monospace',
        color: '#ffffff',
        outlineWidth: 2
      });

      // Difficulty badge
      const diffColor = meta.difficulty === 'easy' ? '#44cc44' : meta.difficulty === 'medium' ? '#ffaa00' : '#ff4444';
      drawText(ctx, meta.difficulty.toUpperCase(), cardX + this.cardWidth / 2, cardY + 200, {
        font: '10px "Press Start 2P", monospace',
        color: diffColor,
        outlineWidth: 2
      });

      // Selection progress arc
      if (isHovered && this.hoverTime > 0) {
        const progress = this.hoverTime / this.SELECT_HOLD_TIME;
        drawProgressArc(ctx, cardX + this.cardWidth / 2, cardY + 80, 45, progress, '#00ff88');
      }

      ctx.restore();
    }

    // Cursor
    if (gestureState && gestureState.detected) {
      const cursorX = gestureState.palmX * width;
      const cursorY = gestureState.palmY * height;

      // Glow
      ctx.save();
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 15;
      drawCircle(ctx, cursorX, cursorY, 8, '#00ff88', '#ffffff', 2);
      ctx.restore();

      if (gestureState.gesture === Gesture.POINT) {
        drawCircle(ctx, cursorX, cursorY, 14, 'rgba(0, 255, 136, 0.3)');
      }
    } else {
      // "Show your hand" prompt
      const pulse = 0.5 + Math.sin(Date.now() / 300) * 0.5;
      drawText(ctx, '✋ Show your hand to navigate', width / 2, height - 120, {
        font: 'bold 16px "Press Start 2P", monospace',
        color: `rgba(255, 170, 0, ${pulse})`
      });
    }

    // Controls Pane at the bottom
    const paneWidth = 900;
    const paneHeight = 85;
    const paneX = (width - paneWidth) / 2;
    const paneY = height - paneHeight - 20;

    drawRoundRect(ctx, paneX, paneY, paneWidth, paneHeight, 10, 'rgba(20, 20, 40, 0.8)', '#00ff88');

    drawText(ctx, '🎮 QUICK CONTROLS', width / 2, paneY + 25, { font: '12px "Press Start 2P"', color: '#ffffff' });

    drawText(ctx, '🎈 Balloon: point | 🍉 Slice: FAST SWIPE | ✊ RPS: FIST/PALM/PEACE', width / 2, paneY + 50, {
      font: '10px "Press Start 2P", monospace', color: '#00ffff'
    });
    drawText(ctx, '🏎️ Car: TILT (Steer) PALM (Gas) FIST (Brake) | ⚙️ Global: 🤘 ROCK (Pause)', width / 2, paneY + 70, {
      font: '10px "Press Start 2P", monospace', color: '#00ffff'
    });

    // Difficulty Button
    window.gameDifficultyStr = window.gameDifficultyStr || 'MEDIUM';
    const diffBtnX = width - 220;
    const diffBtnY = 20;
    const diffBtnW = 200;
    const diffBtnH = 50;

    let hoverDiff = false;
    if (gestureState && gestureState.detected) {
      const cursorX = gestureState.palmX * width;
      const cursorY = gestureState.palmY * height;
      if (cursorX >= diffBtnX && cursorX <= diffBtnX + diffBtnW &&
          cursorY >= diffBtnY && cursorY <= diffBtnY + diffBtnH) {
          hoverDiff = true;
      }
      
      // Toggle on pinch
      if (hoverDiff && gestureState.gesture === Gesture.PINCH) {
        if (!this.wasPinchingDiff) {
          const diffs = ['EASY', 'MEDIUM', 'HARD'];
          const multipliers = [0.7, 1.0, 1.5];
          let idx = diffs.indexOf(window.gameDifficultyStr);
          idx = (idx + 1) % diffs.length;
          window.gameDifficultyStr = diffs[idx];
          window.gameDifficulty = multipliers[idx];
          this.wasPinchingDiff = true;
        }
      } else {
        this.wasPinchingDiff = false;
      }
    }

    drawRoundRect(ctx, diffBtnX, diffBtnY, diffBtnW, diffBtnH, 8, hoverDiff ? '#444' : '#222', hoverDiff ? '#00ff88' : '#555');
    drawText(ctx, `DIFF: ${window.gameDifficultyStr}`, diffBtnX + diffBtnW/2, diffBtnY + 30, {
      font: '12px "Press Start 2P", monospace',
      color: hoverDiff ? '#00ff88' : '#fff'
    });
  }
}
