const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../data/mafiaSettings.json');

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
    console.error('فشل حفظ إعدادات المافيا:', e);
  }
}

/**
 * إعدادات السيرفر الخاصة بلعبة المافيا:
 * - lobbyBannerUrl     : بانر واجهة اللوبي (يظهر بالـ embed عند فتح اللعبة)
 * - winnerBannerUrl    : بانر خلفية شاشة نتيجة اللعبة (نفس مقاس صورة الفائز بالروليت 700×496)
 * - mafiaBannerUrl     : صورة كرت الدور المرسلة بالخاص لشخص "مافيا"
 * - doctorBannerUrl    : صورة كرت الدور المرسلة بالخاص لشخص "طبيب"
 * - detectiveBannerUrl : صورة كرت الدور المرسلة بالخاص لشخص "محقق"
 */
function getGuildSettings(guildId) {
  const all = loadAll();
  const s = all[guildId] || {};
  return {
    lobbyBannerUrl:     s.lobbyBannerUrl     || null,
    winnerBannerUrl:    s.winnerBannerUrl    || null,
    mafiaBannerUrl:     s.mafiaBannerUrl     || null,
    doctorBannerUrl:    s.doctorBannerUrl    || null,
    detectiveBannerUrl: s.detectiveBannerUrl || null,
  };
}

function saveGuildSettings(guildId, partial) {
  const all = loadAll();
  all[guildId] = { ...(all[guildId] || {}), ...partial };
  saveAll(all);
  return all[guildId];
}

module.exports = {
  getGuildSettings,
  saveGuildSettings,
};
