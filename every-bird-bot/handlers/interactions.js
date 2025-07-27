const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const moment = require('moment');
const sheetsUtils = require('../utils/sheets');
const calculations = require('../utils/calculations');
const validation = require('../utils/validation');
const habitCommands = require('../commands/habit');
const config = require('../config.json');

// インタラクション処理のメイン関数
async function handleInteraction(interaction) {
    try {
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModalSubmit(interaction);
        } else if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction);
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
}

// ===== ボタンインタラクション処理 =====

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'write_diary') {
        await showDiaryModal(interaction);
    } else if (customId === 'add_habit') {
        await showHabitAddModal(interaction);
    } else if (customId === 'quick_done') {
        await showQuickDoneMenu(interaction);
    } else if (customId.startsWith('calendar_prev_')) {
        await handleCalendarNavigation(interaction, 'prev');
    } else if (customId.startsWith('calendar_next_')) {
        await handleCalendarNavigation(interaction, 'next');
    } else if (customId.startsWith('confirm_delete_')) {
        await confirmHabitDelete(interaction);
    } else if (customId === 'cancel_delete') {
        await interaction.update({ content: 'キャンセルしました。', embeds: [], components: [] });
    } else if (customId === 'daily_motivation') {
        await handleDailyMotivation(interaction);
    }
}

// ===== セレクトメニューインタラクション処理 =====

async function handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'goal_type') {
        await handleGoalTypeSelection(interaction);
    } else if (customId === 'quick_done_habits') {
        await handleQuickDone(interaction);
    } else if (customId.startsWith('edit_habit_')) {
        await handleHabitEditSelection(interaction);
    }
}

// ===== モーダル送信処理 =====

async function handleModalSubmit(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'diary_modal') {
        await saveDiaryEntry(interaction);
    } else if (customId === 'habit_add_modal') {
        await saveNewHabit(interaction);
    }
}

// ===== オートコンプリート処理 =====

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

// ===== 日記関連モーダル =====

async function showDiaryModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('diary_modal')
        .setTitle('今日の日記');

    const diaryInput = new TextInputBuilder()
        .setCustomId('diary_content')
        .setLabel('今日の出来事・感想')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('今日あった出来事や感じたことを書いてください...')
        .setRequired(true)
        .setMaxLength(2000);

    const moodInput = new TextInputBuilder()
        .setCustomId('mood')
        .setLabel('今日の気分 (😊🙂😐😔😞から選択)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('😊')
        .setRequired(true)
        .setMaxLength(2);

    const firstActionRow = new ActionRowBuilder().addComponents(diaryInput);
    const secondActionRow = new ActionRowBuilder().addComponents(moodInput);

    modal.addComponents(firstActionRow, secondActionRow);
    
    await interaction.showModal(modal);
}

async function saveDiaryEntry(interaction) {
    const content = interaction.fields.getTextInputValue('diary_content');
    const mood = interaction.fields.getTextInputValue('mood');
    
    // バリデーション
    const diaryData = { content, mood };
    const validationResult = validation.validateDiaryData(diaryData);
    
    if (!validationResult.isValid) {
        await interaction.reply({ 
            content: `❌ 入力エラー:\n${validationResult.errors.join('\n')}`, 
            ephemeral: true 
        });
        return;
    }
    
    const today = moment().format('YYYY-MM-DD');
    const userId = interaction.user.id;
    
    try {
        // 入力をサニタイズ
        const sanitizedContent = validation.sanitizeInput(content);
        
        await sheetsUtils.saveDiaryToSheet(userId, today, sanitizedContent, mood);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ 日記を保存しました')
            .setDescription(`日付: ${today}`)
            .addFields(
                { name: '気分', value: `${mood} ${config.mood_emojis[mood]}`, inline: true }
            )
            .setColor(0x00AE86)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('日記保存エラー:', error);
        await interaction.reply({ content: '日記の保存中にエラーが発生しました。', ephemeral: true });
    }
}

// ===== 習慣関連モーダル =====

