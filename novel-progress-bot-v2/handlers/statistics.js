const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const { calculatePeriodStatistics, calculateDetailedStatistics, generateWorkPatternChart } = require('../utils/statistics');

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

async function handleDetailedStatistics(interaction) {
    await interaction.deferReply();

    try {
        const period = interaction.options.getString('期間');
        const showProgressTypes = interaction.options.getBoolean('進捗種別表示') || false;
        
        let startDate, endDate, title;
        const now = moment();

        switch (period) {
            case '今週':
                startDate = now.clone().startOf('week');
                endDate = now.clone().endOf('week');
                title = '📊 今週の詳細統計';
                break;
            case '今月':
                startDate = now.clone().startOf('month');
                endDate = now.clone().endOf('month');
                title = '📊 今月の詳細統計';
                break;
            case '先週':
                startDate = now.clone().subtract(1, 'week').startOf('week');
                endDate = now.clone().subtract(1, 'week').endOf('week');
                title = '📊 先週の詳細統計';
                break;
            case '先月':
                startDate = now.clone().subtract(1, 'month').startOf('month');
                endDate = now.clone().subtract(1, 'month').endOf('month');
                title = '📊 先月の詳細統計';
                break;
            case '過去3ヶ月':
                startDate = now.clone().subtract(3, 'months').startOf('month');
                endDate = now.clone().endOf('month');
                title = '📊 過去3ヶ月の詳細統計';
                break;
        }

        const detailedStats = await calculateDetailedStatistics(startDate, endDate);

        const embed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle(title)
            .setDescription(`期間: ${startDate.format('YYYY-MM-DD')} 〜 ${endDate.format('YYYY-MM-DD')}`)
            .addFields(
                { name: '📝 執筆日数', value: `${detailedStats.writingDays}日`, inline: true },
                { name: '⚡ 非執筆作業日数', value: `${detailedStats.nonWritingDays}日`, inline: true },
                { name: '📅 総作業日数', value: `${detailedStats.totalWorkDays}日`, inline: true },
                { name: '✍️ 総執筆字数', value: `${detailedStats.totalChars.toLocaleString()}字`, inline: true },
                { name: '📈 執筆平均字数/日', value: `${detailedStats.avgWritingChars}字`, inline: true },
                { name: '🎯 作業継続率', value: `${detailedStats.workConsistencyRate}%`, inline: true }
            )
            .setTimestamp();

        // 進捗種別の詳細表示
        if (showProgressTypes && Object.keys(detailedStats.progressTypes).length > 0) {
            let progressTypeText = '';
            const typeEmojis = {
                '執筆': '✍️',
                'プロット作成': '🗺️',
                'キャラ設定': '👤',
                'リサーチ': '🔍',
                '推敲・校正': '✏️',
                'アイデア出し': '💡',
                'その他': '⚡'
            };

            Object.entries(detailedStats.progressTypes).forEach(([type, count]) => {
                const emoji = typeEmojis[type] || '📋';
                progressTypeText += `${emoji} ${type}: ${count}日\n`;
            });

            embed.addFields({ name: '📋 作業種別内訳', value: progressTypeText, inline: false });
        }

        // 作業パターンの可視化（文字ベースチャート）
        const workPattern = await generateWorkPatternChart(startDate, endDate);
        if (workPattern) {
            embed.addFields({ name: '📈 作業パターン', value: workPattern, inline: false });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('詳細統計取得エラー:', error);
        await interaction.editReply('❌ 詳細統計の取得中にエラーが発生しました。');
    }
}

module.exports = {
    handleStatistics,
    handleDetailedStatistics
};
