const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');

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

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height; sw = sh * boxRatio;
    sx = (img.width - sw) / 2; sy = 0;
  } else {
    sw = img.width; sh = sw / boxRatio;
    sx = 0; sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const ROLE_COLORS = {
  'مافيا':  { bg1: '#0a0a1a', bg2: '#1a0a2e', accent: '#6a0a0a', border: '#c0102a' },
  'محقق':   { bg1: '#0a1020', bg2: '#0a1a3a', accent: '#0a3a6a', border: '#1060c0' },
  'طبيب':   { bg1: '#0a1a0a', bg2: '#0a2a1a', accent: '#0a4a1a', border: '#10a040' },
  'مواطن':  { bg1: '#0a0f1a', bg2: '#121828', accent: '#1a2a4a', border: '#304070' },
};

const ROLE_EMOJI = {
  'مافيا': '🔴',
  'محقق':  '🔵',
  'طبيب':  '💚',
  'مواطن': '⚪',
};

// ──────────────────────────────────────────────────────────────
//  بطاقة الدور — مستطيلة عمودية (portrait) 400×600
//  تشبه بطاقات الألعاب الكلاسيكية
// ──────────────────────────────────────────────────────────────
async function generateRoleCard(role, playerName, avatarUrl) {
  const W = 400, H = 600;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const c = ROLE_COLORS[role] || ROLE_COLORS['مواطن'];

  // الخلفية
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, c.bg1);
  bg.addColorStop(1, c.bg2);
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fill();

  // إطار خارجي
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 4;
  roundRect(ctx, 4, 4, W - 8, H - 8, 21);
  ctx.stroke();

  // إطار داخلي
  ctx.strokeStyle = `${c.border}66`;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 14, 14, W - 28, H - 28, 14);
  ctx.stroke();

  // وهج أعلى
  const shine = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.8);
  shine.addColorStop(0, `${c.border}33`);
  shine.addColorStop(1, 'transparent');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, W, H);

  // ── أيقونة الدور أعلى المنتصف ──
  ctx.font = '38px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ROLE_EMOJI[role] || '⚪', W / 2, 55);

  // ── الأفاتار (دائرة وسط الكرت) ──
  const avatarSize = 130;
  const avatarX = W / 2;
  const avatarY = 220;
  try {
    const buf = await fetchImageBuffer(avatarUrl);
    const img = await loadImage(buf);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 4;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((playerName || '?')[0].toUpperCase(), avatarX, avatarY);
  }

  // ── خط فاصل تحت الأفاتار ──
  ctx.strokeStyle = `${c.border}88`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 300);
  ctx.lineTo(W - 40, 300);
  ctx.stroke();

  // ── اسم اللاعب ──
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#c0d0ff';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerName || 'لاعب', W / 2, 340);
  ctx.shadowBlur = 0;

  // ── اسم الدور (كبير) ──
  const roleGrad = ctx.createLinearGradient(0, 370, W, 430);
  roleGrad.addColorStop(0, c.border);
  roleGrad.addColorStop(1, '#ffffff');
  ctx.fillStyle = roleGrad;
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 12;
  ctx.fillText(role, W / 2, 410);
  ctx.shadowBlur = 0;

  // ── شعار أسفل ──
  ctx.fillStyle = `${c.border}88`;
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('M A F I A', W / 2, H - 22);

  // زخرفة أركان
  drawCornerDeco(ctx, 28, 28, c.border, false, false);
  drawCornerDeco(ctx, W - 28, 28, c.border, true, false);
  drawCornerDeco(ctx, 28, H - 28, c.border, false, true);
  drawCornerDeco(ctx, W - 28, H - 28, c.border, true, true);

  return canvas.toBuffer('image/png');
}

function drawCornerDeco(ctx, x, y, color, flipX, flipY) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, 12); ctx.lineTo(0, 0); ctx.lineTo(12, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────
//  بطاقة دور ببانر مخصص (portrait 400×600)
// ──────────────────────────────────────────────────────────────
async function generateRoleCardCustom(bannerUrl, role, playerName, avatarUrl) {
  const W = 400, H = 600;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const c = ROLE_COLORS[role] || ROLE_COLORS['مواطن'];

  // الخلفية المخصصة
  try {
    const bannerBuf = await fetchImageBuffer(bannerUrl);
    const bannerImg = await loadImage(bannerBuf);
    roundRect(ctx, 0, 0, W, H, 24);
    ctx.save();
    ctx.clip();
    drawImageCover(ctx, bannerImg, 0, 0, W, H);
    ctx.restore();
  } catch (e) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c.bg1); bg.addColorStop(1, c.bg2);
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H, 24);
    ctx.fill();
  }

  // تعتيم فوق البانر
  const overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, 'rgba(0,0,0,0.35)');
  overlay.addColorStop(0.45, 'rgba(0,0,0,0.15)');
  overlay.addColorStop(0.7, 'rgba(0,0,0,0.55)');
  overlay.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = overlay;
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fill();

  // إطار
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 4;
  roundRect(ctx, 4, 4, W - 8, H - 8, 21);
  ctx.stroke();

  ctx.strokeStyle = `${c.border}66`;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 14, 14, W - 28, H - 28, 14);
  ctx.stroke();

  // أيقونة أعلى
  ctx.font = '38px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ROLE_EMOJI[role] || '⚪', W / 2, 55);

  // الأفاتار
  const avatarSize = 130;
  const avatarX = W / 2;
  const avatarY = 220;
  try {
    const buf = await fetchImageBuffer(avatarUrl);
    const img = await loadImage(buf);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((playerName || '?')[0].toUpperCase(), avatarX, avatarY);
  }

  // خط فاصل
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 300); ctx.lineTo(W - 40, 300);
  ctx.stroke();

  // نصوص مع ظل
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 10;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerName || 'لاعب', W / 2, 340);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial';
  ctx.fillText(role, W / 2, 410);

  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('M A F I A', W / 2, H - 22);

  drawCornerDeco(ctx, 28, 28, '#ffffff', false, false);
  drawCornerDeco(ctx, W - 28, 28, '#ffffff', true, false);
  drawCornerDeco(ctx, 28, H - 28, '#ffffff', false, true);
  drawCornerDeco(ctx, W - 28, H - 28, '#ffffff', true, true);

  return canvas.toBuffer('image/png');
}

