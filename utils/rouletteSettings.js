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

// ✅ كل ثيم معه لون نيون (neon) خاص فيه يُستخدم في توهج حواف الشرائح
const PRESET_THEMES = {
  // 🌊 كحلي غامق جدًا (قريب من الأسود) + نيون أزرق ساطع
  navy: [
    { outer: '#020408', inner: '#000102', text: '#ffffff', neon: '#1a5fff' },
    { outer: '#030509', inner: '#000102', text: '#ffffff', neon: '#2570ff' },
    { outer: '#010306', inner: '#000001', text: '#ffffff', neon: '#1452e6' },
    { outer: '#02040a', inner: '#000102', text: '#ffffff', neon: '#1a5fff' },
    { outer: '#010307', inner: '#000001', text: '#ffffff', neon: '#1452e6' },
    { outer: '#030610', inner: '#000103', text: '#ffffff', neon: '#2570ff' },
  ],
  // 🔴 أحمر غامق + نيون أحمر
  red: [
    { outer: '#1a0405', inner: '#0a0102', text: '#ffffff', neon: '#ff2d3d' },
    { outer: '#220608', inner: '#0c0203', text: '#ffffff', neon: '#ff3a4d' },
    { outer: '#150304', inner: '#080102', text: '#ffffff', neon: '#ff1f30' },
    { outer: '#1e0507', inner: '#0a0102', text: '#ffffff', neon: '#ff2d3d' },
    { outer: '#180405', inner: '#090102', text: '#ffffff', neon: '#ff1f30' },
    { outer: '#240709', inner: '#0d0203', text: '#ffffff', neon: '#ff3a4d' },
  ],
  // ⚙️ رصاصي غامق + نيون فولاذي
  gray: [
    { outer: '#15171a', inner: '#080909', text: '#ffffff', neon: '#7d8a96' },
    { outer: '#1a1c1f', inner: '#0a0b0c', text: '#ffffff', neon: '#8e9aa6' },
    { outer: '#101214', inner: '#070808', text: '#ffffff', neon: '#6c7884' },
    { outer: '#181a1d', inner: '#090a0b', text: '#ffffff', neon: '#7d8a96' },
    { outer: '#131517', inner: '#080909', text: '#ffffff', neon: '#6c7884' },
    { outer: '#1d1f22', inner: '#0b0c0d', text: '#ffffff', neon: '#8e9aa6' },
  ],
  // ⚪ فضي غامق + نيون فضي ساطع
  silver: [
    { outer: '#1c1e22', inner: '#0a0b0d', text: '#ffffff', neon: '#d8dee5' },
    { outer: '#22252a', inner: '#0c0d10', text: '#ffffff', neon: '#e6ebf0' },
    { outer: '#17191c', inner: '#08090a', text: '#ffffff', neon: '#c8cfd8' },
    { outer: '#202327', inner: '#0b0c0e', text: '#ffffff', neon: '#d8dee5' },
    { outer: '#1a1c20', inner: '#090a0b', text: '#ffffff', neon: '#c8cfd8' },
    { outer: '#262931', inner: '#0d0e11', text: '#ffffff', neon: '#e6ebf0' },
  ],
  // ⬛ أسود + نيون أبيض خافت
  black: [
    { outer: '#080808', inner: '#020202', text: '#ffffff', neon: '#e8e8e8' },
    { outer: '#0b0b0b', inner: '#030303', text: '#ffffff', neon: '#f4f4f4' },
    { outer: '#050505', inner: '#010101', text: '#ffffff', neon: '#dcdcdc' },
    { outer: '#0a0a0a', inner: '#020202', text: '#ffffff', neon: '#e8e8e8' },
    { outer: '#070707', inner: '#020202', text: '#ffffff', neon: '#dcdcdc' },
    { outer: '#0d0d0d', inner: '#040404', text: '#ffffff', neon: '#f4f4f4' },
  ],
};

const WHEEL_STYLES = {
  classic: { innerRadiusFactor: 0.28, outerGlow: true,  borderStyle: 'solid', segmentStyle: 'gradient' },
  neon:    { innerRadiusFactor: 0.22, outerGlow: true,  borderStyle: 'neon',  segmentStyle: 'neon'     },
  minimal: { innerRadiusFactor: 0.20, outerGlow: false, borderStyle: 'thin',  segmentStyle: 'flat'     },
  royal:   { innerRadiusFactor: 0.32, outerGlow: true,  borderStyle: 'gold',  segmentStyle: 'gradient' },
};

function getGuildSettings(guildId) {
  const all = loadAll();
  const s = all[guildId] || {};
  return {
    bannerUrl:    s.bannerUrl    || null,
    theme:        s.theme        || 'navy',
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
  return PRESET_THEMES[settings?.theme] || PRESET_THEMES.navy;
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
