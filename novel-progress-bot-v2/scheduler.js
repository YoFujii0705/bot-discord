const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const { getActiveWorks } = require('./utils/database');
const { calculatePeriodStatistics } = require('./utils/statistics');

// 定期実行タスクの設定
function setupCronJobs(client) {
    // 毎日19時に進捗リマインダー
    cron.schedule('0 19 * * *', () => {
        sendDailyReminder(client);
    }, {
        timezone: process.env.TIMEZONE || 'Asia/Tokyo'
    });

    // 毎週月曜日9時に週間レポート
    cron.schedule('0 9 * * 1', () => {
        sendWeeklyReport(client);
    }, {
        timezone: process.env.TIMEZONE || 'Asia/Tokyo'
    });

    // 毎月1日9時に月間振り返り
    cron.schedule('0 9 1 * *', () => {
        sendMonthlyReport(client);
    }, {
        timezone: process.env.TIMEZONE || 'Asia/Tokyo'
    });

    console.log('✅ 定期実行タスクを設定しました');
}

// 日次リマインダー
async function sendDailyReminder(client) {
    const channel = client.channels.cache.get(process.env.REMINDER_CHANNEL_ID);
    if (!channel) return;

    try {
        // 進行中の作品をチェック
        const activeWorks = await getActiveWorks();

        if (activeWorks.length > 0) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('📝 今日の執筆はいかがでしたか？')
                .setDescription('進捗報告をお待ちしています！\n`/進捗報告`コマンドで報告してくださいね。\n※字数が0でも作業内容を記録できます！')
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
async function sendWeeklyReport(client) {
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
async function sendMonthlyReport(client) {
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

module.exports = {
    setupCronJobs
};
