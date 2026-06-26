const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { getUser, saveUser, getSession, setSession, deleteSession } = require('../utils/db');
const { generateWheelImage, generateSmoothAngles, generateBannerImage, getFrameDelays } = require('../utils/wheelCanvas');
const { getGuildSettings, getThemeColors } = require('../utils/rouletteSettings');

const JOIN_TIME = 30;
const BET_DEFAULT = 50;
const SPIN_STEPS = 36;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('روليت')
    .setDescription('🎰 العب روليت الحظ الجماعي!')
    .addIntegerOption(o =>
      o.setName('رهان').setDescription('النقاط للرهان (افتراضي 50)').setMinValue(10).setMaxValue(1000).setRequired(false)
    ),

  async execute(interaction, client) {
    const channelId = interaction.channelId;
    if (getSession(channelId)) return interaction.reply({ content: '⚠️ في لعبة روليت شغالة!', ephemeral: true });

    const bet = interaction.options.getInteger('رهان') || BET_DEFAULT;
    const hostUser = getUser(interaction.user.id, interaction.guildId);
    if (hostUser.points < bet) return interaction.reply({ content: `❌ ما عندك نقاط كافية! عندك **${hostUser.points}**.`, ephemeral: true });

    const guildSettings = getGuildSettings(interaction.guildId);
    const colors = getThemeColors(guildSettings);

    const session = {
      hostId: interaction.user.id,
      guildId: interaction.guildId,
      channelId,
      bet,
      players: [],
      status: 'waiting',
      messageId: null,
      bannerMsgId: null,
      timeLeft: JOIN_TIME,
      colors,
    };

    session.players.push(buildPlayer(interaction));
    setSession(channelId, session);

    let bannerMsg;
    try {
      const bannerBuf = await generateBannerImage(guildSettings.bannerUrl);
      const bannerAtt = new AttachmentBuilder(bannerBuf, { name: 'banner.png' });
      const bannerEmbed = new EmbedBuilder()
        .setImage('attachment://banner.png')
        .setColor(0x020d1f);
      bannerMsg = await interaction.reply({
        embeds: [bannerEmbed],
        files: [bannerAtt],
        components: buildLobbyButtons(),
        fetchReply: true,
      });
      session.bannerMsgId = bannerMsg.id;
    } catch (e) {
      bannerMsg = await interaction.reply({
        content: '🎰 **روليت الحظ**',
        components: buildLobbyButtons(),
        fetchReply: true,
      });
      session.bannerMsgId = bannerMsg.id;
    }

    try {
      const wheelBuf = await generateWheelImage(session.players, null, 0, colors);
      const wheelAtt = new AttachmentBuilder(wheelBuf, { name: 'wheel.png' });
      const wheelMsg = await interaction.channel.send({
        content: buildStatusText(session, JOIN_TIME),
        files: [wheelAtt],
      });
      session.messageId = wheelMsg.id;
    } catch (e) {
      session.messageId = bannerMsg.id;
    }

    setSession(channelId, session);

    let timeLeft = JOIN_TIME;
    const timer = setInterval(async () => {
      timeLeft -= 5;
      const s = getSession(channelId);
      if (!s || s.status !== 'waiting') { clearInterval(timer); return; }
      s.timeLeft = timeLeft;
      setSession(channelId, s);

      if (timeLeft <= 0) {
        clearInterval(timer);
        if (s.players.length < 2) {
          deleteSession(channelId);
          try { const m = await interaction.channel.messages.fetch(s.messageId); await m.edit({ content: '❌ انتهى الوقت! ما انضم كافي لاعبين.', files: [] }); } catch (e) {}
          try { const bm = await interaction.channel.messages.fetch(s.bannerMsgId); await bm.edit({ components: [] }); } catch (e) {}
          return;
        }
        await startSpin(interaction.channel, s, channelId);
        return;
      }

      try {
        const current = getSession(channelId);
        const wheelBuf = await generateWheelImage(current.players, null, 0, current.colors);
        const wheelAtt = new AttachmentBuilder(wheelBuf, { name: 'wheel.png' });
        const m = await interaction.channel.messages.fetch(current.messageId);
        await m.edit({ content: buildStatusText(current, timeLeft), files: [wheelAtt] });
      } catch (e) {}
    }, 5000);
  },

  async handleButton(interaction, client) {
    const channelId = interaction.channelId;
    const session = getSession(channelId);

    if (interaction.customId === 'roulette_join') {
      if (!session || session.status !== 'waiting') return interaction.reply({ content: '⚠️ اللعبة مو في وقت الانضمام.', ephemeral: true });
      if (session.players.find(p => p.id === interaction.user.id)) return interaction.reply({ content: '✅ أنت منضم!', ephemeral: true });
      if (session.players.length >= 10) return interaction.reply({ content: '❌ اكتملت اللعبة.', ephemeral: true });
      const user = getUser(interaction.user.id, interaction.guildId);
      if (user.points < session.bet) return interaction.reply({ content: `❌ تحتاج **${session.bet}** نقطة للدخول.`, ephemeral: true });
      session.players.push(buildPlayer(interaction));
      setSession(channelId, session);
      try {
        const wheelBuf = await generateWheelImage(session.players, null, 0, session.colors);
        const wheelAtt = new AttachmentBuilder(wheelBuf, { name: 'wheel.png' });
        const m = await interaction.channel.messages.fetch(session.messageId);
        await m.edit({ content: buildStatusText(session, session.timeLeft ?? JOIN_TIME), files: [wheelAtt] });
      } catch (e) {}
      return interaction.reply({ content: `✅ **${interaction.member?.displayName || interaction.user.displayName}** انضم! (${session.players.length} لاعب)`, ephemeral: false });
    }

    if (interaction.customId === 'roulette_leave') {
      if (!session || session.status !== 'waiting') return interaction.reply({ content: '⚠️ ما تقدر تخرج الحين.', ephemeral: true });
      if (session.hostId === interaction.user.id) return interaction.reply({ content: '❌ المنشئ ما يقدر يخرج.', ephemeral: true });
      const idx = session.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ أنت مو في اللعبة.', ephemeral: true });
      session.players.splice(idx, 1);
      setSession(channelId, session);
      return interaction.reply({ content: `👋 **${interaction.member?.displayName || interaction.user.displayName}** خرج.`, ephemeral: false });
    }

    if (interaction.customId === 'roulette_shop') {
      const shopCmd = client.commands.get('متجر');
      if (shopCmd) return shopCmd.execute(interaction);
    }

    if (interaction.customId === 'roulette_inventory') {
      const user = getUser(interaction.user.id, interaction.guildId);
      return interaction.reply({
        content: `🎒 **حقيبتك:**\n🛡️ حماية: **${user.activeShields || 0}**\n☢️ نيوك: **${user.activeNukes || 0}**\n💻 هيكر: **${user.activeHackers || 0}**\n💰 نقاط: **${user.points}**`,
        ephemeral: true,
      });
    }

    if (interaction.customId === 'roulette_spin') {
      if (!session || session.status !== 'waiting') return interaction.reply({ content: '⚠ اللعبة مو في حالة الانتظار.', ephemeral: true });
      if (session.hostId !== interaction.user.id) return interaction.reply({ content: '❌ فقط المنشئ يدير العجلة.', ephemeral: true });
      if (session.players.length < 2) return interaction.reply({ content: '❌ تحتاج لاعبين اثنين على الأقل!', ephemeral: true });
      await interaction.deferUpdate();
      await startSpin(interaction.channel, session, channelId);
    }
  },
};

