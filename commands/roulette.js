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

// ── خريطة الأزرار الخاصة ← عنصر الحقيبة المطلوب ──
const POWER_ITEM_MAP = {
  elim_random: { field: 'activeRandoms', name: '🎲 عشوائي' },
  elim_hacker: { field: 'activeHackers', name: '💻 تهكير' },
  elim_nuke:   { field: 'activeNukes',   name: '☢️ نيوك'   },
  elim_shield: { field: 'activeShields', name: '🛡️ حماية'  },
};

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
        content: `🎒 **حقيبتك:**\n🛡️ حماية: **${user.activeShields || 0}**\n🎯 قنص: **${user.activeSnipers || 0}**\n💻 تهكير: **${user.activeHackers || 0}**\n🎲 عشوائي: **${user.activeRandoms || 0}**\n☢️ نيوك: **${user.activeNukes || 0}**\n💰 نقاط: **${user.points}**`,
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

    // ── أزرار الطرد العادية ──
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

    // ── أزرار القوى الخاصة (عشوائي / تهكير / نيوك / حماية) ──
    if (POWER_ITEM_MAP[interaction.customId]) {
      const s = getSession(channelId);
      if (!s || s.status !== 'elimination') {
        return interaction.reply({ content: '⚠️ مو وقت الطرد الحين.', ephemeral: true });
      }
      if (interaction.user.id !== s.currentSpinner?.id) {
        return interaction.reply({ content: '❌ مو دورك تستخدم هذا!', ephemeral: true });
      }

      // ── فحص ملكية العنصر قبل أي تنفيذ ──
      const itemInfo = POWER_ITEM_MAP[interaction.customId];
      const user = getUser(interaction.user.id, s.guildId);
      if (!user[itemInfo.field] || user[itemInfo.field] < 1) {
        return interaction.reply({
          content: `❌ ما عندك **${itemInfo.name}**! اشترِه من المتجر 🛒 أول عشان تستخدمه.`,
          ephemeral: true,
        });
      }

      // ── خصم القطعة من الحقيبة ──
      user[itemInfo.field] -= 1;
      saveUser(user);

      const existingTimer = eliminationTimers.get(channelId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        eliminationTimers.delete(channelId);
      }

      await interaction.deferUpdate();
      try {
        const elimMsg = await interaction.channel.messages.fetch(s.eliminationMessageId);
        await elimMsg.edit({ components: [] });
      } catch (e) {}

      if (interaction.customId === 'elim_random') await handleRandomElimination(interaction.channel, s, channelId);
      else if (interaction.customId === 'elim_hacker') await handleHackerElimination(interaction.channel, s, channelId);
      else if (interaction.customId === 'elim_nuke') await handleNukeElimination(interaction.channel, s, channelId);
      else if (interaction.customId === 'elim_shield') await handleSelfShield(interaction.channel, s, channelId);
      return;
    }
  },

  // ── صدّر للاستخدام من المتجر ──
  buildEliminationButtonsPublic: buildEliminationButtons,
  announceChampionPublic: announceChampion,
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
          .setLabel(p.displayName)
          .setStyle(ButtonStyle.Secondary)
      )
    );
    rows.push(row);
  }

  // صف أزرار القوى الخاصة (تتطلب امتلاك القطعة من المتجر)
  const powerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('elim_random').setLabel('🎲 طرد عشوائي').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('elim_hacker').setLabel('💻 تهكير (طرد 2)').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('elim_nuke').setLabel('☢️ نيوك (طرد الكل)').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('elim_shield').setLabel('🛡️ حماية نفسي').setStyle(ButtonStyle.Secondary),
  );
  rows.push(powerRow);

  return rows;
}

// ──────────────────────────────────────────────
//  دوران العجلة
// ──────────────────────────────────────────────

