const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, getTopUsers } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('نقاطي')
    .setDescription('💰 شوف نقاطك وإحصائياتك'),

  async execute(interaction) {
    const user = getUser(interaction.user.id, interaction.guildId);
    const member = interaction.member;

    const embed = new EmbedBuilder()
      .setColor(0x0a1f5c)
      .setTitle(`📊 إحصائيات ${member?.displayName || interaction.user.displayName}`)
      .setThumbnail(interaction.user.avatarURL({ size: 128 }))
      .addFields(
        { name: '💰 النقاط', value: `**${user.points}** نقطة`, inline: true },
        { name: '🏆 انتصارات', value: `**${user.wins || 0}**`, inline: true },
        { name: '💸 خسائر', value: `**${user.losses || 0}**`, inline: true },
        { name: '🛡️ حمايات', value: `**${user.activeShields || 0}**`, inline: true },
        { name: '☢️ نيوك', value: `**${user.activeNukes || 0}**`, inline: true },
        { name: '💻 هيكر', value: `**${user.activeHackers || 0}**`, inline: true },
      )
      .setFooter({ text: 'العب ألعاب لتحصل على نقاط أكثر!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
