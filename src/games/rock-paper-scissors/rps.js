import { BaseGame } from '../_base-game.js';
import { randInt } from '../../utils/math.js';
import { drawText, drawCircle, drawEmoji, clearCanvas, drawRoundRect } from '../../utils/canvas-helpers.js';
import { audio } from '../../utils/audio.js';

const RPS = { ROCK: 'rock', PAPER: 'paper', SCISSORS: 'scissors' };

const CHOICE_EMOJI = {
  [RPS.ROCK]: '✊',
  [RPS.PAPER]: '✋',
  [RPS.SCISSORS]: '✌️'
};

const CHOICE_NAME = {
  [RPS.ROCK]: 'ROCK',
  [RPS.PAPER]: 'PAPER',
  [RPS.SCISSORS]: 'SCISSORS'
};

const Phase = {
  READY: 'ready',
  COUNTDOWN: 'countdown',
  SHOW: 'show',
  RESULT: 'result',
  FINAL: 'final'
};

function getResult(player, cpu) {
  if (player === cpu) return 'draw';
  if (
    (player === RPS.ROCK && cpu === RPS.SCISSORS) ||
    (player === RPS.PAPER && cpu === RPS.ROCK) ||
    (player === RPS.SCISSORS && cpu === RPS.PAPER)
  ) return 'win';
  return 'lose';
}

export class RockPaperScissors extends BaseGame {
  static get meta() {
    return {
      id: 'rock-paper-scissors',
      name: 'RPS Battle',
      description: 'Rock Paper Scissors with real hand gestures!',
      icon: '🤘',
      difficulty: 'easy',
      gestures: ['FIST', 'OPEN_PALM', 'PEACE'],
      duration: 120,
      color: '#9b59b6'
    };
  }

  constructor(canvas, ctx) {
    super(canvas, ctx);
    this.maxTime = 120;
    this.round = 1;
    this.maxRounds = 5;
    this.playerWins = 0;
    this.cpuWins = 0;
    this.draws = 0;
    this.phase = Phase.READY;
    this.phaseTimer = 0;
    
    this.playerChoice = null;
    this.cpuChoice = null;
    this.roundResult = null;
    
    this.detectedGesture = null;
    this.gestureStableTime = 0;
    this.GESTURE_CONFIRM_TIME = 0.8;
    
    this.countdownValue = 3;
    
    this.shakeOffset = 0;
    this.resultScale = 0;
    
    this.history = [];
    this.cpuHistory = [];
  }

  async init() {
    await super.init();
    this.round = 1;
    this.playerWins = 0;
    this.cpuWins = 0;
    this.draws = 0;
    this.phase = Phase.READY;
    this.phaseTimer = 0;
    this.history = [];
    this.cpuHistory = [];
    this.resetRound();
  }

  resetRound() {
    this.playerChoice = null;
    this.cpuChoice = null;
    this.roundResult = null;
    this.detectedGesture = null;
    this.gestureStableTime = 0;
    this.countdownValue = 3;
    this.resultScale = 0;
    this.shakeOffset = 0;
  }

  mapGesture(gestureName) {
    if (gestureName === 'FIST') return RPS.ROCK;
    if (gestureName === 'OPEN_PALM') return RPS.PAPER;
    if (gestureName === 'PEACE') return RPS.SCISSORS;
    return null;
  }

  getCpuChoice() {
    const diff = window.gameDifficulty || 1.0; // 0.7 = Easy, 1.0 = Normal, 1.5 = Hard
    
    // Easy mode: CPU occasionally intentionally loses (picks what player beats)
    // Hard mode: CPU occasionally intentionally wins (picks what beats player)
    
    if (this.playerChoice) {
      if (diff === 0.7 && Math.random() < 0.4) {
        // Lose on purpose 40% of time
        if (this.playerChoice === RPS.ROCK) return RPS.SCISSORS;
        if (this.playerChoice === RPS.PAPER) return RPS.ROCK;
        if (this.playerChoice === RPS.SCISSORS) return RPS.PAPER;
      }
      if (diff === 1.5 && Math.random() < 0.5) {
        // Win on purpose 50% of time
        if (this.playerChoice === RPS.ROCK) return RPS.PAPER;
        if (this.playerChoice === RPS.PAPER) return RPS.SCISSORS;
        if (this.playerChoice === RPS.SCISSORS) return RPS.ROCK;
      }
    }

    // Normal logic: Avoid repeating 3 times
    if (this.cpuHistory.length >= 2) {
      const last = this.cpuHistory[this.cpuHistory.length - 1];
      const prev = this.cpuHistory[this.cpuHistory.length - 2];
      if (last === prev) {
        const choices = Object.values(RPS).filter(c => c !== last);
        return choices[randInt(0, choices.length - 1)];
      }
    }
    const choices = Object.values(RPS);
    return choices[randInt(0, choices.length - 1)];
  }

