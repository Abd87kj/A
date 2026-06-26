const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getUser, saveUser } = require('../utils/db');

const ITEMS = {
  shield: {
    id: 'shield',
    name: '🛡️ حماية',
    description: 'تحميك من خسارة نقاط في الروليت مرة واحدة',
    price: 150,
    emoji: '🛡️',
  },
  nuke: {
    id: 'nuke',
    name: '☢️ نيوك',
    description: 'يضرب لاعب معين ويسرق نصف نقاطه',
    price: 300,
    emoji: '☢️',
  },
  hacker: {
    id: 'hacker',
    name: '💻 هيكر',
    description: 'يكشف اللاعب الأقوى ويسرق 20% من نقاطه',
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
    if (interaction.customId === 'shop_open') {
      const user = getUser(interaction.user.id, interaction.guildId);
      const embed = buildShopEmbed(user);
      const rows = buildShopButtons();
      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }

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
      if (itemId === 'shield') user.activeShields = (user.activeShields || 0) + 1;
      if (itemId === 'nuke') user.activeNukes = (user.activeNukes || 0) + 1;
      if (itemId === 'hacker') user.activeHackers = (user.activeHackers || 0) + 1;
      saveUser(user);

      return interaction.reply({
        content: `✅ اشتريت **${item.name}** بـ **${item.price}** نقطة!\nرصيدك الحالي: **${user.points}** نقطة`,
        ephemeral: true,
      });
    }

    if (interaction.customId === 'shop_inventory') {
      const user = getUser(interaction.user.id, interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(0x0a1f5c)
        .setTitle('🎒 حقيبتك')
        .addFields(
          { name: '🛡️ حماية', value: `${user.activeShields || 0} قطعة`, inline: true },
          { name: '☢️ نيوك', value: `${user.activeNukes || 0} قطعة`, inline: true },
          { name: '💻 هيكر', value: `${user.activeHackers || 0} قطعة`, inline: true },
          { name: '💰 نقاطك', value: `${user.points} نقطة`, inline: false },
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.customId === 'shop_use_nuke') {
      const user = getUser(interaction.user.id, interaction.guildId);
      if (!user.activeNukes || user.activeNukes < 1) {
        return interaction.reply({ content: '❌ ما عندك نيوك!', ephemeral: true });
      }

      const members = await interaction.guild.members.fetch();
      const options = members
        .filter(m => !m.user.bot && m.id !== interaction.user.id)
        .first(10)
        .map(m => ({
          label: m.displayName.substring(0, 25),
          value: m.id,
          description: `نقاط: ${getUser(m.id, interaction.guildId).points}`,
        }));

      if (options.length === 0) {
        return interaction.reply({ content: '❌ ما في لاعبين تقدر تضربهم!', ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId('shop_select_nuke_target')
        .setPlaceholder('اختار اللاعب اللي تبي تضربه')
        .addOptions(options);

      return interaction.reply({
        content: '☢️ **اختار هدف النيوك:**',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }
  },

  async handleSelect(interaction) {
    if (interaction.customId === 'shop_select_nuke_target') {
      const targetId = interaction.values[0];
      const user = getUser(interaction.user.id, interaction.guildId);

      if (!user.activeNukes || user.activeNukes < 1) {
        return interaction.reply({ content: '❌ ما عندك نيوك!', ephemeral: true });
      }

      const target = getUser(targetId, interaction.guildId);
      const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
      const targetName = targetMember?.displayName || 'اللاعب';

      if (target.activeShields > 0) {
        target.activeShields -= 1;
        saveUser(target);
        user.activeNukes -= 1;
        saveUser(user);
        return interaction.reply({
          content: `☢️ أطلقت النيوك على **${targetName}** لكن **الحماية** منعته! 🛡️`,
          ephemeral: false,
        });
      }

      const stolen = Math.floor(target.points * 0.5);
      target.points = Math.max(0, target.points - stolen);
      user.points += stolen;
      user.activeNukes -= 1;
      saveUser(target);
      saveUser(user);

      return interaction.reply({
        content: `☢️ **نيوك!** سرقت **${stolen}** نقطة من **${targetName}**!\nرصيدك الآن: **${user.points}** نقطة`,
        ephemeral: false,
      });
    }
  },
};

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
      .setCustomId('shop_buy_nuke')
      .setLabel('شراء نيوك')
      .setEmoji('☢️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('shop_buy_hacker')
      .setLabel('شراء هيكر')
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
      .setCustomId('shop_use_nuke')
      .setLabel('استخدم نيوك')
      .setEmoji('☢️')
      .setStyle(ButtonStyle.Danger),
  );

  return [buyRow, actionRow];
}
