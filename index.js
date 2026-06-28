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
      console.log(`✅ تحميل أمر: ${command.data.name}  (من ${file})`);
    } else {
      console.warn(`⚠️ الملف ${file} ما فيه data.name صحيح - تجاهلته`);
    }
  } catch (e) {
    console.error(`❌ خطأ بتحميل ${file}:`, e.message);
    console.error(e.stack);
  }
}

console.log(`\n📋 إجمالي الأوامر المحمّلة: ${client.commands.size}`);

// ── رفع الأوامر تلقائياً عند الاستعداد ──
client.once('ready', async () => {
  console.log(`\n🤖 البوت شغال: ${client.user.tag}`);

  try {
    const commands = [];
    client.commands.forEach(cmd => commands.push(cmd.data.toJSON()));

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

// ── خريطة بريفكس customId ← اسم الأمر المسؤول عنه ──
// ضيف هنا أي أمر جديد فيه أزرار (بريفكس الـ customId ← اسم الأمر بالسلاش)
const BUTTON_PREFIX_MAP = {
  mafia_: 'مافيا',
  bomb_: 'بومب',
};

function findCommandForButton(customId) {
  for (const [prefix, commandName] of Object.entries(BUTTON_PREFIX_MAP)) {
    if (customId.startsWith(prefix)) {
      return commandName;
    }
  }
  return null;
}

// ── معالجة الأوامر والأزرار ──
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
    // نوجه الزر فقط للأمر المسؤول عنه حسب بريفكس الـ customId
    // (قبل كان يمرر الزر لكل الأوامر، وهذا يسبب تعارض بين أزرار مافيا وبومب)
    const commandName = findCommandForButton(interaction.customId);
    const command = commandName ? client.commands.get(commandName) : null;

    if (command?.handleButton) {
      try {
        await command.handleButton(interaction, client);
      } catch (e) {
        console.error('❌ خطأ بمعالجة الزر:', e);
        const msg = { content: '❌ حدث خطأ أثناء معالجة الزر.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
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
