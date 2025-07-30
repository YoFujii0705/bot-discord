const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class PomodoroBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        // ユーザーセッション管理
        this.userSessions = new Map();
        // ユーザー統計
        this.userStats = new Map();
        // プリセット
        this.userPresets = new Map();

        this.setupEvents();
    }

    setupEvents() {
        this.client.once('ready', () => {
            console.log(`${this.client.user.tag} でログインしました！`);
            this.client.user.setActivity('ポモドーロテクニック', { type: 'WATCHING' });
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            await this.handleMessage(message);
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            }
        });
    }

    async handleMessage(message) {
        const args = message.content.trim().split(/\s+/);
        const command = args[0].toLowerCase();

        switch (command) {
            case '!pomodoro':
            case '!pomo':
                await this.startPomodoro(message, args);
                break;
            case '!stop':
                await this.stopSession(message);
                break;
            case '!status':
                await this.showStatus(message);
                break;
            case '!stats':
                await this.showStats(message);
                break;
            case '!preset':
                await this.handlePreset(message, args);
                break;
            case '!help':
                await this.showHelp(message);
                break;
        }
    }

    async startPomodoro(message, args) {
        const userId = message.author.id;
        
        // 既存セッションチェック
        if (this.userSessions.has(userId)) {
            await message.reply('❌ 既にポモドーロセッションが進行中です。`!stop`で停止してから新しいセッションを開始してください。');
            return;
        }

        let workTime = 25; // デフォルト25分
        let breakTime = 5;  // デフォルト5分
        let sets = 4;       // デフォルト4セット

        // コマンド引数の解析
        if (args.length >= 4) {
            workTime = parseInt(args[1]);
            breakTime = parseInt(args[2]);
            sets = parseInt(args[3]);
        } else if (args.length === 2 && args[1]) {
            // プリセット使用
            const presetName = args[1];
            const userPresets = this.userPresets.get(userId) || {};
            if (userPresets[presetName]) {
                const preset = userPresets[presetName];
                workTime = preset.workTime;
                breakTime = preset.breakTime;
                sets = preset.sets;
            } else {
                await message.reply(`❌ プリセット "${presetName}" が見つかりません。`);
                return;
            }
        }

        // 入力値検証
        if (isNaN(workTime) || isNaN(breakTime) || isNaN(sets) || 
            workTime <= 0 || breakTime <= 0 || sets <= 0 ||
            workTime > 180 || breakTime > 60 || sets > 20) {
            await message.reply('❌ 無効な値です。作業時間(1-180分)、休憩時間(1-60分)、セット数(1-20)を確認してください。');
            return;
        }

        // セッション開始
        const session = {
            userId,
            channelId: message.channel.id,
            workTime: workTime * 60 * 1000, // ミリ秒に変換
            breakTime: breakTime * 60 * 1000,
            totalSets: sets,
            currentSet: 1,
            isWorking: true,
            isPaused: false,
            startTime: Date.now(),
            currentTimer: null,
            message: message
        };

        this.userSessions.set(userId, session);
        await this.startTimer(session);
    }

    async startTimer(session) {
        const isWork = session.isWorking;
        const duration = isWork ? session.workTime : session.breakTime;
        const endTime = Date.now() + duration;

        // 開始メッセージ
        const embed = this.createSessionEmbed(session, endTime);
        const row = this.createControlButtons(session);
        
        const reply = await session.message.reply({
            embeds: [embed],
            components: [row]
        });

        // タイマー設定
        session.currentTimer = setTimeout(async () => {
            await this.onTimerComplete(session);
        }, duration);

        session.lastMessageId = reply.id;
    }

    async onTimerComplete(session) {
        const channel = this.client.channels.cache.get(session.channelId);
        if (!channel) return;

        if (session.isWorking) {
            // 作業時間終了
            const embed = new EmbedBuilder()
                .setTitle('🍅 作業時間終了！')
                .setDescription('お疲れさまでした！休憩時間を始めましょう。')
                .setColor('#00ff00')
                .addFields({
                    name: '進捗',
                    value: `${session.currentSet}/${session.totalSets} セット完了`,
                    inline: false
                });

            await channel.send({ embeds: [embed] });

            // 統計更新
            this.updateStats(session.userId, 'work');

            // 休憩開始
            session.isWorking = false;
            await this.startTimer(session);

        } else {
            // 休憩時間終了
            session.currentSet++;
            
            if (session.currentSet > session.totalSets) {
                // 全セット完了
                const embed = new EmbedBuilder()
                    .setTitle('🎉 ポモドーロセッション完了！')
                    .setDescription('素晴らしい！すべてのセットを完了しました。')
                    .setColor('#ffd700')
                    .addFields({
                        name: '完了セット数',
                        value: `${session.totalSets} セット`,
                        inline: true
                    });

                await channel.send({ embeds: [embed] });
                this.userSessions.delete(session.userId);
                this.updateStats(session.userId, 'complete');
            } else {
                // 次の作業開始
                const embed = new EmbedBuilder()
                    .setTitle('⏰ 休憩時間終了！')
                    .setDescription('次の作業セットを始めましょう！')
                    .setColor('#ff6b6b');

                await channel.send({ embeds: [embed] });

                session.isWorking = true;
                await this.startTimer(session);
            }
        }
    }

    async handleButtonInteraction(interaction) {
        const userId = interaction.user.id;
        const session = this.userSessions.get(userId);

        if (!session) {
            await interaction.reply({ content: '❌ アクティブなセッションがありません。', ephemeral: true });
            return;
        }

        switch (interaction.customId) {
            case 'pause':
                await this.pauseSession(interaction, session);
                break;
            case 'resume':
                await this.resumeSession(interaction, session);
                break;
            case 'stop':
                await this.stopSessionButton(interaction, session);
                break;
        }
    }

    async pauseSession(interaction, session) {
        if (session.isPaused) {
            await interaction.reply({ content: '❌ セッションは既に一時停止中です。', ephemeral: true });
            return;
        }

        clearTimeout(session.currentTimer);
        session.isPaused = true;
        session.pauseTime = Date.now();

        await interaction.reply({ content: '⏸️ セッションを一時停止しました。', ephemeral: true });
    }

    async resumeSession(interaction, session) {
        if (!session.isPaused) {
            await interaction.reply({ content: '❌ セッションは停止していません。', ephemeral: true });
            return;
        }

        session.isPaused = false;
        const pausedDuration = Date.now() - session.pauseTime;
        
        // 残り時間で再開
        const remainingTime = session.isWorking ? session.workTime : session.breakTime;
        session.currentTimer = setTimeout(async () => {
            await this.onTimerComplete(session);
        }, remainingTime - pausedDuration);

        await interaction.reply({ content: '▶️ セッションを再開しました。', ephemeral: true });
    }

    async stopSessionButton(interaction, session) {
        clearTimeout(session.currentTimer);
        this.userSessions.delete(session.userId);
        await interaction.reply({ content: '🛑 セッションを停止しました。', ephemeral: true });
    }

    async stopSession(message) {
        const userId = message.author.id;
        const session = this.userSessions.get(userId);

        if (!session) {
            await message.reply('❌ アクティブなセッションがありません。');
            return;
        }

        clearTimeout(session.currentTimer);
        this.userSessions.delete(userId);
        await message.reply('🛑 ポモドーロセッションを停止しました。');
    }

    async showStatus(message) {
        const userId = message.author.id;
        const session = this.userSessions.get(userId);

        if (!session) {
            await message.reply('❌ アクティブなセッションがありません。');
            return;
        }

        const embed = this.createSessionEmbed(session, Date.now() + (session.isWorking ? session.workTime : session.breakTime));
        await message.reply({ embeds: [embed] });
    }

    async showStats(message) {
        const userId = message.author.id;
        const stats = this.userStats.get(userId) || { workSessions: 0, completedPomodoros: 0, totalWorkTime: 0 };

        const embed = new EmbedBuilder()
            .setTitle('📊 あなたのポモドーロ統計')
            .setColor('#9b59b6')
            .addFields(
                { name: '完了したポモドーロ', value: `${stats.completedPomodoros}`, inline: true },
                { name: '作業セッション', value: `${stats.workSessions}`, inline: true },
                { name: '推定作業時間', value: `${Math.floor(stats.workSessions * 25)} 分`, inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async handlePreset(message, args) {
        const userId = message.author.id;
        const subCommand = args[1];

        if (!subCommand) {
            await this.listPresets(message);
            return;
        }

        switch (subCommand.toLowerCase()) {
            case 'save':
                await this.savePreset(message, args);
                break;
            case 'delete':
                await this.deletePreset(message, args);
                break;
            case 'list':
                await this.listPresets(message);
                break;
            default:
                await message.reply('❌ 無効なサブコマンドです。使用法: `!preset save/delete/list`');
        }
    }

    async savePreset(message, args) {
        if (args.length < 6) {
            await message.reply('❌ 使用法: `!preset save <名前> <作業時間> <休憩時間> <セット数>`');
            return;
        }

        const userId = message.author.id;
        const name = args[2];
        const workTime = parseInt(args[3]);
        const breakTime = parseInt(args[4]);
        const sets = parseInt(args[5]);

        if (isNaN(workTime) || isNaN(breakTime) || isNaN(sets)) {
            await message.reply('❌ 時間とセット数は数値で入力してください。');
            return;
        }

        if (!this.userPresets.has(userId)) {
            this.userPresets.set(userId, {});
        }

        this.userPresets.get(userId)[name] = { workTime, breakTime, sets };
        await message.reply(`✅ プリセット "${name}" を保存しました。`);
    }

    async deletePreset(message, args) {
        if (args.length < 3) {
            await message.reply('❌ 使用法: `!preset delete <名前>`');
            return;
        }

        const userId = message.author.id;
        const name = args[2];
        const userPresets = this.userPresets.get(userId);

        if (!userPresets || !userPresets[name]) {
            await message.reply(`❌ プリセット "${name}" が見つかりません。`);
            return;
        }

        delete userPresets[name];
        await message.reply(`✅ プリセット "${name}" を削除しました。`);
    }

    async listPresets(message) {
        const userId = message.author.id;
        const userPresets = this.userPresets.get(userId) || {};
        const presetNames = Object.keys(userPresets);

        if (presetNames.length === 0) {
            await message.reply('プリセットが保存されていません。');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('💾 保存されたプリセット')
            .setColor('#3498db');

        for (const name of presetNames) {
            const preset = userPresets[name];
            embed.addFields({
                name: name,
                value: `作業: ${preset.workTime}分, 休憩: ${preset.breakTime}分, セット: ${preset.sets}`,
                inline: false
            });
        }

        await message.reply({ embeds: [embed] });
    }

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🍅 ポモドーロボット ヘルプ')
            .setDescription('ポモドーロテクニックでの作業をサポートします！')
            .setColor('#e74c3c')
            .addFields(
                {
                    name: '基本コマンド',
                    value: '`!pomodoro` または `!pomo` - デフォルト設定でポモドーロ開始\n' +
                           '`!pomodoro <作業時間> <休憩時間> <セット数>` - カスタム設定で開始\n' +
                           '`!pomodoro <プリセット名>` - プリセットを使用して開始\n' +
                           '`!stop` - 現在のセッションを停止\n' +
                           '`!status` - 現在のセッション状況を表示',
                    inline: false
                },
                {
                    name: '統計・プリセット',
                    value: '`!stats` - あなたの統計を表示\n' +
                           '`!preset save <名前> <作業> <休憩> <セット>` - プリセット保存\n' +
                           '`!preset list` - プリセット一覧\n' +
                           '`!preset delete <名前>` - プリセット削除',
                    inline: false
                },
                {
                    name: 'デフォルト設定',
                    value: '作業時間: 25分\n休憩時間: 5分\nセット数: 4回',
                    inline: false
                }
            )
            .setFooter({ text: 'セッション中はボタンで一時停止・再開・停止が可能です' });

        await message.reply({ embeds: [embed] });
    }

    createSessionEmbed(session, endTime) {
        const isWork = session.isWorking;
        const status = session.isPaused ? '⏸️ 一時停止中' : (isWork ? '🍅 作業中' : '☕ 休憩中');
        const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        return new EmbedBuilder()
            .setTitle(`${status}`)
            .setDescription(`セット ${session.currentSet}/${session.totalSets}`)
            .addFields(
                { name: '残り時間', value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true },
                { name: '次は', value: isWork ? '休憩' : (session.currentSet < session.totalSets ? '作業' : '完了'), inline: true }
            )
            .setColor(isWork ? '#e74c3c' : '#2ecc71')
            .setTimestamp();
    }

    createControlButtons(session) {
        const pauseBtn = new ButtonBuilder()
            .setCustomId('pause')
            .setLabel('一時停止')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏸️')
            .setDisabled(session.isPaused);

        const resumeBtn = new ButtonBuilder()
            .setCustomId('resume')
            .setLabel('再開')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️')
            .setDisabled(!session.isPaused);

        const stopBtn = new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('停止')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🛑');

        return new ActionRowBuilder()
            .addComponents(pauseBtn, resumeBtn, stopBtn);
    }

    updateStats(userId, type) {
        if (!this.userStats.has(userId)) {
            this.userStats.set(userId, { workSessions: 0, completedPomodoros: 0, totalWorkTime: 0 });
        }

        const stats = this.userStats.get(userId);
        
        if (type === 'work') {
            stats.workSessions++;
        } else if (type === 'complete') {
            stats.completedPomodoros++;
        }
    }

    async start(token) {
        try {
            await this.client.login(token);
        } catch (error) {
            console.error('ボットの起動に失敗しました:', error);
        }
    }
}

// 使用方法
const bot = new PomodoroBot();

// 環境変数からトークンを取得
const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error('DISCORD_TOKEN環境変数が設定されていません');
    process.exit(1);
}

bot.start(token);
