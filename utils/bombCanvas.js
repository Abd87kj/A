const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');

try {
  registerFont(path.join(__dirname, '../data/Cairo-ExtraLight.ttf'), { family: 'Cairo' });
} catch (e) {
  console.warn('تعذر تحميل خط Cairo:', e.message);
}

// الخلفية الافتراضية الجديدة لصورة الجولة (الصورة الزرقاء)
// ضع ملف الصورة هنا: data/bomb-word-bg.png
const DEFAULT_WORD_BG = path.join(__dirname, '../data/bomb-word-bg.png');

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
//  أيقونات مرسومة (بديل عن الإيموجي عشان نتجنب مشكلة صناديق الكود
//  لما الخط لا يدعم رموز الإيموجي على السيرفر)
// ──────────────────────────────────────────────────────────────────
function drawBombIcon(ctx, cx, cy, size) {
  const r = size * 0.42;
  ctx.save();
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, '#3a3a3a');
  grad.addColorStop(1, '#0a0a0a');
  ctx.beginPath();
  ctx.fillStyle = grad;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#7ec8ff';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.55, cy - r * 0.6);
  ctx.quadraticCurveTo(cx + r * 1.2, cy - r * 1.3, cx + r * 1.0, cy - r * 1.9);
  ctx.stroke();

  const sx = cx + r * 1.0, sy = cy - r * 1.9;
  ctx.fillStyle = '#29b6f6';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i;
    const rr = i % 2 === 0 ? size * 0.16 : size * 0.06;
    const px = sx + Math.cos(ang) * rr;
    const py = sy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFireIcon(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  const w = size * 0.5, h = size * 0.65;
  const grad = ctx.createLinearGradient(0, h, 0, -h);
  grad.addColorStop(0, '#0091ea');
  grad.addColorStop(0.55, '#29b6f6');
  grad.addColorStop(1, '#80d8ff');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.bezierCurveTo(w, h * 0.25, w * 0.55, -h * 0.35, 0, -h);
  ctx.bezierCurveTo(-w * 0.55, -h * 0.35, -w, h * 0.25, 0, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTimerIcon(ctx, cx, cy, size) {
  const r = size * 0.38;
  ctx.save();
  ctx.strokeStyle = '#7ec8ff';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.06, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.12, cy - r - size * 0.1);
  ctx.lineTo(cx + size * 0.12, cy - r - size * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.06);
  ctx.lineTo(cx, cy + size * 0.06 - r * 0.6);
  ctx.moveTo(cx, cy + size * 0.06);
  ctx.lineTo(cx + r * 0.4, cy + size * 0.06 + r * 0.25);
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawTrophyIcon(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.35);
  ctx.lineTo(size * 0.3, -size * 0.35);
  ctx.lineTo(size * 0.18, size * 0.15);
  ctx.lineTo(-size * 0.18, size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.arc(-size * 0.36, -size * 0.2, size * 0.13, Math.PI * 0.2, Math.PI * 1.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.36, -size * 0.2, size * 0.13, Math.PI * 1.7, Math.PI * 0.8, true);
  ctx.stroke();
  ctx.fillRect(-size * 0.1, size * 0.15, size * 0.2, size * 0.12);
  ctx.fillRect(-size * 0.18, size * 0.27, size * 0.36, size * 0.08);
  ctx.restore();
}

function drawBoomIcon(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  const spikes = 10;
  ctx.fillStyle = '#ff5500';
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (Math.PI / spikes) * i;
    const rr = i % 2 === 0 ? size * 0.42 : size * 0.2;
    const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
//  صورة الكلمة / الجولة  (الثيم الأزرق - الحروف بيضاء)
//  تُعرض في القناة كل جولة بدل الـ embed
// ──────────────────────────────────────────────────────────────────
async function generateWordImage({ first, last, holderName, holderAvatarUrl, round, roundSeconds, bannerUrl = null }) {
  const W = 700, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── الخلفية ──
  // أولوية: بانر مخصص من إعدادات السيرفر، وإلا الخلفية الزرقاء الافتراضية، وإلا تدرج بديل أزرق
  let hasImageBg = false;
  if (bannerUrl) {
    try {
      const buf = await fetchImageBuffer(bannerUrl);
      const img = await loadImage(buf);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasImageBg = true;
    } catch (e) {}
  }
  if (!hasImageBg) {
    try {
      const img = await loadImage(DEFAULT_WORD_BG);
      drawImageCover(ctx, img, 0, 0, W, H);
      hasImageBg = true;
    } catch (e) {}
  }

  if (!hasImageBg) {
    // تدرج افتراضي أزرق-أسود (يستخدم فقط إذا تعذر تحميل أي صورة خلفية)
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#00040a');
    grad.addColorStop(1, '#001a33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#29b6f6';
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, W - 10, H - 10);
  } else {
    // تعتيم خفيف جداً فقط لضمان وضوح النص، بدون كسر لون الخلفية الزرقاء
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, W, H);
  }

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
    // حلقة زرقاء نيون (تناسق مع الخلفية)
    ctx.beginPath();
    ctx.arc(avX, avY, avR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#29b6f6';
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1b2a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px Cairo`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((holderName || '?')[0], avX, avY);
  }

  // أيقونة القنبلة فوق الأفاتار
  drawBombIcon(ctx, avX, avY - avR - 30, 56);

  // ── النصوص ──
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 12;

  // "الجولة X"
  ctx.fillStyle = '#7ec8ff';
  ctx.font = `bold 18px Cairo`;
  ctx.fillText(`الجولة ${round}`, W - 30, 35);

  // اسم الحامل (+ أيقونة نار زرقاء بدل 🔥)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px Cairo`;
  const holderLine = `القنبلة عند: ${holderName}`;
  const holderY = H / 2 - 50;
  ctx.fillText(holderLine, W - 30, holderY);
  const holderW = ctx.measureText(holderLine).width;
  ctx.shadowBlur = 0;
  drawFireIcon(ctx, W - 30 - holderW - 22, holderY, 34);
  ctx.shadowBlur = 12;

  // الحروف المطلوبة - أكبر شيء في الصورة (أبيض الآن)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 80px Cairo`;
  ctx.fillText(`${first}  —  ${last}`, W - 30, H / 2 + 10);

  // الوقت المتبقي (+ أيقونة مؤقت زرقاء بدل ⏱️)
  ctx.fillStyle = '#7ec8ff';
  ctx.font = `bold 20px Cairo`;
  const timeLine = `${roundSeconds} ثانية`;
  const timeY = H / 2 + 75;
  ctx.fillText(timeLine, W - 30, timeY);
  const timeW = ctx.measureText(timeLine).width;
  ctx.shadowBlur = 0;
  drawTimerIcon(ctx, W - 30 - timeW - 20, timeY, 30);

  return canvas.toBuffer('image/png');
}

// ──────────────────────────────────────────────────────────────────
//  صورة الفائز  (بدون تغيير - باقية على الثيم الأصلي)
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

  // "الفائز!" (+ أيقونة كأس بدل 🏆)
  ctx.fillStyle = '#FFD700';
  ctx.font = `bold 28px Cairo`;
  const winLabel = 'الفائز!';
  const winLabelY = H / 2 - 40;
  ctx.fillText(winLabel, W - 40, winLabelY);
  const winLabelW = ctx.measureText(winLabel).width;
  ctx.shadowBlur = 0;
  drawTrophyIcon(ctx, W - 40 - winLabelW - 22, winLabelY, 30);
  ctx.shadowBlur = 12;

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 40px Cairo`;
  ctx.fillText(winner.displayName || winner.username || '؟', W - 40, H / 2 + 15);

  // "نجا من كل الانفجارات" (+ أيقونة انفجار بدل 💥)
  ctx.fillStyle = '#ffcc00';
  ctx.font = `bold 22px Cairo`;
  const survLabel = 'نجا من كل الانفجارات';
  const survY = H / 2 + 65;
  ctx.fillText(survLabel, W - 40, survY);
  const survW = ctx.measureText(survLabel).width;
  ctx.shadowBlur = 0;
  drawBoomIcon(ctx, W - 40 - survW - 22, survY, 30);

  return canvas.toBuffer('image/png');
}

// ──────────────────────────────────────────────────────────────────
//  صورة اللوبي  (بدون تغيير - باقية على الثيم الأصلي)
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

  // "تمرير القنبلة" + أيقونة قنبلة بدل 💣 (مُحاذاة في المنتصف معاً)
  ctx.font = `bold 62px Cairo`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lobbyLabel = 'تمرير القنبلة';
  const lobbyW = ctx.measureText(lobbyLabel).width;
  const iconSize = 60, gap = 18;
  const totalW = iconSize + gap + lobbyW;
  const startX = W / 2 - totalW / 2;

  ctx.shadowColor = 'rgba(255,50,0,0.6)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(lobbyLabel, startX + iconSize + gap, H / 2);
  ctx.shadowBlur = 0;
  drawBombIcon(ctx, startX + iconSize / 2, H / 2, iconSize);

  return canvas.toBuffer('image/png');
}

module.exports = { generateWordImage, generateBombWinnerImage, generateBombLobbyImage };