function buildPlayer(interaction) {
  return {
    id: interaction.user.id,
    username: interaction.user.username,
    displayName: interaction.member?.displayName || interaction.user.displayName,
    avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
    discriminator: interaction.user.discriminator,
  };
}

function buildStatusText(session, timeLeft) {
  const playerList = session.players.map((p, i) => `\`${i + 1}\` **${p.displayName}**`).join(' • ');
  return `⏰ **${timeLeft} ثانية** للانضمام | 🪙 الرهان: **${session.bet} نقطة** | 👥 اللاعبون: ${playerList}`;
}

function buildLobbyButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('roulette_join').setLabel('دخول +').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('roulette_leave').setLabel('خروج -').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('roulette_spin').setLabel('دوّر الحين 🎰').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('roulette_shop').setLabel('المتجر 🛒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('roulette_inventory').setLabel('الحقيبة 🎒').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

async function startSpin(channel, session, channelId) {
  session.status = 'spinning';
  setSession(channelId, session);

  try {
    const bm = await channel.messages.fetch(session.bannerMsgId);
    await bm.edit({ components: [] });
  } catch (e) {}

  const winnerIdx = Math.floor(Math.random() * session.players.length);
  const winner = session.players[winnerIdx];
  const angles = generateSmoothAngles(winnerIdx, session.players.length, SPIN_STEPS);
  const delays = getFrameDelays(SPIN_STEPS);

  let spinMsg;
  try {
    const firstBuf = await generateWheelImage(session.players, null, angles[0], session.colors);
    const att = new AttachmentBuilder(firstBuf, { name: 'wheel.png' });
    spinMsg = await channel.send({ content: '🎰 **العجلة تدور...**', files: [att] });
  } catch (e) {
    deleteSession(channelId);
    return;
  }

  for (let i = 0; i < SPIN_STEPS; i++) {
    const isLast = i === SPIN_STEPS - 1;
    await new Promise(r => setTimeout(r, delays[i]));
    try {
      const buf = await generateWheelImage(session.players, isLast ? winnerIdx : null, angles[i], session.colors);
      const att = new AttachmentBuilder(buf, { name: 'wheel.png' });
      await spinMsg.edit({
        content: isLast
          ? `🏆 **وقفت على ${winner.displayName}!**`
          : i > SPIN_STEPS * 0.75
            ? '🎰 **تتباطأ...**'
            : '🎰 **العجلة تدور...**',
        files: [att],
      });
    } catch (e) {}
  }

  const pot = session.bet * session.players.length;
  for (const p of session.players) {
    const u = getUser(p.id, session.guildId);
    if (p.id === winner.id) {
      u.points += pot;
      u.wins = (u.wins || 0) + 1;
    } else {
      if (u.activeShields > 0) {
        u.activeShields -= 1;
      } else {
        u.points = Math.max(0, u.points - session.bet);
        u.losses = (u.losses || 0) + 1;
      }
    }
    saveUser(u);
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🏆 نتيجة الروليت')
    .setDescription(`## 🎉 فاز **${winner.displayName}**!\n💰 الجائزة: **${pot} نقطة**`)
    .addFields({
      name: '📊 النتائج',
      value: session.players.map(p => {
        const isWinner = p.id === winner.id;
        return `${isWinner ? '🥇' : '💸'} **${p.displayName}** ${isWinner ? `+${pot}` : `-${session.bet}`}`;
      }).join('\n'),
    })
    .setTimestamp();

  const shopRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_open').setLabel('المتجر 🛒').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [resultEmbed], components: [shopRow] });
  deleteSession(channelId);
}
