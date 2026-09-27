/** Linear interpolation */
export function lerp(a, b, t) { return a + (b - a) * t; }

/** Clamp value between min and max */
export function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

/** Distance between two 2D points */
export function dist(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }

/** Distance between two 3D points */
export function dist3D(p1, p2) { return Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2 + (p2.z-p1.z)**2); }

/** Convert radians to degrees */
export function radToDeg(rad) { return rad * (180 / Math.PI); }

/** Convert degrees to radians */
export function degToRad(deg) { return deg * (Math.PI / 180); }

/** Exponential moving average for smoothing */
export function ema(current, previous, factor = 0.3) { return previous + (current - previous) * factor; }

/** Map a value from one range to another */
export function mapRange(val, inMin, inMax, outMin, outMax) {
  return clamp(outMin + (val - inMin) * (outMax - outMin) / (inMax - inMin), outMin, outMax);
}

/** Random integer between min and max (inclusive) */
export function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/** Random float between min and max */
export function randFloat(min, max) { return Math.random() * (max - min) + min; }

/** Check if two circles overlap */
export function circlesOverlap(x1, y1, r1, x2, y2, r2) { return dist(x1, y1, x2, y2) < r1 + r2; }
