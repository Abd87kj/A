const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { getUser, saveUser, addPoints, getSession, setSession, deleteSession } = require('../utils/db');
const { generateWheelImage } = require('../utils/wheelCanvas');

const JOIN_TIME = 30; // ثواني للانضمام
const BET_DEFAULT = 50; // نقاط افتراضية

module.exports = {
  data: new SlashCommandBuilder()
    .setName('روليت')
    .setDescription('🎰 العب روليت الحظ الجماعي!')
    .addIntegerOption(o =>
      o.setName('رهان')
        .setDescription('عدد النقاط للرهان (افتراضي: 50)')
        .setMinValue(10)
        .setMaxValue(1000)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const channelId = interaction.channelId;

    if (getSession(channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة روليت شغالة بالفعل في هذه القناة!', ephemeral: true });
    }

    const bet = interaction.options.getInteger('رهان') || BET_DEFAULT;
    const hostUser = getUser(interaction.user.id, interaction.guildId);

    if (hostUser.points < bet) {
      return interaction.reply({ content: `❌ ما عندك نقاط كافية! عندك **${hostUser.points}** نقطة فقط.`, ephemeral: true });
    }

    const session = {
      hostId: interaction.user.id,
      guildId: interaction.guildId,
      channelId,
      bet,
      players: [],
      status: 'waiting',
      messageId: null,
      startTime: Date.now(),
    };

    session.players.push({
      id: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.displayName,
      avatarURL: interaction.user.avatarURL,
      discriminator: interaction.user.discriminator,
    });

    setSession(channelId, session);

    const embed = buildWaitingEmbed(session, bet, JOIN_TIME);
    const rows = buildWaitingButtons();

    let wheelBuffer;
    try {
      wheelBuffer = await generateWheelImage(session.players, null, false, 0);
    } catch (e) {
      wheelBuffer = null;
    }

    let replyOptions = { embeds: [embed], components: rows };
    if (wheelBuffer) {
      const attachment = new AttachmentBuilder(wheelBuffer, { name: 'wheel.png' });
      replyOptions.files = [attachment];
      embed.setImage('attachment://wheel.png');
    }

    const msg = await interaction.reply({ ...replyOptions, fetchReply: true });
    session.messageId = msg.id;
    setSession(channelId, session);

    let timeLeft = JOIN_TIME;
    const timer = setInterval(async () => {
      timeLeft -= 5;
      const currentSession = getSession(channelId);
      if (!currentSession || currentSession.status !== 'waiting') {
        clearInterval(timer);
        return;
      }

      if (timeLeft <= 0) {
        clearInterval(timer);
        if (currentSession.players.length < 2) {
          deleteSession(channelId);
          try {
            await msg.edit({
              content: '❌ **انتهى الوقت!** ما انضم كافي لاعبين. تم إلغاء اللعبة.',
              embeds: [],
              components: [],
              files: [],
            });
          } catch (e) {}
          return;
        }
        await startSpin(msg, currentSession, channelId, client);
        return;
      }

      try {
        const updatedSession = getSession(channelId);
        if (!updatedSession) return;
        const updatedEmbed = buildWaitingEmbed(updatedSession, bet, timeLeft);
        let updateOptions = { embeds: [updatedEmbed], components: rows };

        if (wheelBuffer) {
          const attachment = new AttachmentBuilder(
            await generateWheelImage(updatedSession.players, null, false, 0),
            { name: 'wheel.png' }
          );
          updatedEmbed.setImage('attachment://wheel.png');
          updateOptions.files = [attachment];
        }

        await msg.edit(updateOptions);
      } catch (e) {}
    }, 5000);
  },

  async handleButton(interaction, client) {
    const channelId = interaction.channelId;
    const session = getSession(channelId);

    if (interaction.customId === 'roulette_join') {
      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '⚠️ اللعبة مو في وقت الانضمام.', ephemeral: true });
      }

      if (session.players.find(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '✅ أنت منضم بالفعل!', ephemeral: true });
      }

      if (session.players.length >= 10) {
        return interaction.reply({ content: '❌ اكتملت اللعبة (10 لاعبين).', ephemeral: true });
      }

      const user = getUser(interaction.user.id, interaction.guildId);
      if (user.points < session.bet) {
        return interaction.reply({ content: `❌ ما عندك نقاط كافية! تحتاج **${session.bet}** نقطة.`, ephemeral: true });
      }

      session.players.push({
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.displayName,
        avatarURL: interaction.user.avatarURL,
        discriminator: interaction.user.discriminator,
      });
      setSession(channelId, session);

      await interaction.reply({ content: `✅ **${interaction.member?.displayName || interaction.user.displayName}** انضم للعبة! (${session.players.length} لاعب)`, ephemeral: false });

    } else if (interaction.customId === 'roulette_leave') {
      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '⚠️ ما تقدر تخرج الحين.', ephemeral: true });
      }

      if (session.hostId === interaction.user.id) {
        return interaction.reply({ content: '❌ المنشئ ما يقدر يخرج. استخدم /إلغاء لإلغاء اللعبة.', ephemeral: true });
      }

      const idx = session.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) {
        return interaction.reply({ content: '⚠️ أنت مو في اللعبة.', ephemeral: true });
      }

      session.players.splice(idx, 1);
      setSession(channelId, session);
      await interaction.reply({ content: `👋 **${interaction.member?.displayName || interaction.user.displayName}** خرج من اللعبة.`, ephemeral: false });

    } else if (interaction.customId === 'roulette_spin') {
      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '⚠️ اللعبة مو في حالة الانتظار.', ephemeral: true });
      }

      if (session.hostId !== interaction.user.id) {
        return interaction.reply({ content: '❌ فقط من أنشأ اللعبة يقدر يدير العجلة.', ephemeral: true });
      }

      if (session.players.length < 2) {
        return interaction.reply({ content: '❌ تحتاج على الأقل لاعبين اثنين!', ephemeral: true });
      }

      await interaction.deferUpdate();

      try {
        const msg = await interaction.channel.messages.fetch(session.messageId);
        await startSpin(msg, session, channelId, client);
      } catch (e) {
        console.error(e);
      }
    }
  }
};

