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

// يرسم صورة "cover fit" تغطي المستطيل كامل بدون تشويه النسبة
function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

const ROLE_COLORS = {
  'مافيا':    { bg1: '#0a0a1a', bg2: '#1a0a2e', accent: '#6a0a0a', border: '#c0102a' },
  'محقق':    { bg1: '#0a1020', bg2: '#0a1a3a', accent: '#0a3a6a', border: '#1060c0' },
  'طبيب':    { bg1: '#0a1a0a', bg2: '#0a2a1a', accent: '#0a4a1a', border: '#10a040' },
  'مواطن':   { bg1: '#0a0f1a', bg2: '#121828', accent: '#1a2a4a', border: '#304070' },
};

const ROLE_EMOJI = {
  'مافيا': '🔴',
  'محقق':  '🔵',
  'طبيب':  '💚',
  'مواطن': '⚪',
};

async function generateRoleCard(role, playerName, avatarUrl) {
  const W = 500, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const c = ROLE_COLORS[role] || ROLE_COLORS['مواطن'];

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, c.bg1);
  bg.addColorStop(1, c.bg2);
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fill();

  ctx.strokeStyle = c.border;
  ctx.lineWidth = 3;
  roundRect(ctx, 4, 4, W - 8, H - 8, 17);
  ctx.stroke();

  ctx.strokeStyle = `${c.border}55`;
  ctx.lineWidth = 1;
  roundRect(ctx, 12, 12, W - 24, H - 24, 12);
  ctx.stroke();

  const shine = ctx.createRadialGradient(80, 60, 0, 80, 60, 120);
  shine.addColorStop(0, `${c.border}22`);
  shine.addColorStop(1, 'transparent');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, W, H);

  const avatarSize = 100;
  const avatarX = 60;
  const avatarY = H / 2;
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
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((playerName || '?')[0].toUpperCase(), avatarX, avatarY);
  }

  ctx.fillStyle = '#c0d0ff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerName || 'لاعب', W - 40, H / 2 - 40);

  const roleGrad = ctx.createLinearGradient(W - 200, 0, W - 40, 0);
  roleGrad.addColorStop(0, c.border);
  roleGrad.addColorStop(1, '#ffffff');
  ctx.fillStyle = roleGrad;
  ctx.font = 'bold 52px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(role, W - 40, H / 2 + 15);

  ctx.font = '32px Arial';
  ctx.fillText(ROLE_EMOJI[role] || '⚪', W - 40, H / 2 + 60);

  ctx.fillStyle = `${c.border}66`;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('M A F I A', W / 2, H - 18);

  return canvas.toBuffer('image/png');
}

// ─── كرت دور ببانر مخصص يرفعه الأدمن (مافيا / طبيب / محقق) ───
// نفس مقاس الكرت الافتراضي (500×300) عشان يطلع بنفس الشكل بالـ DM
async function generateRoleCardCustom(bannerUrl, role, playerName, avatarUrl) {
  const W = 500, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const c = ROLE_COLORS[role] || ROLE_COLORS['مواطن'];

  // الخلفية المخصصة (cover fit)
  try {
    const bannerBuf = await fetchImageBuffer(bannerUrl);
    const bannerImg = await loadImage(bannerBuf);
    drawImageCover(ctx, bannerImg, 0, 0, W, H);
  } catch (e) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c.bg1);
    bg.addColorStop(1, c.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // تعتيم يمين الصورة عشان النص يبان بوضوح فوق أي خلفية
  const overlay = ctx.createLinearGradient(0, 0, W, 0);
  overlay.addColorStop(0, 'rgba(0,0,0,0.05)');
  overlay.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  overlay.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // الأفاتار
  const avatarSize = 100;
  const avatarX = 60;
  const avatarY = H / 2;
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
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((playerName || '?')[0].toUpperCase(), avatarX, avatarY);
  }

  // النصوص (مع ظل عشان توضح فوق أي خلفية)
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 10;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerName || 'لاعب', W - 40, H / 2 - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px Arial';
  ctx.fillText(role, W - 40, H / 2 + 15);

  ctx.font = '32px Arial';
  ctx.fillText(ROLE_EMOJI[role] || '⚪', W - 40, H / 2 + 60);

  ctx.shadowBlur = 0;

  // إطار خارجي
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 3;
  roundRect(ctx, 4, 4, W - 8, H - 8, 17);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

