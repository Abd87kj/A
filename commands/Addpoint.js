const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getUser, saveUser } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('اضافة-نقاط')
    .setDescription('➕ أضف أو اسحب نقاط من لاعب (للمشرفين فقط)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o =>
      o.setName('لاعب')
        .setDescription('اللاعب المستهدف')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('نقاط')
        .setDescription('عدد النقاط (سالب للسحب، موجب للإضافة)')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('سبب')
        .setDescription('سبب التعديل (اختياري)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('لاعب');
    const amount = interaction.options.getInteger('نقاط');
    const reason = interaction.options.getString('سبب') || 'لا يوجد سبب';

    if (amount === 0) {
      return interaction.reply({ content: '❌ النقاط لازم تكون غير صفر.', ephemeral: true });
    }

    const user = getUser(target.id, interaction.guildId);
    const before = user.points;

    user.points = Math.max(0, user.points + amount);
    saveUser(user);

    const after = user.points;
    const isAdd = amount > 0;
    const diff = Math.abs(amount);

    // لو السحب طلع أكبر من الرصيد، نوضح كم اتسحب فعلاً
    const actualChange = after - before;

    const embed = new EmbedBuilder()
      .setColor(isAdd ? 0x2ecc71 : 0xe74c3c)
      .setTitle(isAdd ? '➕ إضافة نقاط' : '➖ سحب نقاط')
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: '👤 اللاعب', value: `<@${target.id}>`, inline: true },
        { name: isAdd ? '💰 المُضاف' : '💸 المسحوب', value: `**${Math.abs(actualChange)} نقطة**`, inline: true },
        { name: '📊 الرصيد', value: `~~${before}~~ ➜ **${after}**`, inline: true },
        { name: '📝 السبب', value: reason },
      )
      .setFooter({ text: `بواسطة ${interaction.user.tag}` })
      .setTimestamp();

    // تنبيه لو السحب اقتطع بسبب الرصيد
    if (!isAdd && actualChange !== -diff) {
      embed.setDescription(`⚠️ الرصيد ما يكفي، اتسحب **${Math.abs(actualChange)}** فقط بدل **${diff}**.`);
    }

    return interaction.reply({ embeds: [embed] });
  },
};