// ──────────────────────────────────────────────────────────────
//  صورة النتيجة — landscape 1200×675
//  الفريق الفائز فوق، الخاسر تحت، صور اللاعبين كبيرة
// ──────────────────────────────────────────────────────────────
async function generateResultImage(winners, losers, winnerTeam, bannerUrl = null) {
  const W = 1200, H = 675;
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
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#050a14');
    bg.addColorStop(1, '#0a1428');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = 'rgba(3,6,14,0.5)';
    ctx.fillRect(0, 0, W, H);
  }

  // ── إطار خارجي ──
  ctx.strokeStyle = '#2a4a8a';
  ctx.lineWidth = 3;
  roundRect(ctx, 6, 6, W - 12, H - 12, 20);
  ctx.stroke();

  const isWinMafia = winnerTeam === 'مافيا';
  const winColor  = isWinMafia ? '#c0102a' : '#1060c0';
  const loseColor = isWinMafia ? '#1060c0' : '#c0102a';
  const loseTeam  = isWinMafia ? 'المواطنين' : 'المافيا';

  // ── قسم الفائزين (النصف العلوي) ──
  const winGrad = ctx.createLinearGradient(0, 0, W, 0);
  winGrad.addColorStop(0, `${winColor}00`);
  winGrad.addColorStop(0.5, `${winColor}44`);
  winGrad.addColorStop(1, `${winColor}00`);
  ctx.fillStyle = winGrad;
  ctx.fillRect(0, 0, W, H / 2 - 10);

  // عنوان الفائزين
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🏆 فاز فريق ${winnerTeam}`, W / 2, 52);
  ctx.shadowBlur = 0;

  // صور الفائزين
  const winAvatarSize = 120;
  const winY = 185;
  await drawPlayerRow(ctx, winners, W, winY, winAvatarSize, winColor);

  // ── خط فاصل ──
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, H / 2); ctx.lineTo(W - 60, H / 2);
  ctx.stroke();

  // ── قسم الخاسرين (النصف السفلي) ──
  const loseGrad = ctx.createLinearGradient(0, H / 2, W, H);
  loseGrad.addColorStop(0, `${loseColor}00`);
  loseGrad.addColorStop(0.5, `${loseColor}33`);
  loseGrad.addColorStop(1, `${loseColor}00`);
  ctx.fillStyle = loseGrad;
  ctx.fillRect(0, H / 2, W, H / 2);

  // عنوان الخاسرين
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffffcc';
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`خسر فريق ${loseTeam}`, W / 2, H / 2 + 45);
  ctx.shadowBlur = 0;

  // صور الخاسرين
  const loseAvatarSize = 100;
  const loseY = H / 2 + 160;
  await drawPlayerRow(ctx, losers, W, loseY, loseAvatarSize, loseColor);

  // شعار أسفل
  ctx.fillStyle = '#ffffff55';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('M A F I A', W / 2, H - 12);

  return canvas.toBuffer('image/png');
}

// ── رسم صف أفاتارات اللاعبين في المنتصف ──
async function drawPlayerRow(ctx, players, W, centerY, size, borderColor) {
  const list = players.slice(0, 8);
  const gap  = size + 28;
  const totalWidth = list.length * gap - 28;
  let startX = (W - totalWidth) / 2 + size / 2;

  for (const p of list) {
    const avatarUrl = p.avatarURL
      ? p.avatarURL({ size: 256, format: 'png' })
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    // دائرة الخلفية
    ctx.beginPath();
    ctx.arc(startX, centerY, size / 2 + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    try {
      const buf = await fetchImageBuffer(avatarUrl);
      const img = await loadImage(buf);
      ctx.save();
      ctx.beginPath();
      ctx.arc(startX, centerY, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, startX - size / 2, centerY - size / 2, size, size);
      ctx.restore();
    } catch (e) {
      ctx.beginPath();
      ctx.arc(startX, centerY, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#1a2a4a';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${size * 0.38}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = p.displayName || p.username || '?';
      ctx.fillText(name[0].toUpperCase(), startX, centerY);
    }

    // حلقة ملونة
    ctx.beginPath();
    ctx.arc(startX, centerY, size / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // اسم اللاعب تحت الصورة
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.min(16, size * 0.16)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayName = (p.displayName || p.username || '').substring(0, 12);
    ctx.fillText(displayName, startX, centerY + size / 2 + 8);
    ctx.shadowBlur = 0;

    startX += gap;
  }
}

module.exports = { generateRoleCard, generateRoleCardCustom, generateResultImage };
