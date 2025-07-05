require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const moment = require('moment');
const cron = require('node-cron');

// Discord Client作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Google Sheets設定
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// スラッシュコマンド定義
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botの接続テスト'),

    new SlashCommandBuilder()
        .setName('sheets-test')
        .setDescription('Google Sheets接続テスト'),

    new SlashCommandBuilder()
        .setName('作品登録')
        .setDescription('新しい作品を登録します')
        .addStringOption(option =>
            option.setName('タイトル')
                .setDescription('作品のタイトル')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('締切日')
                .setDescription('締切日（YYYY-MM-DD形式）')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('テーマ')
                .setDescription('作品のテーマ')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('字数制限')
                .setDescription('字数制限（文字数）')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('目標字数')
                .setDescription('目標字数（文字数）')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('備考')
                .setDescription('その他のメモ')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('作品一覧')
        .setDescription('現在の作品一覧とカウントダウンを表示します'),

    new SlashCommandBuilder()
        .setName('ステータス変更')
        .setDescription('作品のステータスを変更します')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('作品ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ステータス')
                .setDescription('新しいステータス')
                .setRequired(true)
                .addChoices(
                    { name: '未着手', value: '未着手' },
                    { name: '着手中', value: '着手中' },
                    { name: '完了', value: '完了' }
                )),

    new SlashCommandBuilder()
        .setName('進捗報告')
        .setDescription('今日の執筆字数を報告します')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('作品ID')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('字数')
                .setDescription('今日書いた字数')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('メモ')
                .setDescription('今日の執筆メモ')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('統計')
        .setDescription('執筆統計を表示します')
        .addStringOption(option =>
            option.setName('期間')
                .setDescription('統計期間')
                .setRequired(true)
                .addChoices(
                    { name: '今週', value: '今週' },
                    { name: '今月', value: '今月' },
                    { name: '先週', value: '先週' },
                    { name: '先月', value: '先月' }
                )),

    new SlashCommandBuilder()
        .setName('ペース分析')
        .setDescription('作品の執筆ペースを分析します')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('作品ID')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('アーカイブ')
        .setDescription('完了した作品のアーカイブを表示します'),

    new SlashCommandBuilder()
        .setName('執筆習慣')
        .setDescription('執筆習慣と連続日数を表示します'),

    new SlashCommandBuilder()
        .setName('ヘルプ')
        .setDescription('Botの機能一覧とコマンドの使い方を表示します')
        .addStringOption(option =>
            option.setName('カテゴリ')
                .setDescription('詳細を見たいカテゴリを選択')
                .setRequired(false)
                .addChoices(
                    { name: '基本機能', value: '基本機能' },
                    { name: '統計・分析', value: '統計・分析' },
                    { name: '定期実行', value: '定期実行' },
                    { name: 'コマンド例', value: 'コマンド例' }
                )),
];
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
    setupCronJobs();
});

// スラッシュコマンドの処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case 'ping':
                await interaction.reply('🏓 Pong! Botは正常に動作しています！');
                break;

            case 'sheets-test':
                await handleSheetsTest(interaction);
                break;

            case '作品登録':
                await handleWorkRegistration(interaction);
                break;

            case '作品一覧':
                await handleWorkList(interaction);
                break;

            case 'ステータス変更':
                await handleStatusChange(interaction);
                break;

            case '進捗報告':
                await handleProgressReport(interaction);
                break;

            case '統計':
                await handleStatistics(interaction);
                break;

            case 'ペース分析':
                await handlePaceAnalysis(interaction);
                break;

            case 'アーカイブ':
                await handleArchive(interaction);
                break;

            case '執筆習慣':
                await handleWritingHabit(interaction);
                break;

            case 'ヘルプ':
                await handleHelp(interaction);
                break;
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

// 定期実行タスクの設定
function setupCronJobs() {
    // 毎日19時に進捗リマインダー
    cron.schedule('0 19 * * *', () => {
        sendDailyReminder();
    }, {
        timezone: process.env.TIMEZONE || 'Asia/Tokyo'
    });

    // 毎週月曜日9時に週間レポート
    cron.schedule('0 9 * * 1', () => {
        sendWeeklyReport();
    }, {
        timezone: process.env.TIMEZONE || 'Asia/Tokyo'
    });

    // 毎月1日9時に月間振り返り
    cron.schedule('0 9 1 * *', () => {
        sendMonthlyReport();
    }, {
        timezone: process.env.TIMEZONE || 'Asia/Tokyo'
    });

    console.log('✅ 定期実行タスクを設定しました');
}
// Google Sheetsテスト
async function handleSheetsTest(interaction) {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        });

        await interaction.reply(`✅ Google Sheets接続成功！\nシート名: ${response.data.properties.title}`);
    } catch (error) {
        console.error('Sheetsエラー:', error);
        await interaction.reply('❌ Google Sheets接続に失敗しました。設定を確認してください。');
    }
}

