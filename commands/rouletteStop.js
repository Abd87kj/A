const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSession, deleteSession } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ايقاف-الروليت')
    .setDescription('🛑 إيقاف لعبة الروليت الحالية في هذه القناة')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channelId = interaction.channelId;
    const session = getSession(channelId);

    if (!session) {
      return interaction.reply({ content: '⚠️ ما في لعبة روليت شغالة في هذه القناة.', ephemeral: true });
    }

    const isHost = session.hostId === interaction.user.id;
    const isManager = interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);

    if (!isHost && !isManager) {
      return interaction.reply({ content: '❌ فقط منشئ اللعبة أو الإدارة يقدر يوقف الروليت.', ephemeral: true });
    }

    deleteSession(channelId);

    try {
      if (session.eliminationMessageId) {
        const m = await interaction.channel.messages.fetch(session.eliminationMessageId);
        await m.edit({ components: [] });
      }
    } catch (e) {}

    try {
      if (session.bannerMsgId) {
        const bm = await interaction.channel.messages.fetch(session.bannerMsgId);
        await bm.edit({ components: [] });
      }
    } catch (e) {}

    try {
      if (session.messageId) {
        const sm = await interaction.channel.messages.fetch(session.messageId);
        await sm.edit({ content: '🛑 تم إيقاف اللعبة.', components: [] }).catch(() => sm.delete().catch(() => {}));
      }
    } catch (e) {}

    return interaction.reply({ content: '🛑 تم إيقاف لعبة الروليت في هذه القناة بنجاح.', ephemeral: false });
  },
};
