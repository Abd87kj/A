const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const theme = require('../utils/theme');

const sessions = new Map();
const MODIFIERS = [-1, -1, -1, +2, +3, +4, +5, +6, -2];

function rollMain() { return Math.floor(Math.random() * 6) + 1; }
function rollModifier() { return MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)]; }

function bar(score, target) {
  const segments = 5;
  const filled = Math.min(segments, Math.round((score / target) * segments));
  return '🟦'.repeat(filled) + '⬜'.repeat(segments - filled);
}

function buildBoardEmbed(session) {
  const [p1, p2] = session.players;
  return new EmbedBuilder()
    .setColor(theme.colors.info)
    .setTitle(`${theme.emojis.dice} لعبة النرد — الهدف: ${session.target} نقطة`)
    .setDescription(
      `**<@${p1.id}>**: ${p1.score} نقطة\n${bar(p1.score, session.target)}\n\n` +
      `**<@${p2.id}>**: ${p2.score} نقطة\n${bar(p2.score, session.target)}\n\n` +
      `🎯 الدور الحالي: <@${session.turn}>`
    )
    .setFooter({ text: 'اضغط (ارمِ النرد) عند بدء دورك' });
}

function rollRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dice_roll').setLabel('ارمِ النرد 🎲').setStyle(ButtonStyle.Primary)
  );
}
function decisionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dice_lock').setLabel('تثبيت ✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dice_reroll').setLabel('أعد الرمي 🔄').setStyle(ButtonStyle.Danger)
  );
}

function otherPlayer(session, id) { return session.players.find((p) => p.id !== id); }
function currentPlayer(session) { return session.players.find((p) => p.id === session.turn); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('نرد')
    .setDescription('🎲 ابدأ لعبة نرد ضد لاعب آخر')
    .addUserOption((o) => o.setName('الخصم').setDescription('اللاعب الذي تريد منافسته').setRequired(true))
    .addIntegerOption((o) => o.setName('الهدف').setDescription('عدد النقاط المطلوبة للفوز (افتراضي 15)').setRequired(false)),

  async execute(interaction) {
    const channelId = interaction.channelId;
    if (sessions.has(channelId)) {
      return interaction.reply({ content: '⚠️ فيه لعبة نرد شغالة بهذي القناة حالياً.', ephemeral: true });
    }
    const opponent = interaction.options.getUser('الخصم');
    const target = interaction.options.getInteger('الهدف') || 15;

    if (opponent.id === interaction.user.id) {
      return interaction.reply({ content: 'اختر خصماً غيرك!', ephemeral: true });
    }

    const session = {
      channelId,
      players: [{ id: interaction.user.id, score: 0 }, { id: opponent.id, score: 0 }],
      target,
      turn: interaction.user.id,
      rerollUsed: false,
      pending: 0
    };
    sessions.set(channelId, session);

    await interaction.reply({ embeds: [buildBoardEmbed(session)], components: [rollRow()] });
  },

  async handleButton(interaction) {
    const session = sessions.get(interaction.channelId);
    if (!session) return;
    const id = interaction.customId;

    if (id === 'dice_roll') {
      if (interaction.user.id !== session.turn) return interaction.reply({ content: 'ما هذا دورك!', ephemeral: true });
      const main = rollMain();
      const mod = rollModifier();
      session.pending = main + mod;
      session.rerollUsed = false;
      const embed = new EmbedBuilder()
        .setColor(mod >= 0 ? theme.colors.success : theme.colors.danger)
        .setTitle(`🎲 رميت: ${main}  |  المُعدِّل: ${mod > 0 ? '+' + mod : mod}`)
        .setDescription(`**إجمالي هذا الدور: ${Math.max(0, main + mod)} نقطة**\n\nتثبيت النقاط أم إعادة الرمي؟ (إعادة واحدة فقط مسموحة)`);
      return interaction.update({ embeds: [buildBoardEmbed(session), embed], components: [decisionRow()] });
    }

    if (id === 'dice_lock') {
      if (interaction.user.id !== session.turn) return interaction.reply({ content: 'ما هذا دورك!', ephemeral: true });
      const player = currentPlayer(session);
      player.score += Math.max(0, session.pending);
      if (player.score >= session.target) {
        sessions.delete(session.channelId);
        const embed = new EmbedBuilder()
          .setColor(theme.colors.success)
          .setTitle(`${theme.emojis.trophy} فاز <@${player.id}>!`)
          .setDescription(`النتيجة النهائية: ${player.score} نقطة`);
        return interaction.update({ embeds: [embed], components: [] });
      }
      session.turn = otherPlayer(session, player.id).id;
      session.pending = 0;
      return interaction.update({ embeds: [buildBoardEmbed(session)], components: [rollRow()] });
    }

    if (id === 'dice_reroll') {
      if (interaction.user.id !== session.turn) return interaction.reply({ content: 'ما هذا دورك!', ephemeral: true });
      if (session.rerollUsed) return interaction.reply({ content: 'استخدمت إعادة الرمي بالفعل هذا الدور!', ephemeral: true });
      session.rerollUsed = true;
      const main = rollMain();
      const mod = rollModifier();
      session.pending = main + mod;
      const embed = new EmbedBuilder()
        .setColor(mod >= 0 ? theme.colors.success : theme.colors.danger)
        .setTitle(`🔄 إعادة الرمي: ${main}  |  المُعدِّل: ${mod > 0 ? '+' + mod : mod}`)
        .setDescription(`**إجمالي هذا الدور: ${Math.max(0, main + mod)} نقطة**\n\nثبّت النقاط الآن (لا توجد إعادة أخرى).`);
      return interaction.update({
        embeds: [buildBoardEmbed(session), embed],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('dice_lock').setLabel('تثبيت ✅').setStyle(ButtonStyle.Success)
        )]
      });
    }
  }
};
