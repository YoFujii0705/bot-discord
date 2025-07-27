const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');
const sheetsUtils = require('../utils/sheets');
const calculations = require('../utils/calculations');
const config = require('../config.json');

// コマンド定義
function createCommand() {
    return new SlashCommandBuilder()
        .setName('diary')
        .setDescription('日記機能')
        .addSubcommand(subcommand =>
            subcommand
                .setName('write')
                .setDescription('今日の日記を書く')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('過去の日記を見る')
                .addStringOption(option =>
                    option.setName('date')
                        .setDescription('日付 (YYYY-MM-DD形式、省略で今日)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('goal')
                .setDescription('目標設定・編集')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('review')
                .setDescription('振り返り')
                .addStringOption(option =>
                    option.setName('period')
                        .setDescription('期間')
                        .setRequired(true)
                        .addChoices(
                            { name: '週次', value: 'weekly' },
                            { name: '月次', value: 'monthly' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('統計・グラフ表示')
        );
}

// コマンド処理
async function handleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'write':
            await handleDiaryWrite(interaction);
            break;
        case 'view':
            await handleDiaryView(interaction);
            break;
        case 'goal':
            await handleGoalSetting(interaction);
            break;
        case 'review':
            await handleReview(interaction);
            break;
        case 'stats':
            await handleStats(interaction);
            break;
    }
}

// 日記作成処理
async function handleDiaryWrite(interaction) {
    const today = moment().format('YYYY-MM-DD');
    
    // 今日の日記が既に存在するかチェック
    const existingEntry = await sheetsUtils.getDiaryEntry(interaction.user.id, today);
    
    const embed = new EmbedBuilder()
        .setTitle('📝 今日の日記を書きましょう')
        .setDescription(`日付: ${today}${existingEntry ? '\n⚠️ 今日の日記は既に書かれています。上書きしますか？' : ''}`)
        .setColor(0x00AE86);

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('write_diary')
                .setLabel('日記を書く')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝')
        );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// 日記閲覧処理
async function handleDiaryView(interaction) {
    const date = interaction.options.getString('date') || moment().format('YYYY-MM-DD');
    const entry = await sheetsUtils.getDiaryEntry(interaction.user.id, date);
    
    if (!entry) {
        await interaction.reply({ content: `${date} の日記は見つかりませんでした。`, ephemeral: true });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`📖 ${date} の日記`)
        .setDescription(entry.content)
        .addFields(
            { name: '気分', value: entry.mood, inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 目標設定処理
async function handleGoalSetting(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 目標設定')
        .setDescription('設定したい目標の種類を選んでください')
        .setColor(0x00AE86);

    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('goal_type')
        .setPlaceholder('目標の種類を選択...')
        .addOptions([
            {
                label: '体重目標',
                description: '目標体重を設定',
                value: 'weight_goal',
                emoji: '⚖️'
            },
            {
                label: '習慣目標',
                description: '習慣の目標を設定',
                value: 'habit_goal',
                emoji: '📅'
            },
            {
                label: '月間目標',
                description: '今月の目標を設定',
                value: 'monthly_goal',
                emoji: '🗓️'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// 振り返り処理
async function handleReview(interaction) {
    const period = interaction.options.getString('period');
    const userId = interaction.user.id;
    
    let startDate, endDate, title;
    
    if (period === 'weekly') {
        startDate = moment().startOf('week');
        endDate = moment().endOf('week');
        title = '📊 今週の振り返り';
    } else {
        startDate = moment().startOf('month');
        endDate = moment().endOf('month');
        title = '📊 今月の振り返り';
    }
    
    const entries = await sheetsUtils.getDiaryEntriesInRange(userId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
    
    if (entries.length === 0) {
        await interaction.reply({ content: 'この期間の日記データがありません。', ephemeral: true });
        return;
    }
    
    // 統計計算
    const avgMood = calculations.calculateAverageMood(entries);
    const diaryDays = entries.length;
    
    // 体重データを別途取得
    const weightEntries = await sheetsUtils.getWeightEntriesInRange(userId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
    const weightChange = calculations.calculateWeightChangeFromEntries(weightEntries);
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${startDate.format('MM/DD')} - ${endDate.format('MM/DD')}`)
        .addFields(
            { name: '📝 日記を書いた日数', value: `${diaryDays}日`, inline: true },
            { name: '😊 平均気分', value: avgMood, inline: true },
            { name: '⚖️ 体重変化', value: weightChange, inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 統計表示処理
async function handleStats(interaction) {
    const userId = interaction.user.id;
    const last30Days = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const today = moment().format('YYYY-MM-DD');
    
    const entries = await sheetsUtils.getDiaryEntriesInRange(userId, last30Days, today);
    
    if (entries.length === 0) {
        await interaction.reply({ content: '過去30日間のデータがありません。', ephemeral: true });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('📈 過去30日間の統計')
        .addFields(
            { name: '📝 日記記録日数', value: `${entries.length}/30日`, inline: true },
            { name: '😊 最高の気分の日', value: `${calculations.countMoodDays(entries, '😊')}日`, inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
    createCommand,
    handleCommand,
    handleDiaryWrite,
    handleDiaryView,
    handleGoalSetting,
    handleReview,
    handleStats
};
