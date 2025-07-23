require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ コマンド登録準備: ${command.data.name}`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🔄 ${commands.length}個のスラッシュコマンドを登録中...`);

        // グローバル登録（全サーバーで利用可能、反映に最大1時間）
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ${data.length}個のスラッシュコマンドを正常に登録しました！`);
        console.log('⏰ 反映まで最大1時間かかる場合があります');
        
    } catch (error) {
        console.error('❌ コマンド登録エラー:', error);
    }
})();
