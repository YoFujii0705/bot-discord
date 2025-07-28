require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const cron = require('node-cron');

// モジュールのインポート
const commands = require('./commands');
const handlers = require('./handlers');
const { setupCronJobs } = require('./scheduler');

// Discord Client作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Bot起動時の処理
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} が起動しました！`);

    // スラッシュコマンドを登録
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('スラッシュコマンドを登録中...');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('✅ スラッシュコマンドの登録が完了しました！');
    } catch (error) {
        console.error('❌ コマンド登録エラー:', error);
    }

    // 定期実行タスクの設定
    setupCronJobs(client);
});

// スラッシュコマンドの処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const handler = handlers[interaction.commandName];
        if (handler) {
            await handler(interaction);
        } else {
            await interaction.reply({ content: '未知のコマンドです。', ephemeral: true });
        }
    } catch (error) {
        console.error('コマンド実行エラー:', error);

        const reply = { content: 'コマンドの実行中にエラーが発生しました。', ephemeral: true };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
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
