const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const theme = require('../utils/theme');
const { getGuildSettings } = require('../utils/bombSetting');
const { generateWordImage, generateBombWinnerImage, generateBombLobbyImage } = require('../utils/bombCanvas');

const WORDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/words.json'), 'utf8')
);

const sessions = new Map();

function normalize(word) {
  return word
    .trim()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function pickPuzzle(usedWords) {
  const pool = WORDS.filter((w) => !usedWords.has(w));
  const list = pool.length ? pool : WORDS;
  const word = list[Math.floor(Math.random() * list.length)];
  const norm = normalize(word);
  return { sourceWord: word, first: norm[0], last: norm[norm.length - 1] };
}

function isValidAnswer(answer, first, last) {
  const norm = normalize(answer);
  if (norm.length < 2) return false;
  return norm[0] === first && norm[norm.length - 1] === last;
}

function buildPassRow(session) {
  const others = session.players.filter((p) => !p.eliminated && p.id !== session.holderId);
  const row = new ActionRowBuilder();
  others.slice(0, 5).forEach((p) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bomb_pass_${p.id}`)
        .setLabel(p.tag)
        .setStyle(ButtonStyle.Secondary)
    );
  });
  return row;
}

// ──────────────────────────────────────────────────────────────────
//  إيقاف اللعبة من الخارج (تُستخدم من أمر /ايقاف-بومب)
// ──────────────────────────────────────────────────────────────────
function stopSession(channelId, reason = 'stopped_by_admin') {
  const session = sessions.get(channelId);
  if (!session) return null;

  // أوقف المُجمّع (collector) بدون أن يُعتبر "انفجار"
  if (session.collector && !session.collector.ended) {
    session.collector.stop(reason);
  }

  sessions.delete(channelId);
  return session;
}

// ──────────────────────────────────────────────────────────────────
//  رسم صورة الجولة
// ──────────────────────────────────────────────────────────────────
async function sendWordImage(channel, session) {
  const holder = session.players.find(p => p.id === session.holderId);
  if (!holder) return;

  const avatarUrl = holder.avatarURL
    || `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;

  let buf;
  try {
    buf = await generateWordImage({
      first: session.puzzle.first,
      last: session.puzzle.last,
      holderName: holder.tag,
      holderAvatarUrl: avatarUrl,
      round: session.round,
      roundSeconds: session.roundSeconds,
      bannerUrl: session.wordBannerUrl,
    });
  } catch (e) {
    console.error('خطأ في توليد صورة الكلمة:', e);
    // fallback: embed عادي
    return channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(theme.colors.danger)
          .setTitle(`💣 لعبة البومب — الجولة ${session.round}`)
          .setDescription(
            `**كلمة تبدأ بـ \`${session.puzzle.first}\` وتنتهي بـ \`${session.puzzle.last}\`**\n\n` +
            `🔥 القنبلة عند: <@${session.holderId}>\n` +
            `⏱️ الوقت: **${session.roundSeconds} ثانية**`
          )
      ]
    });
  }

  const att = new AttachmentBuilder(buf, { name: 'word.png' });
  return channel.send({ files: [att] });
}

