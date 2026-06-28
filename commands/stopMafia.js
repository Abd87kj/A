const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getSession, deleteSession } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ايقاف-المافيا')
    .setDescription('🛑 أوقف لعبة المافيا الجارية في هذا الشات'),

  async execute(interaction, client) {
    const channelId = interaction.channelId;
    const session = getSession(`mafia_${channelId}`);

    if (!session) {
      return interaction.reply({ content: '⚠️ ما في لعبة مافيا شغالة في هذا الشات.', ephemeral: true });
    }

    // يسمح للمنشئ أو لمن عنده صلاحية ManageGuild
    const isHost  = session.hostId === interaction.user.id;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

    if (!isHost && !isAdmin) {
      return interaction.reply({
        content: '❌ فقط منشئ اللعبة أو الإداريين يقدرون يوقفون اللعبة.',
        ephemeral: true,
      });
    }

    // احذف السيشن
    deleteSession(`mafia_${channelId}`);

    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🛑 تم إيقاف لعبة المافيا')
      .setDescription(
        `قام **${interaction.member?.displayName || interaction.user.displayName}** بإيقاف اللعبة.\n\n` +
        'يمكن بدء لعبة جديدة في أي وقت باستخدام `/مافيا`'
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
