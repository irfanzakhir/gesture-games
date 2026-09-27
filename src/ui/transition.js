export class Transition {
  constructor() {
    this.active = false;
    this.alpha = 0;
    this.fadeIn = true;
    this.duration = 0.3; // seconds
    this.onMidpoint = null;
    this.elapsed = 0;
  }

  start(onMidpoint) {
    this.active = true;
    this.alpha = 0;
    this.fadeIn = true;
    this.elapsed = 0;
    this.onMidpoint = onMidpoint;
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.fadeIn) {
      this.alpha = Math.min(1, this.elapsed / this.duration);
      if (this.alpha >= 1) {
        this.fadeIn = false;
        this.elapsed = 0;
        if (this.onMidpoint) this.onMidpoint();
      }
    } else {
      this.alpha = 1 - Math.min(1, this.elapsed / this.duration);
      if (this.alpha <= 0) {
        this.active = false;
      }
    }
  }

  render(ctx, width, height) {
    if (!this.active || this.alpha <= 0) return;
    ctx.fillStyle = `rgba(0, 0, 0, ${this.alpha})`;
    ctx.fillRect(0, 0, width, height);
  }
}
