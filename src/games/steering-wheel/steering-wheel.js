import { BaseGame } from '../_base-game.js';
import { lerp, clamp, randInt, randFloat, dist } from '../../utils/math.js';
import { drawText, drawCircle, drawRoundRect, clearCanvas } from '../../utils/canvas-helpers.js';
import { audio } from '../../utils/audio.js';

const ObstacleType = {
  ROCK: { emoji: '🪨', points: 0, damage: true, radius: 15 },
  CONE: { emoji: '🔶', points: 0, damage: true, radius: 15 },
  COIN: { emoji: '🪙', points: 10, damage: false, radius: 15 },
  FUEL: { emoji: '⛽', points: 0, damage: false, timeBonus: 5, radius: 15 },
  STAR: { emoji: '⭐', points: 50, damage: false, radius: 15 },
};

export class SteeringWheel extends BaseGame {
  static get meta() {
    return {
      id: 'steering-wheel',
      name: 'Car Drive',
      description: 'Tilt your hand to steer! Dodge obstacles, collect coins!',
      icon: '🏎️',
      difficulty: 'medium',
      gestures: ['OPEN_PALM', 'FIST'],
      duration: 60,
      color: '#27ae60'
    };
  }

  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.carX = this.width / 2;
    this.carY = this.height - 100;
    this.speed = 0;
    const diff = window.gameDifficulty || 1.0;
    this.maxSpeed = 500 * diff;
    this.minSpeed = 0;
    this.scrollY = 0;
    this.steerAngle = 0;
    
    this.lives = 3;
    this.maxLives = 3;
    
    this.obstacles = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1.0;
    
    this.dashOffset = 0;
    
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeIntensity = 0;
    
    this.particles = [];
    
    this.distanceScore = 0;
    this.roadWidth = this.width * 0.45;

