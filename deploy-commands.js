require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
console.log(`📂 وجدت ${files.length} ملف بمجلد commands:`, files);

files.forEach(file => {
  const filePath = path.join(commandsPath, file);
  try {
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);
    if (command?.data?.toJSON) {
      commands.push(command.data.toJSON());
      console.log(`✅ تحميل: ${command.data.name}  (من ${file})`);
    } else {
      console.warn(`⚠️ الملف ${file} ما فيه data.toJSON صحيح - تجاهلته`);
    }
  } catch (err) {
    console.error(`❌ خطأ بملف ${file}:`, err.message);
    console.error(err.stack);
  }
});

console.log(`\n📋 إجمالي الأوامر الجاهزة للرفع: ${commands.length}`);
console.log('الأسماء:', commands.map(c => c.name));

if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
  console.error('❌ متغيرات البيئة ناقصة! تأكد من TOKEN / CLIENT_ID / GUILD_ID بملف .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`\n⏳ جاري رفع ${commands.length} أوامر للسيرفر ${process.env.GUILD_ID}...`);
    const result = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log(`\n✅ تم رفع ${result.length} أمر بنجاح! القائمة الفعلية من Discord:`);
    result.forEach(c => console.log(`   - /${c.name}`));
  } catch (error) {
    console.error('\n❌ خطأ بالرفع:', error);
  }
})();
