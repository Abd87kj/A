const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const theme = require('../utils/theme');
const bombCommand = require('./bomb');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ايقاف-بومب')
    .setDescription('🛑 أوقف لعبة البومب الجارية في هذه القناة'),

  async execute(interaction) {
    const channelId = interaction.channelId;
    const session = bombCommand.sessions.get(channelId);

    if (!session) {
      return interaction.reply({
        content: '❌ لا توجد لعبة بومب شغالة بهذي القناة حالياً.',
        ephemeral: true,
      });
    }

    // الصلاحية: منشئ اللعبة، أو شخص يملك صلاحية إدارة السيرفر/الرسائل
    const isHost = interaction.user.id === session.host;
    const isManager =
      interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.member?.permissions?.has(PermissionFlagsBits.ManageMessages);

    if (!isHost && !isManager) {
      return interaction.reply({
        content: '⚠️ فقط منشئ اللعبة أو أحد المسؤولين يقدر يوقف اللعبة.',
        ephemeral: true,
      });
    }

    // حاول إزالة أزرار رسالة اللوبي إن كانت اللعبة بعدها بمرحلة الانضمام
    if (!session.started && session.lobbyMsgId) {
      try {
        const lobbyMsg = await interaction.channel.messages.fetch(session.lobbyMsgId);
        await lobbyMsg.edit({ components: [] });
      } catch (e) {
        // تجاهل إن لم نتمكن من تعديل الرسالة (محذوفة مثلاً)
      }
    }

    bombCommand.stopSession(channelId);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(theme.colors.danger)
          .setTitle('🛑 تم إيقاف لعبة البومب')
          .setDescription(`تم إيقاف اللعبة بواسطة <@${interaction.user.id}>.`),
      ],
    });
  },
};
