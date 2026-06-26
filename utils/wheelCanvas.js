const { createCanvas, loadImage } = require('@napi-rs/canvas');
const https = require('https');
const http = require('http');
const GIFEncoder = require('gif-encoder-2');

// عدد فريمات الدوران الافتراضي (لكل ثانية ~9 فريم)
const SPIN_STEPS = 72; // = 8 ثواني × 9

const DEFAULT_PLAYER_COLORS = [
  { outer: '#0d2a6e', inner: '#061428', text: '#a0c4ff' },
  { outer: '#1a0d6e', inner: '#080614', text: '#b0a0ff' },
  { outer: '#0d4a6e', inner: '#061c28', text: '#90d4ff' },
  { outer: '#0d6e3a', inner: '#061e14', text: '#90ffb0' },
  { outer: '#6e0d3a', inner: '#28060e', text: '#ffb0c0' },
  { outer: '#6e4a0d', inner: '#281c06', text: '#ffd090' },
  { outer: '#0d6e6e', inner: '#062828', text: '#90ffff' },
  { outer: '#4a0d6e', inner: '#1c0628', text: '#d090ff' },
  { outer: '#6e6e0d', inner: '#282806', text: '#ffff90' },
  { outer: '#6e1a0d', inner: '#280806', text: '#ffb090' },
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
  bg.addColorStop(0, '#020d1f');
  bg.addColorStop(0.5, '#0a1a3a');
  bg.addColorStop(1, '#050f28');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  return canvas.toBuffer('image/png');
}

/**
 * يرسم العجلة.
 * @param {object[]} players - قائمة اللاعبين
 * @param {number|null} winnerIndex - فهرس الفائز (null = لا أحد)
 * @param {number} rotationAngle - زاوية الدوران الحالية
 * @param {object[]|null} colors - ألوان مخصصة
 * @param {number} size - حجم الكانفاس
 * @param {boolean} showNames - إظهار أسماء اللاعبين
 * @param {object} styleConfig - إعدادات شكل العجلة
 */
