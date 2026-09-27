/**
 * Base class for all minigames.
 * Each game extends this and implements init(), update(), render(), destroy().
 */
export class BaseGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.score = 0;
    this.timeLeft = 60;  // seconds
    this.maxTime = 60;
    this.isRunning = false;
    this.isGameOver = false;
    this.highScore = 0;
  }

  /**
   * Called once when the game is selected. Load assets, reset state.
   */
  async init() {
    this.score = 0;
    this.timeLeft = this.maxTime;
    this.isRunning = true;
    this.isGameOver = false;
    // Load high score from localStorage
    const saved = localStorage.getItem(`gesture-games-${this.constructor.meta.id}-highscore`);
    this.highScore = saved ? parseInt(saved, 10) : 0;
  }

  /**
   * Called every frame.
   * @param {number} dt - Delta time in seconds
   * @param {GestureState} gestureState - Current gesture data
   */
  update(dt, gestureState) {
    if (!this.isRunning) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.gameOver();
    }
  }

  /**
   * Called every frame to render the game.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    // Override in subclass
  }

  /**
   * Called when game ends. Saves high score.
   */
  gameOver() {
    this.isRunning = false;
    this.isGameOver = true;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(`gesture-games-${this.constructor.meta.id}-highscore`, this.highScore.toString());
    }
  }

  /**
   * Called when leaving the game. Clean up resources.
   */
  destroy() {
    this.isRunning = false;
  }

  /**
   * Resize handler
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * Game metadata for the menu. Override in each game.
   */
  static get meta() {
    return {
      id: 'base',
      name: 'Base Game',
      description: 'Override this',
      icon: '🎮',
      difficulty: 'easy',
      gestures: [],
      duration: 60,
      color: '#333333'
    };
  }
}
