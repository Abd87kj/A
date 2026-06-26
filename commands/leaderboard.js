const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTopUsers } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('توب')
    .setDescription('🏆 قائمة أفضل اللاعبين'),

  async execute(interaction) {
    await interaction.deferReply();
    const topUsers = getTopUsers(interaction.guildId, 10);

    if (topUsers.length === 0) {
      return interaction.editReply('❌ ما في بيانات بعد. العب ألعاب أول!');
    }

    const medals = ['🥇', '🥈', '🥉'];
    let leaderboard = '';

    for (let i = 0; i < topUsers.length; i++) {
      const u = topUsers[i];
      const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
      const name = member?.displayName || u.userId;
      const medal = medals[i] || `\`${i + 1}\``;
      leaderboard += `${medal} **${name}** — ${u.points} نقطة\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 أفضل اللاعبين')
      .setDescription(leaderboard)
      .setFooter({ text: `${interaction.guild.name}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
