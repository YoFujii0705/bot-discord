const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const { findWorkById, getWorkProgressData, getAllProgressData } = require('../utils/database');
const { recordWorkEvaluation } = require('../utils/evaluation');

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
        console.error('執筆習慣取得エラー:', error);
        await interaction.editReply('❌ 執筆習慣の取得中にエラーが発生しました。');
    }
}

async function handleWorkEvaluation(interaction) {
    await interaction.deferReply();

    try {
        const workId = interaction.options.getInteger('id');
        const evaluationItem = interaction.options.getString('評価項目');
        const completionRate = interaction.options.getInteger('完成度');
        const evaluationMemo = interaction.options.getString('評価メモ') || '';

        // 作品を検索
        const workData = await findWorkById(workId);
        if (!workData) {
            await interaction.editReply(`❌ ID ${workId} の作品が見つかりません。`);
            return;
        }

        const title = workData.title;
        const today = moment().format('YYYY-MM-DD');

        // 作業評価をスプレッドシートに記録
        await recordWorkEvaluation(title, evaluationItem, completionRate, evaluationMemo, today);

        // 評価に応じた絵文字とメッセージ
        const itemEmojis = {
            'プロット完成度': '🗺️',
            'キャラクター設定': '👤',
            'リサーチ進捗': '🔍',
            '世界観構築': '🌍',
            '推敲完成度': '✏️'
        };

        let evaluationMessage = '';
        if (completionRate >= 90) {
            evaluationMessage = '🌟 ほぼ完成ですね！素晴らしい進捗です！';
        } else if (completionRate >= 70) {
            evaluationMessage = '🔥 順調に進んでいます！もう一息です！';
        } else if (completionRate >= 50) {
            evaluationMessage = '💪 半分を超えました！着実な進歩です！';
        } else if (completionRate >= 30) {
            evaluationMessage = '✨ 良いスタートを切っています！';
        } else if (completionRate >= 10) {
            evaluationMessage = '🌱 最初の一歩を踏み出しました！';
        } else {
            evaluationMessage = '📋 現状を把握することから始まります！';
        }

        const embed = new EmbedBuilder()
            .setColor(getEvaluationColor(completionRate))
            .setTitle(`${itemEmojis[evaluationItem] || '📊'} 作業評価記録`)
            .addFields(
                { name: '作品', value: title, inline: true },
                { name: '評価項目', value: evaluationItem, inline: true },
                { name: '完成度', value: `${completionRate}%`, inline: true }
            )
            .setDescription(evaluationMessage)
            .setTimestamp();

        if (evaluationMemo) {
            embed.addFields({ name: '評価メモ', value: evaluationMemo, inline: false });
        }

        // 進捗バーを表示
        const progressBar = generateProgressBar(completionRate);
        embed.addFields({ name: '進捗バー', value: progressBar, inline: false });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('作業評価エラー:', error);
        await interaction.editReply('❌ 作業評価中にエラーが発生しました。');
    }
}

// 評価に応じた色を取得
function getEvaluationColor(completionRate) {
    if (completionRate >= 90) return 0x00ff00; // 緑
    if (completionRate >= 70) return 0xffff00; // 黄
    if (completionRate >= 50) return 0xff9900; // オレンジ
    if (completionRate >= 30) return 0xff6600; // 濃いオレンジ
    return 0xff0000; // 赤
}

// 進捗バー生成
function generateProgressBar(percentage) {
    const filledBlocks = Math.floor(percentage / 5); // 5%ごとに1ブロック
    const emptyBlocks = 20 - filledBlocks;
    
    const filled = '█'.repeat(filledBlocks);
    const empty = '░'.repeat(emptyBlocks);
    
    return `\`${filled}${empty}\` ${percentage}%`;
}

module.exports = {
    handlePaceAnalysis,
    handleArchive,
    handleWritingHabit,
    handleWorkEvaluation
};error('ペース分析エラー:', error);
        await interaction.editReply('❌ ペース分析中にエラーが発生しました。');
    }
}

async function handleArchive(interaction) {
    await interaction.deferReply();

    try {
        const { sheets } = require('../config/googleSheets');
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
        console.
