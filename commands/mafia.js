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

const NIGHT_TIME = 60;   // وقت الليل الكلي (ثانية) — بعد ما ينتهي الكل أو ينتهي الوقت
const VOTE_TIME  = 45;

// ──────────────────────────────────────────────
//  توزيع الأدوار
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
//  فحص الفوز
// ──────────────────────────────────────────────
function checkWin(session) {
  const alive = session.players.filter(p => p.alive);
  const mafiaAlive    = alive.filter(p => p.role === 'مافيا').length;
  const citizensAlive = alive.filter(p => p.role !== 'مافيا').length;
  if (mafiaAlive === 0)             return 'مواطنين';
  if (mafiaAlive >= citizensAlive)  return 'مافيا';
  return null;
}

// ──────────────────────────────────────────────
//  خريطة بانر كل دور
// ──────────────────────────────────────────────
const ROLE_SESSION_BANNER_KEY = {
  'مافيا': 'mafiaBannerUrl',
  'طبيب':  'doctorBannerUrl',
  'محقق':  'detectiveBannerUrl',
};

// ──────────────────────────────────────────────
//  Module Exports
// ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('مافيا')
    .setDescription('🕵️ العب لعبة المافيا الجماعية!'),

  async execute(interaction, client) {
    const channelId = interaction.channelId;

    if (getSession(`mafia_${channelId}`)) {
      return interaction.reply({ content: '⚠️ في لعبة مافيا شغالة بالفعل!', ephemeral: true });
    }

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
      // الخطوة الحالية في الليل: 'mafia' → 'doctor' → 'detective' → done
      nightStep: null,
      // هل أرسلنا الأزرار لكل دور؟
      nightStepSent: { mafia: false, doctor: false, detective: false },
      // رسالة الخطوة الحالية (نعدّلها عند الانتهاء)
      nightStepMsgId: null,
      votes: {},
      messageId: null,
      voteMsgId: null,
      nightMessageId: null,
      lobbyBannerUrl:     settings.lobbyBannerUrl,
      winnerBannerUrl:    settings.winnerBannerUrl,
      mafiaBannerUrl:     settings.mafiaBannerUrl,
      doctorBannerUrl:    settings.doctorBannerUrl,
      detectiveBannerUrl: settings.detectiveBannerUrl,
    };

    session.players.push(buildPlayer(interaction));
    setSession(`mafia_${channelId}`, session);

    const embed = buildLobbyEmbed(session);
    const rows  = buildLobbyButtons();

    const msg = await interaction.reply({
      embeds: [embed],
      components: rows,
      fetchReply: true,
    });

    session.messageId = msg.id;
    setSession(`mafia_${channelId}`, session);
  },

  // ──────────────────────────────────────────────
  //  معالجة الأزرار
  // ──────────────────────────────────────────────
  async handleButton(interaction, client) {
    const channelId = interaction.channelId;
    const session   = getSession(`mafia_${channelId}`);
    const id        = interaction.customId;

    // ─── انضمام ───
    if (id === 'mafia_join') {
      if (!session || session.status !== 'waiting')
        return interaction.reply({ content: '⚠️ اللعبة مو في وقت الانضمام.', ephemeral: true });
      if (session.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: '✅ أنت منضم!', ephemeral: true });
      if (session.players.length >= 12)
        return interaction.reply({ content: '❌ اكتمل اللاعبون (12 كحد أقصى).', ephemeral: true });

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

    // ─── خروج ───
    if (id === 'mafia_leave') {
      if (!session || session.status !== 'waiting')
        return interaction.reply({ content: '⚠️ ما تقدر تخرج الحين.', ephemeral: true });
      if (session.hostId === interaction.user.id)
        return interaction.reply({ content: '❌ المنشئ ما يقدر يخرج.', ephemeral: true });

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

    // ─── بدء اللعبة ───
    if (id === 'mafia_start') {
      if (!session || session.status !== 'waiting')
        return interaction.reply({ content: '⚠️ اللعبة بدأت بالفعل.', ephemeral: true });
      if (session.hostId !== interaction.user.id)
        return interaction.reply({ content: '❌ فقط المنشئ يقدر يبدأ.', ephemeral: true });
      if (session.players.length < 4)
        return interaction.reply({ content: '❌ تحتاج 4 لاعبين على الأقل!', ephemeral: true });

      await interaction.deferUpdate();

      const roles = assignRoles(session.players.length);
      session.players.forEach((p, i) => { p.role = roles[i]; p.alive = true; });
      session.status = 'playing';
      session.phase  = 'sending_roles';
      session.round  = 1;
      setSession(`mafia_${channelId}`, session);

      // أرسل زر "اعرف دورك" للكل
      await sendRevealRoleButton(interaction.channel, session, channelId);
      return;
    }

    // ─── كشف الدور (ephemeral) ───
    if (id === 'mafia_reveal_role') {
      if (!session || session.status !== 'playing')
        return interaction.reply({ content: '⚠️ ما في لعبة شغالة.', ephemeral: true });

      const player = session.players.find(p => p.id === interaction.user.id);
      if (!player)
        return interaction.reply({ content: '❌ أنت مو في اللعبة.', ephemeral: true });

      // سجّل إن هذا الشخص شاف دوره
      if (!session.revealedPlayers) session.revealedPlayers = [];
      if (!session.revealedPlayers.includes(player.id)) {
        session.revealedPlayers.push(player.id);
        setSession(`mafia_${channelId}`, session);
      }

      try {
        const member = await interaction.guild.members.fetch(player.id);
        const avatarUrl = member.user.avatarURL({ size: 128, format: 'png' })
          || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const bannerKey   = ROLE_SESSION_BANNER_KEY[player.role];
        const customBanner = bannerKey ? session[bannerKey] : null;

        const cardBuf = customBanner
          ? await generateRoleCardCustom(customBanner, player.role, player.displayName, avatarUrl)
          : await generateRoleCard(player.role, player.displayName, avatarUrl);

        const attachment = new AttachmentBuilder(cardBuf, { name: 'role.png' });

        const roleDesc = {
          'مافيا': '🔴 أنت **مافيا**! ستختار ضحيتك الليلة.',
          'محقق':  '🔵 أنت **محقق**! ستتحقق من هوية شخص الليلة.',
          'طبيب':  '💚 أنت **طبيب**! ستحمي شخصاً من القتل الليلة.',
          'مواطن': '⚪ أنت **مواطن**! ساعد في الكشف عن المافيا بالتصويت.',
        };

        await interaction.reply({
          content: roleDesc[player.role] || '⚪ أنت مواطن.',
          files: [attachment],
          ephemeral: true,
        });
      } catch (e) {
        await interaction.reply({ content: '⚠️ صار خطأ أثناء تحميل بطاقتك.', ephemeral: true });
      }

      // تحقق هل الكل شافوا أدوارهم
      const fresh = getSession(`mafia_${channelId}`);
      if (!fresh) return;

      const totalPlayers   = fresh.players.length;
      const revealedCount  = (fresh.revealedPlayers || []).length;

      if (revealedCount >= totalPlayers && fresh.phase === 'sending_roles') {
        fresh.phase = 'night';
        setSession(`mafia_${channelId}`, fresh);

        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (channel) await startNight(channel, fresh, channelId, client);
      }
      return;
    }

    // ─── أزرار الليل ───
    if (
      id.startsWith('mafia_night_kill_') ||
      id.startsWith('mafia_night_save_') ||
      id.startsWith('mafia_night_investigate_')
    ) {
      await handleNightAction(interaction, session, channelId, client);
      return;
    }

    // ─── أزرار التصويت ───
    if (id.startsWith('mafia_vote_')) {
      if (!session || session.status !== 'playing' || session.phase !== 'day_vote')
        return interaction.reply({ content: '⚠️ مو وقت التصويت الحين.', ephemeral: true });

      const voter = session.players.find(p => p.id === interaction.user.id);
      if (!voter || !voter.alive)
        return interaction.reply({ content: '❌ أنت خارج اللعبة.', ephemeral: true });

      const targetId = id.replace('mafia_vote_', '');
      if (targetId !== 'skip' && interaction.user.id === targetId)
        return interaction.reply({ content: '❌ ما تقدر تصوت على نفسك!', ephemeral: true });

      session.votes[interaction.user.id] = targetId;
      setSession(`mafia_${channelId}`, session);

      const aliveCount = session.players.filter(p => p.alive).length;
      const votedCount = Object.keys(session.votes).length;

      await interaction.reply({
        content: `✅ تم تسجيل صوتك! (${votedCount}/${aliveCount} صوتوا)`,
        ephemeral: true,
      });

      if (votedCount >= aliveCount) {
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (channel) await resolveVote(channel, session, channelId, client);
      }
      return;
    }
  },
};

