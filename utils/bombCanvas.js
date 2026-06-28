const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');

try {
  registerFont(path.join(__dirname, '../data/Cairo-ExtraLight.ttf'), { family: 'Cairo' });
} catch (e) {
  console.warn('تعذر تحميل خط Cairo:', e.message);
}

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

// يرسم صورة cover-fit بدون تشويه النسبة
function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0;
  } else {
    sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ──────────────────────────────────────────────────────────────────
//  صورة الكلمة / الجولة
//  تُعرض في القناة كل جولة بدل الـ embed
// ──────────────────────────────────────────────────────────────────
async function generateWordImage({ first, last, holderName, holderAvatarUrl, round, roundSeconds, bannerUrl = null }) {
  const W = 700, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── الخلفية ──
  let hasCustomBg = false;
  if (bannerUrl) {
    try {
      const buf = await fetchImageBuffer(bannerUrl);
      const img = await loadImage(buf);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasCustomBg = true;
    } catch (e) {}
  }
  if (!hasCustomBg) {
    // تدرج افتراضي أسود-أحمر
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0000');
    grad.addColorStop(1, '#1a0000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else {
    // تعتيم فوق البانر المخصص
    ctx.fillStyle = 'rgba(5,0,0,0.58)';
    ctx.fillRect(0, 0, W, H);
  }

  // إطار خارجي
  ctx.strokeStyle = '#cc2200';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  // ── أفاتار الحامل ──
  const avR = 48;
  const avX = 80;
  const avY = H / 2;
  try {
    const buf = await fetchImageBuffer(holderAvatarUrl);
    const img = await loadImage(buf);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, avX - avR, avY - avR, avR * 2, avR * 2);
    ctx.restore();
    // حلقة حمراء
    ctx.beginPath();
    ctx.arc(avX, avY, avR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff3300';
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.fillStyle = '#3a0000';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px Cairo`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((holderName || '?')[0], avX, avY);
  }

  // ── النصوص ──
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 12;

  // "الجولة X"
  ctx.fillStyle = '#ffaa44';
  ctx.font = `bold 18px Cairo`;
  ctx.fillText(`الجولة ${round}`, W - 30, 35);

  // اسم الحامل
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px Cairo`;
  ctx.fillText(`🔥 القنبلة عند: ${holderName}`, W - 30, H / 2 - 50);

  // الحروف المطلوبة - أكبر شيء في الصورة
  ctx.fillStyle = '#ff4422';
  ctx.font = `bold 80px Cairo`;
  ctx.fillText(`${first}  —  ${last}`, W - 30, H / 2 + 10);

  // الوقت المتبقي
  ctx.fillStyle = '#ffcc00';
  ctx.font = `bold 20px Cairo`;
  ctx.fillText(`⏱️ ${roundSeconds} ثانية`, W - 30, H / 2 + 75);

  ctx.shadowBlur = 0;

  // أيقونة القنبلة يسار الصورة
  ctx.font = `70px Cairo`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣', avX, avY - avR - 28);

  return canvas.toBuffer('image/png');
}

// ──────────────────────────────────────────────────────────────────
//  صورة الفائز
// ──────────────────────────────────────────────────────────────────
async function generateBombWinnerImage(winner, bannerUrl = null) {
  const W = 700, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // الخلفية
  let hasCustomBg = false;
  if (bannerUrl) {
    try {
      const buf = await fetchImageBuffer(bannerUrl);
      const img = await loadImage(buf);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasCustomBg = true;
    } catch (e) {}
  }
  if (!hasCustomBg) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0a00');
    grad.addColorStop(1, '#1a1a00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.fillRect(0, 0, W, H);
  }

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  // أفاتار الفائز
  const avR = 70;
  const avX = 100;
  const avY = H / 2;
  const avatarUrl = winner.avatarURL
    ? (typeof winner.avatarURL === 'function' ? winner.avatarURL({ size: 256, format: 'png' }) : winner.avatarURL)
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  try {
    const buf = await fetchImageBuffer(avatarUrl);
    const img = await loadImage(buf);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, avX - avR, avY - avR, avR * 2, avR * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(avX, avY, avR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a00';
    ctx.fill();
  }

  // النصوص
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 12;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#FFD700';
  ctx.font = `bold 28px Cairo`;
  ctx.fillText('🏆 الفائز!', W - 40, H / 2 - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 40px Cairo`;
  ctx.fillText(winner.displayName || winner.username || '؟', W - 40, H / 2 + 15);

  ctx.fillStyle = '#ffcc00';
  ctx.font = `bold 22px Cairo`;
  ctx.fillText('نجا من كل الانفجارات 💥', W - 40, H / 2 + 65);

  ctx.shadowBlur = 0;
  return canvas.toBuffer('image/png');
}

// ──────────────────────────────────────────────────────────────────
//  صورة اللوبي
// ──────────────────────────────────────────────────────────────────
async function generateBombLobbyImage(bannerUrl = null) {
  const W = 700, H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  let hasCustomBg = false;
  if (bannerUrl) {
    try {
      const buf = await fetchImageBuffer(bannerUrl);
      const img = await loadImage(buf);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasCustomBg = true;
    } catch (e) {}
  }
  if (!hasCustomBg) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
  }

  ctx.strokeStyle = '#ff3300';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  ctx.shadowColor = 'rgba(255,50,0,0.6)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 62px Cairo`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣 تمرير القنبلة', W / 2, H / 2);
  ctx.shadowBlur = 0;

  return canvas.toBuffer('image/png');
}

module.exports = { generateWordImage, generateBombWinnerImage, generateBombLobbyImage };