    this.isBraking = false;
    this.isAccelerating = false;
  }

  async init() {
    this.score = 0;
    this.timeLeft = SteeringWheel.meta.duration;
    this.isRunning = true;
    this.isGameOver = false;
    this.carX = this.width / 2;
    this.carY = this.height - 100;
    this.speed = 0;
    this.scrollY = 0;
    this.lives = this.maxLives;
    this.obstacles = [];
    this.particles = [];
    this.distanceScore = 0;
    this.roadWidth = this.width * 0.45;
  }

  update(dt, gestureState) {
    if (!this.isRunning || this.isGameOver) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0 || this.lives <= 0) {
      audio.play('gameOver');
      this.gameOver();
      return;
    }

    // Process Hand Input
    this.isBraking = false;
    this.isAccelerating = false;
    let targetSteerAngle = 0;

    if (gestureState.detected) {
      // handAngle: -45 to +45 (inverted because camera is mirrored)
      targetSteerAngle = clamp(-gestureState.handAngle, -60, 60);

      if (gestureState.gesture === 'OPEN_PALM') {
        this.isAccelerating = true;
        this.speed += 300 * dt;
      } else if (gestureState.gesture === 'FIST') {
        this.isBraking = true;
        this.speed -= 400 * dt;
      }
    }

    // Default deceleration
    if (!this.isAccelerating && !this.isBraking) {
      this.speed -= 50 * dt;
    }

    this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);
    
    // Update scrolling
    this.scrollY += this.speed * dt;
    this.distanceScore += (this.speed * dt) * 0.05; // 0.05 points per pixel
    this.score = Math.floor(this.distanceScore) + this.obstacles.reduce((acc, obs) => acc + (obs.collected ? obs.type.points : 0), 0);

    // Smooth steering
    this.steerAngle = lerp(this.steerAngle, targetSteerAngle, 10 * dt);

    // Move car horizontally
    // Map -45..45 angle to lateral speed
    const lateralSpeed = (this.steerAngle / 45) * 350;
    if (this.speed > 0) {
      this.carX += lateralSpeed * dt;
    }

    // Constrain car to screen and road
    this.carX = clamp(this.carX, 30, this.width - 30);
    const carWorldY = this.scrollY + (this.height - this.carY);
    const roadCenterCar = this._getRoadCenterX(carWorldY);
    
    // Add grass penalty
    if (Math.abs(this.carX - roadCenterCar) > this.roadWidth / 2) {
      this.speed -= 200 * dt; // slowdown on grass
      // Grass particles
      if (this.speed > 50 && Math.random() < 0.3) {
        this._spawnParticle(this.carX + randFloat(-15, 15), this.carY + 20, '#6B8E23');
      }
    }

    // Spawn particles for acceleration/braking
    if (this.isAccelerating && this.speed > 100 && Math.random() < 0.2) {
      this._spawnParticle(this.carX, this.carY + 25, '#888');
    }

    // Dash offset for road
    this.dashOffset = (this.dashOffset + this.speed * dt) % 40;

    // Shake logic
    if (this.shakeIntensity > 0) {
      this.shakeX = randFloat(-this.shakeIntensity, this.shakeIntensity);
      this.shakeY = randFloat(-this.shakeIntensity, this.shakeIntensity);
      this.shakeIntensity -= 100 * dt;
      if (this.shakeIntensity < 0) this.shakeIntensity = 0;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // Spawning obstacles
    if (this.speed > 50) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawnObstacle();
        // Spawning rate scales with speed
        this.spawnInterval = randFloat(0.5, 1.5) * (300 / Math.max(100, this.speed));
        this.spawnTimer = this.spawnInterval;
      }
    }

    // Update obstacles and check collisions
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      // Screen Y position of the obstacle
      obs.screenY = this.height - (obs.worldY - this.scrollY);

      if (obs.screenY > this.height + 50) {
        obs.alive = false;
      }

      if (obs.alive && !obs.hit && !obs.collected) {
        const d = dist(this.carX, this.carY, obs.x, obs.screenY);
        if (d < 25 + obs.type.radius) {
          if (obs.type.damage) {
            audio.play('crash');
            obs.hit = true;
            this.lives -= 1;
            this.speed = 0;
            this.shakeIntensity = 20;
            this._createExplosion(obs.x, obs.screenY, '#e74c3c');
          } else {
            obs.collected = true;
            if (obs.type.timeBonus) {
              audio.play('win');
              this.timeLeft += obs.type.timeBonus;
            } else {
              audio.play('coin');
            }
            if (obs.type.points > 0) {
              this.score += obs.type.points;
            }
            this._createExplosion(obs.x, obs.screenY, '#f1c40f');
          }
        }
      }

      if (!obs.alive) {
        this.obstacles.splice(i, 1);
      }
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.screenY = p.y + (this.scrollY - p.spawnScrollY); // Keep relative to ground or screen? Let's make them move relative to screen
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  _spawnObstacle() {
    const worldY = this.scrollY + this.height + 100;
    const roadCenterX = this._getRoadCenterX(worldY);
    // Spawn within road bounds mostly
    const x = roadCenterX + randFloat(-this.roadWidth/2 + 20, this.roadWidth/2 - 20);
    
    const r = Math.random();
    let type = ObstacleType.ROCK;
    if (r < 0.05) type = ObstacleType.STAR;
    else if (r < 0.10) type = ObstacleType.FUEL;
    else if (r < 0.35) type = ObstacleType.COIN;
    else if (r < 0.65) type = ObstacleType.CONE;

    this.obstacles.push({
      x,
      worldY,
      type,
      alive: true,
      hit: false,
      collected: false,
      screenY: -50
    });
  }

  _spawnParticle(x, y, color) {
    this.particles.push({
      x, y,
      vx: randFloat(-30, 30),
      vy: randFloat(20, 100),
      life: randFloat(0.2, 0.5),
      maxLife: 0.5,
      color,
      size: randFloat(2, 6)
    });
  }

  _createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x, y,
        vx: randFloat(-150, 150),
        vy: randFloat(-150, 150),
        life: randFloat(0.3, 0.7),
        maxLife: 0.7,
        color: color,
        size: randFloat(3, 8)
      });
    }
  }

  _getRoadCenterX(worldY) {
    return this.width / 2 
      + Math.sin(worldY * 0.002) * (this.width * 0.15)
      + Math.sin(worldY * 0.0007) * (this.width * 0.1)
      + Math.sin(worldY * 0.004) * (this.width * 0.05);
  }

  render(ctx) {
    clearCanvas(ctx, this.width, this.height, '#2ecc71'); // Grass background

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // Grass stripes for speed effect
    ctx.fillStyle = '#27ae60';
    for (let i = 0; i < this.height; i += 40) {
      const y = (i + this.scrollY % 40) % this.height;
      ctx.fillRect(0, y, this.width, 20);
    }

    // Draw Road
    this._drawRoad(ctx);

    // Draw Particles
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Obstacles
    this.obstacles.forEach(obs => {
      if (!obs.hit && !obs.collected && obs.alive) {
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obs.type.emoji, obs.x, obs.screenY);
      }
    });

    // Draw Car
    this._drawCar(ctx, this.carX, this.carY, this.steerAngle);

    ctx.restore();

    // HUD
    this._drawHUD(ctx);
  }

  _drawRoad(ctx) {
    const roadW = this.roadWidth;
    
    // Draw in thick horizontal strips for performance
    const stripHeight = 10;
    
    for (let screenY = 0; screenY <= this.height; screenY += stripHeight) {
      const worldY = this.scrollY + (this.height - screenY);
      const centerX = this._getRoadCenterX(worldY);
      
      // Road surface
      ctx.fillStyle = '#555555';
      ctx.fillRect(centerX - roadW/2, screenY, roadW, stripHeight + 1);
      
      // Edge lines
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(centerX - roadW/2, screenY, 4, stripHeight + 1);
      ctx.fillRect(centerX + roadW/2 - 4, screenY, 4, stripHeight + 1);
      
      // Center dashed line
      if ((screenY + this.dashOffset) % 40 < 20) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(centerX - 2, screenY, 4, stripHeight + 1);
      }
    }
  }

  _drawCar(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180 * 0.3); // Visual rotation
    
    const w = 34, h = 54;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(-w/2 + 5, -h/2 + 5, w, h, 5);
    ctx.fill();
    
    // Brake lights glow
    if (this.isBraking) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-w/2 + 2, h/2 - 2, 8, 4);
      ctx.fillRect(w/2 - 10, h/2 - 2, 8, 4);
      ctx.shadowBlur = 0;
    }

    // Body
    ctx.fillStyle = '#e74c3c'; // Red
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 5);
    ctx.fill();
    
    // Roof
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.roundRect(-w/2 + 3, -h/2 + 15, w - 6, h - 25, 3);
    ctx.fill();
    
    // Windshield
    ctx.fillStyle = '#5dade2';
    ctx.fillRect(-w/2 + 4, -h/2 + 8, w - 8, 10);
    // Rear window
    ctx.fillRect(-w/2 + 5, h/2 - 12, w - 10, 6);
    
    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(-w/2 - 4, -h/2 + 8, 4, 12);  // FL
    ctx.fillRect(w/2, -h/2 + 8, 4, 12);       // FR
    ctx.fillRect(-w/2 - 4, h/2 - 18, 4, 12);  // RL
    ctx.fillRect(w/2, h/2 - 18, 4, 12);       // RR

    ctx.restore();
  }

  _drawHUD(ctx) {
    // Top bar for score and time
    drawRoundRect(ctx, 10, 10, 150, 40, 10, 'rgba(0, 0, 0, 0.5)');
    drawText(ctx, `🪙 ${this.score}`, 85, 30, { font: '20px "Press Start 2P", monospace', color: '#fff', align: 'center' });

    drawRoundRect(ctx, this.width / 2 - 50, 10, 100, 40, 10, 'rgba(0, 0, 0, 0.5)');
    drawText(ctx, `${Math.ceil(this.timeLeft)}s`, this.width / 2, 30, { font: '18px "Press Start 2P", monospace', color: '#fff', align: 'center' });

    drawRoundRect(ctx, this.width - 160, 10, 150, 40, 10, 'rgba(0, 0, 0, 0.5)');
    let livesStr = '';
    for(let i=0; i<this.maxLives; i++) {
      livesStr += i < this.lives ? '❤️' : '🖤';
    }
    drawText(ctx, livesStr, this.width - 85, 30, { font: '20px serif', color: '#fff', align: 'center' });

    // Speedometer
    const speedX = 70;
    const speedY = this.height - 70;
    drawCircle(ctx, speedX, speedY, 50, 'rgba(0,0,0,0.6)');
    
    // Speed arc
    const speedPct = this.speed / this.maxSpeed;
    ctx.beginPath();
    ctx.arc(speedX, speedY, 40, Math.PI * 0.75, Math.PI * 0.75 + (Math.PI * 1.5) * speedPct);
    ctx.lineWidth = 6;
    ctx.strokeStyle = this.speed > this.maxSpeed * 0.8 ? '#e74c3c' : '#3498db';
    ctx.stroke();
    
    drawText(ctx, Math.round(this.speed).toString(), speedX, speedY + 5, { font: 'bold 22px monospace', color: '#fff', align: 'center' });
    drawText(ctx, 'km/h', speedX, speedY + 25, { font: '10px monospace', color: '#aaa', align: 'center' });

    // Steering Indicator
    const steerX = this.width - 70;
    const steerY = this.height - 70;
    drawCircle(ctx, steerX, steerY, 50, 'rgba(0,0,0,0.6)');
    
    ctx.save();
    ctx.translate(steerX, steerY);
    ctx.rotate(this.steerAngle * Math.PI / 180);
    
    // Wheel ring
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#7f8c8d';
    ctx.stroke();
    
    // Wheel center and spokes
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#95a5a6';
    ctx.fill();
    
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(-35, -3, 70, 6);
    ctx.fillRect(-3, 0, 6, 35);
    ctx.restore();
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.roadWidth = this.width * 0.45;
    if (this.carY > this.height) {
      this.carY = this.height - 100;
    }
  }

  gameOver() {
    this.isGameOver = true;
    this.isRunning = false;
    // BaseGame normally handles high score logic if implemented there
  }
}