// 作品登録処理
async function handleWorkRegistration(interaction) {
    await interaction.deferReply();

    try {
        const title = interaction.options.getString('タイトル');
        const deadline = interaction.options.getString('締切日');
        const theme = interaction.options.getString('テーマ') || '';
        const charLimit = interaction.options.getInteger('字数制限') || '';
        const targetChars = interaction.options.getInteger('目標字数') || '';
        const memo = interaction.options.getString('備考') || '';

        // 日付形式チェック
        if (!moment(deadline, 'YYYY-MM-DD', true).isValid()) {
            await interaction.editReply('❌ 締切日は YYYY-MM-DD 形式で入力してください。（例: 2025-07-01）');
            return;
        }

        // 次のIDを取得
        const nextId = await getNextWorkId();

        // スプレッドシートに登録
        const today = moment().format('YYYY-MM-DD');
        const values = [
            [nextId, title, deadline, theme, charLimit, targetChars, memo, today, '', '未着手', 0]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
            valueInputOption: 'RAW',
            resource: { values }
        });

        // 成功メッセージ
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ 作品登録完了')
            .addFields(
                { name: 'タイトル', value: title, inline: true },
                { name: '締切日', value: deadline, inline: true },
                { name: 'ID', value: nextId.toString(), inline: true }
            )
            .setTimestamp();

        if (theme) embed.addFields({ name: 'テーマ', value: theme, inline: true });
        if (charLimit) embed.addFields({ name: '字数制限', value: charLimit.toString(), inline: true });
        if (targetChars) embed.addFields({ name: '目標字数', value: targetChars.toString(), inline: true });
        if (memo) embed.addFields({ name: '備考', value: memo, inline: false });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('作品登録エラー:', error);
        await interaction.editReply('❌ 作品登録中にエラーが発生しました。');
    }
}

// 作品一覧表示
async function handleWorkList(interaction) {
    await interaction.deferReply();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            await interaction.editReply('📚 登録されている作品はありません。');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📚 作品一覧')
            .setTimestamp();

        let description = '';

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const id = row[0];
            const title = row[1];
            const deadline = row[2];
            const status = row[9] || '未着手';
            const progress = row[10] || 0;
            const targetChars = row[5] || 0;

            // 締切までの日数計算
            const deadlineDate = moment(deadline, 'YYYY-MM-DD');
            const today = moment();
            const daysLeft = deadlineDate.diff(today, 'days');

            let statusEmoji = '';
            switch (status) {
                case '未着手': statusEmoji = '⏸️'; break;
                case '着手中': statusEmoji = '✍️'; break;
                case '完了': statusEmoji = '✅'; break;
                default: statusEmoji = '❓'; break;
            }

            let deadlineText = '';
            if (daysLeft > 0) {
                deadlineText = `あと${daysLeft}日`;
            } else if (daysLeft === 0) {
                deadlineText = '今日が締切';
            } else {
                deadlineText = `${Math.abs(daysLeft)}日経過`;
            }

            const progressRate = targetChars > 0 ? Math.round((progress / targetChars) * 100) : 0;

            description += `${statusEmoji} **${title}** (ID: ${id})\n`;
            description += `📅 ${deadline} (${deadlineText}) | 進捗: ${progressRate}%\n\n`;
        }

        embed.setDescription(description);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('作品一覧取得エラー:', error);
        await interaction.editReply('❌ 作品一覧の取得中にエラーが発生しました。');
    }
}
// ステータス変更処理
async function handleStatusChange(interaction) {
    await interaction.deferReply();

    try {
        const workId = interaction.options.getInteger('id');
        const newStatus = interaction.options.getString('ステータス');

        // 作品を検索
        const workData = await findWorkById(workId);
        if (!workData) {
            await interaction.editReply(`❌ ID ${workId} の作品が見つかりません。`);
            return;
        }

        const oldStatus = workData.status;
        const title = workData.title;

        // ステータス更新
        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `作品管理!J${workData.rowIndex}`,
            valueInputOption: 'RAW',
            resource: { values: [[newStatus]] }
        });

        // 完了日更新（完了時のみ）
        if (newStatus === '完了') {
            const today = moment().format('YYYY-MM-DD');
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `作品管理!I${workData.rowIndex}`,
                valueInputOption: 'RAW',
                resource: { values: [[today]] }
            });
        }

        // 着手中になった場合、個別シートを作成
        if (newStatus === '着手中' && oldStatus !== '着手中') {
            await createWorkSheet(workId, title, workData.targetChars);
        }

        // 成功メッセージ
        const embed = new EmbedBuilder()
            .setColor(newStatus === '完了' ? 0xffd700 : 0x00ff00)
            .setTitle(`${newStatus === '完了' ? '🎉' : '✅'} ステータス変更完了`)
            .addFields(
                { name: '作品', value: title, inline: true },
                { name: '変更', value: `${oldStatus} → ${newStatus}`, inline: true }
            )
            .setTimestamp();

        if (newStatus === '完了') {
            embed.setDescription('🎊 おめでとうございます！作品が完了しました！素晴らしい達成です！');
        } else if (newStatus === '着手中') {
            embed.setDescription('✍️ 執筆開始ですね！頑張ってください！個別の進捗管理シートを作成しました。');
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('ステータス変更エラー:', error);
        await interaction.editReply('❌ ステータス変更中にエラーが発生しました。');
    }
}

