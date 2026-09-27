import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * Initialize the MediaPipe HandLandmarker.
 * Uses CDN for WASM files, local model file.
 * @returns {Promise<HandLandmarker>}
 */
export async function initHandTracker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: import.meta.env.BASE_URL + 'assets/models/hand_landmarker.task',
      delegate: 'CPU'  // CPU for potato PCs, avoid GPU requirement
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  return handLandmarker;
}

// Pre-allocated result object to avoid creating garbage every frame
const _noHandResult = { landmarks: null, handedness: null };
const _handResult = { landmarks: null, handedness: null };
let _lastTimestamp = -1;

/**
 * Detect hands in the current video frame.
 * Uses timestamp dedup to avoid calling detectForVideo twice with
 * the same timestamp (which MediaPipe rejects).
 * @param {HandLandmarker} handLandmarker
 * @param {HTMLVideoElement} video
 * @param {number} timestamp - performance.now()
 * @returns {{ landmarks: Array|null, handedness: string|null }}
 */
export function detectHands(handLandmarker, video, timestamp) {
  // MediaPipe requires strictly increasing timestamps.
  // On high-refresh displays (144Hz+) multiple rAF callbacks can fire
  // before the webcam delivers a new frame. Passing the same timestamp
  // twice throws. Guard against it:
  if (timestamp <= _lastTimestamp) {
    return _handResult;  // return previous result
  }
  _lastTimestamp = timestamp;

  const results = handLandmarker.detectForVideo(video, timestamp);
  if (results.landmarks && results.landmarks.length > 0) {
    _handResult.landmarks = results.landmarks[0];
    _handResult.handedness = results.handednesses?.[0]?.[0]?.categoryName || 'Right';
    return _handResult;
  }
  return _noHandResult;
}
