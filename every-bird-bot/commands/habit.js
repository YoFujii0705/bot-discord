const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const moment = require('moment');
const sheetsUtils = require('../utils/sheets');
const calculations = require('../utils/calculations');
const config = require('../config.json');

// コマンド定義
function createCommand() {
    return new SlashCommandBuilder()
        .setName('habit')
        .setDescription('習慣管理機能')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('新しい習慣を追加')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('習慣一覧を表示')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('done')
                .setDescription('習慣を完了としてマーク')
                .addStringOption(option =>
                    option.setName('habit')
                        .setDescription('完了した習慣')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('習慣を編集')
                .addStringOption(option =>
                    option.setName('habit')
                        .setDescription('編集する習慣')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('習慣を削除')
                .addStringOption(option =>
                    option.setName('habit')
                        .setDescription('削除する習慣')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('calendar')
                .setDescription('カレンダー表示')
                .addStringOption(option =>
                    option.setName('month')
                        .setDescription('表示する月 (YYYY-MM形式、省略で今月)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('habit')
                        .setDescription('特定の習慣のみ表示')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('習慣の統計表示')
                .addStringOption(option =>
                    option.setName('habit')
                        .setDescription('特定の習慣の統計（省略で全体）')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        );
}

// コマンド処理
async function handleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'add':
            await handleHabitAdd(interaction);
            break;
        case 'list':
            await handleHabitList(interaction);
            break;
        case 'done':
            await handleHabitDone(interaction);
            break;
        case 'edit':
            await handleHabitEdit(interaction);
            break;
        case 'delete':
            await handleHabitDelete(interaction);
            break;
        case 'calendar':
            await handleHabitCalendar(interaction);
            break;
        case 'stats':
            await handleHabitStats(interaction);
            break;
    }
}

// 習慣追加処理
async function handleHabitAdd(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('➕ 新しい習慣を追加')
        .setDescription('追加したい習慣の情報を入力してください')
        .setColor(0x00AE86);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('add_habit')
                .setLabel('習慣を追加')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➕')
        );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// 習慣一覧表示
async function handleHabitList(interaction) {
    const userId = interaction.user.id;
    const habits = await sheetsUtils.getUserHabits(userId);
    
    if (habits.length === 0) {
        await interaction.reply({ content: '登録された習慣がありません。`/habit add` で習慣を追加してください。', ephemeral: true });
        return;
    }
    
    const today = moment().format('YYYY-MM-DD');
    const todayLogs = await sheetsUtils.getHabitLogsForDate(userId, today);
    
    const embed = new EmbedBuilder()
        .setTitle('📋 あなたの習慣一覧')
        .setDescription(`${today} の状況`)
        .setColor(0x00AE86);
    
    habits.forEach(habit => {
        const isDone = todayLogs.some(log => log.habitId === habit.id);
        const statusEmoji = isDone ? '✅' : '⭕';
        const streakInfo = `${habit.currentStreak}日連続`;
        
        embed.addFields({
            name: `${statusEmoji} ${habit.category} ${habit.name}`,
            value: `頻度: ${config.habit_frequencies[habit.frequency]} | 難易度: ${config.habit_difficulties[habit.difficulty].emoji} | ${streakInfo}`,
            inline: false
        });
    });
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quick_done')
                .setLabel('クイック完了')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// 習慣完了処理
async function handleHabitDone(interaction) {
    const habitName = interaction.options.getString('habit');
    const userId = interaction.user.id;
    const today = moment().format('YYYY-MM-DD');
    
    const habit = await sheetsUtils.getHabitByName(userId, habitName);
    if (!habit) {
        await interaction.reply({ content: '指定された習慣が見つかりません。', ephemeral: true });
        return;
    }
    
    // 今日既に完了しているかチェック
    const existingLog = await sheetsUtils.getHabitLog(userId, habit.id, today);
    if (existingLog) {
        await interaction.reply({ content: `${habit.name} は今日既に完了しています！`, ephemeral: true });
        return;
    }
    
    // 習慣ログを保存
    await sheetsUtils.saveHabitLog(userId, habit.id, today);
    
    // ストリーク更新
    const newStreak = await sheetsUtils.updateHabitStreak(userId, habit.id);
    
    // お祝いメッセージ
    const celebrationMessages = [
        'やったね！🎉', '素晴らしい！👏', 'お疲れ様！✨', 'その調子！🔥', '継続は力なり！💪'
    ];
    const randomMessage = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];
    
    const embed = new EmbedBuilder()
        .setTitle(`✅ ${habit.name} 完了！`)
        .setDescription(`${randomMessage}\n\n**${newStreak}日連続達成中！**`)
        .addFields(
            { name: '獲得ポイント', value: `${config.habit_difficulties[habit.difficulty].points}pts`, inline: true },
            { name: '今日の日付', value: today, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// 習慣カレンダー表示
async function handleHabitCalendar(interaction) {
    const month = interaction.options.getString('month') || moment().format('YYYY-MM');
    const specificHabit = interaction.options.getString('habit');
    const userId = interaction.user.id;
    
    try {
        const [year, monthNum] = month.split('-').map(Number);
        const calendar = await calculations.generateHabitCalendar(userId, year, monthNum, specificHabit);
        
        const embed = new EmbedBuilder()
            .setTitle(`📅 習慣カレンダー - ${year}年${monthNum}月`)
            .setDescription(calendar.description)
            .addFields({ name: 'カレンダー', value: calendar.display })
            .setColor(0x00AE86)
            .setFooter({ text: '✅ = 完了, ⭕ = 未完了, 📝 = 日記あり, 🔶 = 一部完了' });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`calendar_prev_${year}_${monthNum}`)
                    .setLabel('前月')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('◀️'),
                new ButtonBuilder()
                    .setCustomId(`calendar_next_${year}_${monthNum}`)
                    .setLabel('次月')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('▶️')
            );
        
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } catch (error) {
        console.error('カレンダー生成エラー:', error);
        await interaction.reply({ content: '無効な月形式です。YYYY-MM形式で入力してください。', ephemeral: true });
    }
}

// 習慣統計表示
async function handleHabitStats(interaction) {
    const specificHabit = interaction.options.getString('habit');
    const userId = interaction.user.id;
    
    if (specificHabit) {
        await showSpecificHabitStats(interaction, userId, specificHabit);
    } else {
        await showOverallHabitStats(interaction, userId);
    }
}

// 特定習慣の統計表示
async function showSpecificHabitStats(interaction, userId, habitName) {
    const habit = await sheetsUtils.getHabitByName(userId, habitName);
    if (!habit) {
        await interaction.reply({ content: '指定された習慣が見つかりません。', ephemeral: true });
        return;
    }
    
    const last30Days = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const today = moment().format('YYYY-MM-DD');
    
    const logs = await sheetsUtils.getHabitLogsInRange(userId, last30Days, today);
    const habitLogs = logs.filter(log => log.habitId === habit.id);
    
    const completionRate = ((habitLogs.length / 30) * 100).toFixed(1);
    const bestStreak = await calculations.calculateBestStreak(userId, habit.id);
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 ${habit.category} ${habit.name} の統計`)
        .setDescription('過去30日間のデータ')
        .addFields(
            { name: '達成日数', value: `${habitLogs.length}/30日`, inline: true },
            { name: '達成率', value: `${completionRate}%`, inline: true },
            { name: '現在のストリーク', value: `${habit.currentStreak}日`, inline: true },
            { name: '最高ストリーク', value: `${bestStreak}日`, inline: true },
            { name: '難易度', value: `${config.habit_difficulties[habit.difficulty].emoji} ${config.habit_difficulties[habit.difficulty].name}`, inline: true },
            { name: '総獲得ポイント', value: `${habitLogs.length * config.habit_difficulties[habit.difficulty].points}pts`, inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 全体習慣統計表示
async function showOverallHabitStats(interaction, userId) {
    const habits = await sheetsUtils.getUserHabits(userId);
    if (habits.length === 0) {
        await interaction.reply({ content: '登録された習慣がありません。', ephemeral: true });
        return;
    }
    
    const last30Days = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const today = moment().format('YYYY-MM-DD');
    
    const logs = await sheetsUtils.getHabitLogsInRange(userId, last30Days, today);
    
    // 統計計算
    const totalCompletions = logs.length;
    const activeDays = new Set(logs.map(log => log.date)).size;
    const totalPossibleCompletions = habits.length * 30;
    const overallRate = ((totalCompletions / totalPossibleCompletions) * 100).toFixed(1);
    
    // 最も達成率の高い習慣
    let bestHabit = null;
    let bestRate = 0;
    
    for (const habit of habits) {
        const habitLogs = logs.filter(log => log.habitId === habit.id);
        const rate = (habitLogs.length / 30) * 100;
        if (rate > bestRate) {
            bestRate = rate;
            bestHabit = habit;
        }
    }
    
    const embed = new EmbedBuilder()
        .setTitle('📊 全体の習慣統計')
        .setDescription('過去30日間の概要')
        .addFields(
            { name: '登録習慣数', value: `${habits.length}個`, inline: true },
            { name: '総達成数', value: `${totalCompletions}回`, inline: true },
            { name: '活動日数', value: `${activeDays}/30日`, inline: true },
            { name: '全体達成率', value: `${overallRate}%`, inline: true },
            { name: '最高達成習慣', value: bestHabit ? `${bestHabit.category} ${bestHabit.name} (${bestRate.toFixed(1)}%)` : 'なし', inline: false }
        )
        .setColor(0x00AE86)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 習慣編集処理
async function handleHabitEdit(interaction) {
    const habitName = interaction.options.getString('habit');
    const userId = interaction.user.id;
    
    const habit = await sheetsUtils.getHabitByName(userId, habitName);
    if (!habit) {
        await interaction.reply({ content: '指定された習慣が見つかりません。', ephemeral: true });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`✏️ ${habit.name} を編集`)
        .setDescription('編集したい項目を選択してください')
        .addFields(
            { name: '現在の設定', value: `カテゴリ: ${habit.category}\n頻度: ${config.habit_frequencies[habit.frequency]}\n難易度: ${config.habit_difficulties[habit.difficulty].emoji} ${config.habit_difficulties[habit.difficulty].name}` }
        )
        .setColor(0x00AE86);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`edit_habit_${habit.id}`)
        .setPlaceholder('編集する項目を選択...')
        .addOptions([
            {
                label: '習慣名',
                description: '習慣の名前を変更',
                value: 'name',
                emoji: '📝'
            },
            {
                label: 'カテゴリ',
                description: 'カテゴリを変更',
                value: 'category',
                emoji: '📁'
            },
            {
                label: '頻度',
                description: '実行頻度を変更',
                value: 'frequency',
                emoji: '📅'
            },
            {
                label: '難易度',
                description: '難易度を変更',
                value: 'difficulty',
                emoji: '⚡'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// 習慣削除処理
async function handleHabitDelete(interaction) {
    const habitName = interaction.options.getString('habit');
    const userId = interaction.user.id;
    
    const habit = await sheetsUtils.getHabitByName(userId, habitName);
    if (!habit) {
        await interaction.reply({ content: '指定された習慣が見つかりません。', ephemeral: true });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('⚠️ 習慣の削除確認')
        .setDescription(`**${habit.category} ${habit.name}** を削除しますか？\n\n⚠️ この操作は取り消せません。過去のログも削除されます。`)
        .setColor(0xFF0000);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_delete_${habit.id}`)
                .setLabel('削除する')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('cancel_delete')
                .setLabel('キャンセル')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// オートコンプリート処理
async function handleAutocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const userId = interaction.user.id;
    
    if (focusedOption.name === 'habit') {
        const habits = await sheetsUtils.getUserHabits(userId);
        const filtered = habits.filter(habit => 
            habit.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        ).slice(0, 25);
        
        const choices = filtered.map(habit => ({
            name: `${habit.category} ${habit.name}`,
            value: habit.name
        }));
        
        await interaction.respond(choices);
    }
}

module.exports = {
    createCommand,
    handleCommand,
    handleHabitAdd,
    handleHabitList,
    handleHabitDone,
    handleHabitEdit,
    handleHabitDelete,
    handleHabitCalendar,
    handleHabitStats,
    handleAutocomplete
};
