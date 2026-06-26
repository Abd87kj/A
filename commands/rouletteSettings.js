const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getGuildSettings, saveGuildSettings, getThemeColors, PRESET_THEMES } = require('../utils/rouletteSettings');
const { generateBannerImage, generateWheelImage } = require('../utils/wheelCanvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('اعداد-روليت')
    .setDescription('⚙️ لوحة تحكم لعبة الروليت (بانر/ألوان/معاينة)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('بانر')
        .setDescription('غيّر صورة واجهة بداية الروليت')
        .addStringOption(o => o.setName('رابط').setDescription('رابط مباشر للصورة (png/jpg)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ثيم')
        .setDescription('غيّر ثيم ألوان العجلة')
        .addStringOption(o =>
          o.setName('اسم')
            .setDescription('اختر ثيم جاهز')
            .setRequired(true)
            .addChoices(
              { name: 'الافتراضي', value: 'default' },
              { name: 'ذهبي', value: 'gold' },
              { name: 'أحمر', value: 'red' },
              { name: 'زمردي', value: 'emerald' },
              { name: 'بنفسجي', value: 'purple' },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('لون-مخصص')
        .setDescription('أضف لون مخصص للعجلة (يبدأ ثيم جديد عند أول استخدام)')
        .addStringOption(o => o.setName('خارجي').setDescription('كود اللون الخارجي مثل #0d2a6e').setRequired(true))
        .addStringOption(o => o.setName('داخلي').setDescription('كود اللون الداخلي مثل #061428').setRequired(true))
        .addStringOption(o => o.setName('نص').setDescription('كود لون النص مثل #a0c4ff').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('تصفير-الالوان')
        .setDescription('مسح الألوان المخصصة والرجوع للثيم المختار')
    )
    .addSubcommand(sub =>
      sub.setName('معاينة')
        .setDescription('شاهد البانر والعجلة بالشكل الحالي')
    )
    .addSubcommand(sub =>
      sub.setName('عرض')
        .setDescription('عرض الإعدادات الحالية')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'بانر') {
      const url = interaction.options.getString('رابط');
      if (!/^https?:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i.test(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const buf = await generateBannerImage(url);
        saveGuildSettings(guildId, { bannerUrl: url });
        const att = new AttachmentBuilder(buf, { name: 'preview.png' });
        const embed = new EmbedBuilder().setTitle('✅ تم تحديث بانر الروليت').setImage('attachment://preview.png').setColor(0x2ecc71);
        return interaction.editReply({ embeds: [embed], files: [att] });
      } catch (e) {
        return interaction.editReply({ content: '❌ ما قدرت أحمّل الصورة من الرابط، تأكد إنه رابط مباشر صحيح.' });
      }
    }

    if (sub === 'ثيم') {
      const name = interaction.options.getString('اسم');
      saveGuildSettings(guildId, { theme: name, customColors: null });
      const colors = PRESET_THEMES[name];
      await interaction.deferReply({ ephemeral: true });
      const demoPlayers = colors.slice(0, 5).map((c, i) => ({ displayName: `لاعب${i + 1}` }));
      const buffer = await generateWheelImage(demoPlayers, null, 0, colors);
      const att = new AttachmentBuilder(buffer, { name: 'theme.png' });
      const embed = new EmbedBuilder().setTitle(`✅ تم تفعيل ثيم: ${name}`).setImage('attachment://theme.png').setColor(0x2ecc71);
      return interaction.editReply({ embeds: [embed], files: [att] });
    }

    if (sub === 'لون-مخصص') {
      const outer = interaction.options.getString('خارجي');
      const inner = interaction.options.getString('داخلي');
      const text = interaction.options.getString('نص');
      const hexRe = /^#[0-9a-fA-F]{6}$/;
      if (![outer, inner, text].every(c => hexRe.test(c))) {
        return interaction.reply({ content: '❌ صيغة الألوان غلط، استخدم مثل #0d2a6e', ephemeral: true });
      }
      const settings = getGuildSettings(guildId);
      const newColors = [...(settings.customColors || []), { outer, inner, text }];
      saveGuildSettings(guildId, { customColors: newColors });
      await interaction.deferReply({ ephemeral: true });
      const demoPlayers = newColors.map((c, i) => ({ displayName: `لاعب${i + 1}` }));
      const buffer = await generateWheelImage(demoPlayers, null, 0, newColors);
      const att = new AttachmentBuilder(buffer, { name: 'custom.png' });
      const embed = new EmbedBuilder().setTitle(`✅ أُضيف لون مخصص (${newColors.length} ألوان الآن)`).setImage('attachment://custom.png').setColor(0x2ecc71);
      return interaction.editReply({ embeds: [embed], files: [att] });
    }

    if (sub === 'تصفير-الالوان') {
      saveGuildSettings(guildId, { customColors: null });
      return interaction.reply({ content: '✅ تم مسح الألوان المخصصة، رجعنا للثيم المختار.', ephemeral: true });
    }

    if (sub === 'معاينة') {
      await interaction.deferReply({ ephemeral: true });
      const settings = getGuildSettings(guildId);
      const colors = getThemeColors(settings);
      const bannerBuf = await generateBannerImage(settings.bannerUrl);
      const demoPlayers = ['لاعب1', 'لاعب2', 'لاعب3', 'لاعب4', 'لاعب5'].map(n => ({ displayName: n }));
      const wheelBuf = await generateWheelImage(demoPlayers, 1, 0, colors);

      const bannerAtt = new AttachmentBuilder(bannerBuf, { name: 'banner.png' });
      const wheelAtt = new AttachmentBuilder(wheelBuf, { name: 'wheel.png' });
      const embed1 = new EmbedBuilder().setTitle('🖼️ معاينة البانر').setImage('attachment://banner.png').setColor(0x3498db);
      const embed2 = new EmbedBuilder().setTitle('🎡 معاينة العجلة').setImage('attachment://wheel.png').setColor(0x3498db);
      return interaction.editReply({ embeds: [embed1, embed2], files: [bannerAtt, wheelAtt] });
    }

    if (sub === 'عرض') {
      const settings = getGuildSettings(guildId);
      const colorsCount = getThemeColors(settings).length;
      return interaction.reply({
        content:
          `⚙️ **إعدادات الروليت الحالية:**\n` +
          `🖼️ البانر: ${settings.bannerUrl ? settings.bannerUrl : 'الافتراضي'}\n` +
          `🎨 الثيم: **${settings.customColors ? 'مخصص' : settings.theme}** (${colorsCount} ألوان)`,
        ephemeral: true,
      });
    }
  },
};
