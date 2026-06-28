const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getGuildSettings, saveGuildSettings } = require('../utils/mafiaSetting');

const URL_REGEX = /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i;

function validateUrl(url) {
  return URL_REGEX.test(url);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('اعدادات-المافيا')
    .setDescription('⚙️ لوحة تحكم إعدادات لعبة المافيا')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ─── بانر اللوبي ───────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-اللوبي')
        .setDescription('🖼️ غيّر صورة غرفة الانتظار')
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

    // ─── بانر بطاقة المافيا ─────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-بطاقة-المافيا')
        .setDescription('🔴 غيّر خلفية بطاقة دور المافيا')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر بطاقة الطبيب ──────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-بطاقة-الطبيب')
        .setDescription('💚 غيّر خلفية بطاقة دور الطبيب')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر بطاقة المحقق ──────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-بطاقة-المحقق')
        .setDescription('🔵 غيّر خلفية بطاقة دور المحقق')
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
        .setTitle('✅ تم تحديث بانر لوبي المافيا')
        .setDescription('هذه الصورة ستظهر في غرفة الانتظار عند بدء لعبة جديدة.')
        .setImage(url)
        .setColor(0x0a0f1e);
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
        .setTitle('✅ تم تحديث بانر شاشة الفائز')
        .setDescription('هذه الصورة ستظهر خلفية عند إعلان الفريق الفائز.')
        .setImage(url)
        .setColor(0xFFD700);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  بانر بطاقة المافيا
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-بطاقة-المافيا') {
      const url = interaction.options.getString('رابط');
      if (!url) {
        saveGuildSettings(guildId, { mafiaBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر بطاقة المافيا للافتراضي.', ephemeral: true });
      }
      if (!validateUrl(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp/gif).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      saveGuildSettings(guildId, { mafiaBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر بطاقة المافيا 🔴')
        .setDescription('هذه الصورة ستظهر خلفية في بطاقة الدور اللي تُرسل للاعبي المافيا بالـ DM.')
        .setImage(url)
        .setColor(0xc0102a);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  بانر بطاقة الطبيب
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-بطاقة-الطبيب') {
      const url = interaction.options.getString('رابط');
      if (!url) {
        saveGuildSettings(guildId, { doctorBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر بطاقة الطبيب للافتراضي.', ephemeral: true });
      }
      if (!validateUrl(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp/gif).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      saveGuildSettings(guildId, { doctorBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر بطاقة الطبيب 💚')
        .setDescription('هذه الصورة ستظهر خلفية في بطاقة الدور اللي تُرسل للطبيب بالـ DM.')
        .setImage(url)
        .setColor(0x10a040);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  بانر بطاقة المحقق
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-بطاقة-المحقق') {
      const url = interaction.options.getString('رابط');
      if (!url) {
        saveGuildSettings(guildId, { detectiveBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر بطاقة المحقق للافتراضي.', ephemeral: true });
      }
      if (!validateUrl(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp/gif).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      saveGuildSettings(guildId, { detectiveBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر بطاقة المحقق 🔵')
        .setDescription('هذه الصورة ستظهر خلفية في بطاقة الدور اللي تُرسل للمحقق بالـ DM.')
        .setImage(url)
        .setColor(0x1060c0);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  عرض الإعدادات
    // ══════════════════════════════════════════════════════
    if (sub === 'عرض') {
      const s = getGuildSettings(guildId);
      const fmt = (url) => url ? `[رابط مخصص](${url}) ✅` : 'افتراضي';
      const embed = new EmbedBuilder()
        .setTitle('⚙️ إعدادات المافيا الحالية')
        .setColor(0x0a0f1e)
        .addFields(
          { name: '🖼️ بانر اللوبي',          value: fmt(s.lobbyBannerUrl),     inline: true },
          { name: '🏆 بانر الفائز',           value: fmt(s.winnerBannerUrl),    inline: true },
          { name: '\u200B',                    value: '\u200B',                  inline: true },
          { name: '🔴 بانر بطاقة المافيا',    value: fmt(s.mafiaBannerUrl),     inline: true },
          { name: '💚 بانر بطاقة الطبيب',    value: fmt(s.doctorBannerUrl),    inline: true },
          { name: '🔵 بانر بطاقة المحقق',    value: fmt(s.detectiveBannerUrl), inline: true },
        )
        .setFooter({ text: 'استخدم الأوامر الفرعية لتغيير أي إعداد' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
