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
    
    // Smoothing factor (lower = smoother but laggier)
    this.SMOOTHING = 0.35;
    
    // Velocity tracking
    this.velocityX = 0;
    this.velocityY = 0;
    
    // No hand detected counter
    this.framesWithoutHand = 0;
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
      return {
        detected: false,
        gesture: Gesture.NONE,
        palmX: this.prevPalmX,
        palmY: this.prevPalmY,
        fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false, count: 0 },
        pinchDistance: 1,
        handAngle: 0,
        velocity: { x: 0, y: 0 },
        rawLandmarks: null,
        handedness: null,
        framesWithoutHand: this.framesWithoutHand
      };
    }

    this.framesWithoutHand = 0;
    const lm = handResult.landmarks;
    const dt = (timestamp - this.prevTimestamp) / 1000 || 1/30;
    this.prevTimestamp = timestamp;

    // 1. Calculate palm position (average of wrist and middle MCP)
    //    Mirror X so moving hand right = cursor right (camera is mirrored)
    const rawPalmX = 1 - (lm[LM.WRIST].x + lm[LM.MIDDLE_MCP].x) / 2;
    const rawPalmY = (lm[LM.WRIST].y + lm[LM.MIDDLE_MCP].y) / 2;
    const palmX = ema(rawPalmX, this.prevPalmX, this.SMOOTHING);
    const palmY = ema(rawPalmY, this.prevPalmY, this.SMOOTHING);

    // 2. Calculate velocity
    this.velocityX = (palmX - this.prevPalmX) / dt;
    this.velocityY = (palmY - this.prevPalmY) / dt;
    this.prevPalmX = palmX;
    this.prevPalmY = palmY;

    // 3. Detect finger extension states
    const fingers = this._getFingerStates(lm);

    // 4. Calculate pinch distance (thumb tip to index tip)
    const pinchDistance = dist3D(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]);

    // 5. Calculate hand angle (for steering)
    const handAngle = this._getHandAngle(lm);

    // 6. Classify gesture
    const rawGesture = this._classifyGesture(fingers, pinchDistance, handAngle, lm);
    
    // 7. Debounce gesture
    if (rawGesture === this.currentGesture) {
      this.gestureFrameCount++;
      if (this.gestureFrameCount >= this.GESTURE_HOLD_FRAMES) {
        this.confirmedGesture = rawGesture;
      }
    } else {
      this.currentGesture = rawGesture;
      this.gestureFrameCount = 1;
    }

    return {
      detected: true,
      gesture: this.confirmedGesture,
      palmX,
      palmY,
      fingers,
      pinchDistance,
      handAngle,
      velocity: { x: this.velocityX, y: this.velocityY },
      rawLandmarks: lm,
      handedness: handResult.handedness,
      framesWithoutHand: 0
    };
  }

  /**
   * Detect which fingers are extended.
   * Fingers: compare tip Y to PIP Y (tip above PIP = extended).
   * Thumb: compare tip X distance from palm center.
   */
  _getFingerStates(lm) {
    const thumb = this._isThumbExtended(lm);
    const index = lm[LM.INDEX_TIP].y < lm[LM.INDEX_PIP].y;
    const middle = lm[LM.MIDDLE_TIP].y < lm[LM.MIDDLE_PIP].y;
    const ring = lm[LM.RING_TIP].y < lm[LM.RING_PIP].y;
    const pinky = lm[LM.PINKY_TIP].y < lm[LM.PINKY_PIP].y;
    return {
      thumb, index, middle, ring, pinky,
      count: [thumb, index, middle, ring, pinky].filter(Boolean).length
    };
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
