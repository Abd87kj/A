require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ── إنشاء الكلاينت ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// ── تحميل الأوامر ──
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command?.data?.name) {
      client.commands.set(command.data.name, command);
      console.log(`✅ تحميل أمر: ${command.data.name}`);
    }
  } catch (e) {
    console.error(`❌ خطأ بتحميل ${file}:`, e.message);
  }
}

// ── رفع الأوامر تلقائياً عند الاستعداد ──
client.once('ready', async () => {
  console.log(`\n🤖 البوت شغال: ${client.user.tag}`);

  try {
    const commands = [];
    commandFiles.forEach(file => {
      const cmd = client.commands.find(c =>
        path.join(commandsPath, file).includes(file)
      );
    });

    // نجمع الأوامر من الكولكشن مباشرة
    client.commands.forEach(cmd => {
      commands.push(cmd.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log(`✅ تم رفع ${commands.length} أمر تلقائياً`);
    commands.forEach(c => console.log(`   - /${c.name}`));
  } catch (e) {
    console.error('❌ خطأ برفع الأوامر:', e.message);
  }
});

// ── معالجة الأوامر ──
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (e) {
      console.error(`❌ خطأ بتنفيذ /${interaction.commandName}:`, e);
      const msg = { content: '❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    // نمرر الضغط على الأزرار لكل أمر عنده handleButton
    for (const [, command] of client.commands) {
      if (typeof command.handleButton === 'function') {
        try {
          await command.handleButton(interaction, client);
        } catch (e) {
          console.error('❌ خطأ بمعالجة الزر:', e);
        }
      }
    }
  }
});

// ── تشغيل البوت ──
if (!process.env.TOKEN) {
  console.error('❌ TOKEN مو موجود في .env');
  process.exit(1);
}

client.login(process.env.TOKEN);