// ══════════════════════════════════════════════
//  مساعدات البناء
// ══════════════════════════════════════════════

function buildPlayer(interaction) {
  return {
    id: interaction.user.id,
    username: interaction.user.username,
    displayName: interaction.member?.displayName || interaction.user.displayName,
    avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
    role: null,
    alive: true,
  };
}

function buildLobbyEmbed(session) {
  const list = session.players.map((p, i) => `\`${i + 1}\` **${p.displayName}**`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(0x0a0f1e)
    .setTitle('🕵️ لعبة المافيا')
    .setDescription('**هل أنت مواطن بريء أم مافيا خفية؟**\n\nكل شخص يستلم دوره. المافيا تقتل بالليل، المواطنون يصوتون بالنهار!')
    .addFields(
      { name: '👥 اللاعبون',   value: list || 'لا يوجد', inline: false },
      { name: '⚙️ الحد الأدنى', value: '4 لاعبين',       inline: true  },
      { name: '👤 الحد الأقصى', value: '12 لاعب',        inline: true  },
    )
    .setFooter({ text: `${session.players.length}/12 لاعب • المنشئ يضغط "ابدأ" عند الجهوزية` })
    .setTimestamp();

  if (session.lobbyBannerUrl) embed.setImage(session.lobbyBannerUrl);
  return embed;
}

function buildLobbyButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mafia_join' ).setLabel('دخول'      ).setEmoji('👤').setStyle(ButtonStyle.Primary  ),
    new ButtonBuilder().setCustomId('mafia_leave').setLabel('خروج'      ).setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mafia_start').setLabel('ابدأ اللعبة').setEmoji('🕵️').setStyle(ButtonStyle.Success  ),
  )];
}

