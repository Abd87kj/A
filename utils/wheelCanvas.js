const { createCanvas, loadImage } = require('@napi-rs/canvas');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BANNER_PATH = path.join(__dirname, '../assets/roulette_banner.png');

// ألوان كحلي غامق متدرج لكل لاعب - درجات مختلفة
const PLAYER_COLORS = [
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
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// رسم صورة الواجهة (البانر الكحلي)
async function generateBannerImage() {
  const W = 700, H = 350;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  try {
    const bannerImg = await loadImage(BANNER_PATH);
    ctx.drawImage(bannerImg, 0, 0, W, H);
  } catch (e) {
    // fallback خلفية كحلية
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#020d1f');
    bg.addColorStop(1, '#050f28');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  return canvas.toBuffer('image/png');
}

// رسم العجلة الكاملة مع الأسماء والصورة في المنتصف
async function generateWheelImage(players, winnerIndex, rotationAngle = 0) {
  const SIZE = 700;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 310;
  const innerR = 90;

  // خلفية سوداء
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // هالة خارجية
  const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 20, cx, cy, outerR + 40);
  glowGrad.addColorStop(0, 'rgba(20, 60, 160, 0.35)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 40, 0, Math.PI * 2);
  ctx.fill();

  const n = players.length;
  if (n === 0) {
    // عجلة فارغة
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

      // تدرج القطعة
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

      // حدود بين القطع
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(80, 130, 220, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // اسم اللاعب على القطعة
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      const textRadius = outerR * 0.65;
      ctx.translate(textRadius, 0);

      // إذا القطعة صغيرة، صغّر الخط
      const fontSize = n <= 4 ? 18 : n <= 6 ? 15 : n <= 8 ? 13 : 11;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = col.text;
      ctx.shadowColor = 'rgba(0,0,20,0.9)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const displayName = players[i].displayName || players[i].username || '؟';
      const maxLen = n <= 4 ? 12 : n <= 6 ? 9 : 7;
      const shortName = displayName.length > maxLen ? displayName.substring(0, maxLen) + '..' : displayName;

      // نص مستقيم (بدون تدوير)
      ctx.rotate(-midAngle);
      ctx.fillText(shortName, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  // الحلقة الخارجية المعدنية الفخمة
  // حلقة داخلية
  const ring1 = ctx.createLinearGradient(cx - outerR, cy, cx + outerR, cy);
  ring1.addColorStop(0, '#0a1535');
  ring1.addColorStop(0.25, '#2a4a8a');
  ring1.addColorStop(0.5, '#6080c0');
  ring1.addColorStop(0.75, '#2a4a8a');
  ring1.addColorStop(1, '#0a1535');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 6, 0, Math.PI * 2);
  ctx.strokeStyle = ring1;
  ctx.lineWidth = 10;
  ctx.stroke();

  // حلقة خارجية لامعة
  const ring2 = ctx.createLinearGradient(cx - outerR - 10, cy - outerR - 10, cx + outerR + 10, cy + outerR + 10);
  ring2.addColorStop(0, '#304080');
  ring2.addColorStop(0.3, '#8090d0');
  ring2.addColorStop(0.5, '#a0b0e0');
  ring2.addColorStop(0.7, '#8090d0');
  ring2.addColorStop(1, '#304080');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 14, 0, Math.PI * 2);
  ctx.strokeStyle = ring2;
  ctx.lineWidth = 4;
  ctx.stroke();

  // المؤشر (مثلث) على اليمين
  const arrowTip = cx + outerR + 4;
  ctx.beginPath();
  ctx.moveTo(arrowTip + 24, cy);
  ctx.lineTo(arrowTip, cy - 18);
  ctx.lineTo(arrowTip, cy + 18);
  ctx.closePath();
  const arrowGrad = ctx.createLinearGradient(arrowTip, cy - 18, arrowTip + 24, cy);
  arrowGrad.addColorStop(0, '#2050a0');
  arrowGrad.addColorStop(1, '#90b0ff');
  ctx.fillStyle = arrowGrad;
  ctx.fill();
  ctx.strokeStyle = '#c0d8ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // الدائرة الوسطى
  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  centerGrad.addColorStop(0, '#1a2a5a');
  centerGrad.addColorStop(0.6, '#0a1535');
  centerGrad.addColorStop(1, '#050e25');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();

  // إطار الدائرة الوسطى
  const centerRing = ctx.createLinearGradient(cx - innerR, cy, cx + innerR, cy);
  centerRing.addColorStop(0, '#1a3060');
  centerRing.addColorStop(0.5, '#5070b0');
  centerRing.addColorStop(1, '#1a3060');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = centerRing;
  ctx.lineWidth = 3;
  ctx.stroke();

  // صورة اللاعب في المنتصف
  if (winnerIndex !== null && winnerIndex >= 0 && players[winnerIndex]) {
    const winner = players[winnerIndex];
    const avatarFn = winner.avatarURL;
    const avatarUrl = typeof avatarFn === 'function'
      ? avatarFn({ size: 128, format: 'png' })
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(winner.discriminator || '0') % 5}.png`;

    try {
      const imgBuf = await fetchImageBuffer(avatarUrl);
      const img = await loadImage(imgBuf);
      const r = innerR - 6;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();

      // إطار ذهبي
      const goldRing = ctx.createLinearGradient(cx - innerR, cy, cx + innerR, cy);
      goldRing.addColorStop(0, '#806010');
      goldRing.addColorStop(0.5, '#f0c030');
      goldRing.addColorStop(1, '#806010');
      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 3, 0, Math.PI * 2);
      ctx.strokeStyle = goldRing;
      ctx.lineWidth = 4;
      ctx.stroke();
    } catch (e) {
      // fallback حرف أول الاسم
      ctx.fillStyle = '#7090d0';
      ctx.font = `bold 44px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = winner.displayName || winner.username || '?';
      ctx.fillText(name[0].toUpperCase(), cx, cy);
    }
  }

  return canvas.toBuffer('image/png');
}

// دالة الأنيميشن السلس - ترجع مصفوفة من الزوايا
function generateSmoothAngles(winnerIndex, playerCount, steps = 12) {
  const targetSlice = (Math.PI * 2 / playerCount) * winnerIndex;
  // نريد المؤشر يقف على منتصف قطعة الفائز
  const targetAngle = (Math.PI * 2 * 6) + (Math.PI * 2 - targetSlice - (Math.PI / playerCount));
  
  const angles = [];
  for (let i = 1; i <= steps; i++) {
    // easing: تبدأ سريعة وتتباطأ بشكل سلس جداً
    const t = i / steps;
    const eased = 1 - Math.pow(1 - t, 4); // ease-out quartic
    angles.push(targetAngle * eased);
  }
  return angles;
}

module.exports = { generateWheelImage, generateBannerImage, generateSmoothAngles };
