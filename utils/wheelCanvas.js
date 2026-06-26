const { createCanvas, loadImage } = require('@napi-rs/canvas');
const https = require('https');
const http = require('http');

const PLAYER_COLORS = [
  ['#0a1628', '#1a3a6e'],
  ['#0d1f3c', '#1e4d8c'],
  ['#071220', '#0f2d5a'],
  ['#0c1832', '#183070'],
  ['#081525', '#122a60'],
  ['#0b1a30', '#163468'],
  ['#091522', '#102855'],
  ['#0e2040', '#1c3a7a'],
  ['#060f1a', '#0d2248'],
  ['#0a1830', '#152e65'],
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

async function generateWheelImage(players, winnerIndex, spinning = false, rotationAngle = 0) {
  const SIZE = 600;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 270;
  const innerR = 80;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 10, cx, cy, outerR + 20);
  glowGrad.addColorStop(0, 'rgba(30, 80, 180, 0.4)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 20, 0, Math.PI * 2);
  ctx.fill();

  const n = players.length;
  const sliceAngle = (Math.PI * 2) / n;
  const baseAngle = rotationAngle - Math.PI / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(baseAngle);
  ctx.translate(-cx, -cy);

  for (let i = 0; i < n; i++) {
    const startAngle = i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const midAngle = startAngle + sliceAngle / 2;
    const colors = PLAYER_COLORS[i % PLAYER_COLORS.length];

    const gx = cx + Math.cos(midAngle) * outerR * 0.6;
    const gy = cy + Math.sin(midAngle) * outerR * 0.6;
    const grad = ctx.createRadialGradient(gx, gy, 0, cx, cy, outerR);
    grad.addColorStop(0, colors[1]);
    grad.addColorStop(1, colors[0]);

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
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(midAngle);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
    ctx.font = 'bold 18px Arial';
    ctx.shadowColor = 'rgba(0, 0, 80, 0.8)';
    ctx.shadowBlur = 4;

    const displayName = players[i].displayName || players[i].username;
    const shortName = displayName.length > 10 ? displayName.substring(0, 10) + '..' : displayName;
    ctx.fillText(shortName, outerR - 15, 6);
    ctx.restore();
  }

  ctx.restore();

  const ringGrad = ctx.createLinearGradient(cx - outerR, cy, cx + outerR, cy);
  ringGrad.addColorStop(0, '#1a1a2e');
  ringGrad.addColorStop(0.3, '#4a5a8a');
  ringGrad.addColorStop(0.5, '#8090c0');
  ringGrad.addColorStop(0.7, '#4a5a8a');
  ringGrad.addColorStop(1, '#1a1a2e');

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 8, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 12;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 14, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100, 130, 200, 0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const arrowX = cx + outerR + 5;
  ctx.beginPath();
  ctx.moveTo(arrowX + 20, cy);
  ctx.lineTo(arrowX - 5, cy - 15);
  ctx.lineTo(arrowX - 5, cy + 15);
  ctx.closePath();
  const arrowGrad = ctx.createLinearGradient(arrowX - 5, cy, arrowX + 20, cy);
  arrowGrad.addColorStop(0, '#3060c0');
  arrowGrad.addColorStop(1, '#80a0ff');
  ctx.fillStyle = arrowGrad;
  ctx.fill();
  ctx.strokeStyle = '#a0c0ff';
  ctx.lineWidth = 1;
  ctx.stroke();

  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  centerGrad.addColorStop(0, '#1a2a5a');
  centerGrad.addColorStop(0.6, '#0a1535');
  centerGrad.addColorStop(1, '#050e25');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();
  ctx.strokeStyle = '#2a4a9a';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (winnerIndex !== null && winnerIndex >= 0 && players[winnerIndex]) {
    const winner = players[winnerIndex];
    const avatarUrl = winner.avatarURL
      ? winner.avatarURL({ size: 128, format: 'png' })
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(winner.discriminator || '0') % 5}.png`;

    try {
      const imgBuf = await fetchImageBuffer(avatarUrl);
      const img = await loadImage(imgBuf);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 8, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - (innerR - 8), cy - (innerR - 8), (innerR - 8) * 2, (innerR - 8) * 2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, innerR - 4, 0, Math.PI * 2);
      const goldGrad = ctx.createLinearGradient(cx - innerR, cy, cx + innerR, cy);
      goldGrad.addColorStop(0, '#c0a020');
      goldGrad.addColorStop(0.5, '#f0d060');
      goldGrad.addColorStop(1, '#c0a020');
      ctx.strokeStyle = goldGrad;
      ctx.lineWidth = 4;
      ctx.stroke();
    } catch (e) {
      ctx.fillStyle = '#a0c0ff';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = winner.displayName || winner.username || '?';
      ctx.fillText(name[0].toUpperCase(), cx, cy);
    }
  } else {
    ctx.fillStyle = '#4070d0';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎰', cx, cy);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateWheelImage };
