const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { getUser, saveUser, getSession, setSession, deleteSession } = require('../utils/db');
const { generateRoleCard, generateRoleCardCustom, generateResultImage } = require('../utils/mafiaCanvas');
const { getGuildSettings } = require('../utils/mafiaSetting');

const NIGHT_TIME = 30; // ثواني لكل دور ليلي
const VOTE_TIME = 45;  // ثواني للتصويت

const ROLES = ['مافيا', 'محقق', 'طبيب', 'مواطن'];

function assignRoles(count) {
  const roles = [];
  const mafiaCount = count >= 6 ? 2 : 1;
  for (let i = 0; i < mafiaCount; i++) roles.push('مافيا');
  roles.push('محقق');
  roles.push('طبيب');
  while (roles.length < count) roles.push('مواطن');
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}

function checkWin(session) {
  const alive = session.players.filter(p => p.alive);
  const mafiaAlive = alive.filter(p => p.role === 'مافيا').length;
  const citizensAlive = alive.filter(p => p.role !== 'مافيا').length;
  if (mafiaAlive === 0) return 'مواطنين';
  if (mafiaAlive >= citizensAlive) return 'مافيا';
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('مافيا')
    .setDescription('🕵️ العب لعبة المافيا الجماعية!'),

  async execute(interaction, client) {
    const channelId = interaction.channelId;

    if (getSession(`mafia_${channelId}`)) {
      return interaction.reply({ content: '⚠️ في لعبة مافيا شغالة بالفعل!', ephemeral: true });
    }

    // ── إعدادات السيرفر (البانرات المخصصة) ──
    const settings = getGuildSettings(interaction.guildId);

    const session = {
      hostId: interaction.user.id,
      guildId: interaction.guildId,
      channelId,
      players: [],
      status: 'waiting',
      phase: null,
      round: 0,
      nightKill: null,
      nightSave: null,
      nightInvestigate: null,
      votes: {},
      messageId: null,
      // ── بانرات مخصصة من /اعدادات-المافيا ──
      lobbyBannerUrl: settings.lobbyBannerUrl,
      winnerBannerUrl: settings.winnerBannerUrl,
      mafiaBannerUrl: settings.mafiaBannerUrl,
      doctorBannerUrl: settings.doctorBannerUrl,
      detectiveBannerUrl: settings.detectiveBannerUrl,
    };

    session.players.push(buildPlayer(interaction));
    setSession(`mafia_${channelId}`, session);

    const embed = buildLobbyEmbed(session);
    const rows = buildLobbyButtons();

    const msg = await interaction.reply({
      embeds: [embed],
      components: rows,
      fetchReply: true,
    });

    session.messageId = msg.id;
    setSession(`mafia_${channelId}`, session);
  },

  async handleButton(interaction, client) {
    const channelId = interaction.channelId;
    const session = getSession(`mafia_${channelId}`);
    const id = interaction.customId;

    if (id === 'mafia_join') {
      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '⚠️ اللعبة مو في وقت الانضمام.', ephemeral: true });
      }
      if (session.players.find(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '✅ أنت منضم!', ephemeral: true });
      }
      if (session.players.length >= 12) {
        return interaction.reply({ content: '❌ اكتمل اللاعبون (12 كحد أقصى).', ephemeral: true });
      }
      session.players.push(buildPlayer(interaction));
      setSession(`mafia_${channelId}`, session);

      try {
        const msg = await interaction.channel.messages.fetch(session.messageId);
        await msg.edit({ embeds: [buildLobbyEmbed(session)], components: buildLobbyButtons() });
      } catch (e) {}

      return interaction.reply({
        content: `✅ **${interaction.member?.displayName || interaction.user.displayName}** انضم! (${session.players.length} لاعب)`,
        ephemeral: false,
      });
    }

    if (id === 'mafia_leave') {
      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '⚠️ ما تقدر تخرج الحين.', ephemeral: true });
      }
      if (session.hostId === interaction.user.id) {
        return interaction.reply({ content: '❌ المنشئ ما يقدر يخرج.', ephemeral: true });
      }
      const idx = session.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ أنت مو في اللعبة.', ephemeral: true });
      session.players.splice(idx, 1);
      setSession(`mafia_${channelId}`, session);

      try {
        const msg = await interaction.channel.messages.fetch(session.messageId);
        await msg.edit({ embeds: [buildLobbyEmbed(session)], components: buildLobbyButtons() });
      } catch (e) {}

      return interaction.reply({
        content: `👋 **${interaction.member?.displayName || interaction.user.displayName}** خرج.`,
        ephemeral: false,
      });
    }

    if (id === 'mafia_start') {
      if (!session || session.status !== 'waiting') {
        return interaction.reply({ content: '⚠️ اللعبة بدأت بالفعل.', ephemeral: true });
      }
      if (session.hostId !== interaction.user.id) {
        return interaction.reply({ content: '❌ فقط المنشئ يقدر يبدأ.', ephemeral: true });
      }
      if (session.players.length < 4) {
        return interaction.reply({ content: '❌ تحتاج 4 لاعبين على الأقل!', ephemeral: true });
      }

      await interaction.deferUpdate();

      const roles = assignRoles(session.players.length);
      session.players.forEach((p, i) => { p.role = roles[i]; p.alive = true; });
      session.status = 'playing';
      session.phase = 'night';
      session.round = 1;
      setSession(`mafia_${channelId}`, session);

      await sendRoleCards(session, client, interaction.channel);
      await startNight(interaction.channel, session, channelId, client);
      return;
    }

    if (id.startsWith('mafia_vote_')) {
      if (!session || session.status !== 'playing' || session.phase !== 'day_vote') {
        return interaction.reply({ content: '⚠️ مو وقت التصويت الحين.', ephemeral: true });
      }
      const voter = session.players.find(p => p.id === interaction.user.id);
      if (!voter || !voter.alive) {
        return interaction.reply({ content: '❌ أنت خارج اللعبة.', ephemeral: true });
      }
      const targetId = id.replace('mafia_vote_', '');
      if (targetId === 'skip') {
        session.votes[interaction.user.id] = 'skip';
      } else {
        if (interaction.user.id === targetId) {
          return interaction.reply({ content: '❌ ما تقدر تصوت على نفسك!', ephemeral: true });
        }
        session.votes[interaction.user.id] = targetId;
      }
      setSession(`mafia_${channelId}`, session);

      const aliveCount = session.players.filter(p => p.alive).length;
      const votedCount = Object.keys(session.votes).length;

      await interaction.reply({
        content: `✅ تم تسجيل صوتك! (${votedCount}/${aliveCount} صوتوا)`,
        ephemeral: true,
      });

      if (votedCount >= aliveCount) {
        await resolveVote(interaction.channel, session, channelId, client);
      }
      return;
    }

    if (id.startsWith('mafia_night_kill_') || id.startsWith('mafia_night_save_') || id.startsWith('mafia_night_investigate_')) {
      await handleNightAction(interaction, session, channelId, client);
      return;
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
    role: null,
    alive: true,
  };
}

function buildLobbyEmbed(session) {
  const list = session.players.map((p, i) => `\`${i + 1}\` **${p.displayName}**`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(0x0a0f1e)
    .setTitle('🕵️ لعبة المافيا')
    .setDescription('**هل أنت مواطن بريء أم مافيا خفية؟**\n\nكل شخص يستلم دوره بالـ DM. المافيا تقتل بالليل، والمواطنون يصوتون بالنهار!')
    .addFields(
      { name: '👥 اللاعبون', value: list || 'لا يوجد', inline: false },
      { name: '⚙️ الحد الأدنى', value: '4 لاعبين', inline: true },
      { name: '👤 الحد الأقصى', value: '12 لاعب', inline: true },
    )
    .setFooter({ text: `${session.players.length}/12 لاعب • المنشئ يضغط "ابدأ" عند الجهوزية` })
    .setTimestamp();

  if (session.lobbyBannerUrl) {
    embed.setImage(session.lobbyBannerUrl);
  }

  return embed;
}

function buildLobbyButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mafia_join').setLabel('دخول').setEmoji('👤').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('mafia_leave').setLabel('خروج').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mafia_start').setLabel('ابدأ اللعبة').setEmoji('🕵️').setStyle(ButtonStyle.Success),
  )];
}

// خريطة سريعة: دور ← مفتاح البانر المخصص بالسيشن
const ROLE_SESSION_BANNER_KEY = {
  'مافيا': 'mafiaBannerUrl',
  'طبيب': 'doctorBannerUrl',
  'محقق': 'detectiveBannerUrl',
};

