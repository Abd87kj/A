const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { getUser, saveUser, getSession, setSession, deleteSession } = require('../utils/db');
const { generateWheelImage, generateWinnerImage, generateBannerImage } = require('../utils/wheelCanvas');
const { getGuildSettings, getThemeColors, getWheelStyleConfig } = require('../utils/rouletteSettings');

const JOIN_TIME = 30;
const BET_DEFAULT = 50;
const GAMES_ROLE_NAME = 'Games';
const ELIMINATION_TIMEOUT = 30000;

const eliminationTimers = new Map();

function hasGamesRole(member) {
  return member?.roles?.cache?.some(
    r => r.name.toLowerCase() === GAMES_ROLE_NAME.toLowerCase()
  ) ?? false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('روليت')
    .setDescription('🎰 العب روليت الحظ الجماعي!')
    .addIntegerOption(o =>
      o.setName('رهان').setDescription('النقاط للرهان (افتراضي 50)').setMinValue(10).setMaxValue(1000).setRequired(false)
    ),

  async execute(interaction, client) {
    if (!hasGamesRole(interaction.member)) {
      return interaction.reply({
        content: `❌ تحتاج رتبة **${GAMES_ROLE_NAME}** لتشغيل اللعبة.\n💡 الانضمام للعبة مفتوح للجميع بعد ما تبدأ.`,
        ephemeral: true,
      });
    }

    const channelId = interaction.channelId;
    if (getSession(channelId)) return interaction.reply({ content: '⚠️ في لعبة روليت شغالة!', ephemeral: true });

    const bet = interaction.options.getInteger('رهان') || BET_DEFAULT;
    const hostUser = getUser(interaction.user.id, interaction.guildId);
    if (hostUser.points < bet) return interaction.reply({ content: `❌ ما عندك نقاط كافية! عندك **${hostUser.points}**.`, ephemeral: true });

    const guildSettings = getGuildSettings(interaction.guildId);
    const colors = getThemeColors(guildSettings);
    const styleConfig = getWheelStyleConfig(guildSettings);

    const session = {
      hostId: interaction.user.id,
      guildId: interaction.guildId,
      channelId,
      bet,
      players: [],
      eliminatedPlayers: [],
      status: 'waiting',
      messageId: null,
      bannerMsgId: null,
      timeLeft: JOIN_TIME,
      colors,
      spinConfig: {
        spinDuration: guildSettings.spinDuration,
        showNames: guildSettings.showNames,
        styleConfig,
      },
      currentSpinner: null,
      eliminationMessageId: null,
      winnerBannerUrl: guildSettings.winnerBannerUrl || null,
    };

    session.players.push(buildPlayer(interaction));
    setSession(channelId, session);

    let bannerMsg;
    try {
      if (guildSettings.bannerUrl) {
        bannerMsg = await interaction.reply({ content: guildSettings.bannerUrl, components: buildLobbyButtons(), fetchReply: true });
      } else {
        const bannerBuf = await generateBannerImage();
        const bannerAtt = new AttachmentBuilder(bannerBuf, { name: 'banner.png' });
        bannerMsg = await interaction.reply({ files: [bannerAtt], components: buildLobbyButtons(), fetchReply: true });
      }
      session.bannerMsgId = bannerMsg.id;
    } catch (e) {
      bannerMsg = await interaction.reply({ content: '🎰 **روليت الحظ**', components: buildLobbyButtons(), fetchReply: true });
      session.bannerMsgId = bannerMsg.id;
    }

    try {
      const statusMsg = await interaction.channel.send({ content: buildStatusText(session, JOIN_TIME) });
      session.messageId = statusMsg.id;
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
          try { const m = await interaction.channel.messages.fetch(s.messageId); await m.edit({ content: '❌ انتهى الوقت! ما انضم كافي لاعبين.' }); } catch (e) {}
          try { const bm = await interaction.channel.messages.fetch(s.bannerMsgId); await bm.edit({ components: [] }); } catch (e) {}
          return;
        }
        await startSpin(interaction.channel, s, channelId);
        return;
      }

      try {
        const current = getSession(channelId);
        const m = await interaction.channel.messages.fetch(current.messageId);
        await m.edit({ content: buildStatusText(current, timeLeft) });
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
      try { const m = await interaction.channel.messages.fetch(session.messageId); await m.edit({ content: buildStatusText(session, session.timeLeft ?? JOIN_TIME) }); } catch (e) {}
      return interaction.reply({ content: `✅ **${interaction.member?.displayName || interaction.user.displayName}** انضم! (${session.players.length} لاعب)`, ephemeral: false });
    }

    if (interaction.customId === 'roulette_leave') {
      if (!session || session.status !== 'waiting') return interaction.reply({ content: '⚠️ ما تقدر تخرج الحين.', ephemeral: true });
      if (session.hostId === interaction.user.id) return interaction.reply({ content: '❌ المنشئ ما يقدر يخرج.', ephemeral: true });
      const idx = session.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ أنت مو في اللعبة.', ephemeral: true });
      session.players.splice(idx, 1);
      setSession(channelId, session);
      try { const m = await interaction.channel.messages.fetch(session.messageId); await m.edit({ content: buildStatusText(session, session.timeLeft ?? JOIN_TIME) }); } catch (e) {}
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
      return;
    }

    // ── أزرار الطرد ──
    if (interaction.customId.startsWith('eliminate_')) {
      const s = getSession(channelId);
      if (!s || s.status !== 'elimination') {
        return interaction.reply({ content: '⚠️ مو وقت الطرد الحين.', ephemeral: true });
      }
      if (interaction.user.id !== s.currentSpinner?.id) {
        return interaction.reply({ content: '❌ مو دورك تختار!', ephemeral: true });
      }

      const targetId = interaction.customId.replace('eliminate_', '');
      const targetIdx = s.players.findIndex(p => p.id === targetId);
      if (targetIdx === -1) {
        return interaction.reply({ content: '⚠️ اللاعب مو موجود.', ephemeral: true });
      }

      const existingTimer = eliminationTimers.get(channelId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        eliminationTimers.delete(channelId);
      }

      const target = s.players[targetIdx];

      await interaction.deferUpdate();

      try {
        const elimMsg = await interaction.channel.messages.fetch(s.eliminationMessageId);
        await elimMsg.edit({ components: [] });
      } catch (e) {}

      await interaction.channel.send({
        content: `🎯 **${s.currentSpinner.displayName}** اختار طرد **${target.displayName}**!`,
      });

      await handleElimination(interaction.channel, s, channelId, target, targetIdx);
      return;
    }
  },
};

