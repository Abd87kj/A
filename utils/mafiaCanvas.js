const { createCanvas, loadImage } = require('@napi-rs/canvas');
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

async function generateResultImage(winners, losers, winnerTeam) {
  const W = 700;
  const AVATAR_SIZE = 80;
  const PADDING = 30;
  const H = 320;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#050a14');
  bg.addColorStop(1, '#0a1428');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 16);
  ctx.fill();

  ctx.strokeStyle = '#1a3a6a';
  ctx.lineWidth = 2;
  roundRect(ctx, 3, 3, W - 6, H - 6, 14);
  ctx.stroke();

  const isWinMafia = winnerTeam === 'مافيا';
  const winColor = isWinMafia ? '#c0102a' : '#1060c0';

  ctx.fillStyle = winColor + '22';
  roundRect(ctx, 20, 20, W - 40, 120, 10);
  ctx.fill();

  ctx.fillStyle = winColor;
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`فاز فريق ${winnerTeam}`, W - 40, 50);

  let x = W - 40;
  for (const p of winners.slice(0, 6)) {
    x -= AVATAR_SIZE + 10;
    await drawAvatar(ctx, p, x, 75, AVATAR_SIZE, winColor);
  }

  ctx.strokeStyle = '#1a3a6a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 155);
  ctx.lineTo(W - 20, 155);
  ctx.stroke();

  ctx.fillStyle = '#ffffff33';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`خسر فريق ${winnerTeam === 'مافيا' ? 'المواطنين' : 'المافيا'}`, W - 40, 185);

  x = W - 40;
  for (const p of losers.slice(0, 6)) {
    x -= AVATAR_SIZE + 10;
    await drawAvatar(ctx, p, x, 230, AVATAR_SIZE, '#304070');
  }

  ctx.fillStyle = '#1a3a6a66';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('M A F I A', W / 2, H - 10);

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

module.exports = { generateRoleCard, generateResultImage };
