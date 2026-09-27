import { Gesture } from './gesture-engine.js';

export const GameState = {
  LOADING: 'LOADING',
  CALIBRATION: 'CALIBRATION',
  MENU: 'MENU',
  TUTORIAL: 'TUTORIAL',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER',
  PAUSED: 'PAUSED'
};

export class GameManager {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = GameState.LOADING;
    this.games = [];  // Array of game classes (not instances)
    this.activeGame = null;  // Current game instance
    this.selectedGameIndex = 0;
    
    // Pause detection
    this.pauseHoldTime = 0;
    this.FIST_PAUSE_DURATION = 1.5; // seconds to hold to pause
    
    // Game over timer
    this.gameOverTimer = 0;
    this.GAME_OVER_DURATION = 5; // seconds before auto-return to menu
  }

  registerGame(GameClass) {
    this.games.push(GameClass);
  }

  setReady() {
    this.state = GameState.CALIBRATION;
  }

  update(dt, gestureState) {
    switch (this.state) {
      case GameState.CALIBRATION:
        // Wait for hand detection, then move to menu
        if (gestureState && gestureState.detected) {
          this.state = GameState.MENU;
        }
        break;

      case GameState.MENU:
        this._updateMenu(dt, gestureState);
        break;

      case GameState.PLAYING:
        this._updatePlaying(dt, gestureState);
        break;

      case GameState.PAUSED:
        this._updatePaused(dt, gestureState);
        break;

      case GameState.GAME_OVER:
        this._updateGameOver(dt, gestureState);
        break;
    }
  }

  _updateMenu(dt, gestureState) {
    // Menu logic is handled by Menu UI module. GameManager orchestrates state transitions.
  }

  async _startGame(index) {
    const GameClass = this.games[index];
    this.activeGame = new GameClass(this.canvas, this.ctx);
    if (this.activeGame.init) {
      await this.activeGame.init();
    }
    this.state = GameState.PLAYING;
    this.pauseHoldTime = 0;
  }

  _updatePlaying(dt, gestureState) {
    if (!this.activeGame) return;

    // Check for rock-hold to pause
    if (gestureState && gestureState.gesture === Gesture.ROCK) {
      this.pauseHoldTime += dt;
      if (this.pauseHoldTime >= this.FIST_PAUSE_DURATION) {
        this.state = GameState.PAUSED;
        if (this.activeGame) this.activeGame.isRunning = false;
        this.pauseHoldTime = 0;
        return;
      }
    } else {
      this.pauseHoldTime = 0;
    }

    if (this.activeGame && typeof this.activeGame.update === 'function') {
      this.activeGame.update(dt, gestureState);
    }

    if (this.activeGame && this.activeGame.isGameOver) {
      this.state = GameState.GAME_OVER;
      this.gameOverTimer = 0;
    }
  }

  _updatePaused(dt, gestureState) {
    if (!gestureState) return;
    
    // Open palm = resume
    if (gestureState.gesture === Gesture.OPEN_PALM) {
      this.state = GameState.PLAYING;
      if (this.activeGame) this.activeGame.isRunning = true;
    }
    // Thumbs down = quit to menu
    if (gestureState.gesture === Gesture.THUMBS_DOWN) {
      if (this.activeGame && typeof this.activeGame.destroy === 'function') {
        this.activeGame.destroy();
      }
      this.activeGame = null;
      this.state = GameState.MENU;
    }
  }

  _updateGameOver(dt, gestureState) {
    this.gameOverTimer += dt;
    // Thumbs up or auto-timer = return to menu
    if ((gestureState && gestureState.gesture === Gesture.THUMBS_UP) || this.gameOverTimer >= this.GAME_OVER_DURATION) {
      if (this.activeGame && typeof this.activeGame.destroy === 'function') {
        this.activeGame.destroy();
      }
      this.activeGame = null;
      this.state = GameState.MENU;
    }
  }

  render(ctx, gestureState) {
    // Handled in main loop
  }

  resize(width, height) {
    if (this.activeGame && typeof this.activeGame.resize === 'function') {
      this.activeGame.resize(width, height);
    }
  }
}