async function startSpin(channel, session, channelId) {
  session.status = 'spinning';
  setSession(channelId, session);

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

  if (session.players.length === 2) {
    const loserIdx = winnerIdx === 0 ? 1 : 0;
    const loser = session.players[loserIdx];
    session.eliminatedPlayers.push({ ...loser, round: session.eliminatedPlayers.length + 1 });
    session.players = [winner];
    setSession(channelId, session);
    await channel.send({ content: `🏆 **وقفت العجلة على ${winner.displayName}!** فاز بالجولة الأخيرة 🎉` });
    await new Promise(r => setTimeout(r, 1500));
    await announceChampion(channel, session, channelId, winner);
    return;
  }

  // ── مرحلة الطرد ──
  session.status = 'elimination';
  session.currentSpinner = winner;
  setSession(channelId, session);

  const eliminationButtons = buildEliminationButtons(session.players, winner.id);

  const elimMsg = await channel.send({
    content: `🎯 **وقفت على ${winner.displayName}!**\n<@${winner.id}> اختر شخص تطرده أو استخدم إحدى القوى الخاصة (تحتاج تكون شاريها من المتجر 🛒) خلال **30 ثانية**:`,
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
//  معالجة الطرد العادي
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
  targetUser.losses = (targetUser.losses || 0) + 1;
  saveUser(targetUser);

  session.eliminatedPlayers.push({ ...target, round: session.eliminatedPlayers.length + 1 });
  session.players.splice(targetIdx, 1);
  session.status = 'waiting_next';
  session.currentSpinner = null;
  setSession(channelId, session);

  await channel.send({
    content: `💀 **${target.displayName}** طُرد من اللعبة!\n👥 اللاعبون المتبقون: ${session.players.map(p => `**${p.displayName}**`).join(' • ')}`,
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
//  زر: طرد عشوائي (يستهلك قطعة 🎲 عشوائي)
// ──────────────────────────────────────────────

async function handleRandomElimination(channel, session, channelId) {
  const remaining = session.players.filter(p => p.id !== session.currentSpinner.id);
  if (remaining.length === 0) return;
  const target = remaining[Math.floor(Math.random() * remaining.length)];
  const targetIdx = session.players.findIndex(p => p.id === target.id);
  await channel.send({ content: `🎲 **${session.currentSpinner.displayName}** استخدم قطعة الطرد العشوائي!` });
  await handleElimination(channel, session, channelId, target, targetIdx);
}

// ──────────────────────────────────────────────
//  زر: تهكير (يستهلك قطعة 💻 تهكير، يطرد لاعبين عشوائياً)
// ──────────────────────────────────────────────

async function handleHackerElimination(channel, session, channelId) {
  await channel.send({ content: `💻 **${session.currentSpinner.displayName}** استخدم قطعة التهكير! سيتم طرد لاعبين عشوائياً.` });

  for (let n = 0; n < 2; n++) {
    const s = getSession(channelId);
    if (!s) return;
    const remaining = s.players.filter(p => p.id !== s.currentSpinner?.id);
    if (remaining.length === 0) break;

    const target = remaining[Math.floor(Math.random() * remaining.length)];
    const targetIdx = s.players.findIndex(p => p.id === target.id);
    const targetUser = getUser(target.id, s.guildId);

    if (targetUser.activeShields > 0) {
      targetUser.activeShields -= 1;
      saveUser(targetUser);
      await channel.send({ content: `🛡️ **${target.displayName}** استخدم الدرع! نجا من التهكير.` });
      continue;
    }

    targetUser.losses = (targetUser.losses || 0) + 1;
    saveUser(targetUser);
    s.eliminatedPlayers.push({ ...target, round: s.eliminatedPlayers.length + 1 });
    s.players.splice(targetIdx, 1);
    setSession(channelId, s);

    await channel.send({ content: `💀 **${target.displayName}** طُرد بسبب التهكير!` });

    if (s.players.length === 1) {
      await announceChampion(channel, s, channelId, s.players[0]);
      return;
    }
  }

  const after = getSession(channelId);
  if (!after) return;
  after.status = 'waiting_next';
  after.currentSpinner = null;
  setSession(channelId, after);
  await new Promise(r => setTimeout(r, 1500));
  await continueGame(channel, after, channelId);
}

// ──────────────────────────────────────────────
//  زر: نيوك (يستهلك قطعة ☢️ نيوك، يطرد كل اللاعبين)
// ──────────────────────────────────────────────

async function handleNukeElimination(channel, session, channelId) {
  const spinner = session.currentSpinner;
  await channel.send({ content: `☢️ **${spinner.displayName}** استخدم قطعة النيوك! تم طرد جميع اللاعبين الآخرين دفعة واحدة!` });

  const others = session.players.filter(p => p.id !== spinner.id);
  const survivors = [];

  for (const p of others) {
    const u = getUser(p.id, session.guildId);
    if (u.activeShields > 0) {
      u.activeShields -= 1;
      saveUser(u);
      survivors.push(p);
      await channel.send({ content: `🛡️ **${p.displayName}** نجا من النيوك بالدرع!` });
    } else {
      u.losses = (u.losses || 0) + 1;
      saveUser(u);
      session.eliminatedPlayers.push({ ...p, round: session.eliminatedPlayers.length + 1 });
    }
  }

  session.players = [spinner, ...survivors];
  setSession(channelId, session);

  if (session.players.length === 1) {
    await announceChampion(channel, session, channelId, spinner);
    return;
  }

  session.status = 'waiting_next';
  session.currentSpinner = null;
  setSession(channelId, session);
  await new Promise(r => setTimeout(r, 1500));
  await continueGame(channel, session, channelId);
}

// ──────────────────────────────────────────────
//  زر: حماية نفسي (يستهلك قطعة 🛡️ حماية موجودة عندك مسبقاً)
// ──────────────────────────────────────────────

async function handleSelfShield(channel, session, channelId) {
  const spinner = session.currentSpinner;

  await channel.send({ content: `🛡️ **${spinner.displayName}** استخدم قطعة الحماية على نفسه! ما راح يُطرد أحد هذه الجولة.` });

  session.status = 'waiting_next';
  session.currentSpinner = null;
  setSession(channelId, session);
  await new Promise(r => setTimeout(r, 1500));
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
//  إعلان البطل
// ──────────────────────────────────────────────

async function announceChampion(channel, session, channelId, champion) {
  const totalPlayers = session.players.length + session.eliminatedPlayers.length;
  const pot = session.bet * totalPlayers;

  const champUser = getUser(champion.id, session.guildId);
  champUser.points += pot;
  champUser.wins = (champUser.wins || 0) + 1;
  saveUser(champUser);

  const eliminatedList = session.eliminatedPlayers.length > 0
    ? session.eliminatedPlayers.map((p, i) => `\`${i + 1}\` 💀 **${p.displayName}**`).join('\n')
    : 'لا أحد';

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

  const resultEmbed = new EmbedBuilder()
    .setColor(0x0a1f4e)
    .setTitle('👑 بطل الروليت!')
    .setDescription(`## 🎉 فاز **${champion.displayName}** بالجائزة الكاملة!\n💰 **${pot} نقطة**`)
    .setThumbnail(typeof champion.avatarURL === 'string' ? champion.avatarURL : null)
    .addFields(
      { name: '🚪 براا بس', value: eliminatedList },
      { name: '🏆 الفائز', value: `👑 **${champion.displayName}** +${pot}` },
    )
    .setTimestamp();

  const shopRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_open').setLabel('المتجر 🛒').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [resultEmbed], components: [shopRow] });
  deleteSession(channelId);
}

