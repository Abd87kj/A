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
const BUTTON_PREFIX_MAP = {
  mafia_:     'مافيا',
  bomb_:      'بومب',
  roulette_:  'روليت',
  eliminate_: 'روليت',
  elim_:      'روليت',   // ✅ أزرار القوى الخاصة (عشوائي / تهكير / نيوك / حماية)
  shop_:      'متجر',     // ✅ تصحيح: كانت موجّهة غلط لـ 'روليت'
};

function findCommandForButton(customId) {
  for (const [prefix, commandName] of Object.entries(BUTTON_PREFIX_MAP)) {
    if (customId.startsWith(prefix)) {
      return commandName;
    }
  }
  return null;
}

// ── دالة موحّدة للرد بخطأ بدون تكرار الكود ──
async function replyError(interaction, text) {
  const msg = { content: text, ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(msg).catch(() => {});
  } else {
    await interaction.reply(msg).catch(() => {});
  }
}

// ── معالجة الأوامر والأزرار والقوائم المنسدلة ──
client.on('interactionCreate', async interaction => {
  // ─── أوامر السلاش ───
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (e) {
      console.error(`❌ خطأ بتنفيذ /${interaction.commandName}:`, e);
      await replyError(interaction, '❌ حدث خطأ أثناء تنفيذ الأمر.');
    }
    return;
  }

  // ─── الأزرار ───
  if (interaction.isButton()) {
    const commandName = findCommandForButton(interaction.customId);
    const command = commandName ? client.commands.get(commandName) : null;

    if (!command?.handleButton) {
      console.warn(`⚠️ لا يوجد handleButton لمعالجة الزر: ${interaction.customId}`);
      return replyError(interaction, '❌ هذا الزر غير مدعوم حالياً.');
    }

    try {
      await command.handleButton(interaction, client);
    } catch (e) {
      console.error('❌ خطأ بمعالجة الزر:', e);
      await replyError(interaction, '❌ حدث خطأ أثناء معالجة الزر.');
    }
    return;
  }

  // ─── القوائم المنسدلة (Select Menus) ───
  if (interaction.isStringSelectMenu()) {
    const commandName = findCommandForButton(interaction.customId);
    const command = commandName ? client.commands.get(commandName) : null;

    if (!command?.handleSelect) {
      console.warn(`⚠️ لا يوجد handleSelect لمعالجة القائمة: ${interaction.customId}`);
      return replyError(interaction, '❌ هذا الإجراء غير مدعوم حالياً.');
    }

    try {
      await command.handleSelect(interaction, client);
    } catch (e) {
      console.error('❌ خطأ بمعالجة القائمة المنسدلة:', e);
      await replyError(interaction, '❌ حدث خطأ أثناء تنفيذ هذا الإجراء.');
    }
    return;
  }
});

// ── تشغيل البوت ──
if (!process.env.TOKEN) {
  console.error('❌ TOKEN مو موجود في .env');
  process.exit(1);
}

client.login(process.env.TOKEN);