async function sendRoleCards(session, client, channel) {
  for (const player of session.players) {
    try {
      const member = await channel.guild.members.fetch(player.id);
      const avatarUrl = member.user.avatarURL({ size: 128, format: 'png' })
        || `https://cdn.discordapp.com/embed/avatars/0.png`;

      const bannerKey = ROLE_SESSION_BANNER_KEY[player.role];
      const customBanner = bannerKey ? session[bannerKey] : null;

      const cardBuf = customBanner
        ? await generateRoleCardCustom(customBanner, player.role, player.displayName, avatarUrl)
        : await generateRoleCard(player.role, player.displayName, avatarUrl);

      const attachment = new AttachmentBuilder(cardBuf, { name: 'role.png' });

      const roleDesc = {
        'مافيا': '🔴 أنت **مافيا**! تقدر تختار قتل شخص كل ليلة. لا تنكشف للمواطنين!',
        'محقق': '🔵 أنت **محقق**! كل ليلة تقدر تتحقق من هوية شخص واحد.',
        'طبيب': '💚 أنت **طبيب**! كل ليلة تقدر تحمي شخص واحد من القتل.',
        'مواطن': '⚪ أنت **مواطن**! ساعد في الكشف عن المافيا بالتصويت.',
      };

      await member.user.send({
        content: roleDesc[player.role] || '⚪ أنت مواطن.',
        files: [attachment],
      });
    } catch (e) {
      await channel.send({ content: `⚠️ ما قدرت أرسل الدور لـ **${player.displayName}** بالـ DM. تأكد إن الـ DM مفتوح.` });
    }
  }
}

async function startNight(channel, session, channelId, client) {
  session.phase = 'night';
  session.nightKill = null;
  session.nightSave = null;
  session.nightInvestigate = null;
  setSession(`mafia_${channelId}`, session);

  const embed = new EmbedBuilder()
    .setColor(0x050a14)
    .setTitle(`🌙 الليلة ${session.round}`)
    .setDescription('**الليل نزل...**\n\nكل شخص يؤدي دوره بصمت.\n\n🔴 **المافيا** تختار ضحيتها.\n💚 **الطبيب** يختار من يحمي.\n🔵 **المحقق** يتحقق من شخص.')
    .setFooter({ text: `لديكم ${NIGHT_TIME} ثانية` })
    .setTimestamp();

  const nightMsg = await channel.send({ embeds: [embed] });
  session.nightMessageId = nightMsg.id;
  setSession(`mafia_${channelId}`, session);

  await sendNightActionButtons(channel, session, client);

  setTimeout(async () => {
    const current = getSession(`mafia_${channelId}`);
    if (!current || current.phase !== 'night') return;
    await resolveNight(channel, current, channelId, client);
  }, NIGHT_TIME * 1000);
}

async function sendNightActionButtons(channel, session, client) {
  const alive = session.players.filter(p => p.alive);

  for (const player of session.players) {
    if (!player.alive) continue;
    if (!['مافيا', 'محقق', 'طبيب'].includes(player.role)) continue;

    try {
      const member = await channel.guild.members.fetch(player.id);
      const targets = alive.filter(p => p.id !== player.id);

      let actionPrefix, actionLabel, actionEmoji, actionStyle;
      if (player.role === 'مافيا') {
        actionPrefix = 'mafia_night_kill_';
        actionLabel = 'اقتل';
        actionEmoji = '🔫';
        actionStyle = ButtonStyle.Danger;
      } else if (player.role === 'طبيب') {
        actionPrefix = 'mafia_night_save_';
        actionLabel = 'احمِ';
        actionEmoji = '💉';
        actionStyle = ButtonStyle.Success;
      } else {
        actionPrefix = 'mafia_night_investigate_';
        actionLabel = 'تحقق';
        actionEmoji = '🔍';
        actionStyle = ButtonStyle.Primary;
      }

      const rows = [];
      let currentRow = new ActionRowBuilder();
      let count = 0;

      for (const t of targets.slice(0, 20)) {
        if (count === 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
          count = 0;
        }
        currentRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`${actionPrefix}${t.id}`)
            .setLabel(t.displayName.substring(0, 20))
            .setEmoji(actionEmoji)
            .setStyle(actionStyle)
        );
        count++;
      }
      if (count > 0) rows.push(currentRow);

      await member.user.send({
        content: `🌙 **دورك الآن!** اختار شخصاً لـ ${actionLabel}:`,
        components: rows.slice(0, 5),
      });
    } catch (e) {}
  }
}

