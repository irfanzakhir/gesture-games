import { BaseGame } from '../_base-game.js';
import { randInt, randFloat, dist, clamp, circlesOverlap } from '../../utils/math.js';
import { drawText, drawCircle, drawEmoji, clearCanvas } from '../../utils/canvas-helpers.js';

// Balloon types
const BalloonType = {
  REGULAR: 'regular',
  GOLD: 'gold',
  BOMB: 'bomb',
  RAINBOW: 'rainbow'
};

// Color palettes for regular balloons
const BALLOON_COLORS = [
  { main: '#ff4444', highlight: '#ff8888' },  // Red
  { main: '#4488ff', highlight: '#88bbff' },  // Blue
  { main: '#44cc44', highlight: '#88ee88' },  // Green
  { main: '#ffaa00', highlight: '#ffcc44' },  // Yellow
  { main: '#cc44ff', highlight: '#dd88ff' },  // Purple
  { main: '#ff44aa', highlight: '#ff88cc' },  // Pink
];

class Balloon {
  constructor(x, y, type, color, speed, radius) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.color = color;  // { main, highlight }
    this.speed = speed;  // pixels per second upward
    this.radius = radius;
    this.alive = true;
    this.wobble = randFloat(0, Math.PI * 2);  // Phase for horizontal wobble
    this.wobbleSpeed = randFloat(1, 3);
    this.wobbleAmount = randFloat(10, 25);
    this.hoverTime = 0;  // Time cursor has been over this balloon
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = randFloat(-200, 200);
    this.vy = randFloat(-300, -50);
    this.radius = randFloat(2, 6);
    this.color = color;
    this.life = 1;  // 1 = full, 0 = dead
    this.decay = randFloat(1.5, 3);  // life lost per second
  }
}

