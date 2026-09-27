import { dist3D, ema, radToDeg } from './utils/math.js';

// Landmark indices as named constants
const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20
};

// Gesture types enum
export const Gesture = {
  NONE: 'NONE',
  OPEN_PALM: 'OPEN_PALM',
  FIST: 'FIST',
  POINT: 'POINT',
  PINCH: 'PINCH',
  THUMBS_UP: 'THUMBS_UP',
  THUMBS_DOWN: 'THUMBS_DOWN',
  PEACE: 'PEACE',
  ROCK: 'ROCK',
};

export class GestureEngine {
  constructor() {
    // Previous frame data for smoothing and velocity
    this.prevPalmX = 0.5;
    this.prevPalmY = 0.5;
    this.prevTimestamp = 0;
    
    // Gesture debouncing
    this.currentGesture = Gesture.NONE;
    this.gestureFrameCount = 0;
    this.confirmedGesture = Gesture.NONE;
    this.GESTURE_HOLD_FRAMES = 3;  // Frames before confirming gesture
    
    // Smoothing: use adaptive EMA — faster when hand moves fast, smoother when slow
    this.BASE_SMOOTHING = 0.45;    // base factor (higher = more responsive)
    this.MIN_SMOOTHING = 0.25;     // minimum (smoothest, for slow/still hand)
    this.MAX_SMOOTHING = 0.7;      // maximum (most responsive, for fast moves)
    
    // Velocity tracking (smoothed)
    this.velocityX = 0;
    this.velocityY = 0;
    
    // No hand detected counter
    this.framesWithoutHand = 0;
    
    // Pre-allocated return objects to avoid GC pressure
    this._noHandResult = {
      detected: false,
      gesture: Gesture.NONE,
      palmX: 0.5,
      palmY: 0.5,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false, count: 0 },
      pinchDistance: 1,
      handAngle: 0,
      velocity: { x: 0, y: 0 },
      rawLandmarks: null,
      handedness: null,
      framesWithoutHand: 0
    };
    this._handResult = {
      detected: true,
      gesture: Gesture.NONE,
      palmX: 0.5,
      palmY: 0.5,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false, count: 0 },
      pinchDistance: 1,
      handAngle: 0,
      velocity: { x: 0, y: 0 },
      rawLandmarks: null,
      handedness: null,
      framesWithoutHand: 0
    };
    this._fingers = { thumb: false, index: false, middle: false, ring: false, pinky: false, count: 0 };
  }

  /**
   * Process raw landmarks and return high-level gesture state.
   * Call this every frame.
   * @param {{ landmarks: Array|null, handedness: string|null }} handResult
   * @param {number} timestamp - performance.now()
   * @returns {GestureState}
   */
  update(handResult, timestamp) {
    if (!handResult || !handResult.landmarks) {
      this.framesWithoutHand++;
      const r = this._noHandResult;
      r.palmX = this.prevPalmX;
      r.palmY = this.prevPalmY;
      r.velocity.x = 0;
      r.velocity.y = 0;
      r.framesWithoutHand = this.framesWithoutHand;
      return r;
    }

    this.framesWithoutHand = 0;
    const lm = handResult.landmarks;
    const dt = (timestamp - this.prevTimestamp) / 1000 || 1/30;
    this.prevTimestamp = timestamp;

    // 1. Calculate palm position (average of wrist and middle MCP)
    //    Mirror X so moving hand right = cursor right (camera is mirrored)
    const rawPalmX = 1 - (lm[LM.WRIST].x + lm[LM.MIDDLE_MCP].x) / 2;
    const rawPalmY = (lm[LM.WRIST].y + lm[LM.MIDDLE_MCP].y) / 2;
    
    // 2. Adaptive smoothing: compute raw velocity to choose smoothing factor
    const rawVelX = (rawPalmX - this.prevPalmX) / dt;
    const rawVelY = (rawPalmY - this.prevPalmY) / dt;
    const speed = Math.sqrt(rawVelX * rawVelX + rawVelY * rawVelY);
    
    // Map speed to smoothing factor: fast hand = high factor (responsive), slow = low (smooth)
    const adaptiveFactor = Math.min(this.MAX_SMOOTHING, Math.max(this.MIN_SMOOTHING, 
      this.BASE_SMOOTHING + speed * 0.5));
    
    const palmX = ema(rawPalmX, this.prevPalmX, adaptiveFactor);
    const palmY = ema(rawPalmY, this.prevPalmY, adaptiveFactor);

    // 3. Smoothed velocity (using EMA on velocity itself for extra stability)
    this.velocityX = ema((palmX - this.prevPalmX) / dt, this.velocityX, 0.4);
    this.velocityY = ema((palmY - this.prevPalmY) / dt, this.velocityY, 0.4);
    this.prevPalmX = palmX;
    this.prevPalmY = palmY;

    // 4. Detect finger extension states (reuse object)
    this._getFingerStates(lm);

    // 5. Calculate pinch distance (thumb tip to index tip)
    const pinchDistance = dist3D(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]);

    // 6. Calculate hand angle (for steering)
    const handAngle = this._getHandAngle(lm);

    // 7. Classify gesture
    const rawGesture = this._classifyGesture(this._fingers, pinchDistance, handAngle, lm);
    
    // 8. Debounce gesture
    if (rawGesture === this.currentGesture) {
      this.gestureFrameCount++;
      if (this.gestureFrameCount >= this.GESTURE_HOLD_FRAMES) {
        this.confirmedGesture = rawGesture;
      }
    } else {
      this.currentGesture = rawGesture;
      this.gestureFrameCount = 1;
    }

    // 9. Fill pre-allocated result object
    const r = this._handResult;
    r.gesture = this.confirmedGesture;
    r.palmX = palmX;
    r.palmY = palmY;
    r.fingers = this._fingers;
    r.pinchDistance = pinchDistance;
    r.handAngle = handAngle;
    r.velocity.x = this.velocityX;
    r.velocity.y = this.velocityY;
    r.rawLandmarks = lm;
    r.handedness = handResult.handedness;
    return r;
  }

  /**
   * Detect which fingers are extended — mutates this._fingers in-place.
   */
  _getFingerStates(lm) {
    const f = this._fingers;
    f.thumb = this._isThumbExtended(lm);
    f.index = lm[LM.INDEX_TIP].y < lm[LM.INDEX_PIP].y;
    f.middle = lm[LM.MIDDLE_TIP].y < lm[LM.MIDDLE_PIP].y;
    f.ring = lm[LM.RING_TIP].y < lm[LM.RING_PIP].y;
    f.pinky = lm[LM.PINKY_TIP].y < lm[LM.PINKY_PIP].y;
    f.count = (f.thumb ? 1 : 0) + (f.index ? 1 : 0) + (f.middle ? 1 : 0) + (f.ring ? 1 : 0) + (f.pinky ? 1 : 0);
  }

  _isThumbExtended(lm) {
    // Thumb is extended if its tip is far from the index MCP (palm center) on X axis
    const dx = Math.abs(lm[LM.THUMB_TIP].x - lm[LM.INDEX_MCP].x);
    return dx > 0.06;
  }

  _getHandAngle(lm) {
    const wrist = lm[LM.WRIST];
    const middleMCP = lm[LM.MIDDLE_MCP];
    const dx = middleMCP.x - wrist.x;
    const dy = middleMCP.y - wrist.y;
    return radToDeg(Math.atan2(dx, -dy));  // 0=up, +90=right, -90=left
  }

  /**
   * Classify the current hand pose into a named gesture.
   */
  _classifyGesture(fingers, pinchDist, handAngle, lm) {
    const { thumb, index, middle, ring, pinky, count } = fingers;

    // PINCH: thumb and index tips very close
    if (pinchDist < 0.05) return Gesture.PINCH;

    // FIST: no fingers extended (or just thumb)
    if (!index && !middle && !ring && !pinky) {
      // Check if it's thumbs up or down
      if (thumb) {
        // Thumb pointing up = thumbs up (thumb tip above thumb MCP)
        if (lm[LM.THUMB_TIP].y < lm[LM.THUMB_MCP].y - 0.05) return Gesture.THUMBS_UP;
        // Thumb pointing down
        if (lm[LM.THUMB_TIP].y > lm[LM.THUMB_MCP].y + 0.05) return Gesture.THUMBS_DOWN;
      }
      return Gesture.FIST;
    }

    // POINT: only index extended
    if (index && !middle && !ring && !pinky) return Gesture.POINT;

    // PEACE / V: index and middle extended, others closed
    if (index && middle && !ring && !pinky) return Gesture.PEACE;

    // ROCK: index and pinky extended, middle and ring closed
    if (index && !middle && !ring && pinky) return Gesture.ROCK;

    // OPEN_PALM: all fingers extended (4+ since thumb detection can be flaky)
    if (count >= 4) return Gesture.OPEN_PALM;

    return Gesture.NONE;
  }

  /**
   * Reset engine state (call when switching games)
   */
  reset() {
    this.prevPalmX = 0.5;
    this.prevPalmY = 0.5;
    this.velocityX = 0;
    this.velocityY = 0;
    this.confirmedGesture = Gesture.NONE;
    this.currentGesture = Gesture.NONE;
    this.gestureFrameCount = 0;
    this.framesWithoutHand = 0;
  }
}
