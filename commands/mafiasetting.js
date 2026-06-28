const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getGuildSettings, saveGuildSettings } = require('../utils/mafiaSettings');
const { generateRoleCardCustom } = require('../utils/mafiaCanvas');

const URL_REGEX = /^https?:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i;
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

// خريطة الأدوار التي تقبل بانر كرت مخصص
const ROLE_BANNER_MAP = {
  'بانر-المافيا':  { key: 'mafiaBannerUrl',     role: 'مافيا', label: 'المافيا 🔴' },
  'بانر-الطبيب':   { key: 'doctorBannerUrl',    role: 'طبيب',  label: 'الطبيب 💚' },
  'بانر-المحقق':   { key: 'detectiveBannerUrl', role: 'محقق',  label: 'المحقق 🔵' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('اعدادات-المافيا')
    .setDescription('⚙️ لوحة تحكم إعدادات لعبة المافيا')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ─── بانر واجهة اللوبي ───────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-واجهة')
        .setDescription('🖼️ غيّر صورة واجهة لوبي المافيا')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة (png/jpg/webp) — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر الفائز (شاشة النتيجة) ──────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-الفائز')
        .setDescription('🏆 غيّر خلفية شاشة نتيجة اللعبة (نفس مقاس صورة الفائز بالروليت)')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة (png/jpg/webp) — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر كرت المافيا ────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-المافيا')
        .setDescription('🔴 غيّر صورة كرت الدور التي تُرسل بالخاص لشخص المافيا')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة (png/jpg/webp) — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر كرت الطبيب ─────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-الطبيب')
        .setDescription('💚 غيّر صورة كرت الدور التي تُرسل بالخاص لشخص الطبيب')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة (png/jpg/webp) — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── بانر كرت المحقق ─────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر-المحقق')
        .setDescription('🔵 غيّر صورة كرت الدور التي تُرسل بالخاص لشخص المحقق')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة (png/jpg/webp) — اتركه فارغاً للافتراضي')
            .setRequired(false)
        )
    )

    // ─── عرض كل الإعدادات ────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('عرض')
        .setDescription('📋 عرض جميع إعدادات المافيا الحالية')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ══════════════════════════════════════════════════════
    //  بانر واجهة اللوبي
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-واجهة') {
      const url = interaction.options.getString('رابط');

      if (!url) {
        saveGuildSettings(guildId, { lobbyBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر واجهة المافيا للافتراضي.', ephemeral: true });
      }
      if (!URL_REGEX.test(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp).', ephemeral: true });
      }

      saveGuildSettings(guildId, { lobbyBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر واجهة المافيا')
        .setDescription('هذه الصورة بتظهر بالـ embed عند فتح لوبي اللعبة.')
        .setImage(url)
        .setColor(0x0a0f1e);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ══════════════════════════════════════════════════════
    //  بانر الفائز (شاشة النتيجة)
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر-الفائز') {
      const url = interaction.options.getString('رابط');

      if (!url) {
        saveGuildSettings(guildId, { winnerBannerUrl: null });
        return interaction.reply({ content: '✅ تم إعادة بانر شاشة النتيجة للافتراضي.', ephemeral: true });
      }
      if (!URL_REGEX.test(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp).', ephemeral: true });
      }

      saveGuildSettings(guildId, { winnerBannerUrl: url });
      const embed = new EmbedBuilder()
        .setTitle('✅ تم تحديث بانر شاشة النتيجة')
        .setDescription('هذه الصورة بتكون خلفية شاشة الفوز، بنفس مقاس صورة الفائز بالروليت (700×496).')
        .setImage(url)
        .setColor(0xFFD700);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ══════════════════════════════════════════════════════
    //  بانرات كروت الأدوار (مافيا / طبيب / محقق)
    // ══════════════════════════════════════════════════════
    if (ROLE_BANNER_MAP[sub]) {
      const meta = ROLE_BANNER_MAP[sub];
      const url = interaction.options.getString('رابط');

      if (!url) {
        saveGuildSettings(guildId, { [meta.key]: null });
        return interaction.reply({ content: `✅ تم إعادة بانر دور ${meta.label} للافتراضي.`, ephemeral: true });
      }
      if (!URL_REGEX.test(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp).', ephemeral: true });
      }

      saveGuildSettings(guildId, { [meta.key]: url });
      await interaction.deferReply({ ephemeral: true });

      let previewBuf = null;
      try {
        previewBuf = await generateRoleCardCustom(url, meta.role, 'لاعب تجريبي', DEFAULT_AVATAR);
      } catch (e) {
        console.error('خطأ في توليد معاينة كرت الدور:', e);
      }

      const embed = new EmbedBuilder()
        .setTitle(`✅ تم تحديث بانر دور ${meta.label}`)
        .setDescription('هذه الصورة بتُستخدم بدل الكرت الافتراضي عند إرسال الدور بالخاص لهذا اللاعب.')
        .setColor(0x0a0f1e);

      if (previewBuf) {
        const att = new AttachmentBuilder(previewBuf, { name: 'preview.png' });
        embed.setImage('attachment://preview.png');
        return interaction.editReply({ embeds: [embed], files: [att] });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════
    //  عرض الإعدادات
    // ══════════════════════════════════════════════════════
    if (sub === 'عرض') {
      const settings = getGuildSettings(guildId);
      const embed = new EmbedBuilder()
        .setTitle('⚙️ إعدادات المافيا الحالية')
        .setColor(0x0a0f1e)
        .addFields(
          { name: '🖼️ بانر الواجهة', value: settings.lobbyBannerUrl ? `[رابط مخصص](${settings.lobbyBannerUrl})` : 'الافتراضي', inline: true },
          { name: '🏆 بانر الفائز', value: settings.winnerBannerUrl ? `[رابط مخصص](${settings.winnerBannerUrl})` : 'الافتراضي', inline: true },
          { name: '🔴 بانر المافيا', value: settings.mafiaBannerUrl ? `[رابط مخصص](${settings.mafiaBannerUrl})` : 'الافتراضي', inline: true },
          { name: '💚 بانر الطبيب', value: settings.doctorBannerUrl ? `[رابط مخصص](${settings.doctorBannerUrl})` : 'الافتراضي', inline: true },
          { name: '🔵 بانر المحقق', value: settings.detectiveBannerUrl ? `[رابط مخصص](${settings.detectiveBannerUrl})` : 'الافتراضي', inline: true },
        )
        .setFooter({ text: 'استخدم /اعدادات-المافيا لتغيير أي بانر' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