export class BalloonPop extends BaseGame {
  static get meta() {
    return {
      id: 'balloon-pop',
      name: 'Balloon Pop',
      description: 'Pop balloons with your finger! Watch out for bombs!',
      icon: '🎈',
      difficulty: 'easy',
      gestures: ['POINT', 'PINCH'],
      duration: 60,
      color: '#e74c3c'
    };
  }

  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.balloons = [];
    this.particles = [];
    this.stars = [];  // Background stars
    this.lives = 5;
    this.maxLives = 5;
    this.spawnTimer = 0;
    this.spawnInterval = 1.5;  // seconds between spawns, decreases over time
    this.cursorX = 0;
    this.cursorY = 0;
    this.cursorTrail = [];  // [{x, y, alpha}]
    this.comboCount = 0;
    this.comboTimer = 0;
    this.penaltyFlash = 0;  // Flash red when bomb popped
    this.difficulty = 1;  // Increases over time
  }

  async init() {
    await super.init();
    this.balloons = [];
    this.particles = [];
    this.lives = 5;
    this.spawnTimer = 0;
    this.spawnInterval = 1.5;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.penaltyFlash = 0;
    this.difficulty = 1;
    this.cursorTrail = [];
    // Generate background stars
    this.stars = Array.from({ length: 50 }, () => ({
      x: randFloat(0, this.width),
      y: randFloat(0, this.height),
      radius: randFloat(1, 3),
      speed: randFloat(10, 30),
      brightness: randFloat(0.3, 1)
    }));
  }

  update(dt, gestureState) {
    super.update(dt, gestureState);
    if (!this.isRunning) return;

    // Increase difficulty over time
    const elapsed = this.maxTime - this.timeLeft;
    this.difficulty = 1 + elapsed / 30;  // Doubles every 30 seconds
    this.spawnInterval = Math.max(0.4, 1.5 / this.difficulty);

    // Update cursor from gesture
    if (gestureState.detected) {
      this.cursorX = gestureState.palmX * this.width;
      this.cursorY = gestureState.palmY * this.height;
      // Add to trail
      this.cursorTrail.push({ x: this.cursorX, y: this.cursorY, alpha: 1 });
      if (this.cursorTrail.length > 10) this.cursorTrail.shift();
    }

    // Fade cursor trail
    for (const t of this.cursorTrail) { t.alpha -= dt * 3; }
    this.cursorTrail = this.cursorTrail.filter(t => t.alpha > 0);

    // Spawn balloons
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnBalloon();
    }

    // Update balloons
    for (const b of this.balloons) {
      b.y -= b.speed * dt;
      b.wobble += b.wobbleSpeed * dt;
      b.x += Math.sin(b.wobble) * b.wobbleAmount * dt;

      // Check if cursor is over balloon
      if (gestureState.detected) {
        const touching = circlesOverlap(this.cursorX, this.cursorY, 15, b.x, b.y, b.radius);
        if (touching) {
          b.hoverTime += dt;
          // Pop if pinch gesture OR hover for 0.3s while pointing
          const shouldPop = gestureState.gesture === 'PINCH' ||
                           (gestureState.gesture === 'POINT' && b.hoverTime >= 0.3);
          if (shouldPop) {
            this._popBalloon(b);
          }
        } else {
          b.hoverTime = 0;
        }
      }

      // Balloon escaped off top
      if (b.y + b.radius < -20) {
        b.alive = false;
        if (b.type !== BalloonType.BOMB) {
          this.lives--;
          if (this.lives <= 0) {
            this.lives = 0;
            this.gameOver();
            return;
          }
        }
      }
    }

    // Remove dead balloons
    this.balloons = this.balloons.filter(b => b.alive);

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;  // Gravity
      p.life -= p.decay * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Update stars
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > this.height) { s.y = 0; s.x = randFloat(0, this.width); }
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Penalty flash
    if (this.penaltyFlash > 0) this.penaltyFlash -= dt * 2;
  }

  _spawnBalloon() {
    const radius = randInt(25, 40);
    const x = randFloat(radius + 20, this.width - radius - 20);
    const y = this.height + radius + 10;
    const baseSpeed = randFloat(60, 120) * this.difficulty;

    // Determine type (weighted random)
    const roll = Math.random();
    let type, color;
    if (roll < 0.08) {
      type = BalloonType.BOMB;
      color = { main: '#222222', highlight: '#555555' };
    } else if (roll < 0.15) {
      type = BalloonType.GOLD;
      color = { main: '#ffd700', highlight: '#fff3a0' };
    } else if (roll < 0.18) {
      type = BalloonType.RAINBOW;
      color = { main: '#ff6b6b', highlight: '#ffffff' };  // Will be drawn special
    } else {
      type = BalloonType.REGULAR;
      color = BALLOON_COLORS[randInt(0, BALLOON_COLORS.length - 1)];
    }

    const speed = type === BalloonType.GOLD ? baseSpeed * 1.5 : baseSpeed;
    this.balloons.push(new Balloon(x, y, type, color, speed, radius));
  }

  _popBalloon(balloon) {
    balloon.alive = false;

    // Spawn particles
    const particleColor = balloon.color.main;
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(balloon.x, balloon.y, particleColor));
    }

    // Score based on type
    switch (balloon.type) {
      case BalloonType.REGULAR:
        this.score += 10;
        this.comboCount++;
        this.comboTimer = 2;
        break;
      case BalloonType.GOLD:
        this.score += 30;
        this.comboCount++;
        this.comboTimer = 2;
        break;
      case BalloonType.BOMB:
        this.score = Math.max(0, this.score - 20);
        this.penaltyFlash = 1;
        this.comboCount = 0;
        break;
      case BalloonType.RAINBOW:
        const bonus = this.balloons.filter(b => b.alive && b !== balloon).length * 10;
        this.score += Math.max(10, bonus);
        this.comboCount++;
        this.comboTimer = 2;
        // Pop all regular balloons too!
        for (const b of this.balloons) {
          if (b.alive && b !== balloon && b.type !== BalloonType.BOMB) {
            b.alive = false;
            for (let i = 0; i < 5; i++) {
              this.particles.push(new Particle(b.x, b.y, b.color.main));
            }
          }
        }
        break;
    }

    // Combo bonus
    if (this.comboCount >= 3 && balloon.type !== BalloonType.BOMB) {
      this.score += this.comboCount * 2;
    }
  }

  render(ctx) {
    const w = this.width;
    const h = this.height;

    // Background gradient (dark blue to purple)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(1, '#1a0a3e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (const s of this.stars) {
      ctx.globalAlpha = s.brightness;
      drawCircle(ctx, s.x, s.y, s.radius, '#ffffff');
    }
    ctx.globalAlpha = 1;

    // Balloons
    for (const b of this.balloons) {
      this._drawBalloon(ctx, b);
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      drawCircle(ctx, p.x, p.y, p.radius, p.color);
    }
    ctx.globalAlpha = 1;

    // Cursor trail
    for (const t of this.cursorTrail) {
      ctx.globalAlpha = t.alpha * 0.5;
      drawCircle(ctx, t.x, t.y, 8, '#00ffaa');
    }
    ctx.globalAlpha = 1;

    // Cursor
    if (this.cursorTrail.length > 0) {
      // Glowing cursor
      const cx = this.cursorX;
      const cy = this.cursorY;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
      glow.addColorStop(0, 'rgba(0, 255, 170, 0.8)');
      glow.addColorStop(1, 'rgba(0, 255, 170, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 20, cy - 20, 40, 40);
      drawCircle(ctx, cx, cy, 5, '#00ffaa', '#ffffff', 2);
    }

    // Lives
    for (let i = 0; i < this.maxLives; i++) {
      const lx = 30 + i * 35;
      const ly = 30;
      drawEmoji(ctx, i < this.lives ? '❤️' : '🖤', lx, ly, 24);
    }

    // Combo display
    if (this.comboCount >= 3) {
      drawText(ctx, `${this.comboCount}x COMBO!`, w / 2, h - 60, {
        font: '20px "Press Start 2P", monospace',
        color: '#ffaa00'
      });
    }

    // Penalty flash overlay
    if (this.penaltyFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${this.penaltyFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _drawBalloon(ctx, balloon) {
    const { x, y, radius, type, color } = balloon;

    // String (bezier curve dangling below)
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.bezierCurveTo(x - 5, y + radius + 20, x + 5, y + radius + 30, x, y + radius + 40);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Balloon body with gradient
    if (type === BalloonType.RAINBOW) {
      // Rainbow gradient
      const rainGrad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
      rainGrad.addColorStop(0, '#ff0000');
      rainGrad.addColorStop(0.2, '#ff8800');
      rainGrad.addColorStop(0.4, '#ffff00');
      rainGrad.addColorStop(0.6, '#00ff00');
      rainGrad.addColorStop(0.8, '#0088ff');
      rainGrad.addColorStop(1, '#8800ff');
      drawCircle(ctx, x, y, radius, null);
      ctx.fillStyle = rainGrad;
      ctx.fill();
    } else {
      // Normal gradient
      const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
      grad.addColorStop(0, color.highlight);
      grad.addColorStop(1, color.main);
      drawCircle(ctx, x, y, radius, null);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Highlight spot (shiny)
    drawCircle(ctx, x - radius * 0.25, y - radius * 0.3, radius * 0.15, 'rgba(255,255,255,0.6)');

    // Bomb icon
    if (type === BalloonType.BOMB) {
      drawEmoji(ctx, '💣', x, y, radius * 0.8);
    }

    // Gold sparkle
    if (type === BalloonType.GOLD) {
      drawEmoji(ctx, '⭐', x, y, radius * 0.6);
    }

    // Hover indicator (if being pointed at)
    if (balloon.hoverTime > 0) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * (balloon.hoverTime / 0.3)));
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  resize(width, height) {
    super.resize(width, height);
    // Reposition stars
    for (const s of this.stars) {
      s.x = randFloat(0, width);
      s.y = randFloat(0, height);
    }
  }
}