async function showHabitAddModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('habit_add_modal')
        .setTitle('新しい習慣を追加');

    const nameInput = new TextInputBuilder()
        .setCustomId('habit_name')
        .setLabel('習慣名')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例: 朝の散歩')
        .setRequired(true)
        .setMaxLength(50);

    const categoryInput = new TextInputBuilder()
        .setCustomId('habit_category')
        .setLabel('カテゴリ絵文字 (🏃‍♂️📚💼🎨🧘🏠👥)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('🏃‍♂️')
        .setRequired(true)
        .setMaxLength(2);

    const frequencyInput = new TextInputBuilder()
        .setCustomId('habit_frequency')
        .setLabel('頻度 (daily, weekly, custom)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('daily')
        .setRequired(true)
        .setMaxLength(10);

    const difficultyInput = new TextInputBuilder()
        .setCustomId('habit_difficulty')
        .setLabel('難易度 (easy, normal, hard)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('normal')
        .setRequired(true)
        .setMaxLength(10);

    const firstRow = new ActionRowBuilder().addComponents(nameInput);
    const secondRow = new ActionRowBuilder().addComponents(categoryInput);
    const thirdRow = new ActionRowBuilder().addComponents(frequencyInput);
    const fourthRow = new ActionRowBuilder().addComponents(difficultyInput);

    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
    
    await interaction.showModal(modal);
}

async function saveNewHabit(interaction) {
    const name = interaction.fields.getTextInputValue('habit_name');
    const category = interaction.fields.getTextInputValue('habit_category');
    const frequency = interaction.fields.getTextInputValue('habit_frequency');
    const difficulty = interaction.fields.getTextInputValue('habit_difficulty');
    
    // バリデーション
    const habitData = { name, category, frequency, difficulty };
    const validationResult = validation.validateHabitData(habitData);
    
    if (!validationResult.isValid) {
        await interaction.reply({ 
            content: `❌ 入力エラー:\n${validationResult.errors.join('\n')}`, 
            ephemeral: true 
        });
        return;
    }
    
    // 既存習慣との重複チェック
    const existingHabits = await sheetsUtils.getUserHabits(interaction.user.id);
    if (!validation.validateUniqueHabitName(name, existingHabits)) {
        await interaction.reply({ 
            content: '❌ 同じ名前の習慣が既に存在します。', 
            ephemeral: true 
        });
        return;
    }
    
    try {
        // 入力をサニタイズ
        const sanitizedName = validation.sanitizeInput(name);
        
        const habitId = await sheetsUtils.saveHabitToSheet(
            interaction.user.id, 
            sanitizedName, 
            category, 
            frequency, 
            difficulty
        );
        
        const embed = new EmbedBuilder()
            .setTitle('✅ 新しい習慣を追加しました')
            .addFields(
                { name: '習慣名', value: sanitizedName, inline: true },
                { name: 'カテゴリ', value: `${category} ${config.habit_categories[category]}`, inline: true },
                { name: '頻度', value: config.habit_frequencies[frequency], inline: true },
                { name: '難易度', value: `${config.habit_difficulties[difficulty].emoji} ${config.habit_difficulties[difficulty].name}`, inline: true }
            )
            .setColor(0x00AE86)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('習慣保存エラー:', error);
        await interaction.reply({ content: '習慣の保存中にエラーが発生しました。', ephemeral: true });
    }
}

// ===== クイック完了機能 =====

async function showQuickDoneMenu(interaction) {
    const userId = interaction.user.id;
    const habits = await sheetsUtils.getUserHabits(userId);
    const today = moment().format('YYYY-MM-DD');
    const todayLogs = await sheetsUtils.getHabitLogsForDate(userId, today);
    
    // 未完了の習慣のみ表示
    const pendingHabits = habits.filter(habit => 
        !todayLogs.some(log => log.habitId === habit.id)
    );
    
    if (pendingHabits.length === 0) {
        await interaction.update({ 
            content: '🎉 今日の習慣は全て完了しています！', 
            embeds: [], 
            components: [] 
        });
        return;
    }
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('quick_done_habits')
        .setPlaceholder('完了した習慣を選択...')
        .addOptions(
            pendingHabits.slice(0, 25).map(habit => ({
                label: habit.name,
                description: `${config.habit_categories[habit.category]} | ${config.habit_difficulties[habit.difficulty].emoji} ${config.habit_difficulties[habit.difficulty].name}`,
                value: habit.id,
                emoji: habit.category
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.update({ 
        content: '完了した習慣を選択してください:', 
        embeds: [], 
        components: [row] 
    });
}

async function handleQuickDone(interaction) {
    const habitId = interaction.values[0];
    const userId = interaction.user.id;
    const today = moment().format('YYYY-MM-DD');
    
    const habit = await sheetsUtils.getHabitById(habitId);
    if (!habit) {
        await interaction.update({ content: '習慣が見つかりません。', components: [] });
        return;
    }
    
    // 習慣ログを保存
    await sheetsUtils.saveHabitLog(userId, habitId, today);
    
    // ストリーク更新
    const newStreak = await sheetsUtils.updateHabitStreak(userId, habitId);
    
    const embed = new EmbedBuilder()
        .setTitle(`✅ ${habit.name} 完了！`)
        .setDescription(`${newStreak}日連続達成中！ 🎉`)
        .addFields(
            { name: '獲得ポイント', value: `${config.habit_difficulties[habit.difficulty].points}pts`, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();
    
    await interaction.update({ embeds: [embed], components: [] });
}

// ===== カレンダーナビゲーション =====

async function handleCalendarNavigation(interaction, direction) {
    const [, , year, month] = interaction.customId.split('_').map(Number);
    let newYear = year;
    let newMonth = month;
    
    if (direction === 'prev') {
        newMonth--;
        if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        }
    } else {
        newMonth++;
        if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        }
    }
    
    const calendar = await calculations.generateHabitCalendar(interaction.user.id, newYear, newMonth);
    
    const embed = new EmbedBuilder()
        .setTitle(`📅 習慣カレンダー - ${newYear}年${newMonth}月`)
        .setDescription(calendar.description)
        .addFields({ name: 'カレンダー', value: calendar.display })
        .setColor(0x00AE86)
        .setFooter({ text: '✅ = 完了, ⭕ = 未完了, 📝 = 日記あり, 🔶 = 一部完了' });
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`calendar_prev_${newYear}_${newMonth}`)
                .setLabel('前月')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('◀️'),
            new ButtonBuilder()
                .setCustomId(`calendar_next_${newYear}_${newMonth}`)
                .setLabel('次月')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('▶️')
        );
    
    await interaction.update({ embeds: [embed], components: [row] });
}

// ===== 習慣削除確認 =====

async function confirmHabitDelete(interaction) {
    const habitId = interaction.customId.split('_')[2];
    
    try {
        await sheetsUtils.deleteHabitFromSheet(habitId);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ 習慣を削除しました')
            .setDescription('習慣とそのログが削除されました。')
            .setColor(0x00FF00);
        
        await interaction.update({ embeds: [embed], components: [] });
    } catch (error) {
        console.error('習慣削除エラー:', error);
        await interaction.update({ content: '削除中にエラーが発生しました。', embeds: [], components: [] });
    }
}

// ===== 目標タイプ選択 =====

async function handleGoalTypeSelection(interaction) {
    const goalType = interaction.values[0];
    
    // 各目標タイプに応じた処理
    let response = '';
    switch (goalType) {
        case 'weight_goal':
            response = '⚖️ 体重目標は `/weight goal` コマンドで設定できます。';
            break;
        case 'habit_goal':
            response = '📅 習慣目標の設定機能は開発中です。';
            break;
        case 'monthly_goal':
            response = '🗓️ 月間目標の設定機能は開発中です。';
            break;
    }
    
    await interaction.update({ content: response, embeds: [], components: [] });
}

// ===== 習慣編集選択処理 =====

async function handleHabitEditSelection(interaction) {
    const habitId = interaction.customId.split('_')[2];
    const editType = interaction.values[0];
    
    // 編集用のモーダルまたは選択メニューを表示
    // この部分は実装を簡略化
    await interaction.update({ 
        content: `${editType} の編集機能は開発中です。現在は習慣を削除して再作成してください。`, 
        embeds: [], 
        components: [] 
    });
}

// ===== デイリーモチベーション =====

async function handleDailyMotivation(interaction) {
    const motivationMessages = [
        '今日という日は、残りの人生の最初の日だ！ 🌟',
        '小さな一歩が大きな変化を生む 👣',
        '継続は力なり。今日も一歩前進しよう！ 💪',
        '完璧を目指さず、進歩を目指そう 📈',
        '今日の努力は明日の自分への贈り物 🎁',
        '習慣が人を作る。素晴らしい習慣を築こう 🏗️',
        '今日できることに集中しよう！ 🎯',
        '成功は日々の小さな努力の積み重ね ⭐',
        '挑戦することで新しい自分に出会える 🚀',
        '今日も素晴らしい一日にしていこう！ ✨'
    ];
    
    const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];
    
    await interaction.reply({ 
        content: randomMessage, 
        ephemeral: true 
    });
}

module.exports = {
    handleInteraction,
    handleButtonInteraction,
    handleSelectMenuInteraction,
    handleModalSubmit,
    handleAutocomplete,
    showDiaryModal,
    showHabitAddModal,
    saveDiaryEntry,
    saveNewHabit
};
