const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getGuildSettings, saveGuildSettings } = require('../utils/bombSetting');

const URL_REGEX = /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i;

function validateUrl(url) {
  return URL_REGEX.test(url);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('اعدادات-البومب')
    .setDescription('⚙️ لوحة تحكم إعدادات لعبة البومب')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ─── بانر الواجهة ───────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-اللوبي')
        .setDescription('🖼️ غيّر صورة واجهة بداية اللعبة')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة (png/jpg/webp/gif) — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر الفائز ────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-الفائز')
        .setDescription('🏆 غيّر خلفية شاشة إعلان الفائز')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر صورة الكلمة ───────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-الكلمة')
        .setDescription('💣 غيّر خلفية صورة عرض الكلمة / الحروف')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── عرض الإعدادات ──────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('عرض')
        .setDescription('📋 عرض جميع الإعدادات الحالية')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ══════════════════════════════════════════════════════
    //  بانر اللوبي
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-اللوبي') {
      const url = interaction.options.getString('رابط');
      if (!url) {
        saveGuildSettings(guildId, { lobbyBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر اللوبي للافتراضي.', ephemeral: true });
      }
      if (!validateUrl(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp/gif).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      saveGuildSettings(guildId, { lobbyBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر لوبي البومب 💣')
        .setDescription('هذه الصورة ستظهر عند بدء لعبة بومب جديدة.')
        .setImage(url)
        .setColor(0xff6600);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  بانر الفائز
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-الفائز') {
      const url = interaction.options.getString('رابط');
      if (!url) {
        saveGuildSettings(guildId, { winnerBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر الفائز للافتراضي.', ephemeral: true });
      }
      if (!validateUrl(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp/gif).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      saveGuildSettings(guildId, { winnerBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر شاشة الفائز 🏆')
        .setDescription('هذه الصورة ستظهر خلفية عند إعلان الفائز في البومب.')
        .setImage(url)
        .setColor(0xFFD700);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  بانر الكلمة
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-الكلمة') {
      const url = interaction.options.getString('رابط');
      if (!url) {
        saveGuildSettings(guildId, { wordBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر صورة الكلمة للافتراضي.', ephemeral: true });
      }
      if (!validateUrl(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp/gif).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      saveGuildSettings(guildId, { wordBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر صورة الكلمة 💣')
        .setDescription('هذه الصورة ستظهر خلفية في كل جولة خلف الحروف المطلوبة.')
        .setImage(url)
        .setColor(0xff6600);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  عرض الإعدادات
    // ══════════════════════════════════════════════════════
    if (sub === 'عرض') {
      const s = getGuildSettings(guildId);
      const fmt = (url) => url ? `[رابط مخصص](${url}) ✅` : 'افتراضي';
      const embed = new EmbedBuilder()
        .setTitle('⚙️ إعدادات البومب الحالية')
        .setColor(0xff6600)
        .addFields(
          { name: '🖼️ بانر اللوبي',     value: fmt(s.lobbyBannerUrl),  inline: true },
          { name: '🏆 بانر الفائز',      value: fmt(s.winnerBannerUrl), inline: true },
          { name: '💣 بانر صورة الكلمة', value: fmt(s.wordBannerUrl),   inline: true },
        )
        .setFooter({ text: 'استخدم الأوامر الفرعية لتغيير أي إعداد' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
