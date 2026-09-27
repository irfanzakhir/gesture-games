import { BaseGame } from '../_base-game.js';
import { randInt, randFloat, dist, clamp } from '../../utils/math.js';
import { drawText, drawCircle, clearCanvas } from '../../utils/canvas-helpers.js';

const FRUITS = [
  { emoji: '🍎', points: 10, color: '#ff4444', size: 70 },
  { emoji: '🍊', points: 10, color: '#ff8800', size: 70 },
  { emoji: '🍋', points: 10, color: '#ffdd00', size: 65 },
  { emoji: '🍇', points: 15, color: '#8844cc', size: 68 },
  { emoji: '🍉', points: 20, color: '#44cc44', size: 85 },
  { emoji: '🍌', points: 10, color: '#ffcc00', size: 75 },
];

const BOMB = { emoji: '💣', points: -20, color: '#333333', size: 75, isBomb: true };
const STAR = { emoji: '⭐', points: 50, color: '#ffd700', size: 65, isStar: true };

/**
 * Calculates distance from a point p to a line segment [v, w].
 */
function distToSegment(p, v, w) {
  const l2 = dist(v.x, v.y, w.x, w.y) ** 2;
  if (l2 === 0) return dist(p.x, p.y, v.x, v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p.x, p.y, v.x + t * (w.x - v.x), v.y + t * (w.y - v.y));
}

export class FruitSlice extends BaseGame {
  static get meta() {
    return {
      id: 'fruit-slice',
      name: 'Fruit Slice',
      description: 'Slash fruits with your finger! Don\'t hit the bombs!',
      icon: '🍉',
      difficulty: 'medium',
      gestures: ['POINT', 'OPEN_PALM'],
      duration: 60,
      color: '#e67e22'
    };
  }

  async init() {
    await super.init();
    this.fruits = [];
    this.halves = [];
    this.particles = [];
    this.floatingTexts = [];
    this.trail = [];
    
    this.lives = 3;
    this.spawnTimer = 0;
    this.slowMoTimer = 0;
    
    this.comboFruits = 0;
    this.comboTimer = 0;
    this.screenFlash = 0;
  }

  spawnFruit() {
    // 70% fruit, 20% bomb, 10% star
    const r = Math.random();
    let type;
    if (r < 0.1) type = STAR;
    else if (r < 0.3) type = BOMB;
    else type = FRUITS[randInt(0, FRUITS.length - 1)];

    const x = randFloat(this.width * 0.2, this.width * 0.8);
    const y = this.height + 50;
    
    // Aim towards center/top
    const targetX = this.width / 2 + randFloat(-100, 100);
    const targetY = this.height * 0.2;
    
    const timeToPeak = randFloat(1.8, 2.5); // seconds (increased to slow down fruits)
    
    const vy = -Math.abs(y - targetY) * 2 / timeToPeak;
    const vx = (targetX - x) / timeToPeak;
    
    this.fruits.push({
      ...type,
      x, y,
      vx, vy,
      rotation: randFloat(0, Math.PI * 2),
      rotSpeed: randFloat(-3, 3),
      radius: type.size / 2,
      sliced: false
    });
  }

  createHalves(fruit) {
    const leftHalf = { ...fruit, vx: fruit.vx - randFloat(50, 150), rotSpeed: fruit.rotSpeed - 5, life: 1.5, maxLife: 1.5 };
    const rightHalf = { ...fruit, vx: fruit.vx + randFloat(50, 150), rotSpeed: fruit.rotSpeed + 5, life: 1.5, maxLife: 1.5 };
    this.halves.push(leftHalf, rightHalf);
  }

