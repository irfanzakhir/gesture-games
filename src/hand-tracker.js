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

/**
 * Detect hands in the current video frame.
 * @param {HandLandmarker} handLandmarker
 * @param {HTMLVideoElement} video
 * @param {number} timestamp - performance.now()
 * @returns {{ landmarks: Array|null, handedness: string|null }}
 */
export function detectHands(handLandmarker, video, timestamp) {
  const results = handLandmarker.detectForVideo(video, timestamp);
  if (results.landmarks && results.landmarks.length > 0) {
    return {
      landmarks: results.landmarks[0],  // 21 landmarks for first hand
      handedness: results.handednesses?.[0]?.[0]?.categoryName || 'Right'
    };
  }
  return { landmarks: null, handedness: null };
}