// ══════════════════════════════════════════════
//  زر "اعرف دورك"
// ══════════════════════════════════════════════
async function sendRevealRoleButton(channel, session, channelId) {
  const playerList = session.players.map(p => `• **${p.displayName}**`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x1a0a2e)
    .setTitle('🎴 تم توزيع الأدوار!')
    .setDescription(
      `**اللاعبون (${session.players.length}):**\n${playerList}\n\n` +
      '⬇️ اضغط الزر أدناه لتعرف دورك — **بس أنت تشوفه، ما أحد غيرك يشوفه!**\n\n' +
      '⏳ بعد ما الكل يشوف دوره، تبدأ الليلة الأولى.'
    )
    .setFooter({ text: 'كل شخص يضغط الزر مره وحده' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mafia_reveal_role')
      .setLabel('اعرف دورك 🎴')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ══════════════════════════════════════════════
//  بداية الليل
// ══════════════════════════════════════════════
async function startNight(channel, session, channelId, client) {
  session.phase          = 'night';
  session.nightKill      = null;
  session.nightSave      = null;
  session.nightInvestigate = null;
  session.nightStep      = null;
  session.nightStepMsgId = null;
  session.nightStepSent  = { mafia: false, doctor: false, detective: false };
  setSession(`mafia_${channelId}`, session);

  // إعلان بداية الليل
  const embed = new EmbedBuilder()
    .setColor(0x050a14)
    .setTitle(`🌙 الليلة ${session.round}`)
    .setDescription(
      '**الليل نزل...**\n\n' +
      '🔴 **المافيا** ستختار ضحيتها أولاً.\n' +
      '💚 ثم **الطبيب** يختار من يحمي.\n' +
      '🔵 ثم **المحقق** يتحقق من شخص.\n\n' +
      '⏳ انتظروا دوركم...'
    )
    .setTimestamp();

  if (session.mafiaBannerUrl) embed.setImage(session.mafiaBannerUrl);
  await channel.send({ embeds: [embed] });

  // ابدأ بخطوة المافيا
  await startNightStep(channel, session, channelId, 'mafia', client);
}

// ══════════════════════════════════════════════
//  خطوة الليل — تُرسل رسالة عامة مع زر يضغطه صاحب الدور
//  ولما يضغطه يجيه الأزرار ephemeral (بس هو يشوفها)
// ══════════════════════════════════════════════
async function startNightStep(channel, session, channelId, step, client) {
  // تحقق وجود الدور حي
  const alive = session.players.filter(p => p.alive);

  if (step === 'mafia') {
    const mafiaAlive = alive.filter(p => p.role === 'مافيا');
    if (!mafiaAlive.length) {
      // لا مافيا أحياء → انتقل للطبيب
      return await startNightStep(channel, session, channelId, 'doctor', client);
    }

    session.nightStep = 'mafia';
    setSession(`mafia_${channelId}`, session);

    const mentions = mafiaAlive.map(p => `<@${p.id}>`).join(' ');
    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🔴 دور المافيا')
      .setDescription(`${mentions}\n\n**اضغط الزر أدناه لاختيار ضحيتك — بس أنت تشوف الأزرار!**`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mafia_night_open_kill')
        .setLabel('اختر الضحية 🔫')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    session.nightStepMsgId = msg.id;
    setSession(`mafia_${channelId}`, session);

  } else if (step === 'doctor') {
    const doctorAlive = alive.find(p => p.role === 'طبيب');
    if (!doctorAlive) {
      session.nightSave = '__skip__';
      return await startNightStep(channel, session, channelId, 'detective', client);
    }

    session.nightStep = 'doctor';
    setSession(`mafia_${channelId}`, session);

    const embed = new EmbedBuilder()
      .setColor(0x006400)
      .setTitle('💚 دور الطبيب')
      .setDescription(`<@${doctorAlive.id}>\n\n**اضغط الزر أدناه لاختيار من تحمي — بس أنت تشوف الأزرار!**`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mafia_night_open_save')
        .setLabel('اختر من تحمي 💉')
        .setStyle(ButtonStyle.Success)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    session.nightStepMsgId = msg.id;
    setSession(`mafia_${channelId}`, session);

  } else if (step === 'detective') {
    const detectiveAlive = alive.find(p => p.role === 'محقق');
    if (!detectiveAlive) {
      session.nightInvestigate = '__skip__';
      return await resolveNight(channel, session, channelId, client);
    }

    session.nightStep = 'detective';
    setSession(`mafia_${channelId}`, session);

    const embed = new EmbedBuilder()
      .setColor(0x00008b)
      .setTitle('🔵 دور المحقق')
      .setDescription(`<@${detectiveAlive.id}>\n\n**اضغط الزر أدناه لاختيار من تتحقق منه — بس أنت تشوف الأزرار!**`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mafia_night_open_investigate')
        .setLabel('اختر من تتحقق منه 🔍')
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    session.nightStepMsgId = msg.id;
    setSession(`mafia_${channelId}`, session);
  }
}

// ══════════════════════════════════════════════
//  معالجة أفعال الليل
// ══════════════════════════════════════════════
async function handleNightAction(interaction, session, channelId, client) {
  if (!session || session.phase !== 'night')
    return interaction.reply({ content: '⚠️ مو وقت الليل الحين.', ephemeral: true });

  const player = session.players.find(p => p.id === interaction.user.id);
  if (!player || !player.alive)
    return interaction.reply({ content: '❌ أنت خارج اللعبة.', ephemeral: true });

  const id      = interaction.customId;
  const channel = await interaction.client.channels.fetch(session.channelId).catch(() => null);
  const alive   = session.players.filter(p => p.alive);

  // ── فتح أزرار القتل (ephemeral) ──
  if (id === 'mafia_night_open_kill') {
    if (player.role !== 'مافيا')
      return interaction.reply({ content: '❌ هذا الزر مو لك.', ephemeral: true });
    if (session.nightKill)
      return interaction.reply({ content: '✅ اخترت بالفعل! انتظر دور الطبيب.', ephemeral: true });

    const targets = alive.filter(p => p.role !== 'مافيا'); // المافيا ما تقتل بعض
    const rows    = buildTargetRows(targets, 'mafia_night_kill_', '🔫', ButtonStyle.Danger);

    return interaction.reply({
      content: '🔫 **اختر الضحية** — بس أنت تشوف هذي الأزرار:',
      components: rows.slice(0, 5),
      ephemeral: true,
    });
  }

  // ── فتح أزرار الحماية (ephemeral) ──
  if (id === 'mafia_night_open_save') {
    if (player.role !== 'طبيب')
      return interaction.reply({ content: '❌ هذا الزر مو لك.', ephemeral: true });
    if (session.nightSave)
      return interaction.reply({ content: '✅ اخترت بالفعل! انتظر دور المحقق.', ephemeral: true });

    const rows = buildTargetRows(alive, 'mafia_night_save_', '💉', ButtonStyle.Success);

    return interaction.reply({
      content: '💉 **اختر من تحمي** — بس أنت تشوف هذي الأزرار:',
      components: rows.slice(0, 5),
      ephemeral: true,
    });
  }

  // ── فتح أزرار التحقيق (ephemeral) ──
  if (id === 'mafia_night_open_investigate') {
    if (player.role !== 'محقق')
      return interaction.reply({ content: '❌ هذا الزر مو لك.', ephemeral: true });
    if (session.nightInvestigate)
      return interaction.reply({ content: '✅ اخترت بالفعل!', ephemeral: true });

    const targets = alive.filter(p => p.id !== player.id);
    const rows    = buildTargetRows(targets, 'mafia_night_investigate_', '🔍', ButtonStyle.Primary);

    return interaction.reply({
      content: '🔍 **اختر من تتحقق منه** — بس أنت تشوف هذي الأزرار:',
      components: rows.slice(0, 5),
      ephemeral: true,
    });
  }

  // ── تنفيذ القتل ──
  if (id.startsWith('mafia_night_kill_')) {
    if (player.role !== 'مافيا')
      return interaction.reply({ content: '❌ أنت مو مافيا.', ephemeral: true });
    if (session.nightKill)
      return interaction.reply({ content: '⚠️ اخترت بالفعل!', ephemeral: true });
    if (session.nightStep !== 'mafia')
      return interaction.reply({ content: '⚠️ مو دورك الحين.', ephemeral: true });

    session.nightKill = id.replace('mafia_night_kill_', '');
    setSession(`mafia_${channelId}`, session);

    const target = session.players.find(p => p.id === session.nightKill);

    // أعلن للكل إن المافيا اختارت (بدون ذكر الاسم)
    if (channel && session.nightStepMsgId) {
      try {
        const stepMsg = await channel.messages.fetch(session.nightStepMsgId);
        await stepMsg.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x8b0000)
            .setTitle('🔴 المافيا اختارت ✅')
            .setDescription('قامت المافيا باختيار ضحيتها. انتظروا...')
          ],
          components: [],
        });
      } catch (e) {}
    }

    await interaction.reply({
      content: `✅ تم اختيار **${target?.displayName}** للقتل. انتظر نتيجة الليلة.`,
      ephemeral: true,
    });

    // انتقل لدور الطبيب
    await startNightStep(channel, session, channelId, 'doctor', client);
    return;
  }

  // ── تنفيذ الحماية ──
  if (id.startsWith('mafia_night_save_')) {
    if (player.role !== 'طبيب')
      return interaction.reply({ content: '❌ أنت مو طبيب.', ephemeral: true });
    if (session.nightSave)
      return interaction.reply({ content: '⚠️ اخترت بالفعل!', ephemeral: true });
    if (session.nightStep !== 'doctor')
      return interaction.reply({ content: '⚠️ مو دورك الحين.', ephemeral: true });

    session.nightSave = id.replace('mafia_night_save_', '');
    setSession(`mafia_${channelId}`, session);

    const target = session.players.find(p => p.id === session.nightSave);

    // أعلن للكل إن الطبيب اختار (بدون ذكر الاسم)
    if (channel && session.nightStepMsgId) {
      try {
        const stepMsg = await channel.messages.fetch(session.nightStepMsgId);
        await stepMsg.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x006400)
            .setTitle('💚 الطبيب اختار ✅')
            .setDescription('قام الطبيب بحماية أحد اللاعبين. انتظروا...')
          ],
          components: [],
        });
      } catch (e) {}
    }

    await interaction.reply({
      content: `✅ تم اختيار حماية **${target?.displayName}**. انتظر نتيجة الليلة.`,
      ephemeral: true,
    });

    // انتقل لدور المحقق
    await startNightStep(channel, session, channelId, 'detective', client);
    return;
  }

  // ── تنفيذ التحقيق ──
  if (id.startsWith('mafia_night_investigate_')) {
    if (player.role !== 'محقق')
      return interaction.reply({ content: '❌ أنت مو محقق.', ephemeral: true });
    if (session.nightInvestigate)
      return interaction.reply({ content: '⚠️ اخترت بالفعل!', ephemeral: true });
    if (session.nightStep !== 'detective')
      return interaction.reply({ content: '⚠️ مو دورك الحين.', ephemeral: true });

    const targetId = id.replace('mafia_night_investigate_', '');
    session.nightInvestigate = targetId;
    setSession(`mafia_${channelId}`, session);

    const target  = session.players.find(p => p.id === targetId);
    const isMafia = target?.role === 'مافيا';
    const result  = isMafia ? '🔴 **مافيا!**' : '⚪ **مواطن/مواطنة (مو مافيا)**';

    // أعلن للكل إن المحقق اختار (بدون ذكر الاسم أو النتيجة)
    if (channel && session.nightStepMsgId) {
      try {
        const stepMsg = await channel.messages.fetch(session.nightStepMsgId);
        await stepMsg.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x00008b)
            .setTitle('🔵 المحقق انتهى ✅')
            .setDescription('قام المحقق بالتحقيق من أحد اللاعبين. سيتضح النتيجة عند حل الليلة.')
          ],
          components: [],
        });
      } catch (e) {}
    }

    // أرسل النتيجة للمحقق بس (ephemeral)
    await interaction.reply({
      content: `🔍 نتيجة التحقق في **${target?.displayName}**: ${result}`,
      ephemeral: true,
    });

    // حل الليل
    await resolveNight(channel, session, channelId, client);
    return;
  }
}

