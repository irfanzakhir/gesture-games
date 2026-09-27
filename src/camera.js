/**
 * Camera configuration optimized for low-end PCs
 */
const CAMERA_CONFIG = {
  width: 640,
  height: 480,
  facingMode: 'user',
  frameRate: { ideal: 30, max: 30 }
};

/**
 * Initialize the webcam and return the video element.
 * Handles permission denial gracefully.
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<HTMLVideoElement>}
 */
export async function initCamera(videoElement) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONFIG });
    videoElement.srcObject = stream;
    
    await new Promise((resolve) => {
      videoElement.onloadeddata = () => {
        resolve(videoElement);
      };
    });
    
    // Play is required for some browsers
    videoElement.play();
    return videoElement;
  } catch (err) {
    console.error('Camera initialization failed:', err);
    alert('Failed to access webcam. Please enable camera access to play Gesture Games.');
    throw err;
  }
}

/**
 * Draw a small picture-in-picture webcam preview on the game canvas.
 * Draws mirrored (scaleX -1) in the bottom-right corner.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} video
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 */
export function drawPiP(ctx, video, canvasWidth, canvasHeight) {
  if (!video || video.readyState < 2) return;

  const pipWidth = 160;
  const pipHeight = 120;
  const margin = 16;
  
  const x = canvasWidth - pipWidth - margin;
  const y = canvasHeight - pipHeight - margin;

  ctx.save();
  
  // Draw a subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, pipWidth + 2, pipHeight + 2);

  // Translate and flip for mirrored rendering
  ctx.translate(x + pipWidth, y);
  ctx.scale(-1, 1);
  
  // Draw the video
  ctx.drawImage(video, 0, 0, pipWidth, pipHeight);
  
  ctx.restore();
}
