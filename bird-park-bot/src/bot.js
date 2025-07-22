require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Botクライアント作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// コマンドコレクション
client.commands = new Collection();

// コマンドファイル読み込み
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] ${filePath} にdataまたはexecuteプロパティがありません`);
        }
    }
}

// Bot起動時
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} がオンラインになりました！`);
    console.log(`🐦 鳥類園システム起動中...`);
    
    // ステータス設定
    client.user.setActivity('鳥たちを観察中 🐦', { type: 'WATCHING' });
});

// スラッシュコマンド処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`${interaction.commandName} コマンドが見つかりません`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('コマンド実行エラー:', error);
        const errorMessage = 'コマンドの実行中にエラーが発生しました。';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// エラーハンドリング
client.on('error', error => {
    console.error('Discord.js エラー:', error);
});

process.on('unhandledRejection', error => {
    console.error('未処理のPromise拒否:', error);
});

// Bot起動
client.login(process.env.DISCORD_TOKEN);
