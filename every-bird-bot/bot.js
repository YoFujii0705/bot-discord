const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// 機能別モジュールのインポート
const diaryCommands = require('./commands/diary');
const habitCommands = require('./commands/habit');
const weightCommands = require('./commands/weight');
const interactionHandler = require('./handlers/interactions');
const notificationHandler = require('./handlers/notifications');

const config = require('./config.json');

// Discord Bot初期化
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Bot起動時の処理
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} がログインしました！`);
    
    // スラッシュコマンドを登録
    await registerCommands();
    
    // 定期通知のスケジュール設定
    notificationHandler.setupNotificationSchedule(client);
});

// スラッシュコマンド登録
async function registerCommands() {
    const commands = [
        diaryCommands.createCommand(),
        habitCommands.createCommand(),
        weightCommands.createCommand()
    ];

    try {
        await client.application?.commands.set(commands);
        console.log('✅ スラッシュコマンドを登録しました');
    } catch (error) {
        console.error('❌ コマンド登録エラー:', error);
    }
}

// インタラクション処理
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;

            switch (commandName) {
                case 'diary':
                    await diaryCommands.handleCommand(interaction);
                    break;
                case 'habit':
                    await habitCommands.handleCommand(interaction);
                    break;
                case 'weight':
                    await weightCommands.handleCommand(interaction);
                    break;
            }
        } else {
            // ボタン、セレクトメニュー、モーダル等の処理
            await interactionHandler.handleInteraction(interaction);
        }
    } catch (error) {
        console.error('インタラクション処理エラー:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: 'エラーが発生しました。しばらく後にもう一度お試しください。', 
                ephemeral: true 
            });
        }
    }
});

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Bot is shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Bot is shutting down...');
    client.destroy();
    process.exit(0);
});

// Bot起動
client.login(process.env.DISCORD_TOKEN);