  update(dt, gestureState) {
    super.update(dt, gestureState);
    if (this.isGameOver) return;

    if (this.phase === Phase.READY) {
      const currentRps = gestureState.detected ? this.mapGesture(gestureState.gesture) : null;
      
      if (currentRps === this.detectedGesture && currentRps !== null) {
        this.gestureStableTime += dt;
        if (this.gestureStableTime >= this.GESTURE_CONFIRM_TIME) {
          audio.play('select');
          this.playerChoice = currentRps;
          this.phase = Phase.COUNTDOWN;
          this.phaseTimer = 3.0; // 3 second countdown
          this.lastCountdown = 4;
        }
      } else {
        this.detectedGesture = currentRps;
        this.gestureStableTime = 0;
      }
    } 
    else if (this.phase === Phase.COUNTDOWN) {
      this.phaseTimer -= dt;
      this.countdownValue = Math.ceil(this.phaseTimer);
      
      if (this.countdownValue !== this.lastCountdown && this.countdownValue > 0) {
        audio.play('countdown');
        this.lastCountdown = this.countdownValue;
      }

      // Dramatic shake during the last second
      if (this.phaseTimer < 1.0) {
        this.shakeOffset = Math.sin(this.phaseTimer * 40) * 5;
      }

      if (this.phaseTimer <= 0) {
        audio.play('countdownFinal');
        this.shakeOffset = 0;
        this.cpuChoice = this.getCpuChoice();
        this.cpuHistory.push(this.cpuChoice);
        this.roundResult = getResult(this.playerChoice, this.cpuChoice);
        this.phase = Phase.SHOW;
        this.phaseTimer = 2.0;
        this.resultScale = 0;
      }
    }
    else if (this.phase === Phase.SHOW) {
      this.phaseTimer -= dt;
      if (this.resultScale < 1) {
        this.resultScale = Math.min(1, this.resultScale + dt * 4); // Animate scale up
      }
      
      if (this.phaseTimer <= 0) {
        this.history.push({ player: this.playerChoice, cpu: this.cpuChoice, result: this.roundResult });
        
        if (this.roundResult === 'win') {
          audio.play('win');
          this.playerWins++;
          this.score += 20;
        } else if (this.roundResult === 'draw') {
          audio.play('coin');
          this.draws++;
          this.score += 5;
        } else {
          audio.play('lose');
          this.cpuWins++;
        }
        
        this.phase = Phase.RESULT;
        this.phaseTimer = 1.5;
        this.resultScale = 0;
      }
    }
    else if (this.phase === Phase.RESULT) {
      this.phaseTimer -= dt;
      if (this.resultScale < 1) {
        this.resultScale = Math.min(1, this.resultScale + dt * 5); // Animate result text
      }

      if (this.phaseTimer <= 0) {
        if (this.round >= this.maxRounds) {
          this.phase = Phase.FINAL;
          this.phaseTimer = 4.0;
          
          if (this.playerWins === 5) {
            this.score += 50; // Perfect bonus
          }
        } else {
          this.round++;
          this.resetRound();
          this.phase = Phase.READY;
        }
      }
    }
    else if (this.phase === Phase.FINAL) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        audio.play('gameOver');
        this.gameOver();
      }
    }
  }

  render(ctx) {
    clearCanvas(ctx);

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#8e44ad');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Header
    drawText(ctx, `Round ${Math.min(this.round, this.maxRounds)}/${this.maxRounds}`, this.width / 2, 40, { font: 'bold 24px Arial', color: '#fff' });
    drawText(ctx, `Wins: ${this.playerWins} - ${this.cpuWins}`, this.width / 2, 75, { font: '20px Arial', color: '#ecf0f1' });

    // Center divider
    drawText(ctx, 'VS', this.width / 2, this.height / 2 - 20, { font: 'bold 36px Arial', color: '#e74c3c' });

    // Player (Left)
    drawText(ctx, 'YOU', this.width * 0.25, this.height / 2 - 120, { font: 'bold 28px Arial', color: '#3498db' });
    
    // CPU (Right)
    drawText(ctx, 'CPU', this.width * 0.75, this.height / 2 - 120, { font: 'bold 28px Arial', color: '#e74c3c' });

    // RENDER PLAYER SIDE
    if (this.phase === Phase.READY) {
      if (this.detectedGesture) {
        const emoji = CHOICE_EMOJI[this.detectedGesture];
        const progress = this.gestureStableTime / this.GESTURE_CONFIRM_TIME;
        
        ctx.beginPath();
        ctx.arc(this.width * 0.25, this.height / 2 + 20, 60, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 10;
        ctx.stroke();

        drawEmoji(ctx, emoji, this.width * 0.25, this.height / 2 + 30, 80);
        drawText(ctx, CHOICE_NAME[this.detectedGesture], this.width * 0.25, this.height / 2 + 120, { font: 'bold 24px Arial', color: '#fff' });
      } else {
        drawText(ctx, 'Waiting...', this.width * 0.25, this.height / 2 + 20, { font: '24px Arial', color: '#bdc3c7' });
      }
    } else {
      drawEmoji(ctx, CHOICE_EMOJI[this.playerChoice], this.width * 0.25, this.height / 2 + 30, 80);
      drawText(ctx, CHOICE_NAME[this.playerChoice], this.width * 0.25, this.height / 2 + 120, { font: 'bold 24px Arial', color: '#fff' });
    }

    // RENDER CPU SIDE
    if (this.phase === Phase.READY || this.phase === Phase.COUNTDOWN) {
      ctx.save();
      ctx.translate(this.width * 0.75 + this.shakeOffset, this.height / 2 + 30);
      drawEmoji(ctx, '❓', 0, 0, 80);
      ctx.restore();
    } else if (this.cpuChoice) {
      ctx.save();
      ctx.translate(this.width * 0.75, this.height / 2 + 30);
      const scale = this.phase === Phase.SHOW ? this.resultScale : 1;
      ctx.scale(scale, scale);
      drawEmoji(ctx, CHOICE_EMOJI[this.cpuChoice], 0, 0, 80);
      ctx.restore();
      
      drawText(ctx, CHOICE_NAME[this.cpuChoice], this.width * 0.75, this.height / 2 + 120, { font: 'bold 24px Arial', color: '#fff' });
    }

    // MESSAGES / CENTER TEXT
    if (this.phase === Phase.READY) {
      drawRoundRect(ctx, this.width / 2 - 150, this.height - 180, 300, 80, 10, 'rgba(0,0,0,0.5)');
      drawText(ctx, 'Choose your move!', this.width / 2, this.height - 150, { font: '20px Arial', color: '#fff' });
      drawText(ctx, 'Hold gesture for 0.8s', this.width / 2, this.height - 125, { font: '16px Arial', color: '#aaa' });
    }
    else if (this.phase === Phase.COUNTDOWN) {
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2 + 30);
      const cdScale = 1 + (this.phaseTimer % 1); // Pulsing scale
      ctx.scale(cdScale, cdScale);
      drawText(ctx, this.countdownValue.toString(), 0, 0, { font: 'bold 64px Arial', color: '#f1c40f' });
      ctx.restore();
    }
    else if (this.phase === Phase.RESULT) {
      let resultText = '';
      let resultColor = '';
      if (this.roundResult === 'win') { resultText = 'WIN!'; resultColor = '#2ecc71'; }
      else if (this.roundResult === 'lose') { resultText = 'LOSE!'; resultColor = '#e74c3c'; }
      else { resultText = 'DRAW!'; resultColor = '#f1c40f'; }

      ctx.save();
      ctx.translate(this.width / 2, this.height - 140);
      ctx.scale(this.resultScale, this.resultScale);
      drawText(ctx, resultText, 0, 0, { font: 'bold 48px Arial', color: resultColor, outlineColor: '#fff', outlineWidth: 3 });
      ctx.restore();
    }
    else if (this.phase === Phase.FINAL) {
      let finalText = '';
      let finalColor = '';
      if (this.playerWins > this.cpuWins) { finalText = 'MATCH WON!'; finalColor = '#2ecc71'; }
      else if (this.playerWins < this.cpuWins) { finalText = 'MATCH LOST!'; finalColor = '#e74c3c'; }
      else { finalText = 'MATCH TIED!'; finalColor = '#f1c40f'; }

      drawRoundRect(ctx, this.width / 2 - 200, this.height / 2 - 60, 400, 120, 15, 'rgba(0,0,0,0.8)');
      drawText(ctx, finalText, this.width / 2, this.height / 2, { font: 'bold 48px Arial', color: finalColor });
    }

    // ROUND HISTORY INDICATORS
    const startX = this.width / 2 - ((this.maxRounds - 1) * 20);
    for (let i = 0; i < this.maxRounds; i++) {
      const x = startX + i * 40;
      const y = this.height - 50;
      let color = '#555'; // Future round
      
      if (i < this.history.length) {
        const res = this.history[i].result;
        if (res === 'win') color = '#2ecc71';
        else if (res === 'lose') color = '#e74c3c';
        else color = '#f1c40f'; // Draw
      } else if (i === this.round - 1 && this.phase !== Phase.FINAL) {
        color = '#3498db'; // Current round
      }

      drawCircle(ctx, x, y, 10, color);
    }
  }
}
