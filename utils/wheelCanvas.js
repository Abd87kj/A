const { createCanvas, loadImage } = require('@napi-rs/canvas');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const GIFEncoder = require('gif-encoder-2');

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
      if (res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
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
 * يرسم العجلة. كل القياسات (نصف القطر، عرض الخطوط، حجم الخط...) مصممة أصلاً
 * على أساس مقاس 700px، وتُحسب نسبيًا (scale) لأي مقاس تمرره بـ size،
 * عشان نضمن إن العجلة تبقى واضحة وما تفسد لو غيّرنا مقاس التصدير.
 */
async function generateWheelImage(players, winnerIndex, rotationAngle = 0, colors = null, size = 640) {
  const PLAYER_COLORS = colors && colors.length ? colors : DEFAULT_PLAYER_COLORS;
  const SIZE = size;
  const scale = SIZE / 700;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 320 * scale;
  const innerR = 90 * scale;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 20 * scale, cx, cy, outerR + 40 * scale);
  glowGrad.addColorStop(0, 'rgba(20, 60, 160, 0.35)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 40 * scale, 0, Math.PI * 2);
  ctx.fill();

  const n = players.length;
  if (n === 0) {
    const emptyGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    emptyGrad.addColorStop(0, '#0d2a5a');
    emptyGrad.addColorStop(1, '#040d1e');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = emptyGrad;
    ctx.fill();
  } else {
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

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.stroke();

      // رسم الاسم - محور الكتابة على امتداد القطعة
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      const textR = outerR * 0.62;
      // أحجام مرفوعة عن النسخة القديمة عشان توضح أكثر بعد التصدير
      const baseFontSize = n <= 2 ? 30 : n <= 4 ? 25 : n <= 6 ? 21 : n <= 8 ? 18 : 16;
      const fontSize = Math.max(10, baseFontSize * scale);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = col.text;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 8 * scale;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const displayName = players[i].displayName || players[i].username || '؟';
      const maxLen = n <= 2 ? 14 : n <= 4 ? 10 : n <= 6 ? 8 : 6;
      const shortName = displayName.length > maxLen
        ? displayName.substring(0, maxLen) + '..'
        : displayName;

      ctx.translate(textR, 0);
      ctx.fillText(shortName, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // حافة خارجية بسيطة
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.stroke();

  // دائرة المركز
  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  centerGrad.addColorStop(0, '#1a2a5a');
  centerGrad.addColorStop(0.6, '#0a1535');
  centerGrad.addColorStop(1, '#050e25');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.stroke();

  // صورة الفائز في المركز
  if (winnerIndex !== null && winnerIndex >= 0 && players[winnerIndex]) {
    const winner = players[winnerIndex];
    const avatarUrl =
      typeof winner.avatarURL === 'function'
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
  if (t < 0.15) {
    return easeInOutCubic(t / 0.15) * 0.08;
  } else if (t < 0.75) {
    const localT = (t - 0.15) / 0.60;
    return 0.08 + localT * 0.72;
  } else {
    const localT = (t - 0.75) / 0.25;
    return 0.80 + easeOutQuint(localT) * 0.20;
  }
}

function generateSmoothAngles(winnerIndex, playerCount, steps = 48) {
  const FULL_ROTATIONS = 8;
  const sliceAngle = (Math.PI * 2) / playerCount;
  const targetSlice = sliceAngle * winnerIndex;
  const targetAngle = (Math.PI * 2 * FULL_ROTATIONS)
    + (Math.PI * 2 - targetSlice - (sliceAngle / 2));
  const angles = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    angles.push(targetAngle * spinEasing(t));
  }
  return angles;
}

function getFrameDelays(steps = 48) {
  const delays = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    if (t < 0.15)      delays.push(40);
    else if (t < 0.50) delays.push(55);
    else if (t < 0.70) delays.push(80);
    else if (t < 0.82) delays.push(120);
    else if (t < 0.90) delays.push(200);
    else if (t < 0.95) delays.push(300);
    else               delays.push(450);
  }
  return delays;
}

/**
 * المدة الحقيقية الكاملة للـ GIF بالملي ثانية (تشمل كل الفريمات
 * + مدة ثبات الفريم الأخير اللي فيه صورة الفائز). نستخدمها بدل
 * أي رقم تقريبي ثابت عشان رسالة النتيجة تنزل بعد ما العجلة توقفت فعليًا.
 */
function getTotalGifDuration(steps = 48, finalHold = 3000) {
  const delays = getFrameDelays(steps);
  let total = 0;
  for (let i = 0; i < steps - 1; i++) total += delays[i];
  return total + finalHold;
}

async function generateWheelGif(players, winnerIndex, colors = null) {
  const SIZE = 640;
  const STEPS = 48;
  const angles = generateSmoothAngles(winnerIndex, players.length, STEPS);
  const delays = getFrameDelays(STEPS);

  const encoder = new GIFEncoder(SIZE, SIZE, 'neuquant', true);
  encoder.setQuality(10);
  encoder.setRepeat(0);
  encoder.start();

  for (let i = 0; i < STEPS; i++) {
    const isLast = i === STEPS - 1;

    // الفريم الأخير يظهر صورة الفائز في المركز
    const buf = await generateWheelImage(
      players,
      isLast ? winnerIndex : null,
      angles[i],
      colors,
      SIZE // نفس مقاس الرسم = نفس مقاس التصدير، بدون أي تصغير يفسد وضوح الأسماء
    );

    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(buf);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    // الفريم الأخير يبقى ثابت 3 ثواني
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
};