// ──────────────────────────────────────────────────────────────────
//  الجولة الرئيسية
// ──────────────────────────────────────────────────────────────────
async function runRound(interaction, session) {
  // إن أوقفت اللعبة يدوياً أثناء التأخير بين الجولات، لا تبدأ جولة جديدة
  if (!sessions.has(session.channelId)) return;

  const alive = session.players.filter((p) => !p.eliminated);
  if (alive.length <= 1) return endGame(interaction, session, alive[0]);

  session.round += 1;
  session.roundSeconds = Math.max(15 - session.round, 6);
  session.puzzle = pickPuzzle(session.usedWords);
  if (!session.holderId || !alive.find((p) => p.id === session.holderId)) {
    session.holderId = alive[Math.floor(Math.random() * alive.length)].id;
  }

  const channel = await interaction.client.channels.fetch(session.channelId);

  // إرسال صورة الجولة
  const roundMsg = await sendWordImage(channel, session);
  session.roundMsgId = roundMsg?.id;

  const filter = (m) => m.author.id === session.holderId && !m.author.bot;
  const collector = channel.createMessageCollector({ filter, time: session.roundSeconds * 1000 });
  session.collector = collector;

  collector.on('collect', async (m) => {
    if (isValidAnswer(m.content, session.puzzle.first, session.puzzle.last)) {
      session.usedWords.add(session.puzzle.sourceWord);
      collector.stop('answered');
      await m.react('✅').catch(() => {});
      const stillAlive = session.players.filter((p) => !p.eliminated);
      if (stillAlive.length <= 1) return endGame(interaction, session, stillAlive[0]);
      const passRow = buildPassRow(session);
      if (passRow.components.length === 0) return runRound(interaction, session);
      await channel.send({
        content: `<@${m.author.id}> إجابتك صحيحة! 🎯 مرّر القنبلة إلى لاعب آخر:`,
        components: [passRow],
      });
    } else {
      await m.react('❌').catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'answered') return;
    // تم إيقاف اللعبة يدوياً من /ايقاف-بومب — لا تعلن انفجار ولا تبدأ جولة جديدة
    if (reason === 'stopped_by_admin') return;

    const loser = session.players.find((p) => p.id === session.holderId);
    if (loser) loser.eliminated = true;
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(theme.colors.danger)
          .setTitle('💥 انفجرت القنبلة!')
          .setDescription(`<@${session.holderId}> خرج من اللعبة.`),
      ],
    });
    const stillAlive = session.players.filter((p) => !p.eliminated);
    if (stillAlive.length <= 1) return endGame(interaction, session, stillAlive[0]);
    session.holderId = stillAlive[Math.floor(Math.random() * stillAlive.length)].id;
    setTimeout(() => runRound(interaction, session), 2000);
  });
}

// ──────────────────────────────────────────────────────────────────
//  نهاية اللعبة
// ──────────────────────────────────────────────────────────────────
async function endGame(interaction, session, winner) {
  const channel = await interaction.client.channels.fetch(session.channelId);
  sessions.delete(session.channelId);

  if (!winner) {
    return channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(theme.colors.danger)
          .setTitle('💥 انتهت اللعبة!')
          .setDescription('لا يوجد فائز.'),
      ],
    });
  }

  // صورة الفائز
  const winnerPlayer = {
    displayName: winner.tag,
    username: winner.tag,
    avatarURL: winner.avatarURL || null,
  };

  let buf;
  try {
    buf = await generateBombWinnerImage(winnerPlayer, session.winnerBannerUrl);
  } catch (e) {
    console.error('خطأ في توليد صورة فائز البومب:', e);
  }

  if (buf) {
    const att = new AttachmentBuilder(buf, { name: 'winner.png' });
    await channel.send({
      content: `🏆 <@${winner.id}> فاز بلعبة البومب! 🎉`,
      files: [att],
    });
  } else {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(theme.colors.success)
          .setTitle(`${theme.emojis.trophy} انتهت اللعبة!`)
          .setDescription(winner ? `الفائز: <@${winner.id}> 🎉` : 'لا يوجد فائز.'),
      ],
    });
  }
}