// 進捗報告処理
async function handleProgressReport(interaction) {
    await interaction.deferReply();

    try {
        const workId = interaction.options.getInteger('id');
        const todayChars = interaction.options.getInteger('字数');
        const memo = interaction.options.getString('メモ') || '';

        // 作品を検索
        const workData = await findWorkById(workId);
        if (!workData) {
            await interaction.editReply(`❌ ID ${workId} の作品が見つかりません。`);
            return;
        }

        if (workData.status !== '着手中') {
            await interaction.editReply('❌ この作品は「着手中」ステータスではありません。');
            return;
        }

        const title = workData.title;
        const targetChars = workData.targetChars || 0;
        const currentTotal = workData.totalChars || 0;
        const newTotal = currentTotal + todayChars;

        // 個別シートに進捗記録
        const today = moment().format('YYYY-MM-DD');
        const progressRate = targetChars > 0 ? Math.round((newTotal / targetChars) * 100) : 0;

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${title}!A:E`,
            valueInputOption: 'RAW',
            resource: { 
                values: [[today, todayChars, newTotal, progressRate, memo]]
            }
        });

        // 作品管理シートの総字数更新
        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `作品管理!K${workData.rowIndex}`,
            valueInputOption: 'RAW',
            resource: { values: [[newTotal]] }
        });

        // 執筆統計を更新
        await updateStatistics(today, todayChars);

        // 励ましメッセージ
        let encouragement = '';
        if (progressRate >= 100) {
            encouragement = '🎉 目標達成おめでとうございます！素晴らしい成果です！';
        } else if (progressRate >= 75) {
            encouragement = '🔥 もうすぐゴールですね！最後まで頑張って！';
        } else if (progressRate >= 50) {
            encouragement = '💪 半分を超えました！このペースで続けましょう！';
        } else if (progressRate >= 25) {
            encouragement = '✨ 順調に進んでいますね！継続は力なりです！';
        } else if (todayChars > 0) {
            encouragement = '📝 今日も執筆お疲れ様でした！積み重ねが大切です！';
        }

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('📝 進捗報告受理')
            .addFields(
                { name: '作品', value: title, inline: true },
                { name: '今日の字数', value: `${todayChars}字`, inline: true },
                { name: '総字数', value: `${newTotal}字`, inline: true },
                { name: '目標', value: targetChars > 0 ? `${targetChars}字` : '未設定', inline: true },
                { name: '進捗率', value: `${progressRate}%`, inline: true },
                { name: '残り', value: targetChars > 0 ? `${Math.max(0, targetChars - newTotal)}字` : '-', inline: true }
            )
            .setDescription(encouragement)
            .setTimestamp();

        if (memo) {
            embed.addFields({ name: 'メモ', value: memo, inline: false });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('進捗報告エラー:', error);
        await interaction.editReply('❌ 進捗報告中にエラーが発生しました。');
    }
}

// 統計表示
async function handleStatistics(interaction) {
    await interaction.deferReply();

    try {
        const period = interaction.options.getString('期間');
        let startDate, endDate, title;

        const now = moment();

        switch (period) {
            case '今週':
                startDate = now.clone().startOf('week');
                endDate = now.clone().endOf('week');
                title = '📊 今週の執筆統計';
                break;
            case '今月':
                startDate = now.clone().startOf('month');
                endDate = now.clone().endOf('month');
                title = '📊 今月の執筆統計';
                break;
            case '先週':
                startDate = now.clone().subtract(1, 'week').startOf('week');
                endDate = now.clone().subtract(1, 'week').endOf('week');
                title = '📊 先週の執筆統計';
                break;
            case '先月':
                startDate = now.clone().subtract(1, 'month').startOf('month');
                endDate = now.clone().subtract(1, 'month').endOf('month');
                title = '📊 先月の執筆統計';
                break;
        }

        const stats = await calculatePeriodStatistics(startDate, endDate);

        const embed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle(title)
            .addFields(
                { name: '📝 総執筆字数', value: `${stats.totalChars.toLocaleString()}字`, inline: true },
                { name: '📅 執筆日数', value: `${stats.writingDays}日`, inline: true },
                { name: '📈 平均字数/日', value: `${stats.averageChars}字`, inline: true },
                { name: '🔥 最高執筆日', value: `${stats.maxDayChars}字`, inline: true },
                { name: '📚 進行中作品', value: `${stats.activeWorks}作品`, inline: true },
                { name: '✅ 完了作品', value: `${stats.completedWorks}作品`, inline: true }
            )
            .setDescription(`期間: ${startDate.format('YYYY-MM-DD')} 〜 ${endDate.format('YYYY-MM-DD')}`)
            .setTimestamp();

        if (stats.writingStreak > 0) {
            embed.addFields({ name: '🏆 連続執筆', value: `${stats.writingStreak}日`, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('統計取得エラー:', error);
        await interaction.editReply('❌ 統計の取得中にエラーが発生しました。');
    }
}

// ペース分析
async function handlePaceAnalysis(interaction) {
    await interaction.deferReply();

    try {
        const workId = interaction.options.getInteger('id');

        // 作品を検索
        const workData = await findWorkById(workId);
        if (!workData) {
            await interaction.editReply(`❌ ID ${workId} の作品が見つかりません。`);
            return;
        }

        if (workData.status === '完了') {
            await interaction.editReply('❌ この作品は既に完了しています。');
            return;
        }

        const title = workData.title;
        const targetChars = workData.targetChars || 0;
        const currentChars = workData.totalChars || 0;
        const deadline = moment(workData.deadline, 'YYYY-MM-DD');
        const today = moment();
        const daysLeft = Math.max(0, deadline.diff(today, 'days'));
        const remainingChars = Math.max(0, targetChars - currentChars);

        // 必要日次字数
        const requiredDailyChars = daysLeft > 0 ? Math.ceil(remainingChars / daysLeft) : remainingChars;

        // 現在のペース計算
        const progressData = await getWorkProgressData(title);
        const currentDailyAverage = progressData.length > 0 ? 
            Math.round(progressData.reduce((sum, day) => sum + day.chars, 0) / progressData.length) : 0;

        // 予測完了日
        let estimatedCompletion = '';
        if (currentDailyAverage > 0) {
            const daysToComplete = Math.ceil(remainingChars / currentDailyAverage);
            estimatedCompletion = today.clone().add(daysToComplete, 'days').format('YYYY-MM-DD');
        }

        const embed = new EmbedBuilder()
            .setColor(0xff6b6b)
            .setTitle(`📈 ペース分析: ${title}`)
            .addFields(
                { name: '🎯 目標字数', value: `${targetChars.toLocaleString()}字`, inline: true },
                { name: '✍️ 現在字数', value: `${currentChars.toLocaleString()}字`, inline: true },
                { name: '📝 残り字数', value: `${remainingChars.toLocaleString()}字`, inline: true },
                { name: '📅 締切まで', value: `${daysLeft}日`, inline: true },
                { name: '⚡ 必要日次', value: `${requiredDailyChars}字/日`, inline: true },
                { name: '📊 現在ペース', value: `${currentDailyAverage}字/日`, inline: true }
            )
            .setTimestamp();

        if (estimatedCompletion) {
            embed.addFields({ name: '🔮 予測完了日', value: estimatedCompletion, inline: true });
        }

        // ペース判定
        let paceAdvice = '';
        if (daysLeft === 0) {
            paceAdvice = '⚠️ 今日が締切です！頑張って！';
        } else if (requiredDailyChars <= currentDailyAverage) {
            paceAdvice = '✅ 現在のペースで目標達成可能です！';
        } else if (requiredDailyChars <= currentDailyAverage * 1.5) {
            paceAdvice = '⚠️ 少しペースアップが必要です';
        } else {
            paceAdvice = '🚨 大幅なペースアップが必要です！';
        }

        embed.setDescription(paceAdvice);

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('ペース分析エラー:', error);
        await interaction.editReply('❌ ペース分析中にエラーが発生しました。');
    }
}

// アーカイブ表示
async function handleArchive(interaction) {
    await interaction.deferReply();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            await interaction.editReply('📚 完了した作品はありません。');
            return;
        }

        const completedWorks = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[9] === '完了') {
                const id = row[0];
                const title = row[1];
                const deadline = row[2];
                const targetChars = parseInt(row[5]) || 0;
                const totalChars = parseInt(row[10]) || 0;
                const completedDate = row[8];
                const createdDate = row[7];

                // 執筆期間計算
                const startDate = moment(createdDate, 'YYYY-MM-DD');
                const endDate = moment(completedDate, 'YYYY-MM-DD');
                const writingDays = endDate.diff(startDate, 'days') + 1;
                const dailyAverage = writingDays > 0 ? Math.round(totalChars / writingDays) : 0;

                completedWorks.push({
                    id, title, deadline, targetChars, totalChars, 
                    completedDate, writingDays, dailyAverage
                });
            }
        }

        if (completedWorks.length === 0) {
            await interaction.editReply('📚 完了した作品はありません。');
            return;
        }

        // 最新の完了順でソート
        completedWorks.sort((a, b) => moment(b.completedDate).diff(moment(a.completedDate)));

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 完了作品アーカイブ')
            .setDescription(`総計 ${completedWorks.length} 作品完了`)
            .setTimestamp();

        // 最大10作品まで表示
        const displayWorks = completedWorks.slice(0, 10);

        for (const work of displayWorks) {
            const progressRate = work.targetChars > 0 ? Math.round((work.totalChars / work.targetChars) * 100) : 0;
            const fieldValue = `📝 ${work.totalChars.toLocaleString()}字 | 🎯 ${progressRate}% | 📅 ${work.writingDays}日間 | ⚡ ${work.dailyAverage}字/日\n完了日: ${work.completedDate}`;

            embed.addFields({
                name: `✅ ${work.title} (ID: ${work.id})`,
                value: fieldValue,
                inline: false
            });
        }

        if (completedWorks.length > 10) {
            embed.setFooter({ text: `※ 最新10作品を表示中（全${completedWorks.length}作品）` });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('アーカイブ取得エラー:', error);
        await interaction.editReply('❌ アーカイブの取得中にエラーが発生しました。');
    }
}

// 執筆習慣表示
async function handleWritingHabit(interaction) {
    await interaction.deferReply();

    try {
        // 全ての進捗データを取得
        const allProgressData = await getAllProgressData();

        if (allProgressData.length === 0) {
            await interaction.editReply('📊 執筆データがありません。');
            return;
        }

        // 日付別に集計
        const dailyTotals = {};
        allProgressData.forEach(entry => {
            const date = entry.date;
            if (!dailyTotals[date]) {
                dailyTotals[date] = 0;
            }
            dailyTotals[date] += entry.chars;
        });

        // 連続執筆日数計算
        const sortedDates = Object.keys(dailyTotals).sort();
        let currentStreak = 0;
        let maxStreak = 0;
        let lastDate = null;

        for (const date of sortedDates.reverse()) {
            const currentDate = moment(date);

            if (!lastDate || lastDate.diff(currentDate, 'days') === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                break;
            }

            lastDate = currentDate;
        }

        // 統計計算
        const totalDays = Object.keys(dailyTotals).length;
        const totalChars = Object.values(dailyTotals).reduce((sum, chars) => sum + chars, 0);
        const averageChars = Math.round(totalChars / totalDays);
        const maxDayChars = Math.max(...Object.values(dailyTotals));

        // 最近7日間の執筆状況
        const recentDays = [];
        for (let i = 6; i >= 0; i--) {
            const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
            const chars = dailyTotals[date] || 0;
            recentDays.push({ date, chars });
        }

        const embed = new EmbedBuilder()
            .setColor(0x4ecdc4)
            .setTitle('📈 執筆習慣レポート')
            .addFields(
                { name: '🔥 現在の連続日数', value: `${currentStreak}日`, inline: true },
                { name: '🏆 最長連続記録', value: `${maxStreak}日`, inline: true },
                { name: '📊 総執筆日数', value: `${totalDays}日`, inline: true },
                { name: '📝 総執筆字数', value: `${totalChars.toLocaleString()}字`, inline: true },
                { name: '📈 日平均字数', value: `${averageChars}字`, inline: true },
                { name: '🎯 最高執筆日', value: `${maxDayChars}字`, inline: true }
            )
            .setTimestamp();

        // 最近7日間のグラフ（文字ベース）
        let recentChart = '```\n最近7日間の執筆状況:\n';
        recentDays.forEach(day => {
            const bars = Math.floor(day.chars / 100);
            const barChart = '█'.repeat(Math.min(bars, 20));
            recentChart += `${day.date.slice(5)}: ${barChart} ${day.chars}字\n`;
        });
        recentChart += '```';

        embed.addFields({ name: '📊 最近の執筆パターン', value: recentChart, inline: false });

        // 励ましメッセージ
        let habitMessage = '';
        if (currentStreak >= 30) {
            habitMessage = '🌟 素晴らしい！30日以上の継続は立派な習慣です！';
        } else if (currentStreak >= 14) {
            habitMessage = '🔥 2週間継続！執筆が習慣になってきましたね！';
        } else if (currentStreak >= 7) {
            habitMessage = '📝 1週間継続！良いペースです！';
        } else if (currentStreak >= 3) {
            habitMessage = '💪 3日坊主を克服！この調子で続けましょう！';
        } else if (currentStreak > 0) {
            habitMessage = '✨ 執筆継続中！習慣化まであと少しです！';
        } else {
            habitMessage = '📚 新しいスタートの時です！今日から執筆を始めましょう！';
        }

        embed.setDescription(habitMessage);

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('執筆習慣取得エラー:', error);
        await interaction.editReply('❌ 執筆習慣の取得中にエラーが発生しました。');
    }
}

