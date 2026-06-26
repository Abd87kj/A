const { createCanvas, loadImage } = require('@napi-rs/canvas');
const https = require('https');
const http = require('http');
const GIFEncoder = require('gif-encoder-2');

const SPIN_STEPS = 72;

const DEFAULT_PLAYER_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12',
  '#9b59b6','#1abc9c','#e67e22','#e91e63',
  '#00bcd4','#8bc34a',
];

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generateBannerImage() {
  const W = 700, H = 350;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(0.5, '#16213e');
  bg.addColorStop(1, '#0f3460');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#f0c030';
  ctx.shadowBlur = 20;
  ctx.fillText('🎰 روليت الحظ', W / 2, H / 2);
  return canvas.toBuffer('image/png');
}

async function generateWheelImage(
  players,
  winnerIndex,
  rotationAngle = 0,
  colors = null,
  size = 640,
  showNames = true,
  styleConfig = {}
) {
  const SIZE = size;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = SIZE * 0.44;
  const innerR = SIZE * 0.12;
  const n = players.length;

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (n === 0) return canvas.toBuffer('image/png');

  const COLORS = Array.isArray(colors) && colors.length > 0
    ? colors.map(c => typeof c === 'string' ? c : (c.outer || '#3498db'))
    : DEFAULT_PLAYER_COLORS;

  const sliceAngle = (Math.PI * 2) / n;

  // ── رسم الشرائح ──
  for (let i = 0; i < n; i++) {
    const start = rotationAngle + i * sliceAngle - Math.PI / 2;
    const end = start + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ── رسم الأسماء (بدون rotate — مضمونة تشتغل على napi-rs) ──
  if (showNames) {
    for (let i = 0; i < n; i++) {
      const mid = rotationAngle + i * sliceAngle - Math.PI / 2 + sliceAngle / 2;
      const textR = outerR * 0.65;
      const tx = cx + Math.cos(mid) * textR;
      const ty = cy + Math.sin(mid) * textR;

      const displayName = players[i].displayName || players[i].username || '؟';
      const maxLen = n <= 3 ? 10 : n <= 5 ? 7 : n <= 7 ? 6 : 5;
      const shortName = displayName.length > maxLen
        ? displayName.substring(0, maxLen) + '..'
        : displayName;

      const fontSize = n <= 3 ? 22 : n <= 5 ? 19 : n <= 7 ? 16 : 13;

      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(shortName, tx, ty);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(shortName, tx, ty);
    }
  }

  // ── الحافة الذهبية ──
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = '#f0c030';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#f0c030';
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── دائرة المركز ──
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.strokeStyle = '#f0c030';
  ctx.lineWidth = 3;
  ctx.stroke();

  // ── صورة الفائز في المركز ──
  if (winnerIndex !== null && winnerIndex >= 0 && players[winnerIndex]) {
    const winner = players[winnerIndex];
    const avatarUrl = typeof winner.avatarURL === 'function'
      ? winner.avatarURL({ size: 128, format: 'png' })
      : (typeof winner.avatarURL === 'string' && winner.avatarURL)
        ? winner.avatarURL
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(winner.discriminator || '0') % 5}.png`;
    try {
      const imgBuf = await fetchImageBuffer(avatarUrl);
      const img = await loadImage(imgBuf);
      const r = innerR - 4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      const goldRing = ctx.createLinearGradient(cx - innerR, cy, cx + innerR, cy);
      goldRing.addColorStop(0, '#806010');
      goldRing.addColorStop(0.5, '#f0c030');
      goldRing.addColorStop(1, '#806010');
      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 3, 0, Math.PI * 2);
      ctx.strokeStyle = goldRing;
      ctx.lineWidth = 3;
      ctx.stroke();
    } catch (e) {
      ctx.fillStyle = '#f0c030';
      ctx.font = `bold ${innerR * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = winner.displayName || winner.username || '?';
      ctx.fillText(name[0].toUpperCase(), cx, cy);
    }
  }

  // ── المؤشر ──
  const needleX = cx + outerR + 8;
  ctx.save();
  ctx.translate(needleX, cy);
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-20, -13);
  ctx.lineTo(-20, 13);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;

  return canvas.toBuffer('image/png');
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}
function spinEasing(t) {
  if (t < 0.15) return easeInOutCubic(t / 0.15) * 0.08;
  if (t < 0.75) return 0.08 + ((t - 0.15) / 0.60) * 0.72;
  return 0.80 + easeOutQuint((t - 0.75) / 0.25) * 0.20;
}

function getSpinSteps(spinDuration = 8) {
  return Math.max(36, Math.round(spinDuration * 9));
}

function generateSmoothAngles(winnerIndex, playerCount, steps) {
  const FULL_ROTATIONS = 8;
  const sliceAngle = (Math.PI * 2) / playerCount;
  const targetSlice = sliceAngle * winnerIndex;
  const targetAngle = (Math.PI * 2 * FULL_ROTATIONS) + (Math.PI * 2 - targetSlice - (sliceAngle / 2));
  const angles = [];
  for (let i = 1; i <= steps; i++) {
    angles.push(targetAngle * spinEasing(i / steps));
  }
  return angles;
}

function getFrameDelays(steps, baseDelay = 55, maxTailMultiplier = 5) {
  const delays = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    let multiplier = 1;
    if (t > 0.75) {
      const localT = (t - 0.75) / 0.25;
      multiplier = 1 + (maxTailMultiplier - 1) * (localT * localT);
    }
    delays.push(Math.round(baseDelay * multiplier));
  }
  return delays;
}

function getTotalGifDuration(steps, finalHold = 3000) {
  const delays = getFrameDelays(steps);
  let total = 0;
  for (let i = 0; i < steps - 1; i++) total += delays[i];
  return total + finalHold;
}

async function generateWheelGif(players, winnerIndex, colors = null, config = {}) {
  const SIZE = 640;
  const spinDuration = config.spinDuration ?? 8;
  const showNames = config.showNames !== false;
  const styleConfig = config.styleConfig ?? {};

  const STEPS = getSpinSteps(spinDuration);
  const angles = generateSmoothAngles(winnerIndex, players.length, STEPS);
  const delays = getFrameDelays(STEPS);

  const encoder = new GIFEncoder(SIZE, SIZE, 'neuquant', true);
  encoder.setQuality(10);
  encoder.setRepeat(0);
  encoder.start();

  for (let i = 0; i < STEPS; i++) {
    const isLast = i === STEPS - 1;
    const buf = await generateWheelImage(
      players,
      isLast ? winnerIndex : null,
      angles[i],
      colors,
      SIZE,
      showNames,
      styleConfig
    );
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(buf);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
    encoder.setDelay(isLast ? 3000 : delays[i]);
    encoder.addFrame(data);
  }

  encoder.finish();
  return encoder.out.getData();
}

module.exports = {
  generateWheelImage,
  generateWheelGif,
  generateBannerImage,
  generateSmoothAngles,
  getFrameDelays,
  getTotalGifDuration,
  getSpinSteps,
  SPIN_STEPS,
};