  createParticles(fruit) {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: fruit.x,
        y: fruit.y,
        vx: fruit.vx * 0.5 + randFloat(-150, 150),
        vy: fruit.vy * 0.5 + randFloat(-150, 150),
        life: randFloat(0.5, 1.0),
        maxLife: 1.0,
        color: fruit.color,
        size: randFloat(3, 8)
      });
    }
  }

  createFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text, x, y, color,
      vy: -50,
      life: 1.0,
      maxLife: 1.0
    });
  }

  update(dt, gestureState) {
    super.update(dt, gestureState);
    if (this.isGameOver) return;

    let timeScale = 1.0;
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      timeScale = 0.3;
    }

    const scaledDt = dt * timeScale;
    const gravity = 800 * scaledDt;

    // Screen flash
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 2);
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        if (this.comboFruits >= 3) {
          const comboBonus = this.comboFruits * 5;
          this.score += comboBonus;
          this.createFloatingText(`${this.comboFruits}x COMBO! +${comboBonus}`, this.width/2, this.height/3, '#ffaa00');
        }
        this.comboFruits = 0;
      }
    }

    // Spawn logic
    this.spawnTimer -= scaledDt;
    if (this.spawnTimer <= 0) {
      const numToSpawn = randInt(1, 3);
      for (let i=0; i<numToSpawn; i++) this.spawnFruit();
      this.spawnTimer = randFloat(1.0, 3.0);
    }

    // Update fruits
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.x += f.vx * scaledDt;
      f.y += f.vy * scaledDt;
      f.vy += gravity;
      f.rotation += f.rotSpeed * scaledDt;

      // Miss
      if (f.y > this.height + f.radius * 2 && f.vy > 0) {
        if (!f.isBomb && !f.isStar) {
          this.lives--;
          if (this.lives <= 0) this.gameOver();
        }
        this.fruits.splice(i, 1);
      }
    }

    // Update halves
    for (let i = this.halves.length - 1; i >= 0; i--) {
      const h = this.halves[i];
      h.x += h.vx * scaledDt;
      h.y += h.vy * scaledDt;
      h.vy += gravity;
      h.rotation += h.rotSpeed * scaledDt;
      h.life -= scaledDt;
      if (h.life <= 0) this.halves.splice(i, 1);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * scaledDt;
      p.y += p.vy * scaledDt;
      p.vy += gravity * 0.5;
      p.life -= scaledDt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.x += 0;
      ft.y += ft.vy * scaledDt;
      ft.life -= scaledDt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Update trail
    if (gestureState.detected) {
      const px = gestureState.palmX * this.width;
      const py = gestureState.palmY * this.height;
      const velMag = Math.hypot(gestureState.velocity.x, gestureState.velocity.y);
      
      this.trail.push({ x: px, y: py, life: 0.3 }); // increased trail life

      // Trail intersection checks if velocity is high enough
      if (velMag > 0.8 && this.trail.length >= 2) { // lowered from 1.5 to 0.8 to make cutting easier
        const p1 = this.trail[this.trail.length - 2];
        const p2 = this.trail[this.trail.length - 1];

        for (let i = this.fruits.length - 1; i >= 0; i--) {
          const f = this.fruits[i];
          const distToFruit = distToSegment({ x: f.x, y: f.y }, p1, p2);
          
          if (distToFruit <= f.radius * 1.5) {
            // Sliced!
            if (f.isBomb) {
              this.score = Math.max(0, this.score + f.points);
              this.screenFlash = 1.0;
              this.createFloatingText('BOMB!', f.x, f.y, '#ff0000');
            } else {
              this.score += f.points;
              this.comboFruits++;
              this.comboTimer = 1.0;
              
              if (f.isStar) {
                this.slowMoTimer = 2.0;
                this.createFloatingText('SLOW MO!', f.x, f.y, f.color);
              } else {
                this.createFloatingText(`+${f.points}`, f.x, f.y, f.color);
              }
              
              this.createHalves(f);
              this.createParticles(f);
            }
            this.fruits.splice(i, 1);
          }
        }
      }
    }

    // Fade trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt; // use real dt for trail fade
      if (this.trail[i].life <= 0) {
        this.trail.splice(i, 1);
      }
    }
  }

  render(ctx) {
    // Background gradient (wooden board look)
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#5c3a21');
    grad.addColorStop(1, '#3b2413');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Trail
    if (this.trail.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // glowing effect
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Halves
    for (const h of this.halves) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rotation);
      ctx.globalAlpha = Math.max(0, h.life / h.maxLife);
      drawText(ctx, h.emoji, 0, 0, {
        font: `${h.size}px sans-serif`,
        align: 'center',
        baseline: 'middle'
      });
      ctx.restore();
    }

    // Fruits
    for (const f of this.fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      drawText(ctx, f.emoji, 0, 0, {
        font: `${f.size}px sans-serif`,
        align: 'center',
        baseline: 'middle'
      });
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      drawCircle(ctx, p.x, p.y, p.size, { fill: p.color });
    }
    ctx.globalAlpha = 1.0;

    // Floating Texts
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      drawText(ctx, ft.text, ft.x, ft.y, {
        font: 'bold 24px sans-serif',
        color: ft.color,
        outlineColor: '#fff',
        outlineWidth: 2,
        align: 'center',
        baseline: 'middle'
      });
    }
    ctx.globalAlpha = 1.0;

    // Flash
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // UI
    let hearts = '';
    for(let i=0; i<this.lives; i++) hearts += '❤️';
    drawText(ctx, `Lives: ${hearts}`, 20, 60, { font: '24px sans-serif', color: '#fff', align: 'left' });
  }
}
