const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');
const sheetsUtils = require('../utils/sheets');
const calculations = require('../utils/calculations');
const validation = require('../utils/validation');
const config = require('../config.json');

// コマンド定義
function createCommand() {
    return new SlashCommandBuilder()
        .setName('weight')
        .setDescription('体重管理機能')
        .addSubcommand(subcommand =>
            subcommand
                .setName('record')
                .setDescription('今日の体重を記録')
                .addNumberOption(option =>
                    option.setName('weight')
                        .setDescription('体重（kg）')
                        .setRequired(true)
                        .setMinValue(20)
                        .setMaxValue(300)
                )
                .addStringOption(option =>
                    option.setName('memo')
                        .setDescription('メモ（体調など）')
                        .setRequired(false)
                        .setMaxLength(100)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('体重履歴を表示')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('表示する日数（デフォルト: 7日）')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(90)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('graph')
                .setDescription('体重グラフを表示')
                .addStringOption(option =>
                    option.setName('period')
                        .setDescription('期間')
                        .setRequired(false)
                        .addChoices(
                            { name: '1週間', value: '7' },
                            { name: '2週間', value: '14' },
                            { name: '1ヶ月', value: '30' },
                            { name: '3ヶ月', value: '90' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('goal')
                .setDescription('体重目標を設定')
                .addNumberOption(option =>
                    option.setName('target')
                        .setDescription('目標体重（kg）')
                        .setRequired(true)
                        .setMinValue(20)
                        .setMaxValue(300)
                )
                .addStringOption(option =>
                    option.setName('deadline')
                        .setDescription('目標期限（YYYY-MM-DD形式）')
                        .setRequired(false)
                )
                .addNumberOption(option =>
                    option.setName('height')
                        .setDescription('身長（cm）- BMI計算用（初回のみ）')
                        .setRequired(false)
                        .setMinValue(100)
                        .setMaxValue(250)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('体重統計を表示')
        );
}

// コマンド処理
async function handleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'record':
            await handleWeightRecord(interaction);
            break;
        case 'view':
            await handleWeightView(interaction);
            break;
        case 'graph':
            await handleWeightGraph(interaction);
            break;
        case 'goal':
            await handleWeightGoal(interaction);
            break;
        case 'stats':
            await handleWeightStats(interaction);
            break;
    }
}

// 体重記録処理
async function handleWeightRecord(interaction) {
    const weight = interaction.options.getNumber('weight');
    const memo = interaction.options.getString('memo') || '';
    const userId = interaction.user.id;
    const today = moment().format('YYYY-MM-DD');
    
    // 今日の体重が既に記録されているかチェック
    const existingEntry = await sheetsUtils.getWeightEntry(userId, today);
    
    try {
        await sheetsUtils.saveWeightToSheet(userId, today, weight, memo);
        
        // 前回との比較
        const lastEntry = await sheetsUtils.getLastWeightEntry(userId, today);
        let changeText = '';
        if (lastEntry && lastEntry.weight) {
            const change = weight - parseFloat(lastEntry.weight);
            if (change > 0) {
                changeText = `\n前回比: +${change.toFixed(1)}kg ↗️`;
            } else if (change < 0) {
                changeText = `\n前回比: ${change.toFixed(1)}kg ↘️`;
            } else {
                changeText = `\n前回比: 変化なし ➡️`;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`⚖️ 体重を記録しました ${existingEntry ? '(更新)' : ''}`)
            .setDescription(`**${weight}kg**${changeText}`)
            .addFields(
                { name: '日付', value: today, inline: true },
                { name: 'メモ', value: memo || 'なし', inline: true }
            )
            .setColor(0x00AE86)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('体重記録エラー:', error);
        await interaction.reply({ content: '体重の記録中にエラーが発生しました。', ephemeral: true });
    }
}

// 体重履歴表示
async function handleWeightView(interaction) {
    const days = interaction.options.getInteger('days') || 7;
    const userId = interaction.user.id;
    
    const startDate = moment().subtract(days - 1, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    
    const entries = await sheetsUtils.getWeightEntriesInRange(userId, startDate, endDate);
    
    if (entries.length === 0) {
        await interaction.reply({ content: `過去${days}日間の体重記録がありません。`, ephemeral: true });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`⚖️ 体重履歴（過去${days}日間）`)
        .setColor(0x00AE86);
    
    // 最新5件を表示
    const recentEntries = entries.slice(-5).reverse();
    recentEntries.forEach(entry => {
        embed.addFields({
            name: entry.date,
            value: `${entry.weight}kg${entry.memo ? ` - ${entry.memo}` : ''}`,
            inline: false
        });
    });
    
    // 統計情報
    if (entries.length >= 2) {
        const firstWeight = parseFloat(entries[0].weight);
        const lastWeight = parseFloat(entries[entries.length - 1].weight);
        const change = lastWeight - firstWeight;
        const changeText = change >= 0 ? `+${change.toFixed(1)}kg` : `${change.toFixed(1)}kg`;
        
        embed.addFields({
            name: '期間内変化',
            value: changeText,
            inline: true
        });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 体重グラフ表示
async function handleWeightGraph(interaction) {
    const period = parseInt(interaction.options.getString('period')) || 30;
    const userId = interaction.user.id;
    
    const startDate = moment().subtract(period - 1, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    
    const entries = await sheetsUtils.getWeightEntriesInRange(userId, startDate, endDate);
    
    if (entries.length < 2) {
        await interaction.reply({ content: 'グラフを表示するには2つ以上の体重記録が必要です。', ephemeral: true });
        return;
    }
    
    // 簡易ASCIIグラフを作成
    const graph = calculations.generateWeightGraph(entries);
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 体重グラフ（過去${period}日間）`)
        .setDescription('```\n' + graph + '\n```')
        .addFields(
            { name: '最高体重', value: `${Math.max(...entries.map(e => parseFloat(e.weight)))}kg`, inline: true },
            { name: '最低体重', value: `${Math.min(...entries.map(e => parseFloat(e.weight)))}kg`, inline: true },
            { name: '記録日数', value: `${entries.length}日`, inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 体重目標設定（健康ガイダンス付き）
async function handleWeightGoal(interaction) {
    const target = interaction.options.getNumber('target');
    const deadline = interaction.options.getString('deadline');
    const height = interaction.options.getNumber('height');
    const userId = interaction.user.id;
    
    try {
        // 現在の体重を取得
        const currentEntry = await sheetsUtils.getLatestWeightEntry(userId);
        if (!currentEntry) {
            await interaction.reply({ 
                content: '目標設定には現在の体重データが必要です。まず `/weight record` で体重を記録してください。', 
                ephemeral: true 
            });
            return;
        }
        
        const currentWeight = parseFloat(currentEntry.weight);
        
        // 身長データの処理
        let userHeight = height;
        if (!userHeight) {
            const savedProfile = await sheetsUtils.getUserProfile(userId);
            userHeight = savedProfile?.height;
        } else {
            await sheetsUtils.saveUserProfile(userId, { height });
        }
        
        // 健康ガイダンス実行
        const guidance = validation.analyzeWeightGoal(currentWeight, target, deadline, userHeight);
        
        // 目標保存
        await sheetsUtils.saveWeightGoal(userId, target, deadline);
        
        // レスポンス作成
        const difference = target - currentWeight;
        const direction = difference > 0 ? '増量' : '減量';
        const absChange = Math.abs(difference);
        
        const embed = new EmbedBuilder()
            .setTitle('🎯 体重目標を設定しました')
            .setDescription(`**目標体重: ${target}kg**\n現在の体重: ${currentWeight}kg\n目標まで: ${absChange.toFixed(1)}kg ${direction}`)
            .setColor(guidance.isHealthy ? 0x00AE86 : 0xFFA500);
        
        if (deadline) {
            const daysUntilDeadline = moment(deadline).diff(moment(), 'days');
            embed.addFields({ name: '期限', value: `${deadline} (あと${daysUntilDeadline}日)`, inline: true });
            
            if (daysUntilDeadline > 0) {
                const weeklyRate = (absChange / daysUntilDeadline) * 7;
                embed.addFields({ name: '必要な週間ペース', value: `${weeklyRate.toFixed(2)}kg/週`, inline: true });
            }
        }
        
        // BMI情報
        if (userHeight) {
            const currentBMI = calculations.calculateBMI(currentWeight, userHeight);
            const targetBMI = calculations.calculateBMI(target, userHeight);
            const healthyRange = calculations.getHealthyWeightRange(userHeight);
            
            embed.addFields(
                { name: '現在のBMI', value: `${currentBMI.toFixed(1)} (${calculations.getBMICategory(currentBMI)})`, inline: true },
                { name: '目標時のBMI', value: `${targetBMI.toFixed(1)} (${calculations.getBMICategory(targetBMI)})`, inline: true },
                { name: '健康的体重範囲', value: `${healthyRange.min}-${healthyRange.max}kg`, inline: true }
            );
        }
        
        // アドバイス追加
        if (guidance.warnings.length > 0) {
            embed.addFields({ name: '⚠️ アドバイス', value: guidance.warnings.join('\n\n'), inline: false });
        }
        
        if (guidance.recommendations.length > 0) {
            embed.addFields({ name: '💡 おすすめ', value: guidance.recommendations.join('\n\n'), inline: false });
        }
        
        // ランダムなヒント
        const randomTip = config.weight_guidance.tips[Math.floor(Math.random() * config.weight_guidance.tips.length)];
        embed.setFooter({ text: randomTip });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        
    } catch (error) {
        console.error('体重目標設定エラー:', error);
        await interaction.reply({ content: '目標設定中にエラーが発生しました。', ephemeral: true });
    }
}

// 体重統計表示
async function handleWeightStats(interaction) {
    const userId = interaction.user.id;
    const last30Days = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const today = moment().format('YYYY-MM-DD');
    
    const entries = await sheetsUtils.getWeightEntriesInRange(userId, last30Days, today);
    
    if (entries.length === 0) {
        await interaction.reply({ content: '過去30日間の体重記録がありません。', ephemeral: true });
        return;
    }
    
    // 統計計算
    const weights = entries.map(e => parseFloat(e.weight));
    const avgWeight = (weights.reduce((sum, w) => sum + w, 0) / weights.length).toFixed(1);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const firstWeight = weights[0];
    const lastWeight = weights[weights.length - 1];
    const totalChange = (lastWeight - firstWeight).toFixed(1);
    
    // 目標との比較
    const goal = await sheetsUtils.getWeightGoal(userId);
    let goalProgress = '';
    if (goal && goal.target) {
        const remaining = (parseFloat(goal.target) - lastWeight).toFixed(1);
        const direction = remaining > 0 ? '増量' : '減量';
        goalProgress = `目標まで: ${Math.abs(remaining)}kg ${direction}`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('📊 体重統計（過去30日間）')
        .addFields(
            { name: '記録日数', value: `${entries.length}日`, inline: true },
            { name: '平均体重', value: `${avgWeight}kg`, inline: true },
            { name: '期間変化', value: `${totalChange >= 0 ? '+' : ''}${totalChange}kg`, inline: true },
            { name: '最高体重', value: `${maxWeight}kg`, inline: true },
            { name: '最低体重', value: `${minWeight}kg`, inline: true },
            { name: '現在体重', value: `${lastWeight}kg`, inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();
    
    if (goalProgress) {
        embed.addFields({ name:
