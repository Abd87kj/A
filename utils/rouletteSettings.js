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

// ─── ثيمات بألوان واضحة ومختلفة ───
const PRESET_THEMES = {
  // الافتراضي: رمادي/أبيض (مثل الصورة)
  default: [
    { outer: '#f0f0f0', border: '#000000', text: '#000000' },
    { outer: '#d0d0d0', border: '#000000', text: '#000000' },
    { outer: '#e8e8e8', border: '#000000', text: '#000000' },
    { outer: '#c0c0c0', border: '#000000', text: '#000000' },
    { outer: '#ebebeb', border: '#000000', text: '#000000' },
    { outer: '#b8b8b8', border: '#000000', text: '#000000' },
  ],
  // ذهبي
  gold: [
    { outer: '#FFD700', border: '#b8860b', text: '#000000' },
    { outer: '#FFC200', border: '#b8860b', text: '#000000' },
    { outer: '#FFE44D', border: '#b8860b', text: '#000000' },
    { outer: '#DAA520', border: '#b8860b', text: '#000000' },
    { outer: '#F5C518', border: '#b8860b', text: '#000000' },
    { outer: '#C8960C', border: '#b8860b', text: '#000000' },
  ],
  // أحمر
  red: [
    { outer: '#ff2d3d', border: '#8b0000', text: '#ffffff' },
    { outer: '#cc0010', border: '#8b0000', text: '#ffffff' },
    { outer: '#ff5566', border: '#8b0000', text: '#ffffff' },
    { outer: '#990010', border: '#8b0000', text: '#ffffff' },
    { outer: '#ff3344', border: '#8b0000', text: '#ffffff' },
    { outer: '#bb0010', border: '#8b0000', text: '#ffffff' },
  ],
  // زمردي
  emerald: [
    { outer: '#00c853', border: '#005a1f', text: '#ffffff' },
    { outer: '#00a040', border: '#005a1f', text: '#ffffff' },
    { outer: '#00e066', border: '#005a1f', text: '#ffffff' },
    { outer: '#008030', border: '#005a1f', text: '#ffffff' },
    { outer: '#00b84a', border: '#005a1f', text: '#ffffff' },
    { outer: '#006020', border: '#005a1f', text: '#ffffff' },
  ],
  // بنفسجي
  purple: [
    { outer: '#9b59b6', border: '#4a0080', text: '#ffffff' },
    { outer: '#7d3c98', border: '#4a0080', text: '#ffffff' },
    { outer: '#bb77cc', border: '#4a0080', text: '#ffffff' },
    { outer: '#6a1f8a', border: '#4a0080', text: '#ffffff' },
    { outer: '#a060bb', border: '#4a0080', text: '#ffffff' },
    { outer: '#5c1a7a', border: '#4a0080', text: '#ffffff' },
  ],
  // كحلي - أزرق داكن مع نيون أزرق ساطع وواضح
  navy: [
    { outer: '#0a2a6e', border: '#4488ff', text: '#ffffff', neon: '#4488ff' },
    { outer: '#0c3380', border: '#5599ff', text: '#ffffff', neon: '#5599ff' },
    { outer: '#071f55', border: '#3377ff', text: '#ffffff', neon: '#3377ff' },
    { outer: '#0e3a8a', border: '#66aaff', text: '#ffffff', neon: '#66aaff' },
    { outer: '#091f50', border: '#4488ff', text: '#ffffff', neon: '#4488ff' },
    { outer: '#0d3578', border: '#5599ff', text: '#ffffff', neon: '#5599ff' },
  ],
  // فضي - رمادي متوسط مع حد أبيض ساطع
  silver: [
    { outer: '#5a6070', border: '#dde8f0', text: '#ffffff', neon: '#dde8f0' },
    { outer: '#6a7080', border: '#eef5ff', text: '#ffffff', neon: '#eef5ff' },
    { outer: '#4c5560', border: '#ccddee', text: '#ffffff', neon: '#ccddee' },
    { outer: '#626878', border: '#e0eeff', text: '#ffffff', neon: '#e0eeff' },
    { outer: '#505868', border: '#d0e4f4', text: '#ffffff', neon: '#d0e4f4' },
    { outer: '#687080', border: '#eaf2ff', text: '#ffffff', neon: '#eaf2ff' },
  ],
  // أسود - مع إطارات بيضاء واضحة
  black: [
    { outer: '#111111', border: '#ffffff', text: '#ffffff', neon: '#ffffff' },
    { outer: '#1a1a1a', border: '#eeeeee', text: '#ffffff', neon: '#eeeeee' },
    { outer: '#0d0d0d', border: '#ffffff', text: '#ffffff', neon: '#ffffff' },
    { outer: '#222222', border: '#dddddd', text: '#ffffff', neon: '#dddddd' },
    { outer: '#141414', border: '#ffffff', text: '#ffffff', neon: '#ffffff' },
    { outer: '#1e1e1e', border: '#eeeeee', text: '#ffffff', neon: '#eeeeee' },
  ],
};

const WHEEL_STYLES = {
  classic:   { innerRadiusFactor: 0.28, outerGlow: true,  borderStyle: 'solid',    segmentStyle: 'gradient' },
  neon:      { innerRadiusFactor: 0.22, outerGlow: true,  borderStyle: 'neon',     segmentStyle: 'neon'     },
  minimal:   { innerRadiusFactor: 0.20, outerGlow: false, borderStyle: 'thin',     segmentStyle: 'flat'     },
  royal:     { innerRadiusFactor: 0.32, outerGlow: true,  borderStyle: 'gold',     segmentStyle: 'gradient' },
  neon_navy: { innerRadiusFactor: 0.22, outerGlow: true,  borderStyle: 'neon',     segmentStyle: 'neon'     },
};

function getGuildSettings(guildId) {
  const all = loadAll();
  const s = all[guildId] || {};
  return {
    bannerUrl:       s.bannerUrl       || null,
    winnerBannerUrl: s.winnerBannerUrl || null,
    theme:           s.theme           || 'default',
    customColors:    s.customColors    || null,
    spinDuration:    s.spinDuration    !== undefined ? s.spinDuration : 8,
    showNames:       s.showNames       !== undefined ? s.showNames    : true,
    wheelStyle:      s.wheelStyle      || 'classic',
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