// ──────────────────────────────────────────────
//  مساعد
// ──────────────────────────────────────────────

function buildPlayer(interaction) {
  return {
    id: interaction.user.id,
    username: interaction.user.username,
    displayName: interaction.member?.displayName || interaction.user.displayName,
    avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
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

function buildEliminationButtons(players, spinnerId) {
  const targets = players.filter(p => p.id !== spinnerId);
  const rows = [];
  for (let i = 0; i < targets.length; i += 5) {
    const chunk = targets.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(
      chunk.map(p =>
        new ButtonBuilder()
          .setCustomId(`eliminate_${p.id}`)
          .setLabel(`❌ ${p.displayName}`)
          .setStyle(ButtonStyle.Danger)
      )
    );
    rows.push(row);
  }
  return rows;
}

// ──────────────────────────────────────────────
//  دوران العجلة - صورة واحدة فقط
// ──────────────────────────────────────────────

async function startSpin(channel, session, channelId) {
  session.status = 'spinning';
  setSession(channelId, session);

  // إزالة الأزرار
  try { const bm = await channel.messages.fetch(session.bannerMsgId); await bm.edit({ components: [] }); } catch (e) {}
  try { const sm = await channel.messages.fetch(session.messageId); await sm.delete(); } catch (e) {}

  const winnerIdx = Math.floor(Math.random() * session.players.length);
  const winner = session.players[winnerIdx];

  const waitMsg = await channel.send({ content: '🎰 **العجلة تدور...**' });

  const { generateSmoothAngles, getSpinSteps } = require('../utils/wheelCanvas');
  const STEPS = getSpinSteps(session.spinConfig?.spinDuration ?? 8);
  const angles = generateSmoothAngles(winnerIdx, session.players.length, STEPS);
  
  const sliceAngle = (Math.PI * 2) / session.players.length;
  const randomOffset = (Math.random() - 0.5) * sliceAngle * 0.6;
  const finalAngle = angles[angles.length - 1] + randomOffset;

  let wheelBuf;
  try {
    wheelBuf = await generateWheelImage(
      session.players,
      winnerIdx,
      finalAngle,
      session.colors,
      640,
      session.spinConfig?.showNames !== false,
      session.spinConfig?.styleConfig ?? {}
    );
  } catch (e) {
    console.error('خطأ في توليد صورة العجلة:', e);
    await waitMsg.delete().catch(() => {});
    deleteSession(channelId);
    return;
  }

  await waitMsg.delete().catch(() => {});

  const att = new AttachmentBuilder(wheelBuf, { name: 'wheel.png' });
  await channel.send({ files: [att] });

  await new Promise(r => setTimeout(r, 1500));

  if (session.players.length === 1) {
    await announceChampion(channel, session, channelId, winner);
    return;
  }

  // ── مرحلة الطرد ──
  session.status = 'elimination';
  session.currentSpinner = winner;
  setSession(channelId, session);

  const eliminationButtons = buildEliminationButtons(session.players, winner.id);

  const elimMsg = await channel.send({
    content: `🎯 **وقفت على ${winner.displayName}!**\n<@${winner.id}> اختر شخص تطرده خلال **30 ثانية**:`,
    components: eliminationButtons,
  });

  session.eliminationMessageId = elimMsg.id;
  setSession(channelId, session);

  const timer = setTimeout(async () => {
    eliminationTimers.delete(channelId);
    const current = getSession(channelId);
    if (!current || current.status !== 'elimination') return;

    const remaining = current.players.filter(p => p.id !== current.currentSpinner.id);
    if (remaining.length === 0) return;
    const randomTarget = remaining[Math.floor(Math.random() * remaining.length)];
    const randomIdx = current.players.findIndex(p => p.id === randomTarget.id);

    try { const m = await channel.messages.fetch(current.eliminationMessageId); await m.edit({ components: [] }); } catch (e) {}
    await channel.send({ content: `⏰ انتهى الوقت! تم اختيار **${randomTarget.displayName}** عشوائياً للطرد.` });
    await handleElimination(channel, current, channelId, randomTarget, randomIdx);
  }, ELIMINATION_TIMEOUT);

  eliminationTimers.set(channelId, timer);
}

// ──────────────────────────────────────────────
//  معالجة الطرد
// ──────────────────────────────────────────────

async function handleElimination(channel, session, channelId, target, targetIdx) {
  const existingTimer = eliminationTimers.get(channelId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    eliminationTimers.delete(channelId);
  }

  // فحص الدرع
  const targetUser = getUser(target.id, session.guildId);
  if (targetUser.activeShields > 0) {
    targetUser.activeShields -= 1;
    saveUser(targetUser);
    await channel.send({ content: `🛡️ **${target.displayName}** استخدم الدرع! نجا من الطرد هذه الجولة.` });

    session.status = 'waiting_next';
    session.currentSpinner = null;
    setSession(channelId, session);

    await new Promise(r => setTimeout(r, 2000));
    await continueGame(channel, session, channelId);
    return;
  }

  // طرد اللاعب
  targetUser.points = Math.max(0, targetUser.points - session.bet);
  targetUser.losses = (targetUser.losses || 0) + 1;
  saveUser(targetUser);

  session.eliminatedPlayers.push({ ...target, round: session.eliminatedPlayers.length + 1 });
  session.players.splice(targetIdx, 1);
  session.status = 'waiting_next';
  session.currentSpinner = null;
  setSession(channelId, session);

  await channel.send({
    content: `💸 **${target.displayName}** طُرد وخسر **${session.bet} نقطة!**\n👥 اللاعبون المتبقون: ${session.players.map(p => `**${p.displayName}**`).join(' • ')}`,
  });

  if (session.players.length === 1) {
    await new Promise(r => setTimeout(r, 2000));
    await announceChampion(channel, session, channelId, session.players[0]);
    return;
  }

  await new Promise(r => setTimeout(r, 3000));
  await continueGame(channel, session, channelId);
}

// ──────────────────────────────────────────────
//  جولة جديدة
// ──────────────────────────────────────────────

async function continueGame(channel, session, channelId) {
  const s = getSession(channelId);
  if (!s) return;

  await channel.send({
    content: `🎰 **جولة جديدة!** اللاعبون: ${s.players.map(p => `**${p.displayName}**`).join(' • ')}`,
  });

  await new Promise(r => setTimeout(r, 1500));
  await startSpin(channel, s, channelId);
}

// ──────────────────────────────────────────────
//  إعلان البطل مع صورة كبيرة
// ──────────────────────────────────────────────

async function announceChampion(channel, session, channelId, champion) {
  const totalPlayers = session.players.length + session.eliminatedPlayers.length;
  const pot = session.bet * totalPlayers;

  const champUser = getUser(champion.id, session.guildId);
  champUser.points += pot;
  champUser.wins = (champUser.wins || 0) + 1;
  saveUser(champUser);

  const eliminatedList = session.eliminatedPlayers.length > 0
    ? session.eliminatedPlayers.map((p, i) => `\`${i + 1}\` 💸 **${p.displayName}** -${session.bet}`).join('\n')
    : 'لا أحد';

  // ── صورة الفائز - البانر المخصص يصير الخلفية تلقائياً ──
  let winnerImageBuf;
  try {
    const { generateWinnerImage } = require('../utils/wheelCanvas');
    winnerImageBuf = await generateWinnerImage(champion, pot, session.bet, session.winnerBannerUrl);
  } catch (e) {
    console.error('خطأ في توليد صورة الفائز:', e);
  }

  if (winnerImageBuf) {
    const winnerAtt = new AttachmentBuilder(winnerImageBuf, { name: 'winner.png' });
    await channel.send({ files: [winnerAtt] });
  }

  // ── embed النتيجة ──
  const resultEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('👑 بطل الروليت!')
    .setDescription(`## 🎉 فاز **${champion.displayName}** بالجائزة الكاملة!\n💰 **${pot} نقطة**`)
    .setThumbnail(
      typeof champion.avatarURL === 'string' ? champion.avatarURL : null
    )
    .addFields(
      { name: '💸 المطرودون بالترتيب', value: eliminatedList },
      { name: '🏆 الفائز', value: `👑 **${champion.displayName}** +${pot}` },
    )
    .setTimestamp();

  const shopRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_open').setLabel('المتجر 🛒').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [resultEmbed], components: [shopRow] });
  deleteSession(channelId);
}
