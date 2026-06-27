const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const GIFEncoder = require('gif-encoder-2');
const path = require('path');

// تسجيل خط Cairo لدعم العربية
try {
  registerFont(path.join(__dirname, '../data/Cairo-ExtraLight.ttf'), { family: 'Cairo' });
} catch (e) {
  console.warn('تعذر تحميل خط Cairo:', e.message);
}

const SPIN_STEPS = 72;

// ألوان داكنة وأنيقة
const DEFAULT_PLAYER_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#e91e63',
  '#00bcd4',
  '#8bc34a',
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
  bg.addColorStop(0, '#0a0a1e');
  bg.addColorStop(0.5, '#12082a');
  bg.addColorStop(1, '#0a1428');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Cairo';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#c0a030';
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
  const outerR = SIZE * 0.42;
  const innerR = SIZE * 0.11;
  const n = players.length;

  // خلفية داكنة أنيقة
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.7);
  bgGrad.addColorStop(0, '#16162a');
  bgGrad.addColorStop(1, '#0a0a12');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (n === 0) return canvas.toBuffer('image/png');

  const COLORS = Array.isArray(colors) && colors.length > 0
    ? colors.map(c => typeof c === 'string' ? c : (c.outer || '#1a1a4e'))
    : DEFAULT_PLAYER_COLORS;

  const sliceAngle = (Math.PI * 2) / n;

  const isNeonNavy = styleConfig?.borderStyle === 'neon_navy';
  const isNeon = styleConfig?.borderStyle === 'neon';

  // ── رسم الشرائح ──
  for (let i = 0; i < n; i++) {
    const start = rotationAngle + i * sliceAngle - Math.PI / 2;
    const end = start + sliceAngle;
    const mid = start + sliceAngle / 2;
    const color = COLORS[i % COLORS.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, start, end);
    ctx.closePath();

    if (isNeonNavy) {
      const navyColors = ['#050c18','#070f22','#040a14','#060e1c','#050b16','#07102a'];
      const baseColor = navyColors[i % navyColors.length];
      const g1x = cx + Math.cos(mid) * outerR * 0.2;
      const g1y = cy + Math.sin(mid) * outerR * 0.2;
      const g2x = cx + Math.cos(mid) * outerR;
      const g2y = cy + Math.sin(mid) * outerR;
      const sg = ctx.createLinearGradient(g1x, g1y, g2x, g2y);
      sg.addColorStop(0, lightenColor(baseColor, 40));
      sg.addColorStop(1, baseColor);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#4a9eff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      const g1x = cx + Math.cos(mid) * outerR * 0.3;
      const g1y = cy + Math.sin(mid) * outerR * 0.3;
      const g2x = cx + Math.cos(mid) * outerR;
      const g2y = cy + Math.sin(mid) * outerR;
      const sg = ctx.createLinearGradient(g1x, g1y, g2x, g2y);
      sg.addColorStop(0, lightenColor(color, 30));
      sg.addColorStop(1, color);
      ctx.fillStyle = sg;
      ctx.fill();
      if (isNeon) {
        ctx.strokeStyle = '#cc44ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // ── رسم الأسماء ──
  if (showNames) {
    for (let i = 0; i < n; i++) {
      const mid = rotationAngle + i * sliceAngle - Math.PI / 2 + sliceAngle / 2;
      const textR = outerR * 0.62;
      const tx = cx + Math.cos(mid) * textR;
      const ty = cy + Math.sin(mid) * textR;

      const displayName = players[i].displayName || players[i].username || '؟';
      const maxLen = n <= 3 ? 10 : n <= 5 ? 7 : n <= 7 ? 6 : 5;
      const shortName = displayName.length > maxLen
        ? displayName.substring(0, maxLen) + '..'
        : displayName;

      const fontSize = n <= 3 ? 22 : n <= 5 ? 18 : n <= 7 ? 15 : 12;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.font = `bold ${fontSize}px Cairo`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // ظل النص
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.95)';
      ctx.strokeText(shortName, 0, 0);

      // النص بلون أبيض ذهبي
      ctx.fillStyle = '#f0e6c0';
      ctx.shadowColor = 'rgba(200,160,50,0.4)';
      ctx.shadowBlur = 4;
      ctx.fillText(shortName, 0, 0);
      ctx.restore();
    }
  }

  // ── الحافة الخارجية - كحلية بسيطة ──
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 3, 0, Math.PI * 2);
  ctx.strokeStyle = '#1a3a6e';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#1a3a6e';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── دائرة المركز ──
  // ظل المركز
  ctx.beginPath();
  ctx.arc(cx, cy, innerR + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a12';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  const centerGrad = ctx.createRadialGradient(cx - innerR * 0.3, cy - innerR * 0.3, 0, cx, cy, innerR);
  centerGrad.addColorStop(0, '#2a2a4e');
  centerGrad.addColorStop(1, '#0e0e22');
  ctx.fillStyle = centerGrad;
  ctx.fill();

  // حلقة ذهبية للمركز
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = '#1a3a6e';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(26,58,110,0.8)';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

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
      const r = innerR - 5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();

      // حلقة ذهبية فوق الصورة
      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#e8cc60';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(232,204,96,0.8)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } catch (e) {
      ctx.fillStyle = '#c0a030';
      ctx.font = `bold ${innerR * 0.8}px Cairo`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = winner.displayName || winner.username || '?';
      ctx.fillText(name[0].toUpperCase(), cx, cy);
    }
  }

  // ── السهم (يمين العجلة، صغير وأنيق) ──
  const needleX = cx + outerR + 18;
  const needleSize = 14; // صغير

  ctx.save();
  ctx.translate(needleX, cy);

  // ظل السهم
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 1;

  // جسم السهم - مثلث صغير يشير يساراً (نحو العجلة)
  ctx.beginPath();
  ctx.moveTo(-needleSize, 0);           // رأس السهم (يشير للعجلة)
  ctx.lineTo(needleSize * 0.6, -needleSize * 0.55);  // أعلى
  ctx.lineTo(needleSize * 0.6, needleSize * 0.55);   // أسفل
  ctx.closePath();

  // تدرج للسهم
  const needleGrad = ctx.createLinearGradient(-needleSize, 0, needleSize * 0.6, 0);
  needleGrad.addColorStop(0, '#e8cc60');
  needleGrad.addColorStop(0.5, '#c0a030');
  needleGrad.addColorStop(1, '#8a6a10');
  ctx.fillStyle = needleGrad;
  ctx.fill();

  // حدود السهم
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  return canvas.toBuffer('image/png');
}

// دالة مساعدة لتفتيح اللون
function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
  encoder.setQuality(1);
  encoder.setRepeat(-1);
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
    encoder.setDelay(isLast ? 5000 : delays[i]);
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