function buildWaitingEmbed(session, bet, timeLeft) {
  const playerList = session.players.map((p, i) =>
    `\`${i + 1}\` **${p.displayName || p.username}**`
  ).join('\n');

  return new EmbedBuilder()
    .setColor(0x0a1f5c)
    .setTitle('🎰 روليت الحظ')
    .setDescription('**دوّر العجلة وشوف من يفوز!**\n\nالعجلة تدور على اللاعبين، اللي تقف عليه يفوز بكل النقاط! 🏆')
    .addFields(
      { name: '⏰ الوقت المتبقي للانضمام', value: `**${timeLeft} ثانية**`, inline: true },
      { name: '🪙 الرهان', value: `**${bet} نقطة**`, inline: true },
      { name: '👥 اللاعبون', value: playerList || 'لا يوجد لاعبون', inline: false },
    )
    .setFooter({ text: `${session.players.length}/10 لاعبين • اضغط دخول للانضمام` })
    .setTimestamp();
}

function buildWaitingButtons() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('roulette_join')
      .setLabel('دخول')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('roulette_leave')
      .setLabel('خروج')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('roulette_spin')
      .setLabel('دوّر الحين')
      .setEmoji('🎰')
      .setStyle(ButtonStyle.Success),
  );
  return [row];
}

async function startSpin(msg, session, channelId, client) {
  session.status = 'spinning';
  setSession(channelId, session);

  const winnerIdx = Math.floor(Math.random() * session.players.length);
  const winner = session.players[winnerIdx];

  const totalRotations = (Math.PI * 2) * (5 + Math.random() * 3);
  const steps = 7;
  const finalAngle = totalRotations + (winnerIdx / session.players.length) * Math.PI * 2;

  let spinEmbed = new EmbedBuilder()
    .setColor(0x1a3a8c)
    .setTitle('🎰 العجلة تدور...')
    .setDescription('**انتظر النتيجة!** 🌀')
    .setFooter({ text: 'جاري التحديد...' });

  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentAngle = finalAngle * eased;

    try {
      const wheelBuf = await generateWheelImage(
        session.players,
        step === steps ? winnerIdx : null,
        true,
        currentAngle
      );
      const attachment = new AttachmentBuilder(wheelBuf, { name: 'wheel.png' });
      spinEmbed.setImage('attachment://wheel.png');

      if (step === steps) {
        spinEmbed
          .setTitle('🏆 وقفت العجلة!')
          .setDescription(`\n🎉 **الفائز: ${winner.displayName || winner.username}** 🎉\n`)
          .setColor(0xffd700);
      }

      await msg.edit({
        embeds: [spinEmbed],
        components: [],
        files: [attachment],
      });
    } catch (e) {
      console.error('Spin step error:', e);
    }

    if (step < steps) {
      await new Promise(r => setTimeout(r, step < 4 ? 400 : step < 6 ? 600 : 900));
    }
  }

  const totalPot = session.bet * session.players.length;

  for (const player of session.players) {
    if (player.id === winner.id) {
      const winnerUser = getUser(winner.id, session.guildId);
      const prize = totalPot;
      winnerUser.points += prize;
      winnerUser.wins += 1;
      saveUser(winnerUser);
    } else {
      const loserUser = getUser(player.id, session.guildId);
      if (loserUser.activeShields > 0) {
        loserUser.activeShields -= 1;
        saveUser(loserUser);
      } else {
        loserUser.points = Math.max(0, loserUser.points - session.bet);
        loserUser.losses += 1;
        saveUser(loserUser);
      }
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🏆 نتيجة الروليت')
    .setDescription(
      `## 🎉 فاز **${winner.displayName || winner.username}**!\n\n` +
      `💰 الجائزة: **${totalPot} نقطة**\n` +
      `👥 عدد اللاعبين: **${session.players.length}**`
    )
    .addFields({
      name: '📊 النتائج',
      value: session.players.map(p => {
        const isWinner = p.id === winner.id;
        const loserUser = getUser(p.id, session.guildId);
        const hadShield = !isWinner && loserUser.activeShields > 0;
        return `${isWinner ? '🥇' : hadShield ? '🛡️' : '💸'} **${p.displayName || p.username}** ${isWinner ? `+${totalPot}` : hadShield ? '(محمي)' : `-${session.bet}`} نقطة`;
      }).join('\n')
    })
    .setFooter({ text: 'للعب مجدداً اكتب /روليت' })
    .setTimestamp();

  const shopRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('shop_open')
      .setLabel('🛒 المتجر')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('roulette_playagain')
      .setLabel('🎰 العب مجدداً')
      .setStyle(ButtonStyle.Success),
  );

  try {
    await msg.channel.send({ embeds: [resultEmbed], components: [shopRow] });
  } catch (e) {}

  deleteSession(channelId);
}
