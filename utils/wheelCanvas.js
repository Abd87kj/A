const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');

try {
  registerFont(path.join(__dirname, '../data/Cairo-ExtraLight.ttf'), { family: 'Cairo' });
} catch (e) {
  console.warn('تعذر تحميل خط Cairo:', e.message);
}

const SPIN_STEPS = 72;

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
  const W = 700, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  // إطار أبيض
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Cairo';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
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
  const innerR = SIZE * 0.13;
  const n = players.length;

  // خلفية سوداء
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (n === 0) return canvas.toBuffer('image/png');

  const COLORS = Array.isArray(colors) && colors.length > 0 ? colors : [
    { outer: '#f0f0f0', border: '#000000', text: '#000000' },
    { outer: '#d0d0d0', border: '#000000', text: '#000000' },
  ];

  const sliceAngle = (Math.PI * 2) / n;

  // ── رسم الشرائح ──
  for (let i = 0; i < n; i++) {
    const start = rotationAngle + i * sliceAngle - Math.PI / 2;
    const end = start + sliceAngle;

    const colorObj = COLORS[i % COLORS.length];
    const fillColor = typeof colorObj === 'string' ? colorObj : (colorObj.outer || '#e0e0e0');
    const borderColor = (typeof colorObj === 'object' && colorObj.border) ? colorObj.border
      : (typeof colorObj === 'object' && colorObj.neon) ? colorObj.neon
      : '#000000';

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, start, end);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // حد الشريحة
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderColor === '#000000' ? 2.5 : 2;
    if (typeof colorObj === 'object' && colorObj.neon) {
      ctx.shadowColor = colorObj.neon;
      ctx.shadowBlur = 8;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── رسم الأسماء ──
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

      const fontSize = n <= 3 ? 22 : n <= 5 ? 18 : n <= 7 ? 15 : 12;

      const colorObj = COLORS[i % COLORS.length];
      const fillColor = typeof colorObj === 'string' ? colorObj : (colorObj.outer || '#e0e0e0');
      const isLight = isLightColor(fillColor);
      const textColor = '#ffffff'; // دائماً أبيض

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.font = `bold ${fontSize}px Cairo`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // ظل أسود للنص عشان يظهر على أي خلفية
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(shortName, 0, 0);

      ctx.fillStyle = textColor;
      ctx.fillText(shortName, 0, 0);
      ctx.restore();
    }
  }

  // ── الحافة الخارجية السميكة ──
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 1, 0, Math.PI * 2);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 7;
  ctx.stroke();

  // ── دائرة المركز ──
  ctx.beginPath();
  ctx.arc(cx, cy, innerR + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  // ── صورة الفائز في المركز (إذا وجد) ──
  if (winnerIndex !== null && winnerIndex >= 0 && players[winnerIndex]) {
    const winner = players[winnerIndex];
    const avatarUrl = typeof winner.avatarURL === 'function'
      ? winner.avatarURL({ size: 256, format: 'png' })
      : (typeof winner.avatarURL === 'string' && winner.avatarURL)
        ? winner.avatarURL
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(winner.discriminator || '0') % 5}.png`;
    try {
      const imgBuf = await fetchImageBuffer(avatarUrl);
      const img = await loadImage(imgBuf);
      const r = innerR - 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();

      // حلقة بيضاء
      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 1, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } catch (e) {
      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#333333';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${innerR * 0.8}px Cairo`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = winner.displayName || winner.username || '?';
      ctx.fillText(name[0].toUpperCase(), cx, cy);
    }
  } else {
    // مركز فارغ
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
  }

  // ── السهم (يمين العجلة) ──
  const needleX = cx + outerR + 16;
  const needleSize = 14;
  ctx.save();
  ctx.translate(needleX, cy);
  ctx.beginPath();
  ctx.moveTo(-needleSize, 0);
  ctx.lineTo(needleSize * 0.6, -needleSize * 0.55);
  ctx.lineTo(needleSize * 0.6, needleSize * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  return canvas.toBuffer('image/png');
}

function isLightColor(hex) {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  } catch (e) {
    return false;
  }
}

// ─── صورة الفائز النهائية ───
async function generateWinnerImage(winner, pot, bet, bannerUrl = null) {
  // أبعاد الصورة النهائية - نفس نسبة الـ banner الأصلية (1366×968 ≈ 1.41)
  const W = 700, H = 496;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── الخلفية: بانر مخصص أو أسود افتراضي ──
  if (bannerUrl) {
    try {
      const bannerBuf = await fetchImageBuffer(bannerUrl);
      const bannerImg = await loadImage(bannerBuf);
      // نرسم البانر بالكامل بدون طبقة شفافة عشان يظهر واضح
      ctx.drawImage(bannerImg, 0, 0, W, H);
    } catch (e) {
      ctx.fillStyle = '#080e1a';
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = '#080e1a';
    ctx.fillRect(0, 0, W, H);
  }

  // ── موضع الأفاتار داخل دائرة البانر ──
  // الدائرة في الصورة الأصلية (1366×968): مركز (683, 430), r≈270
  // بعد scale لـ (700×496): مركز (350, 220), r≈138
  const avatarX = W * 0.50;       // 350
  const avatarY = H * 0.444;      // ~220
  const avatarR = W * 0.197;      // ~138 - يملأ الدائرة

  const avatarUrl = typeof winner.avatarURL === 'function'
    ? winner.avatarURL({ size: 256, format: 'png' })
    : (typeof winner.avatarURL === 'string' && winner.avatarURL)
      ? winner.avatarURL
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(winner.discriminator || '0') % 5}.png`;

  try {
    const imgBuf = await fetchImageBuffer(avatarUrl);
    const img = await loadImage(imgBuf);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
  } catch (e) {
    // fallback دائرة رمادية
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2a4a';
    ctx.fill();
  }

  // ── اسم الفائز تحت الدائرة ──
  const textY = avatarY + avatarR + 22;

  ctx.font = 'bold 36px Cairo';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 8;
  ctx.fillText(winner.displayName || winner.username || '؟', W / 2, textY);

  // ── النقاط ──
  ctx.font = 'bold 28px Cairo';
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 8;
  ctx.fillText(`+${pot} نقطة`, W / 2, textY + 46);
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

// ─── generateWheelGif للتوافق - يرجع صورة ثابتة فقط ───
async function generateWheelGif(players, winnerIndex, colors = null, config = {}) {
  const SIZE = 640;
  const showNames = config.showNames !== false;
  const styleConfig = config.styleConfig ?? {};
  const spinDuration = config.spinDuration ?? 8;
  const STEPS = getSpinSteps(spinDuration);
  const angles = generateSmoothAngles(winnerIndex, players.length, STEPS);
  const finalAngle = angles[angles.length - 1];
  return generateWheelImage(players, winnerIndex, finalAngle, colors, SIZE, showNames, styleConfig);
}

module.exports = {
  generateWheelImage,
  generateWheelGif,
  generateWinnerImage,
  generateBannerImage,
  generateSmoothAngles,
  getFrameDelays,
  getTotalGifDuration,
  getSpinSteps,
  SPIN_STEPS,
};