// ══════════════════════════════════════════════
//  بناء أزرار الأهداف
// ══════════════════════════════════════════════
function buildTargetRows(targets, prefix, emoji, style) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;

  for (const t of targets.slice(0, 20)) {
    if (count === 5) { rows.push(row); row = new ActionRowBuilder(); count = 0; }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}${t.id}`)
        .setLabel(t.displayName.substring(0, 20))
        .setEmoji(emoji)
        .setStyle(style)
    );
    count++;
  }
  if (count > 0) rows.push(row);
  return rows;
}

// ══════════════════════════════════════════════
//  حل الليل
// ══════════════════════════════════════════════
async function resolveNight(channel, session, channelId, client) {
  if (session.phase !== 'night') return;
  session.phase = 'resolving';
  setSession(`mafia_${channelId}`, session);

  let nightMsg = '';
  let killed = null;

  if (session.nightKill && session.nightKill !== '__skip__') {
    const target = session.players.find(p => p.id === session.nightKill);
    if (target && target.alive) {
      if (session.nightSave === session.nightKill) {
        nightMsg += `💉 **حاولت المافيا القتل، لكن الطبيب أنقذ أحد اللاعبين!**\n`;
      } else {
        target.alive = false;
        killed = target;
        nightMsg += `💀 **قامت المافيا بشطب عضو من اللعبة!**\n`;
      }
    }
  } else {
    nightMsg += '🌙 **مرّت الليلة بهدوء، لم يُشطب أحد.**\n';
  }

  // تأخير 2 ثانية للتشويق ثم الإعلان
  await new Promise(r => setTimeout(r, 2000));

  const winner = checkWin(session);
  if (winner) {
    await endGame(channel, session, channelId, winner);
    return;
  }

  session.phase = 'day';
  session.round++;
  session.votes = {};
  setSession(`mafia_${channelId}`, session);

  const alive     = session.players.filter(p => p.alive);
  const aliveList = alive.map(p => `**${p.displayName}**`).join(' • ');

  // أظهر من مات (لو مات أحد) بعد ما يبدأ النهار
  let killedText = '';
  if (killed) {
    killedText = `\n☠️ **اللي انشطب:** ${killed.displayName} — كان **${killed.role}**.\n`;
  }

  const dayEmbed = new EmbedBuilder()
    .setColor(0x1a3a7a)
    .setTitle(`☀️ النهار ${session.round - 1}`)
    .setDescription(
      nightMsg + killedText +
      `\n**الأحياء (${alive.length}):** ${aliveList}\n\n` +
      `**🗳️ الكل يصوت الآن لطرد شخص مشبوه!**\n⏳ ${VOTE_TIME} ثانية للتصويت`
    )
    .setFooter({ text: 'صوّتوا قبل انتهاء الوقت!' })
    .setTimestamp();

  const rows    = buildVoteButtons(alive);
  const voteMsg = await channel.send({ embeds: [dayEmbed], components: rows });
  session.voteMsgId = voteMsg.id;
  session.phase     = 'day_vote';
  setSession(`mafia_${channelId}`, session);

  setTimeout(async () => {
    const current = getSession(`mafia_${channelId}`);
    if (!current || current.phase !== 'day_vote') return;
    await resolveVote(channel, current, channelId, client);
  }, VOTE_TIME * 1000);
}

// ══════════════════════════════════════════════
//  أزرار التصويت
// ══════════════════════════════════════════════
function buildVoteButtons(alivePlayers) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;

  for (const p of alivePlayers) {
    if (count === 5) { rows.push(row); row = new ActionRowBuilder(); count = 0; }
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

// ══════════════════════════════════════════════
//  حل التصويت
// ══════════════════════════════════════════════
async function resolveVote(channel, session, channelId, client) {
  if (session.phase !== 'day_vote') return;
  session.phase = 'resolving';
  setSession(`mafia_${channelId}`, session);

  try {
    const voteMsg = await channel.messages.fetch(session.voteMsgId);
    await voteMsg.edit({ components: [] });
  } catch (e) {}

  const tally = {};
  for (const [, targetId] of Object.entries(session.votes)) {
    if (targetId === 'skip') continue;
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  let ejected  = null;
  let maxVotes = 0;
  for (const [targetId, count] of Object.entries(tally)) {
    if (count > maxVotes) { maxVotes = count; ejected = targetId; }
  }

  let msg = '';
  if (ejected && maxVotes > 0) {
    const target = session.players.find(p => p.id === ejected);
    if (target) {
      target.alive = false;
      msg = `🗳️ تم طرد **${target.displayName}** بـ ${maxVotes} صوت. كان **${target.role}**.\n`;
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

// ══════════════════════════════════════════════
//  نهاية اللعبة
// ══════════════════════════════════════════════
async function endGame(channel, session, channelId, winnerTeam) {
  deleteSession(`mafia_${channelId}`);

  const mafia    = session.players.filter(p => p.role === 'مافيا');
  const citizens = session.players.filter(p => p.role !== 'مافيا');
  const winners  = winnerTeam === 'مافيا' ? mafia : citizens;
  const losers   = winnerTeam === 'مافيا' ? citizens : mafia;

  for (const p of winners) {
    const u = getUser(p.id, session.guildId);
    u.points = (u.points || 0) + 100;
    u.wins   = (u.wins   || 0) + 1;
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
    resultBuf = await generateResultImage(winnersWithAv, losersWithAv, winnerTeam, session.winnerBannerUrl);
  } catch (e) {}

  const embed = new EmbedBuilder()
    .setColor(winnerTeam === 'مافيا' ? 0xc0102a : 0x1060c0)
    .setTitle(`🏆 انتهت اللعبة! فاز فريق ${winnerTeam}`)
    .addFields(
      { name: '🔴 المافيا',    value: mafia.map(p => `**${p.displayName}**`).join('\n')              || 'لا يوجد', inline: true },
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