async function handleNightAction(interaction, session, channelId, client) {
  if (!session || session.phase !== 'night') {
    return interaction.reply({ content: '⚠️ مو وقت الليل الحين.', ephemeral: true });
  }

  const player = session.players.find(p => p.id === interaction.user.id);
  if (!player || !player.alive) {
    return interaction.reply({ content: '❌ أنت خارج اللعبة.', ephemeral: true });
  }

  const id = interaction.customId;
  const channel = await interaction.client.channels.fetch(session.channelId).catch(() => null);

  if (id.startsWith('mafia_night_kill_')) {
    if (player.role !== 'مافيا') return interaction.reply({ content: '❌ أنت مو مافيا.', ephemeral: true });
    session.nightKill = id.replace('mafia_night_kill_', '');
    setSession(`mafia_${channelId}`, session);
    await interaction.reply({ content: '✅ تم تسجيل اختيارك.', ephemeral: true });

  } else if (id.startsWith('mafia_night_save_')) {
    if (player.role !== 'طبيب') return interaction.reply({ content: '❌ أنت مو طبيب.', ephemeral: true });
    session.nightSave = id.replace('mafia_night_save_', '');
    setSession(`mafia_${channelId}`, session);
    await interaction.reply({ content: '✅ تم تسجيل اختيارك.', ephemeral: true });

  } else if (id.startsWith('mafia_night_investigate_')) {
    if (player.role !== 'محقق') return interaction.reply({ content: '❌ أنت مو محقق.', ephemeral: true });
    const targetId = id.replace('mafia_night_investigate_', '');
    session.nightInvestigate = targetId;
    setSession(`mafia_${channelId}`, session);

    const target = session.players.find(p => p.id === targetId);
    const isMafia = target?.role === 'مافيا';
    await interaction.reply({
      content: `🔍 نتيجة التحقق في **${target?.displayName}**: ${isMafia ? '🔴 **مافيا!**' : '⚪ **مواطن.**'}`,
      ephemeral: true,
    });
  }

  const mafias = session.players.filter(p => p.alive && p.role === 'مافيا');
  const doctor = session.players.find(p => p.alive && p.role === 'طبيب');
  const detective = session.players.find(p => p.alive && p.role === 'محقق');

  const mafiaReady = session.nightKill !== null;
  const doctorReady = !doctor || session.nightSave !== null;
  const detectiveReady = !detective || session.nightInvestigate !== null;

  if (mafiaReady && doctorReady && detectiveReady && channel) {
    await resolveNight(channel, getSession(`mafia_${channelId}`), channelId, client);
  }
}

async function resolveNight(channel, session, channelId, client) {
  if (session.phase !== 'night') return;
  session.phase = 'resolving';
  setSession(`mafia_${channelId}`, session);

  let nightMsg = '';
  let killed = null;

  if (session.nightKill) {
    const target = session.players.find(p => p.id === session.nightKill);
    if (target && target.alive) {
      if (session.nightSave === session.nightKill) {
        nightMsg += `💉 حاولت المافيا تقتل **${target.displayName}** لكن الطبيب أنقذه!\n`;
      } else {
        target.alive = false;
        killed = target;
        nightMsg += `💀 تم قتل **${target.displayName}** على يد المافيا.\n`;
      }
    }
  } else {
    nightMsg += '🌙 مرّت الليلة بهدوء، لم يُقتل أحد.\n';
  }

  const winner = checkWin(session);
  if (winner) {
    await endGame(channel, session, channelId, winner);
    return;
  }

  session.phase = 'day';
  session.round++;
  session.votes = {};
  setSession(`mafia_${channelId}`, session);

  const alive = session.players.filter(p => p.alive);
  const aliveList = alive.map(p => `**${p.displayName}**`).join(' • ');

  const dayEmbed = new EmbedBuilder()
    .setColor(0x1a3a7a)
    .setTitle(`☀️ النهار ${session.round - 1}`)
    .setDescription(nightMsg + `\n**الأحياء (${alive.length}):** ${aliveList}\n\n**الكل يصوت لطرد شخص مشبوه!**`)
    .setFooter({ text: `${VOTE_TIME} ثانية للتصويت` })
    .setTimestamp();

  const rows = buildVoteButtons(alive);
  const voteMsg = await channel.send({ embeds: [dayEmbed], components: rows });
  session.voteMsgId = voteMsg.id;
  session.phase = 'day_vote';
  setSession(`mafia_${channelId}`, session);

  setTimeout(async () => {
    const current = getSession(`mafia_${channelId}`);
    if (!current || current.phase !== 'day_vote') return;
    await resolveVote(channel, current, channelId, client);
  }, VOTE_TIME * 1000);
}

