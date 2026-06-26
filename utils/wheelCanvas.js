const { createCanvas, loadImage } = require('@napi-rs/canvas');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BANNER_PATHS = [
  path.join(__dirname, '../assets/roulette_banner.png'),
  path.join(__dirname, 'assets/roulette_banner.png'),
  path.join(__dirname, 'roulette_banner.png'),
  path.join(process.cwd(), 'assets/roulette_banner.png'),
  path.join(process.cwd(), 'roulette_banner.png'),
];

let BANNER_IMAGE = null;
(async () => {
  for (const p of BANNER_PATHS) {
    if (fs.existsSync(p)) {
      try {
        BANNER_IMAGE = await loadImage(p);
        console.log('✅ البانر محمّل من:', p);
        break;
      } catch (e) {}
    }
  }
  if (!BANNER_IMAGE) console.warn('⚠️ لا يوجد بانر، سيتم استخدام خلفية افتراضية.');
})();

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

async function generateBannerImage() {
  const W = 700, H = 350;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  if (BANNER_IMAGE) {
    ctx.drawImage(BANNER_IMAGE, 0, 0, W, H);
  } else {
    let loaded = false;
    for (const p of BANNER_PATHS) {
      if (fs.existsSync(p)) {
        try {
          const img = await loadImage(p);
          ctx.drawImage(img, 0, 0, W, H);
          BANNER_IMAGE = img;
          loaded = true;
          break;
        } catch (e) {}
      }
    }
    if (!loaded) {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#020d1f');
      bg.addColorStop(0.5, '#0a1a3a');
      bg.addColorStop(1, '#050f28');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return canvas.toBuffer('image/png');
}

function drawSparkle(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(220,235,255,0.85)');
  g.addColorStop(1, 'rgba(220,235,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.5;
  for (let a = 0; a < 4; a++) {
    const ang = a * (Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * size * 1.8, Math.sin(ang) * size * 1.8);
    ctx.lineTo(Math.cos(ang + Math.PI) * size * 1.8, Math.sin(ang + Math.PI) * size * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPointerNeedle(ctx, cx, cy, length, angleRad) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  const baseWidth = 16;
  const grad = ctx.createLinearGradient(0, -baseWidth, 0, baseWidth);
  grad.addColorStop(0, '#1a2a5a');
  grad.addColorStop(0.25, '#a0c0f0');
  grad.addColorStop(0.5, '#f0f6ff');
  grad.addColorStop(0.75, '#a0c0f0');
  grad.addColorStop(1, '#1a2a5a');
  ctx.beginPath();
  ctx.moveTo(0, -baseWidth * 0.55);
  ctx.lineTo(length * 0.8, -baseWidth * 0.16);
  ctx.lineTo(length, 0);
  ctx.lineTo(length * 0.8, baseWidth * 0.16);
  ctx.lineTo(0, baseWidth * 0.55);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,240,255,0.95)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawSparkle(ctx, length, 0, 11);
  ctx.restore();
}

async function generateWheelImage(players, winnerIndex, rotationAngle = 0) {
  const SIZE = 700;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 310;
  const innerR = 90;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const glowGrad = ctx.createRadialGradient(cx, cy, outerR - 20, cx, cy, outerR + 40);
  glowGrad.addColorStop(0, 'rgba(20, 60, 160, 0.35)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 40, 0, Math.PI * 2);
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
      ctx.strokeStyle = 'rgba(160, 190, 240, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      const textRadius = outerR * 0.65;
      ctx.translate(textRadius, 0);
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
      ctx.rotate(-midAngle);
      ctx.fillText(shortName, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  const ring1 = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
  ring1.addColorStop(0, '#0a1535');
  ring1.addColorStop(0.2, '#3a5aa0');
  ring1.addColorStop(0.4, '#c8d8f8');
  ring1.addColorStop(0.5, '#ffffff');
  ring1.addColorStop(0.6, '#c8d8f8');
  ring1.addColorStop(0.8, '#3a5aa0');
  ring1.addColorStop(1, '#0a1535');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 8, 0, Math.PI * 2);
  ctx.strokeStyle = ring1;
  ctx.lineWidth = 16;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const ring2 = ctx.createLinearGradient(cx - outerR - 16, cy - outerR - 16, cx + outerR + 16, cy + outerR + 16);
  ring2.addColorStop(0, '#1a2a5a');
  ring2.addColorStop(0.3, '#90a8e0');
  ring2.addColorStop(0.5, '#e8f0ff');
  ring2.addColorStop(0.7, '#90a8e0');
  ring2.addColorStop(1, '#1a2a5a');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 18, 0, Math.PI * 2);
  ctx.strokeStyle = ring2;
  ctx.lineWidth = 4;
  ctx.stroke();

  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  centerGrad.addColorStop(0, '#1a2a5a');
  centerGrad.addColorStop(0.6, '#0a1535');
  centerGrad.addColorStop(1, '#050e25');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();

  const centerRing = ctx.createLinearGradient(cx - innerR, cy, cx + innerR, cy);
  centerRing.addColorStop(0, '#1a3060');
  centerRing.addColorStop(0.5, '#c8d8f8');
  centerRing.addColorStop(1, '#1a3060');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = centerRing;
  ctx.lineWidth = 4;
  ctx.stroke();

  if (winnerIndex !== null && winnerIndex >= 0 && players[winnerIndex]) {
    const winner = players[winnerIndex];
    const avatarFn = winner.avatarURL;
    const avatarUrl =
      typeof avatarFn === 'function'
        ? avatarFn({ size: 128, format: 'png' })
        : (typeof avatarFn === 'string' && avatarFn)
          ? avatarFn
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
      ctx.fillStyle = '#7090d0';
      ctx.font = `bold 44px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = winner.displayName || winner.username || '?';
      ctx.fillText(name[0].toUpperCase(), cx, cy);
    }
  }

  drawPointerNeedle(ctx, cx, cy, outerR - 4, 0);

  const hubGrad = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, 18);
  hubGrad.addColorStop(0, '#ffffff');
  hubGrad.addColorStop(0.5, '#a0c0f0');
  hubGrad.addColorStop(1, '#1a2a5a');
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = '#e8f0ff';
  ctx.lineWidth = 2;
  ctx.stroke();

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

function generateSmoothAngles(winnerIndex, playerCount, steps = 28) {
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

function getFrameDelays(steps = 28) {
  const delays = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    if (t < 0.15)      delays.push(80);
    else if (t < 0.50) delays.push(100);
    else if (t < 0.70) delays.push(130);
    else if (t < 0.82) delays.push(180);
    else if (t < 0.90) delays.push(280);
    else if (t < 0.95) delays.push(420);
    else               delays.push(600);
  }
  return delays;
}

module.exports = { generateWheelImage, generateBannerImage, generateSmoothAngles, getFrameDelays };
