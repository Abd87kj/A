const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getUser, saveUser } = require('../utils/db');
const { getSession, setSession } = require('../utils/db');

const ITEMS = {
  shield: {
    id: 'shield',
    name: '🛡️ حماية',
    description: 'تحميك من الطرد في الروليت مرة واحدة',
    price: 150,
    emoji: '🛡️',
  },
  sniper: {
    id: 'sniper',
    name: '🎯 قنص',
    description: 'يطرد لاعب مباشرة من الروليت بدون عجلة',
    price: 350,
    emoji: '🎯',
  },
  hacker: {
    id: 'hacker',
    name: '💻 تهكير',
    description: 'تسرق دور الشخص اللي جاء دوره في الطرد وتختار أنت بدله',
    price: 250,
    emoji: '💻',
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('متجر')
    .setDescription('🛒 افتح المتجر واشتري آيتمات'),

  async execute(interaction) {
    const user = getUser(interaction.user.id, interaction.guildId);
    const embed = buildShopEmbed(user);
    const rows = buildShopButtons();
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  },

  async handleButton(interaction) {
    // ── فتح المتجر ──
    if (interaction.customId === 'shop_open') {
      const user = getUser(interaction.user.id, interaction.guildId);
      const embed = buildShopEmbed(user);
      const rows = buildShopButtons();
      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }

    // ── شراء آيتم ──
    if (interaction.customId.startsWith('shop_buy_')) {
      const itemId = interaction.customId.replace('shop_buy_', '');
      const item = ITEMS[itemId];
      if (!item) return interaction.reply({ content: '❌ آيتم غير موجود.', ephemeral: true });

      const user = getUser(interaction.user.id, interaction.guildId);
      if (user.points < item.price) {
        return interaction.reply({
          content: `❌ ما عندك نقاط كافية! تحتاج **${item.price}** نقطة، عندك **${user.points}**.`,
          ephemeral: true,
        });
      }

      user.points -= item.price;
      if (itemId === 'shield')  user.activeShields  = (user.activeShields  || 0) + 1;
      if (itemId === 'sniper')  user.activeSnipers  = (user.activeSnipers  || 0) + 1;
      if (itemId === 'hacker')  user.activeHackers  = (user.activeHackers  || 0) + 1;
      saveUser(user);

      return interaction.reply({
        content: `✅ اشتريت **${item.name}** بـ **${item.price}** نقطة!\nرصيدك الحالي: **${user.points}** نقطة`,
        ephemeral: true,
      });
    }

    // ── الحقيبة ──
    if (interaction.customId === 'shop_inventory') {
      const user = getUser(interaction.user.id, interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(0x0a1f5c)
        .setTitle('🎒 حقيبتك')
        .addFields(
          { name: '🛡️ حماية',  value: `${user.activeShields  || 0} قطعة`, inline: true },
          { name: '🎯 قنص',    value: `${user.activeSnipers  || 0} قطعة`, inline: true },
          { name: '💻 تهكير',  value: `${user.activeHackers  || 0} قطعة`, inline: true },
          { name: '💰 نقاطك',  value: `${user.points} نقطة`,              inline: false },
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── استخدام القنص ──
    if (interaction.customId === 'shop_use_sniper') {
      const user = getUser(interaction.user.id, interaction.guildId);
      if (!user.activeSnipers || user.activeSnipers < 1) {
        return interaction.reply({ content: '❌ ما عندك قنص!', ephemeral: true });
      }

      // لازم تكون في لعبة روليت شغالة
      const session = getSession(interaction.channelId);
      if (!session || !['waiting', 'elimination'].includes(session.status)) {
        return interaction.reply({ content: '❌ ما في لعبة روليت شغالة في هذه القناة!', ephemeral: true });
      }

      // لازم تكون في اللعبة
      if (!session.players.find(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '❌ أنت مو في هذي اللعبة!', ephemeral: true });
      }

      // خيارات الطرد - كل اللاعبين عدا نفسك
      const targets = session.players.filter(p => p.id !== interaction.user.id);
      if (targets.length === 0) {
        return interaction.reply({ content: '❌ ما في لاعبين تقدر تطرد!', ephemeral: true });
      }

      const options = targets.map(p => ({
        label: p.displayName.substring(0, 25),
        value: p.id,
        description: `اضغط لتطرد ${p.displayName}`,
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId('shop_select_sniper_target')
        .setPlaceholder('اختار اللاعب اللي تبي تطرده')
        .addOptions(options);

      return interaction.reply({
        content: '🎯 **اختار هدف القنص — سيُطرد فوراً من اللعبة:**',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }

    // ── استخدام التهكير ──
    if (interaction.customId === 'shop_use_hacker') {
      const user = getUser(interaction.user.id, interaction.guildId);
      if (!user.activeHackers || user.activeHackers < 1) {
        return interaction.reply({ content: '❌ ما عندك تهكير!', ephemeral: true });
      }

      const session = getSession(interaction.channelId);
      if (!session || session.status !== 'elimination') {
        return interaction.reply({
          content: '❌ التهكير يشتغل فقط لما تكون هناك جولة طرد شغالة الحين!',
          ephemeral: true,
        });
      }

      // لازم تكون في اللعبة
      if (!session.players.find(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '❌ أنت مو في هذي اللعبة!', ephemeral: true });
      }

      // ما تقدر تهكر نفسك
      if (session.currentSpinner?.id === interaction.user.id) {
        return interaction.reply({ content: '❌ أنت اللي عليك الدور، ما تحتاج تهكر!', ephemeral: true });
      }

      // سرقة الدور من currentSpinner
      const originalSpinner = session.currentSpinner;
      session.currentSpinner = {
        id: interaction.user.id,
        displayName: interaction.member?.displayName || interaction.user.displayName,
      };
      session.status = 'elimination';
      setSession(interaction.channelId, session);

      user.activeHackers -= 1;
      saveUser(user);

      // إشعار علني في القناة
      await interaction.channel.send({
        content: `💻 **تهكير!** **${interaction.member?.displayName || interaction.user.displayName}** سرق دور **${originalSpinner?.displayName || 'اللاعب'}** في الطرد!\n**${interaction.member?.displayName || interaction.user.displayName}** يختار الآن من يُطرد!`,
      });

      // تعديل رسالة أزرار الطرد لو موجودة
      try {
        const elimMsg = await interaction.channel.messages.fetch(session.eliminationMessageId);
        // إعادة بناء الأزرار بالـ spinner الجديد
        const { buildEliminationButtonsPublic } = require('./روليت');
        if (buildEliminationButtonsPublic) {
          const newButtons = buildEliminationButtonsPublic(session.players, interaction.user.id);
          await elimMsg.edit({
            content: `🎯 **دور ${session.currentSpinner.displayName} (بالتهكير)**\n<@${interaction.user.id}> اختر شخص تطرده:`,
            components: newButtons,
          });
        }
      } catch (e) {}

      return interaction.reply({ content: '✅ تم التهكير! دورك الآن تختار.', ephemeral: true });
    }
  },

  // ── معالجة القوائم المنسدلة ──
  async handleSelect(interaction) {
    // ── تنفيذ القنص ──
    if (interaction.customId === 'shop_select_sniper_target') {
      const targetId = interaction.values[0];
      const user = getUser(interaction.user.id, interaction.guildId);

      if (!user.activeSnipers || user.activeSnipers < 1) {
        return interaction.reply({ content: '❌ ما عندك قنص!', ephemeral: true });
      }

      const session = getSession(interaction.channelId);
      if (!session || !['waiting', 'elimination'].includes(session.status)) {
        return interaction.reply({ content: '❌ اللعبة انتهت أو تغيرت حالتها.', ephemeral: true });
      }

      const targetIdx = session.players.findIndex(p => p.id === targetId);
      if (targetIdx === -1) {
        return interaction.reply({ content: '⚠️ اللاعب مو موجود في اللعبة.', ephemeral: true });
      }

      const target = session.players[targetIdx];

      // فحص الدرع
      const targetUser = getUser(targetId, interaction.guildId);
      if (targetUser.activeShields > 0) {
        targetUser.activeShields -= 1;
        saveUser(targetUser);
        user.activeSnipers -= 1;
        saveUser(user);
        await interaction.update({ content: `🎯 أطلقت القنص على **${target.displayName}** لكن **الدرع** حماه! 🛡️`, components: [] });
        return interaction.followUp({ content: `🛡️ **${target.displayName}** صد القنص بدرعه!`, ephemeral: false });
      }

      // الطرد
      user.activeSnipers -= 1;
      saveUser(user);

      session.players.splice(targetIdx, 1);
      session.eliminatedPlayers = session.eliminatedPlayers || [];
      session.eliminatedPlayers.push({ ...target, round: session.eliminatedPlayers.length + 1 });
      setSession(interaction.channelId, session);

      await interaction.update({ content: `✅ تم إطلاق القنص على **${target.displayName}**!`, components: [] });

      await interaction.channel.send({
        content: `🎯 **قنص!** **${interaction.member?.displayName || interaction.user.displayName}** طرد **${target.displayName}** مباشرة!\n👥 اللاعبون المتبقون: ${session.players.map(p => `**${p.displayName}**`).join(' • ')}`,
      });

      // تحقق من الفائز
      if (session.players.length === 1) {
        const { announceChampionPublic } = require('./روليت');
        if (announceChampionPublic) {
          await announceChampionPublic(interaction.channel, session, interaction.channelId, session.players[0]);
        }
      }
    }
  },
};

// ──────────────────────────────────────────────
//  مساعد
// ──────────────────────────────────────────────

function buildShopEmbed(user) {
  return new EmbedBuilder()
    .setColor(0x0a1f5c)
    .setTitle('🛒 المتجر')
    .setDescription(`💰 رصيدك: **${user.points} نقطة**\n\n**الآيتمات المتاحة:**`)
    .addFields(
      Object.values(ITEMS).map(item => ({
        name: `${item.name} — ${item.price} نقطة`,
        value: item.description,
        inline: false,
      }))
    )
    .setFooter({ text: 'اضغط على الزر للشراء' });
}

function buildShopButtons() {
  const buyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('shop_buy_shield')
      .setLabel('شراء حماية')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('shop_buy_sniper')
      .setLabel('شراء قنص')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('shop_buy_hacker')
      .setLabel('شراء تهكير')
      .setEmoji('💻')
      .setStyle(ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('shop_inventory')
      .setLabel('حقيبتي')
      .setEmoji('🎒')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('shop_use_sniper')
      .setLabel('استخدم قنص')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('shop_use_hacker')
      .setLabel('استخدم تهكير')
      .setEmoji('💻')
      .setStyle(ButtonStyle.Secondary),
  );

  return [buyRow, actionRow];
}
