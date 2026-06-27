const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const {
  getGuildSettings,
  saveGuildSettings,
  getThemeColors,
  getWheelStyleConfig,
  PRESET_THEMES,
  WHEEL_STYLES,
} = require('../utils/rouletteSettings');
const { generateBannerImage, generateWheelImage } = require('../utils/wheelCanvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('اعدادات-الروليت')
    .setDescription('⚙️ لوحة تحكم كاملة لإعدادات الروليت')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ─── الثيم ───────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('ثيم')
        .setDescription('🎨 غيّر ثيم ألوان العجلة')
        .addStringOption(o =>
          o.setName('اسم')
            .setDescription('اختر ثيم جاهز')
            .setRequired(true)
            .addChoices(
              { name: '🌌 الافتراضي',    value: 'default' },
              { name: '🥇 ذهبي',         value: 'gold'    },
              { name: '🔴 أحمر',         value: 'red'     },
              { name: '💚 زمردي',        value: 'emerald' },
              { name: '💜 بنفسجي',       value: 'purple'  },
              { name: '🌊 كحلي غامق',    value: 'navy'    },
            )
        )
    )

    // ─── شكل العجلة ──────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('شكل')
        .setDescription('🎡 غيّر شكل العجلة')
        .addStringOption(o =>
          o.setName('نوع')
            .setDescription('اختر شكل العجلة')
            .setRequired(true)
            .addChoices(
              { name: '🎡 الكلاسيكي — تدرج لوني',         value: 'classic'   },
              { name: '💜 نيون — إطارات متوهجة',           value: 'neon'      },
              { name: '⬜ مينيمال — بسيط بدون تأثيرات',   value: 'minimal'   },
              { name: '👑 ملكي — إطار ذهبي فاخر',          value: 'royal'     },
              { name: '🌊 نيون كحلي — توهج أزرق داكن',    value: 'neon_navy' },
            )
        )
    )

    // ─── مدة الدوران ─────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('مدة-الدوران')
        .setDescription('⏱️ تحكم في مدة دوران العجلة')
        .addIntegerOption(o =>
          o.setName('ثواني')
            .setDescription('المدة بالثواني (3 - 20)')
            .setRequired(true)
            .setMinValue(3)
            .setMaxValue(20)
        )
    )

    // ─── إظهار الأسماء ────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('اسماء-اللاعبين')
        .setDescription('👥 تحكم في إظهار أسماء اللاعبين على العجلة')
        .addStringOption(o =>
          o.setName('وضع')
            .setDescription('اعرض أو أخفِ الأسماء')
            .setRequired(true)
            .addChoices(
              { name: '✅ اعرض الأسماء', value: 'show' },
              { name: '🚫 أخفِ الأسماء', value: 'hide' },
            )
        )
    )

    // ─── البنر ───────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('بانر')
        .setDescription('🖼️ غيّر صورة واجهة بداية الروليت')
        .addStringOption(o =>
          o.setName('رابط')
            .setDescription('رابط مباشر للصورة (png/jpg/webp)')
            .setRequired(true)
        )
    )

    // ─── لون مخصص ────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('لون-مخصص')
        .setDescription('🎨 أضف لون مخصص للعجلة')
        .addStringOption(o => o.setName('خارجي').setDescription('كود اللون الخارجي مثل #0d2a6e').setRequired(true))
        .addStringOption(o => o.setName('داخلي').setDescription('كود اللون الداخلي مثل #061428').setRequired(true))
        .addStringOption(o => o.setName('نص').setDescription('كود لون النص مثل #a0c4ff').setRequired(true))
    )

    // ─── تصفير الألوان ────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('تصفير-الالوان')
        .setDescription('🗑️ مسح الألوان المخصصة والرجوع للثيم المختار')
    )

    // ─── معاينة ───────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('معاينة')
        .setDescription('👁️ شاهد البانر والعجلة بالشكل الحالي')
    )

    // ─── عرض الإعدادات ────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('عرض')
        .setDescription('📋 عرض جميع الإعدادات الحالية')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ══════════════════════════════════════════════════════
    //  ثيم
    // ══════════════════════════════════════════════════════
    if (sub === 'ثيم') {
      const name = interaction.options.getString('اسم');
      saveGuildSettings(guildId, { theme: name, customColors: null });
      await interaction.deferReply({ ephemeral: true });

      const colors = PRESET_THEMES[name];
      const demoPlayers = colors.slice(0, 6).map((_, i) => ({ displayName: `لاعب${i + 1}` }));
      const buffer = await generateWheelImage(demoPlayers, null, 0, colors, 640, true);
      const att = new AttachmentBuilder(buffer, { name: 'theme.png' });
      const themeNames = {
        default: 'الافتراضي 🌌',
        gold:    'ذهبي 🥇',
        red:     'أحمر 🔴',
        emerald: 'زمردي 💚',
        purple:  'بنفسجي 💜',
        navy:    'كحلي غامق 🌊',
      };
      const embed = new EmbedBuilder()
        .setTitle(`✅ تم تفعيل ثيم: ${themeNames[name]}`)
        .setImage('attachment://theme.png')
        .setColor(0x0a1f4e);
      return interaction.editReply({ embeds: [embed], files: [att] });
    }

    // ══════════════════════════════════════════════════════
    //  شكل العجلة
    // ══════════════════════════════════════════════════════
    if (sub === 'شكل') {
      const نوع = interaction.options.getString('نوع');
      saveGuildSettings(guildId, { wheelStyle: نوع });
      await interaction.deferReply({ ephemeral: true });

      const settings = getGuildSettings(guildId);
      const colors = getThemeColors(settings);
      const styleConfig = WHEEL_STYLES[نوع];
      const demoPlayers = Array.from({ length: 5 }, (_, i) => ({ displayName: `لاعب${i + 1}` }));
      const buffer = await generateWheelImage(demoPlayers, null, 0, colors, 640, true, styleConfig);
      const att = new AttachmentBuilder(buffer, { name: 'style.png' });
      const styleNames = {
        classic:   'الكلاسيكي 🎡',
        neon:      'نيون 💜',
        minimal:   'مينيمال ⬜',
        royal:     'ملكي 👑',
        neon_navy: 'نيون كحلي 🌊',
      };
      const embed = new EmbedBuilder()
        .setTitle(`✅ تم تفعيل شكل: ${styleNames[نوع]}`)
        .setImage('attachment://style.png')
        .setColor(0x0a1f4e);
      return interaction.editReply({ embeds: [embed], files: [att] });
    }

    // ══════════════════════════════════════════════════════
    //  مدة الدوران
    // ══════════════════════════════════════════════════════
    if (sub === 'مدة-الدوران') {
      const seconds = interaction.options.getInteger('ثواني');
      saveGuildSettings(guildId, { spinDuration: seconds });
      const label = seconds <= 5 ? 'سريع ⚡' : seconds <= 10 ? 'متوسط 🎡' : seconds <= 15 ? 'بطيء 🐢' : 'طويل جداً 💤';
      return interaction.reply({
        content: `✅ تم تحديث مدة الدوران إلى **${seconds} ثانية** — ${label}`,
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════════
    //  أسماء اللاعبين
    // ══════════════════════════════════════════════════════
    if (sub === 'اسماء-اللاعبين') {
      const وضع = interaction.options.getString('وضع');
      const showNames = وضع === 'show';
      saveGuildSettings(guildId, { showNames });
      await interaction.deferReply({ ephemeral: true });

      const settings = getGuildSettings(guildId);
      const colors = getThemeColors(settings);
      const styleConfig = getWheelStyleConfig(settings);
      const demoPlayers = ['أحمد', 'فهد', 'سلمى', 'نورة', 'خالد'].map(n => ({ displayName: n }));
      const buffer = await generateWheelImage(demoPlayers, null, 0, colors, 640, showNames, styleConfig);
      const att = new AttachmentBuilder(buffer, { name: 'names.png' });
      const embed = new EmbedBuilder()
        .setTitle(showNames ? '✅ أسماء اللاعبين مفعّلة' : '✅ أسماء اللاعبين مخفية')
        .setDescription(showNames ? 'أسماء المشاركين ستظهر على شرائح العجلة.' : 'العجلة ستدور بشرائح بدون أسماء.')
        .setImage('attachment://names.png')
        .setColor(showNames ? 0x2ecc71 : 0xe74c3c);
      return interaction.editReply({ embeds: [embed], files: [att] });
    }

    // ══════════════════════════════════════════════════════
    //  بانر
    // ══════════════════════════════════════════════════════
    if (sub === 'بانر') {
      const url = interaction.options.getString('رابط');
      if (!/^https?:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i.test(url)) {
        return interaction.reply({ content: '❌ الرابط لازم يكون رابط مباشر لصورة (png/jpg/webp).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        saveGuildSettings(guildId, { bannerUrl: url });
        const embed = new EmbedBuilder()
          .setTitle('✅ تم تحديث بانر الروليت')
          .setImage(url)
          .setColor(0x0a1f4e);
        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: '❌ ما قدرت أتحقق من الصورة، تأكد أن الرابط صحيح.' });
      }
    }

    // ══════════════════════════════════════════════════════
    //  لون مخصص
    // ══════════════════════════════════════════════════════
    if (sub === 'لون-مخصص') {
      const outer = interaction.options.getString('خارجي');
      const inner = interaction.options.getString('داخلي');
      const text  = interaction.options.getString('نص');
      const hexRe = /^#[0-9a-fA-F]{6}$/;
      if (![outer, inner, text].every(c => hexRe.test(c))) {
        return interaction.reply({ content: '❌ صيغة الألوان غلط، استخدم مثل #0d2a6e', ephemeral: true });
      }
      const settings = getGuildSettings(guildId);
      const newColors = [...(settings.customColors || []), { outer, inner, text }];
      saveGuildSettings(guildId, { customColors: newColors });
      await interaction.deferReply({ ephemeral: true });
      const demoPlayers = newColors.map((_, i) => ({ displayName: `لاعب${i + 1}` }));
      const styleConfig = getWheelStyleConfig(settings);
      const buffer = await generateWheelImage(demoPlayers, null, 0, newColors, 640, true, styleConfig);
      const att = new AttachmentBuilder(buffer, { name: 'custom.png' });
      const embed = new EmbedBuilder()
        .setTitle(`✅ أُضيف لون مخصص (${newColors.length} ألوان الآن)`)
        .setImage('attachment://custom.png')
        .setColor(0x0a1f4e);
      return interaction.editReply({ embeds: [embed], files: [att] });
    }

    // ══════════════════════════════════════════════════════
    //  تصفير الألوان
    // ══════════════════════════════════════════════════════
    if (sub === 'تصفير-الالوان') {
      saveGuildSettings(guildId, { customColors: null });
      return interaction.reply({ content: '✅ تم مسح الألوان المخصصة، رجعنا للثيم المختار.', ephemeral: true });
    }

    // ══════════════════════════════════════════════════════
    //  معاينة
    // ══════════════════════════════════════════════════════
    if (sub === 'معاينة') {
      await interaction.deferReply({ ephemeral: true });
      const settings = getGuildSettings(guildId);
      const colors = getThemeColors(settings);
      const styleConfig = getWheelStyleConfig(settings);
      const demoPlayers = ['أحمد', 'فهد', 'سلمى', 'نورة', 'خالد'].map(n => ({ displayName: n }));
      const wheelBuf = await generateWheelImage(demoPlayers, 1, 0, colors, 640, settings.showNames, styleConfig);
      const wheelAtt = new AttachmentBuilder(wheelBuf, { name: 'wheel.png' });
      const styleNames = {
        classic:   'الكلاسيكي 🎡',
        neon:      'نيون 💜',
        minimal:   'مينيمال ⬜',
        royal:     'ملكي 👑',
        neon_navy: 'نيون كحلي 🌊',
      };
      const themeNames = {
        default: 'الافتراضي 🌌',
        gold:    'ذهبي 🥇',
        red:     'أحمر 🔴',
        emerald: 'زمردي 💚',
        purple:  'بنفسجي 💜',
        navy:    'كحلي غامق 🌊',
      };
      const embed = new EmbedBuilder()
        .setTitle('👁️ معاينة العجلة الحالية')
        .setImage('attachment://wheel.png')
        .setColor(0x0a1f4e)
        .addFields(
          { name: '⏱️ مدة الدوران', value: `${settings.spinDuration} ثانية`, inline: true },
          { name: '👥 الأسماء',      value: settings.showNames ? 'مفعّلة ✅' : 'مخفية 🚫', inline: true },
          { name: '🎡 الشكل',        value: styleNames[settings.wheelStyle] || 'كلاسيكي',  inline: true },
          { name: '🎨 الثيم',        value: themeNames[settings.theme] || settings.theme,  inline: true },
        );
      return interaction.editReply({ embeds: [embed], files: [wheelAtt] });
    }

    // ══════════════════════════════════════════════════════
    //  عرض الإعدادات
    // ══════════════════════════════════════════════════════
    if (sub === 'عرض') {
      const settings = getGuildSettings(guildId);
      const colorsCount = getThemeColors(settings).length;
      const styleNames = {
        classic:   'الكلاسيكي 🎡',
        neon:      'نيون 💜',
        minimal:   'مينيمال ⬜',
        royal:     'ملكي 👑',
        neon_navy: 'نيون كحلي 🌊',
      };
      const themeNames = {
        default: 'الافتراضي 🌌',
        gold:    'ذهبي 🥇',
        red:     'أحمر 🔴',
        emerald: 'زمردي 💚',
        purple:  'بنفسجي 💜',
        navy:    'كحلي غامق 🌊',
      };
      const embed = new EmbedBuilder()
        .setTitle('⚙️ إعدادات الروليت الحالية')
        .setColor(0x0a1f4e)
        .addFields(
          { name: '🖼️ البانر',         value: settings.bannerUrl ? `[رابط مخصص](${settings.bannerUrl})` : 'الافتراضي', inline: true },
          { name: '🎨 الثيم',           value: settings.customColors ? `مخصص (${colorsCount} لون)` : (themeNames[settings.theme] || settings.theme), inline: true },
          { name: '🎡 شكل العجلة',     value: styleNames[settings.wheelStyle] || 'كلاسيكي', inline: true },
          { name: '⏱️ مدة الدوران',    value: `${settings.spinDuration} ثانية`, inline: true },
          { name: '👥 أسماء اللاعبين', value: settings.showNames ? 'مفعّلة ✅' : 'مخفية 🚫', inline: true },
        )
        .setFooter({ text: 'استخدم /اعدادات-الروليت معاينة لرؤية العجلة بالشكل الحالي' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
