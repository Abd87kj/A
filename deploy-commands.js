require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

fs.readdirSync(commandsPath).filter(f => f.endsWith('.js')).forEach(file => {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`✅ تحميل: ${command.data.name}`);
  }
});

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`⏳ جاري رفع ${commands.length} أوامر...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ تم رفع جميع الأوامر بنجاح!');
  } catch (error) {
    console.error('❌ خطأ:', error);
  }
})();
