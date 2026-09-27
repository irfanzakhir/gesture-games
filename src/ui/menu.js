import { drawText, drawRoundRect, drawCircle, drawProgressArc, drawEmoji, clearCanvas } from '../utils/canvas-helpers.js';
import { Gesture } from '../gesture-engine.js';
import { audio } from '../utils/audio.js';

export class Menu {
  constructor(games) {
    this.games = games;
    this.hoveredIndex = -1;
    this.hoverTime = 0;
    this.SELECT_HOLD_TIME = 1.0; // reduced to 1 sec per request
    this.selectedCallback = null;

    this.state = 'GAMES'; // 'GAMES' or 'DIFFICULTY'
    this.selectedGameIndex = -1;
    
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

    if (this.state === 'GAMES') {
      this._updateGamesList(dt, cursorX, cursorY, gestureState, canvasWidth, canvasHeight);
    } else if (this.state === 'DIFFICULTY') {
      this._updateDifficulty(dt, cursorX, cursorY, gestureState, canvasWidth, canvasHeight);
    }
  }
  
  _updateGamesList(dt, cursorX, cursorY, gestureState, canvasWidth, canvasHeight) {
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
          audio.play('select');
          this.selectedGameIndex = this.hoveredIndex;
          this.state = 'DIFFICULTY';
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

  _updateDifficulty(dt, cursorX, cursorY, gestureState, canvasWidth, canvasHeight) {
    const diffs = ['EASY', 'MEDIUM', 'HARD'];
    const multipliers = [0.7, 1.0, 1.5];
    
    const btnW = 200;
    const btnH = 80;
    const gap = 30;
    const totalWidth = 3 * btnW + 2 * gap;
    const startX = (canvasWidth - totalWidth) / 2;
    const startY = canvasHeight / 2 - btnH / 2;

    let currentlyHovered = -1;
    for (let i = 0; i < 3; i++) {
      const bx = startX + i * (btnW + gap);
      const by = startY;
      if (cursorX >= bx && cursorX <= bx + btnW && cursorY >= by && cursorY <= by + btnH) {
        currentlyHovered = i;
        break;
      }
    }
    
    // Allow point or open palm or pinch to select difficulty
    const isGesturing = gestureState.gesture === Gesture.POINT || gestureState.gesture === Gesture.PINCH;

    if (currentlyHovered !== -1 && isGesturing) {
      if (this.hoveredIndex === currentlyHovered) {
        this.hoverTime += dt;
        if (this.hoverTime >= 1.0) { // 1 sec as requested
          audio.play('win');
          window.gameDifficultyStr = diffs[this.hoveredIndex];
          window.gameDifficulty = multipliers[this.hoveredIndex];
          
          if (this.selectedCallback) {
            this.selectedCallback(this.selectedGameIndex);
          }
          
          // Reset menu for next time
          this.state = 'GAMES';
          this.hoverTime = 0;
          this.hoveredIndex = -1;
          this.selectedGameIndex = -1;
        }
      } else {
        this.hoveredIndex = currentlyHovered;
        this.hoverTime = 0;
      }
    } else {
      this.hoveredIndex = currentlyHovered;
      this.hoverTime = 0;
    }
    
    // Allow canceling back to GAMES state with Thumbs Down
    if (gestureState.gesture === Gesture.THUMBS_DOWN) {
      this.state = 'GAMES';
      this.hoverTime = 0;
      this.hoveredIndex = -1;
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

    if (this.state === 'GAMES') {
      this._renderGamesList(ctx, width, height);
    } else if (this.state === 'DIFFICULTY') {
      // Draw games list dimmed in background
      ctx.globalAlpha = 0.3;
      this._renderGamesList(ctx, width, height);
      ctx.globalAlpha = 1.0;
      
      this._renderDifficulty(ctx, width, height);
    }

    // Cursor
    if (gestureState && gestureState.detected) {
      const cursorX = gestureState.palmX * width;
      const cursorY = gestureState.palmY * height;

      // Glow (double-circle technique instead of expensive shadowBlur)
      drawCircle(ctx, cursorX, cursorY, 14, 'rgba(0, 255, 136, 0.25)');
      drawCircle(ctx, cursorX, cursorY, 8, '#00ff88', '#ffffff', 2);

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

    if (this.state === 'GAMES') {
      this._renderControlsPane(ctx, width, height);
    }
  }

  _renderGamesList(ctx, width, height) {
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

      const isHovered = this.state === 'GAMES' && this.hoveredIndex === i;
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
        // Thick colored border instead of expensive shadowBlur
      }

      drawRoundRect(ctx, cardX, cardY, this.cardWidth, this.cardHeight, 15, gradient, isHovered ? '#ffffff' : null);
      if (isHovered) {
        // Draw a second outline for glow effect
        ctx.strokeStyle = meta.color || '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(cardX - 3, cardY - 3, this.cardWidth + 6, this.cardHeight + 6, 17);
        ctx.stroke();
      }

      // Icon
      drawEmoji(ctx, meta.icon, cardX + this.cardWidth / 2, cardY + 80, 60);

      // Name
      drawText(ctx, meta.name, cardX + this.cardWidth / 2, cardY + 160, {
        font: 'bold 14px "Press Start 2P", monospace',
        color: '#ffffff',
        outlineWidth: 2
      });

      // Removed difficulty badge as it's selected after clicking the game

      // Selection progress arc
      if (isHovered && this.hoverTime > 0) {
        const progress = this.hoverTime / this.SELECT_HOLD_TIME;
        drawProgressArc(ctx, cardX + this.cardWidth / 2, cardY + 80, 45, progress, '#00ff88');
      }

      ctx.restore();
    }
  }

  _renderDifficulty(ctx, width, height) {
    // Overlay backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);

    drawText(ctx, 'CHOOSE DIFFICULTY', width / 2, height / 2 - 100, {
      font: 'bold 24px "Press Start 2P", monospace',
      color: '#ffffff',
      outlineWidth: 3
    });
    drawText(ctx, 'Point to select | 👎 Thumbs Down to cancel', width / 2, height / 2 - 60, {
      font: '12px "Press Start 2P", monospace',
      color: '#aaaaaa'
    });

    const diffs = ['EASY', 'MEDIUM', 'HARD'];
    const colors = ['#44cc44', '#ffaa00', '#ff4444'];
    
    const btnW = 200;
    const btnH = 80;
    const gap = 30;
    const totalWidth = 3 * btnW + 2 * gap;
    const startX = (width - totalWidth) / 2;
    const startY = height / 2 - btnH / 2;

    for (let i = 0; i < 3; i++) {
      const bx = startX + i * (btnW + gap);
      const by = startY;
      const isHovered = this.hoveredIndex === i;

      drawRoundRect(ctx, bx, by, btnW, btnH, 10, isHovered ? '#333' : '#111', isHovered ? colors[i] : '#444');
      
      drawText(ctx, diffs[i], bx + btnW/2, by + btnH/2 + 6, {
        font: 'bold 16px "Press Start 2P", monospace',
        color: colors[i]
      });

      if (isHovered && this.hoverTime > 0) {
        const progress = this.hoverTime / 1.0;
        drawProgressArc(ctx, bx + btnW/2, by + btnH/2 - 25, 20, progress, colors[i]);
      }
    }
  }

  _renderControlsPane(ctx, width, height) {
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
  }
}
