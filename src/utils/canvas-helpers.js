/**
 * Draw text with outline (for readability on any background)
 */
export function drawText(ctx, text, x, y, {
  font = '24px "Press Start 2P", monospace',
  color = '#ffffff',
  outlineColor = '#000000',
  outlineWidth = 3,
  align = 'center',
  baseline = 'middle'
} = {}) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (outlineWidth > 0) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Draw a rounded rectangle
 */
export function drawRoundRect(ctx, x, y, w, h, radius, fillColor, strokeColor = null) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Draw a circle
 */
export function drawCircle(ctx, x, y, radius, fillColor, strokeColor = null, lineWidth = 2) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draw a progress arc (for selection timers)
 */
export function drawProgressArc(ctx, x, y, radius, progress, color = '#00ff88') {
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * progress));
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * Draw emoji at a position and size
 */
export function drawEmoji(ctx, emoji, x, y, size = 40) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
}

/**
 * Clear the full canvas with a solid color
 */
export function clearCanvas(ctx, width, height, color = '#1a1a2e') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}
