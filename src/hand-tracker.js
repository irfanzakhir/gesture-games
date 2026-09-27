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

let lastVideoTime = -1;
let cachedResult = { landmarks: null, handedness: null };

/**
 * Detect hands in the current video frame.
 * @param {HandLandmarker} handLandmarker
 * @param {HTMLVideoElement} video
 * @param {number} timestamp - performance.now()
 * @returns {{ landmarks: Array|null, handedness: string|null }}
 */
export function detectHands(handLandmarker, video, timestamp) {
  // OPTIMIZATION: Only run expensive AI inference if a new frame is available from the webcam
  if (video.currentTime !== lastVideoTime) {
    const results = handLandmarker.detectForVideo(video, timestamp);
    lastVideoTime = video.currentTime;
    
    if (results.landmarks && results.landmarks.length > 0) {
      cachedResult = {
        landmarks: results.landmarks[0],  // 21 landmarks for first hand
        handedness: results.handednesses?.[0]?.[0]?.categoryName || 'Right'
      };
    } else {
      cachedResult = { landmarks: null, handedness: null };
    }
  }
  return cachedResult;
}