// ─── صورة نتيجة اللعبة (فريق فائز / فريق خاسر) ───
// المقاس 700×496 — نفس مقاس صورة الفائز بالروليت تماماً
// bannerUrl: بانر مخصص يصير خلفية الصورة كاملة (نفس فكرة بنر الفائز بالروليت)
async function generateResultImage(winners, losers, winnerTeam, bannerUrl = null) {
  const W = 700, H = 496;
  const AVATAR_SIZE = 90;
  const LOSER_AVATAR_SIZE = 80;
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
    } catch (e) {
      console.error('خطأ في تحميل بانر الفائز:', e.message);
    }
  }
  if (!hasCustomBg) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#050a14');
    bg.addColorStop(1, '#0a1428');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  } else {
    // تعتيم خفيف فوق البانر المخصص عشان النصوص والأفاتارات تبان بوضوح
    ctx.fillStyle = 'rgba(3,6,14,0.45)';
    ctx.fillRect(0, 0, W, H);
  }

  ctx.strokeStyle = '#1a3a6a';
  ctx.lineWidth = 2;
  roundRect(ctx, 3, 3, W - 6, H - 6, 14);
  ctx.stroke();

  const isWinMafia = winnerTeam === 'مافيا';
  const winColor = isWinMafia ? '#c0102a' : '#1060c0';

  // ── صندوق الفريق الفائز ──
  ctx.fillStyle = winColor + '33';
  roundRect(ctx, 20, 25, W - 40, 175, 12);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;
  ctx.fillText(`فاز فريق ${winnerTeam}`, W - 45, 65);
  ctx.shadowBlur = 0;

  let x = W - 45;
  for (const p of winners.slice(0, 6)) {
    x -= AVATAR_SIZE + 12;
    await drawAvatar(ctx, p, x, 145, AVATAR_SIZE, winColor);
  }

  // ── خط فاصل ──
  ctx.strokeStyle = '#1a3a6a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 225);
  ctx.lineTo(W - 20, 225);
  ctx.stroke();

  // ── الفريق الخاسر ──
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;
  ctx.fillText(`خسر فريق ${winnerTeam === 'مافيا' ? 'المواطنين' : 'المافيا'}`, W - 45, 260);
  ctx.shadowBlur = 0;

  x = W - 45;
  for (const p of losers.slice(0, 6)) {
    x -= LOSER_AVATAR_SIZE + 12;
    await drawAvatar(ctx, p, x, 360, LOSER_AVATAR_SIZE, '#304070');
  }

  ctx.fillStyle = '#ffffffaa';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 4;
  ctx.fillText('M A F I A', W / 2, H - 14);
  ctx.shadowBlur = 0;

  return canvas.toBuffer('image/png');
}

async function drawAvatar(ctx, player, x, y, size, borderColor) {
  const avatarUrl = player.avatarURL
    ? player.avatarURL({ size: 128, format: 'png' })
    : `https://cdn.discordapp.com/embed/avatars/0.png`;
  try {
    const buf = await fetchImageBuffer(avatarUrl);
    const img = await loadImage(buf);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y - size / 2, size, size);
    ctx.restore();
  } catch (e) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2a4a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = player.displayName || player.username || '?';
    ctx.fillText(name[0].toUpperCase(), x + size / 2, y);
  }
  ctx.beginPath();
  ctx.arc(x + size / 2, y, size / 2 + 2, 0, Math.PI * 2);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();
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

module.exports = { generateRoleCard, generateRoleCardCustom, generateResultImage };