// ──────────────────────────────────────────────────────────────────
//  الأمر الرئيسي
// ──────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('بومب')
    .setDescription('💣 ابدأ لعبة تمرير القنبلة'),

  async execute(interaction) {
    const channelId = interaction.channelId;
    if (sessions.has(channelId)) {
      return interaction.reply({ content: '⚠️ فيه لعبة بومب شغالة بهذي القناة حالياً.', ephemeral: true });
    }

    // جلب إعدادات السيرفر
    const settings = getGuildSettings(interaction.guildId);

    const session = {
      channelId,
      guildId: interaction.guildId,
      host: interaction.user.id,
      players: [],
      usedWords: new Set(),
      started: false,
      round: 0,
      // بانرات
      lobbyBannerUrl:  settings.lobbyBannerUrl,
      winnerBannerUrl: settings.winnerBannerUrl,
      wordBannerUrl:   settings.wordBannerUrl,
    };
    sessions.set(channelId, session);

    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bomb_join').setLabel('انضمام للعبة').setEmoji('💣').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bomb_start').setLabel('ابدأ اللعبة').setEmoji('▶️').setStyle(ButtonStyle.Success)
    );

    // اللوبي - بانر مخصص أو صورة افتراضية
    let lobbyBuf;
    try {
      lobbyBuf = await generateBombLobbyImage(settings.lobbyBannerUrl);
    } catch (e) {}

    if (lobbyBuf) {
      const att = new AttachmentBuilder(lobbyBuf, { name: 'lobby.png' });
      await interaction.reply({ files: [att], components: [joinRow] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(theme.colors.primary)
        .setTitle(`${theme.emojis.bomb} استعد لتمرير القنبلة!`)
        .setDescription('اضغط **انضمام للعبة** للمشاركة.\nمنشئ اللعبة يضغط **ابدأ اللعبة** (٢ لاعبين فأكثر).')
        .addFields({ name: 'اللاعبون المنضمون (0)', value: 'لا يوجد بعد' });
      await interaction.reply({ embeds: [embed], components: [joinRow] });
    }

    // تخزين معرف رسالة اللوبي لتعديلها عند الانضمام/الخروج
    const msg = await interaction.fetchReply();
    session.lobbyMsgId = msg.id;
    sessions.set(channelId, session);
  },

  async handleButton(interaction) {
    const id = interaction.customId;
    const session = sessions.get(interaction.channelId);

    // ── انضمام ──
    if (id === 'bomb_join') {
      if (!session || session.started) return interaction.reply({ content: 'لا يمكن الانضمام الآن.', ephemeral: true });
      if (session.players.find((p) => p.id === interaction.user.id)) {
        return interaction.reply({ content: 'أنت منضم بالفعل!', ephemeral: true });
      }

      // حفظ الأفاتار مع اللاعب
      const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
      session.players.push({ id: interaction.user.id, tag: interaction.user.username, eliminated: false, avatarURL: avatarUrl });

      const playerList = session.players.map(p => `<@${p.id}>`).join('\n');
      await interaction.reply({ content: `✅ **${interaction.user.username}** انضم! (${session.players.length} لاعب)` });
      return;
    }

    // ── بدء اللعبة ──
    if (id === 'bomb_start') {
      if (!session) return;
      if (interaction.user.id !== session.host) {
        return interaction.reply({ content: 'فقط من بدأ الجلسة يقدر يبدأ اللعبة.', ephemeral: true });
      }
      if (session.players.length < 2) {
        return interaction.reply({ content: 'تحتاج لاعبين على الأقل (2) لبدء اللعبة.', ephemeral: true });
      }
      session.started = true;
      await interaction.update({ components: [] });
      return runRound(interaction, session);
    }

    // ── تمرير القنبلة ──
    if (id.startsWith('bomb_pass_')) {
      if (!session) return;
      const targetId = id.replace('bomb_pass_', '');
      if (interaction.user.id !== session.holderId) {
        return interaction.reply({ content: 'ما عندك القنبلة عشان تمررها!', ephemeral: true });
      }
      session.holderId = targetId;
      await interaction.update({ content: `تم تمرير القنبلة إلى <@${targetId}> 💣`, components: [] });
      setTimeout(() => runRound(interaction, session), 1500);
    }
  },

  // مُصدّرة عشان أمر /ايقاف-بومب يقدر يصل لها
  sessions,
  stopSession,
};
