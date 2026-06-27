const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../data/rouletteSettings.json');

function loadAll() {
  try {
    if (!fs.existsSync(FILE_PATH)) return {};
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveAll(data) {
  try {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('فشل حفظ إعدادات الروليت:', e);
  }
}

const PRESET_THEMES = {
  default: [
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
  ],
  gold: [
    { outer: '#6e5a0d', inner: '#282006', text: '#ffe9a0' },
    { outer: '#8a6f10', inner: '#332608', text: '#ffeeb0' },
    { outer: '#5a4708', inner: '#221a04', text: '#ffe080' },
    { outer: '#7a6010', inner: '#2c2306', text: '#ffec9a' },
    { outer: '#4f3e08', inner: '#1d1604', text: '#ffe28c' },
  ],
  red: [
    { outer: '#6e0d0d', inner: '#280606', text: '#ffaaaa' },
    { outer: '#8a1010', inner: '#330808', text: '#ffb8b8' },
    { outer: '#5a0808', inner: '#220404', text: '#ff9c9c' },
    { outer: '#7a1414', inner: '#2c0808', text: '#ffc2c2' },
  ],
  emerald: [
    { outer: '#0d6e3a', inner: '#061e14', text: '#90ffb0' },
    { outer: '#0d6e6e', inner: '#062828', text: '#90ffff' },
    { outer: '#10a05a', inner: '#083620', text: '#a0ffc0' },
    { outer: '#0a4a28', inner: '#041e10', text: '#80e0a0' },
  ],
  purple: [
    { outer: '#4a0d6e', inner: '#1c0628', text: '#d090ff' },
    { outer: '#6e0d8a', inner: '#280633', text: '#e0a0ff' },
    { outer: '#3a0a5a', inner: '#160422', text: '#c080ff' },
  ],
  // ✅ ثيم كحلي غامق جديد
  navy: [
    { outer: '#050c18', inner: '#020608', text: '#4a8aff' },
    { outer: '#070f22', inner: '#030610', text: '#5a9aff' },
    { outer: '#040a14', inner: '#02050c', text: '#3a7aff' },
    { outer: '#060e1c', inner: '#030710', text: '#4a8aff' },
    { outer: '#050b16', inner: '#02060a', text: '#3a80ff' },
    { outer: '#07102a', inner: '#040814', text: '#5a90ff' },
  ],
};

const WHEEL_STYLES = {
  classic:  { innerRadiusFactor: 0.28, outerGlow: true,  borderStyle: 'solid', segmentStyle: 'gradient' },
  neon:     { innerRadiusFactor: 0.22, outerGlow: true,  borderStyle: 'neon',  segmentStyle: 'neon'     },
  minimal:  { innerRadiusFactor: 0.20, outerGlow: false, borderStyle: 'thin',  segmentStyle: 'flat'     },
  royal:    { innerRadiusFactor: 0.32, outerGlow: true,  borderStyle: 'gold',  segmentStyle: 'gradient' },
  // ✅ شكل نيون كحلي جديد
  neon_navy: { innerRadiusFactor: 0.22, outerGlow: true, borderStyle: 'neon_navy', segmentStyle: 'neon_navy' },
};

function getGuildSettings(guildId) {
  const all = loadAll();
  const s = all[guildId] || {};
  return {
    bannerUrl:    s.bannerUrl    || null,
    theme:        s.theme        || 'default',
    customColors: s.customColors || null,
    spinDuration: s.spinDuration !== undefined ? s.spinDuration : 8,
    showNames:    s.showNames    !== undefined ? s.showNames    : true,
    wheelStyle:   s.wheelStyle   || 'classic',
  };
}

function saveGuildSettings(guildId, partial) {
  const all = loadAll();
  all[guildId] = { ...(all[guildId] || {}), ...partial };
  saveAll(all);
  return all[guildId];
}

function getThemeColors(settings) {
  if (settings?.customColors?.length) return settings.customColors;
  return PRESET_THEMES[settings?.theme] || PRESET_THEMES.default;
}

function getWheelStyleConfig(settings) {
  return WHEEL_STYLES[settings?.wheelStyle] || WHEEL_STYLES.classic;
}

module.exports = {
  getGuildSettings,
  saveGuildSettings,
  getThemeColors,
  getWheelStyleConfig,
  PRESET_THEMES,
  WHEEL_STYLES,
};
