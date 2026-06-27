client.once('ready', async () => {
  const { REST, Routes } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  const commands = [];
  const files = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
  files.forEach(file => {
    const cmd = require(`./commands/${file}`);
    if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
  });
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✅ تم رفع الأوامر تلقائياً');
});