async function generateWheelImage(
  players,
  winnerIndex,
  rotationAngle = 0,
  colors = null,
  size = 640,
  showNames = true,
  styleConfig = {}
) {
  const PLAYER_COLORS = colors?.length ? colors : DEFAULT_PLAYER_COLORS;
  const SIZE = size;
  const scale = SIZE / 700;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 320 * scale;

  // ✅ نصف قطر المركز يتغير حسب شكل العجلة
  const innerRadiusFactor = styleConfig.innerRadiusFactor ?? 0.28;
  const innerR = outerR * innerRadiusFactor;
  const segmentStyle = styleConfig.segmentStyle ?? 'gradient';
  const borderStyle = styleConfig.borderStyle ?? 'solid';
  const outerGlow = styleConfig.outerGlow ?? true;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // توهج خارجي
  if (outerGlow) {
    const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 20 * scale, cx, cy, outerR + 40 * scale);
    glowGrad.addColorStop(0, 'rgba(20, 60, 160, 0.35)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 40 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  const n = players.length;
  if (n > 0) {
    const sliceAngle = (Math.PI * 2) / n;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationAngle - Math.PI / 2);
    ctx.translate(-cx, -cy);

    for (let i = 0; i < n; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;
      const col = PLAYER_COLORS[i % PLAYER_COLORS.length];

      // ✅ رسم الشريحة حسب النمط
      if (segmentStyle === 'flat') {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = col.outer;
        ctx.fill();
      } else if (segmentStyle === 'neon') {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = col.inner;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.closePath();
        ctx.strokeStyle = col.outer;
        ctx.lineWidth = 3 * scale;
        ctx.shadowColor = col.outer;
        ctx.shadowBlur = 10 * scale;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // gradient (الافتراضي)
        const gx = cx + Math.cos(midAngle) * outerR * 0.55;
        const gy = cy + Math.sin(midAngle) * outerR * 0.55;
        const grad = ctx.createRadialGradient(gx, gy, 0, cx, cy, outerR);
        grad.addColorStop(0, col.outer);
        grad.addColorStop(1, col.inner);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // إطار الشريحة
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();
      if (borderStyle === 'gold') {
        ctx.strokeStyle = 'rgba(220,180,60,0.6)';
        ctx.lineWidth = Math.max(1, 2 * scale);
      } else if (borderStyle === 'neon') {
        ctx.strokeStyle = 'transparent';
      } else if (borderStyle === 'thin') {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = Math.max(0.5, 1 * scale);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = Math.max(1, 2 * scale);
      }
      ctx.stroke();

      // ✅ أسماء اللاعبين — تُرسم فقط لو showNames = true
      if (showNames) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(midAngle);
        const baseFontSize = n <= 2 ? 30 : n <= 4 ? 25 : n <= 6 ? 21 : n <= 8 ? 18 : 16;
        const fontSize = Math.max(10, baseFontSize * scale);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 8 * scale;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayName = players[i].displayName || players[i].username || '؟';
        const maxLen = Math.max(4, (n <= 2 ? 14 : n <= 4 ? 10 : n <= 6 ? 8 : 6) - 3);
        const shortName = displayName.length > maxLen ? displayName.substring(0, maxLen) + '..' : displayName;
        const labelText = `${i + 1}- ${shortName}`;
        ctx.translate(outerR * 0.62, 0);
        ctx.fillText(labelText, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // الحافة الخارجية
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  if (borderStyle === 'gold') {
    const goldRing = ctx.createLinearGradient(cx - outerR, cy, cx + outerR, cy);
    goldRing.addColorStop(0, '#806010');
    goldRing.addColorStop(0.5, '#f0c030');
    goldRing.addColorStop(1, '#806010');
    ctx.strokeStyle = goldRing;
    ctx.lineWidth = Math.max(3, 5 * scale);
    ctx.shadowColor = '#f0c030';
    ctx.shadowBlur = 10 * scale;
  } else if (borderStyle === 'neon') {
    ctx.strokeStyle = '#a040ff';
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.shadowColor = '#a040ff';
    ctx.shadowBlur = 14 * scale;
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(1, 2 * scale);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // دائرة المركز
  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  centerGrad.addColorStop(0, '#1a2a5a');
  centerGrad.addColorStop(0.6, '#0a1535');
  centerGrad.addColorStop(1, '#050e25');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.stroke();

  // صورة الفائز بالمركز
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
      const r = innerR - 6 * scale;
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
      ctx.arc(cx, cy, innerR - 3 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = goldRing;
      ctx.lineWidth = Math.max(2, 4 * scale);
      ctx.stroke();
    } catch (e) {
      ctx.fillStyle = '#7090d0';
      ctx.font = `bold ${44 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = winner.displayName || winner.username || '?';
      ctx.fillText(name[0].toUpperCase(), cx, cy);
    }
  }

  // المؤشر
  ctx.save();
  ctx.translate(cx, cy);
  const needleLen = outerR - 4 * scale;
  const baseWidth = 14 * scale;
  const needleGrad = ctx.createLinearGradient(0, -baseWidth, 0, baseWidth);
  needleGrad.addColorStop(0, '#1a2a5a');
  needleGrad.addColorStop(0.5, '#f0f6ff');
  needleGrad.addColorStop(1, '#1a2a5a');
  ctx.beginPath();
  ctx.moveTo(0, -baseWidth * 0.55);
  ctx.lineTo(needleLen * 0.8, -baseWidth * 0.16);
  ctx.lineTo(needleLen, 0);
  ctx.lineTo(needleLen * 0.8, baseWidth * 0.16);
  ctx.lineTo(0, baseWidth * 0.55);
  ctx.closePath();
  ctx.fillStyle = needleGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,240,255,0.8)';
  ctx.lineWidth = Math.max(1, 1 * scale);
  ctx.stroke();
  ctx.restore();

  // نقطة المركز
  const hubGrad = ctx.createRadialGradient(cx - 3 * scale, cy - 3 * scale, 0, cx, cy, 14 * scale);
  hubGrad.addColorStop(0, '#ffffff');
  hubGrad.addColorStop(0.5, '#a0c0f0');
  hubGrad.addColorStop(1, '#1a2a5a');
  ctx.beginPath();
  ctx.arc(cx, cy, 12 * scale, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();

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

/**
 * ✅ عدد الفريمات يُحسب من مدة الدوران (ثواني × 9 فريم/ثانية)
 */
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

/**
 * ✅ يقبل config من إعدادات السيرفر (spinDuration, showNames, styleConfig)
 */
async function generateWheelGif(players, winnerIndex, colors = null, config = {}) {
  const SIZE = 640;
  const spinDuration = config.spinDuration ?? 8;
  const showNames    = config.showNames    ?? true;
  const styleConfig  = config.styleConfig  ?? {};

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