// ヘルプ表示
async function handleHelp(interaction) {
    const category = interaction.options.getString('カテゴリ');

    if (!category) {
        // 全体概要
        const embed = new EmbedBuilder()
            .setColor(0x00bfff)
            .setTitle('📚 小説執筆管理Bot - 機能一覧')
            .setDescription('小説の執筆進捗を管理し、統計分析で執筆習慣をサポートします')
            .addFields(
                { 
                    name: '📝 基本機能', 
                    value: '作品登録、進捗報告、ステータス管理\n`/ヘルプ カテゴリ:基本機能` で詳細表示', 
                    inline: false 
                },
                { 
                    name: '📊 統計・分析', 
                    value: '執筆統計、ペース分析、習慣トラッキング\n`/ヘルプ カテゴリ:統計・分析` で詳細表示', 
                    inline: false 
                },
                { 
                    name: '⏰ 定期実行', 
                    value: '日次リマインダー、週間・月間レポート\n`/ヘルプ カテゴリ:定期実行` で詳細表示', 
                    inline: false 
                },
                { 
                    name: '💡 使い方のコツ', 
                    value: 'コマンドの具体例と活用法\n`/ヘルプ カテゴリ:コマンド例` で詳細表示', 
                    inline: false 
                }
            )
            .setFooter({ text: '各カテゴリを選択して詳細をご確認ください' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

    } else if (category === '基本機能') {
        const embed = new EmbedBuilder()
            .setColor(0x32cd32)
            .setTitle('📝 基本機能')
            .addFields(
                { 
                    name: '/作品登録', 
                    value: '新しい作品を登録\n必須: タイトル、締切日\nオプション: テーマ、字数制限、目標字数、備考', 
                    inline: false 
                },
                { 
                    name: '/作品一覧', 
                    value: '登録済み作品の一覧とカウントダウンを表示\nステータス別の絵文字と進捗率も確認可能', 
                    inline: false 
                },
                { 
                    name: '/ステータス変更', 
                    value: '作品のステータスを変更\n未着手 → 着手中 → 完了\n「着手中」で個別シート自動作成', 
                    inline: false 
                },
                { 
                    name: '/進捗報告', 
                    value: '日々の執筆字数を報告\n自動で総字数・進捗率計算\n進捗に応じた励ましメッセージ', 
                    inline: false 
                }
            )
            .setFooter({ text: 'まずは作品登録から始めましょう！' });

        await interaction.reply({ embeds: [embed] });

    } else if (category === '統計・分析') {
        const embed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle('📊 統計・分析機能')
            .addFields(
                { 
                    name: '/統計', 
                    value: '期間別執筆統計（今週・今月・先週・先月）\n総字数、執筆日数、平均字数、最高執筆日など', 
                    inline: false 
                },
                { 
                    name: '/ペース分析', 
                    value: '作品別の執筆ペース分析\n締切達成に必要な日次字数と現在ペースを比較', 
                    inline: false 
                },
                { 
                    name: '/執筆習慣', 
                    value: '執筆習慣と連続日数をトラッキング\n最近7日間の執筆パターンを文字グラフで表示', 
                    inline: false 
                },
                { 
                    name: '/アーカイブ', 
                    value: '完了作品の実績一覧\n執筆期間、達成率、日平均字数など詳細情報', 
                    inline: false 
                }
            )
            .setFooter({ text: '統計で執筆パターンを把握して効率アップ！' });

        await interaction.reply({ embeds: [embed] });

    } else if (category === '定期実行') {
        const embed = new EmbedBuilder()
            .setColor(0xff6b35)
            .setTitle('⏰ 定期実行機能')
            .addFields(
                { 
                    name: '📅 毎日19時', 
                    value: '進捗入力リマインダー\n進行中の作品がある場合、執筆を促すメッセージを自動送信', 
                    inline: false 
                },
                { 
                    name: '📊 毎週月曜9時', 
                    value: '先週の執筆レポート\n先週の統計と励ましメッセージを自動送信', 
                    inline: false 
                },
                { 
                    name: '🏆 毎月1日9時', 
                    value: '先月の振り返りレポート\n月間統計と達成状況を自動送信', 
                    inline: false 
                }
            )
            .setDescription('Replitの「Always On」機能で24時間稼働\n設定されたチャンネルに自動通知')
            .setFooter({ text: 'タイムゾーン: Asia/Tokyo（日本時間）' });

        await interaction.reply({ embeds: [embed] });

    } else if (category === 'コマンド例') {
        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('💡 コマンド使用例')
            .addFields(
                { 
                    name: '🚀 基本的な流れ', 
                    value: '```\n1. /作品登録 タイトル:短編小説 締切日:2025-07-01 目標字数:5000\n2. /ステータス変更 id:1 ステータス:着手中\n3. /進捗報告 id:1 字数:800 メモ:プロット完成\n4. /作品一覧 （進捗確認）\n```', 
                    inline: false 
                },
                { 
                    name: '📊 統計活用例', 
                    value: '```\n/統計 期間:今週\n/ペース分析 id:1\n/執筆習慣\n/アーカイブ\n```', 
                    inline: false 
                },
                { 
                    name: '💡 活用のコツ', 
                    value: '• 毎日同じ時間に進捗報告\n• 週末に統計で振り返り\n• ペース分析で計画調整\n• アーカイブで達成感を味わう', 
                    inline: false 
                },
                { 
                    name: '📝 効果的な目標設定', 
                    value: '• 現実的な目標字数を設定\n• 余裕のある締切設定\n• 毎日少しずつでも継続\n• 完了時は自分を褒める', 
                    inline: false 
                }
            )
            .setFooter({ text: '継続は力なり！小説執筆を楽しみましょう📚' });

        await interaction.reply({ embeds: [embed] });
    }
}

// 日次リマインダー
async function sendDailyReminder() {
    const channel = client.channels.cache.get(process.env.REMINDER_CHANNEL_ID);
    if (!channel) return;

    try {
        // 進行中の作品をチェック
        const activeWorks = await getActiveWorks();

        if (activeWorks.length > 0) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('📝 今日の執筆はいかがでしたか？')
                .setDescription('進捗報告をお待ちしています！\n`/進捗報告`コマンドで報告してくださいね。')
                .setTimestamp();

            activeWorks.forEach(work => {
                embed.addFields({
                    name: work.title,
                    value: `締切まで${work.daysLeft}日 | 進捗率: ${work.progress}%`,
                    inline: true
                });
            });

            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('日次リマインダーエラー:', error);
    }
}

// 週間レポート
async function sendWeeklyReport() {
    const channel = client.channels.cache.get(process.env.REMINDER_CHANNEL_ID);
    if (!channel) return;

    try {
        const startDate = moment().subtract(1, 'week').startOf('week');
        const endDate = moment().subtract(1, 'week').endOf('week');

        const stats = await calculatePeriodStatistics(startDate, endDate);

        const embed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle('📊 先週の執筆レポート')
            .addFields(
                { name: '📝 総執筆字数', value: `${stats.totalChars.toLocaleString()}字`, inline: true },
                { name: '📅 執筆日数', value: `${stats.writingDays}日`, inline: true },
                { name: '📈 平均字数/日', value: `${stats.averageChars}字`, inline: true }
            )
            .setDescription(`期間: ${startDate.format('MM/DD')} 〜 ${endDate.format('MM/DD')}`)
            .setTimestamp();

        if (stats.totalChars > 0) {
            let weeklyMessage = '';
            if (stats.writingDays >= 6) {
                weeklyMessage = '🌟 素晴らしい！ほぼ毎日執筆されました！';
            } else if (stats.writingDays >= 4) {
                weeklyMessage = '👍 良いペースで執筆されていますね！';
            } else if (stats.writingDays >= 2) {
                weeklyMessage = '📝 継続して執筆されています！';
            } else {
                weeklyMessage = '💪 今週はもう少し執筆時間を確保してみませんか？';
            }
            embed.setFooter({ text: weeklyMessage });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('週間レポートエラー:', error);
    }
}

// 月間レポート
async function sendMonthlyReport() {
    const channel = client.channels.cache.get(process.env.REMINDER_CHANNEL_ID);
    if (!channel) return;

    try {
        const startDate = moment().subtract(1, 'month').startOf('month');
        const endDate = moment().subtract(1, 'month').endOf('month');

        const stats = await calculatePeriodStatistics(startDate, endDate);

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 先月の執筆振り返り')
            .addFields(
                { name: '📝 総執筆字数', value: `${stats.totalChars.toLocaleString()}字`, inline: true },
                { name: '📅 執筆日数', value: `${stats.writingDays}日`, inline: true },
                { name: '📈 平均字数/日', value: `${stats.averageChars}字`, inline: true },
                { name: '🔥 最高執筆日', value: `${stats.maxDayChars}字`, inline: true },
                { name: '✅ 完了作品', value: `${stats.completedWorks}作品`, inline: true },
                { name: '📚 執筆率', value: `${Math.round((stats.writingDays / endDate.daysInMonth()) * 100)}%`, inline: true }
            )
            .setDescription(`${startDate.format('YYYY年MM月')}の振り返り`)
            .setTimestamp();

        if (stats.completedWorks > 0) {
            embed.setFooter({ text: '🎉 作品完了おめでとうございます！素晴らしい達成です！' });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('月間レポートエラー:', error);
    }
}

// 進行中の作品を取得
async function getActiveWorks() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        const activeWorks = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[9] === '着手中') {
                const deadline = moment(row[2], 'YYYY-MM-DD');
                const daysLeft = deadline.diff(moment(), 'days');
                const progress = Math.round((parseInt(row[10]) || 0) / (parseInt(row[5]) || 1) * 100);

                activeWorks.push({
                    title: row[1],
                    daysLeft: daysLeft,
                    progress: progress
                });
            }
        }

        return activeWorks;
    } catch (error) {
        console.error('作品取得エラー:', error);
        return [];
    }
}