function buildVoteButtons(alivePlayers) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;

  for (const p of alivePlayers) {
    if (count === 5) {
      rows.push(row);
      row = new ActionRowBuilder();
      count = 0;
    }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mafia_vote_${p.id}`)
        .setLabel(p.displayName.substring(0, 20))
        .setEmoji('👆')
        .setStyle(ButtonStyle.Secondary)
    );
    count++;
  }

  if (count === 5) { rows.push(row); row = new ActionRowBuilder(); }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('mafia_vote_skip')
      .setLabel('تخطي')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Primary)
  );
  rows.push(row);

  return rows.slice(0, 5);
}

async function resolveVote(channel, session, channelId, client) {
  if (session.phase !== 'day_vote') return;
  session.phase = 'resolving';
  setSession(`mafia_${channelId}`, session);

  const tally = {};
  for (const [voterId, targetId] of Object.entries(session.votes)) {
    if (targetId === 'skip') continue;
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  let ejected = null;
  let maxVotes = 0;
  for (const [targetId, count] of Object.entries(tally)) {
    if (count > maxVotes) { maxVotes = count; ejected = targetId; }
  }

  let msg = '';
  if (ejected && maxVotes > 0) {
    const target = session.players.find(p => p.id === ejected);
    if (target) {
      target.alive = false;
      msg = `🗳️ تم طرد **${target.displayName}** بـ ${maxVotes} صوت. وكان **${target.role}**.\n`;
    }
  } else {
    msg = '🗳️ لم يُطرد أحد (تعادل أو تخطي).\n';
  }

  const winner = checkWin(session);
  if (winner) {
    await endGame(channel, session, channelId, winner);
    return;
  }

  setSession(`mafia_${channelId}`, session);
  await channel.send({ content: msg });
  await startNight(channel, session, channelId, client);
}

async function endGame(channel, session, channelId, winnerTeam) {
  deleteSession(`mafia_${channelId}`);

  const mafia = session.players.filter(p => p.role === 'مافيا');
  const citizens = session.players.filter(p => p.role !== 'مافيا');
  const winners = winnerTeam === 'مافيا' ? mafia : citizens;
  const losers = winnerTeam === 'مافيا' ? citizens : mafia;

  for (const p of winners) {
    const u = getUser(p.id, session.guildId);
    u.points += 100;
    u.wins = (u.wins || 0) + 1;
    saveUser(u);
  }
  for (const p of losers) {
    const u = getUser(p.id, session.guildId);
    u.losses = (u.losses || 0) + 1;
    saveUser(u);
  }

  let resultBuf;
  try {
    const guild = channel.guild;
    const winnersWithAv = await Promise.all(winners.map(async p => {
      const m = await guild.members.fetch(p.id).catch(() => null);
      return m?.user || { displayName: p.displayName, username: p.username, avatarURL: () => null };
    }));
    const losersWithAv = await Promise.all(losers.map(async p => {
      const m = await guild.members.fetch(p.id).catch(() => null);
      return m?.user || { displayName: p.displayName, username: p.username, avatarURL: () => null };
    }));
    // بانر-الفائز من /اعدادات-المافيا يصير خلفية الصورة (نفس مقاس صورة الفائز بالروليت)
    resultBuf = await generateResultImage(winnersWithAv, losersWithAv, winnerTeam, session.winnerBannerUrl);
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(winnerTeam === 'مافيا' ? 0xc0102a : 0x1060c0)
    .setTitle(`🏆 انتهت اللعبة! فاز فريق ${winnerTeam}`)
    .addFields(
      { name: '🔴 المافيا', value: mafia.map(p => `**${p.displayName}**`).join('\n') || 'لا يوجد', inline: true },
      { name: '⚪ المواطنون', value: citizens.map(p => `**${p.displayName}** (${p.role})`).join('\n') || 'لا يوجد', inline: true },
    )
    .setFooter({ text: 'الفائزون حصلوا على 100 نقطة!' })
    .setTimestamp();

  const files = [];
  if (resultBuf) {
    const att = new AttachmentBuilder(resultBuf, { name: 'result.png' });
    embed.setImage('attachment://result.png');
    files.push(att);
  }

  await channel.send({ embeds: [embed], files });
}
