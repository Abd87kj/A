require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { GAMES_ROLE_ID } = require('./utils/config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

client.on('ready', () => {
  console.log(`✅ البوت شغّال: ${client.user.tag}`);
});

// ===== فحص رتبة "Games" =====
function hasGamesRole(interaction) {
  if (!interaction.inGuild()) return false;
  return interaction.member?.roles?.cache?.has(GAMES_ROLE_ID) ?? false;
}

const NO_PERMISSION_MSG = {
  content: `❌ هذا الأمر مخصص فقط لأصحاب رتبة <@&${GAMES_ROLE_ID}>.`,
  ephemeral: true
};

client.on('interactionCreate', async interaction => {
  // ===== أوامر السلاش =====
  if (interaction.isChatInputCommand()) {
    if (!hasGamesRole(interaction)) {
      return interaction.reply(NO_PERMISSION_MSG);
    }
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
      const msg = { content: '❌ صار خطأ!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
    return;
  }

  // ===== الأزرار =====
  if (interaction.isButton()) {
    if (!hasGamesRole(interaction)) {
      return interaction.reply(NO_PERMISSION_MSG);
    }
    if (interaction.customId.startsWith('roulette_')) {
      const cmd = client.commands.get('روليت');
      if (cmd?.handleButton) await cmd.handleButton(interaction, client);
    } else if (interaction.customId.startsWith('shop_')) {
      const cmd = client.commands.get('متجر');
      if (cmd?.handleButton) await cmd.handleButton(interaction, client);
    } else if (interaction.customId.startsWith('mafia_')) {
      const cmd = client.commands.get('مافيا');
      if (cmd?.handleButton) await cmd.handleButton(interaction, client);
    } else if (interaction.customId.startsWith('bomb_')) {
      const cmd = client.commands.get('بومب');
      if (cmd?.handleButton) await cmd.handleButton(interaction, client);
    } else if (interaction.customId.startsWith('dice_')) {
      const cmd = client.commands.get('نرد');
      if (cmd?.handleButton) await cmd.handleButton(interaction, client);
    }
    return;
  }

  // ===== القوائم المنسدلة =====
  if (interaction.isStringSelectMenu()) {
    if (!hasGamesRole(interaction)) {
      return interaction.reply(NO_PERMISSION_MSG);
    }
    if (interaction.customId.startsWith('shop_select_')) {
      const cmd = client.commands.get('متجر');
      if (cmd?.handleSelect) await cmd.handleSelect(interaction, client);
    }
  }
});

client.login(process.env.TOKEN);