// ID で作品を検索
async function findWorkById(workId) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return null;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (parseInt(row[0]) === workId) {
                return {
                    id: parseInt(row[0]),
                    title: row[1],
                    deadline: row[2],
                    theme: row[3],
                    charLimit: row[4],
                    targetChars: parseInt(row[5]) || 0,
                    memo: row[6],
                    createdDate: row[7],
                    completedDate: row[8],
                    status: row[9],
                    totalChars: parseInt(row[10]) || 0,
                    rowIndex: i + 1
                };
            }
        }

        return null;
    } catch (error) {
        console.error('作品検索エラー:', error);
        return null;
    }
}

// 個別作品シートを作成
async function createWorkSheet(workId, title, targetChars) {
    try {
        // 新しいシートを追加
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            resource: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: title
                        }
                    }
                }]
            }
        });

        // ヘッダー行を追加
        const headers = [
            ['日付', '執筆字数', '累計字数', '進捗率(%)', 'メモ'],
            ['', '', '', '', `タイトル: ${title}`],
            ['', '', '', '', `目標字数: ${targetChars}字`],
            ['', '', '', '', ''],
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${title}!A1:E4`,
            valueInputOption: 'RAW',
            resource: { values: headers }
        });

    } catch (error) {
        console.error('個別シート作成エラー:', error);
    }
}

// 次のIDを取得
async function getNextWorkId() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:A',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return 1;
        }

        const lastId = parseInt(rows[rows.length - 1][0]) || 0;
        return lastId + 1;

    } catch (error) {
        console.error('ID取得エラー:', error);
        return 1;
    }
}

// 統計を更新
async function updateStatistics(date, chars) {
    try {
        const yearMonth = moment(date).format('YYYY-MM');

        // 執筆統計シートから該当月のデータを取得
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '執筆統計!A:E',
        });

        const rows = response.data.values || [];
        let updated = false;

        // 既存データを更新
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === yearMonth) {
                const currentTotal = parseInt(rows[i][1]) || 0;
                const currentDays = parseInt(rows[i][2]) || 0;

                await sheets.spreadsheets.values.update({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    range: `執筆統計!B${i + 1}:D${i + 1}`,
                    valueInputOption: 'RAW',
                    resource: { 
                        values: [[
                            currentTotal + chars,
                            currentDays + 1,
                            Math.round((currentTotal + chars) / (currentDays + 1))
                        ]]
                    }
                });
                updated = true;
                break;
            }
        }

        // 新規データを追加
        if (!updated) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: '執筆統計!A:E',
                valueInputOption: 'RAW',
                resource: { 
                    values: [[yearMonth, chars, 1, chars, 0]]
                }
            });
        }

    } catch (error) {
        console.error('統計更新エラー:', error);
    }
}
// 期間統計を計算
async function calculatePeriodStatistics(startDate, endDate) {
    try {
        const allProgressData = await getAllProgressData();

        let totalChars = 0;
        let writingDays = 0;
        let maxDayChars = 0;
        const dailyTotals = {};

        // 期間内のデータを集計
        allProgressData.forEach(entry => {
            const entryDate = moment(entry.date);
            if (entryDate.isBetween(startDate, endDate, 'day', '[]')) {
                const dateStr = entry.date;
                if (!dailyTotals[dateStr]) {
                    dailyTotals[dateStr] = 0;
                }
                dailyTotals[dateStr] += entry.chars;
            }
        });

        // 統計計算
        Object.values(dailyTotals).forEach(dayChars => {
            totalChars += dayChars;
            if (dayChars > 0) {
                writingDays++;
                maxDayChars = Math.max(maxDayChars, dayChars);
            }
        });

        const averageChars = writingDays > 0 ? Math.round(totalChars / writingDays) : 0;

        // 作品統計
        const worksData = await getWorksStatistics(startDate, endDate);

        // 連続執筆日数計算
        const writingStreak = await calculateWritingStreak();

        return {
            totalChars,
            writingDays,
            averageChars,
            maxDayChars,
            activeWorks: worksData.activeWorks,
            completedWorks: worksData.completedWorks,
            writingStreak
        };

    } catch (error) {
        console.error('期間統計計算エラー:', error);
        return {
            totalChars: 0,
            writingDays: 0,
            averageChars: 0,
            maxDayChars: 0,
            activeWorks: 0,
            completedWorks: 0,
            writingStreak: 0
        };
    }
}

// 全進捗データを取得
async function getAllProgressData() {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        });

        const allData = [];

        for (const sheet of response.data.sheets) {
            const sheetName = sheet.properties.title;

            // 作品管理と執筆統計シートはスキップ
            if (sheetName === '作品管理' || sheetName === '執筆統計') continue;

            try {
                const sheetData = await sheets.spreadsheets.values.get({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    range: `${sheetName}!A:E`,
                });

                const rows = sheetData.data.values;
                if (!rows || rows.length <= 4) continue;

                // 5行目以降がデータ（1-4行目はヘッダー）
                for (let i = 4; i < rows.length; i++) {
                    const row = rows[i];
                    if (row[0] && row[1] && moment(row[0], 'YYYY-MM-DD', true).isValid()) {
                        allData.push({
                            date: row[0],
                            chars: parseInt(row[1]) || 0,
                            work: sheetName
                        });
                    }
                }
            } catch (sheetError) {
                // 個別シートエラーは無視
                continue;
            }
        }

        return allData.sort((a, b) => moment(a.date).diff(moment(b.date)));

    } catch (error) {
        console.error('全進捗データ取得エラー:', error);
        return [];
    }
}

// 作品進捗データを取得
async function getWorkProgressData(workTitle) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${workTitle}!A:E`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 4) return [];

        const progressData = [];
        for (let i = 4; i < rows.length; i++) {
            const row = rows[i];
            if (row[0] && row[1] && moment(row[0], 'YYYY-MM-DD', true).isValid()) {
                progressData.push({
                    date: row[0],
                    chars: parseInt(row[1]) || 0
                });
            }
        }

        return progressData;

    } catch (error) {
        console.error('作品進捗データ取得エラー:', error);
        return [];
    }
}

// 作品統計を取得
async function getWorksStatistics(startDate, endDate) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return { activeWorks: 0, completedWorks: 0 };
        }

        let activeWorks = 0;
        let completedWorks = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const status = row[9];
            const completedDate = row[8];

            if (status === '着手中') {
                activeWorks++;
            } else if (status === '完了' && completedDate) {
                const completed = moment(completedDate, 'YYYY-MM-DD');
                if (completed.isBetween(startDate, endDate, 'day', '[]')) {
                    completedWorks++;
                }
            }
        }

        return { activeWorks, completedWorks };

    } catch (error) {
        console.error('作品統計取得エラー:', error);
        return { activeWorks: 0, completedWorks: 0 };
    }
}

// 連続執筆日数を計算
async function calculateWritingStreak() {
    try {
        const allProgressData = await getAllProgressData();

        if (allProgressData.length === 0) return 0;

        // 日付別に集計
        const dailyTotals = {};
        allProgressData.forEach(entry => {
            if (!dailyTotals[entry.date]) {
                dailyTotals[entry.date] = 0;
            }
            dailyTotals[entry.date] += entry.chars;
        });

        // 執筆があった日のみを取得してソート
        const writingDates = Object.keys(dailyTotals)
            .filter(date => dailyTotals[date] > 0)
            .sort()
            .reverse();

        if (writingDates.length === 0) return 0;

        // 連続日数計算
        let streak = 0;
        let lastDate = null;

        for (const dateStr of writingDates) {
            const currentDate = moment(dateStr);

            if (!lastDate || lastDate.diff(currentDate, 'days') === 1) {
                streak++;
                lastDate = currentDate;
            } else {
                break;
            }
        }

        return streak;

    } catch (error) {
        console.error('連続執筆日数計算エラー:', error);
        return 0;
    }
}

// エラーハンドリング
client.on('error', error => {
    console.error('Discord.js エラー:', error);
});

process.on('unhandledRejection', error => {
    console.error('未処理のPromise拒否:', error);
});

// Bot起動
client.login(process.env.DISCORD_TOKEN);
