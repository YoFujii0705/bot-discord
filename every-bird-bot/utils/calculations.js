const moment = require('moment');
const sheetsUtils = require('./sheets');
const config = require('../config.json');

// ===== 気分関連計算 =====

function calculateAverageMood(entries) {
    const moodValues = { '😊': 5, '🙂': 4, '😐': 3, '😔': 2, '😞': 1 };
    const validEntries = entries.filter(entry => entry.mood && moodValues[entry.mood]);
    
    if (validEntries.length === 0) return '未記録';
    
    const sum = validEntries.reduce((acc, entry) => acc + moodValues[entry.mood], 0);
    const avg = sum / validEntries.length;
    
    if (avg >= 4.5) return '😊 とても良い';
    if (avg >= 3.5) return '🙂 良い';
    if (avg >= 2.5) return '😐 普通';
    if (avg >= 1.5) return '😔 悪い';
    return '😞 とても悪い';
}

function countMoodDays(entries, targetMood) {
    return entries.filter(entry => entry.mood === targetMood).length;
}

// ===== 体重関連計算 =====

function calculateWeightChangeFromEntries(entries) {
    if (entries.length < 2) return '変化なし';
    
    const firstWeight = parseFloat(entries[0].weight);
    const lastWeight = parseFloat(entries[entries.length - 1].weight);
    const change = lastWeight - firstWeight;
    
    if (change > 0) return `+${change.toFixed(1)}kg`;
    if (change < 0) return `${change.toFixed(1)}kg`;
    return '変化なし';
}

function calculateBMI(weight, height) {
    const heightInM = height / 100;
    return weight / (heightInM * heightInM);
}

function getBMICategory(bmi) {
    if (bmi < config.weight_guidance.bmi_ranges.underweight) return '低体重';
    if (bmi <= config.weight_guidance.bmi_ranges.normal_max) return '標準';
    if (bmi <= config.weight_guidance.bmi_ranges.overweight_max) return '過体重';
    return '肥満';
}

function getHealthyWeightRange(height) {
    const heightInM = height / 100;
    const minWeight = config.weight_guidance.bmi_ranges.normal_min * heightInM * heightInM;
    const maxWeight = config.weight_guidance.bmi_ranges.normal_max * heightInM * heightInM;
    
    return {
        min: minWeight.toFixed(1),
        max: maxWeight.toFixed(1)
    };
}

// 体重グラフ生成（簡易ASCII）
function generateWeightGraph(entries) {
    const weights = entries.map(e => parseFloat(e.weight));
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const range = maxWeight - minWeight;
    
    if (range === 0) {
        return `${minWeight}kg ──────────────`;
    }
    
    let graph = '';
    const graphHeight = 8;
    
    // Y軸ラベル
    for (let i = graphHeight; i >= 0; i--) {
        const value = minWeight + (range * i / graphHeight);
        graph += `${value.toFixed(1).padStart(5)} │`;
        
        // データポイント
        for (let j = 0; j < Math.min(entries.length, 20); j++) {
            const weight = weights[j];
            const normalizedHeight = Math.round((weight - minWeight) / range * graphHeight);
            
            if (normalizedHeight === i) {
                graph += '●';
            } else if (j > 0) {
                const prevWeight = weights[j - 1];
                const prevHeight = Math.round((prevWeight - minWeight) / range * graphHeight);
                if ((normalizedHeight < i && prevHeight >= i) || (normalizedHeight >= i && prevHeight < i)) {
                    graph += '│';
                } else {
                    graph += ' ';
                }
            } else {
                graph += ' ';
            }
        }
        graph += '\n';
    }
    
    // X軸
    graph += '      └';
    for (let i = 0; i < Math.min(entries.length, 20); i++) {
        graph += '─';
    }
    
    return graph;
}

// ===== 習慣関連計算 =====

async function calculateBestStreak(userId, habitId) {
    // 全期間のログを取得して最高ストリークを計算
    const logs = await sheetsUtils.getHabitLogsInRange(userId, '2020-01-01', moment().format('YYYY-MM-DD'));
    const habitLogs = logs.filter(log => log.habitId === habitId)
        .map(log => log.date)
        .sort();
    
    let maxStreak = 0;
    let currentStreak = 0;
    let previousDate = null;
    
    for (const dateStr of habitLogs) {
        const currentDate = moment(dateStr);
        
        if (previousDate && currentDate.diff(previousDate, 'days') === 1) {
            currentStreak++;
        } else {
            currentStreak = 1;
        }
        
        maxStreak = Math.max(maxStreak, currentStreak);
        previousDate = currentDate;
    }
    
    return maxStreak;
}

// カレンダー生成
async function generateHabitCalendar(userId, year, month, specificHabitName = null) {
    const startDate = moment(`${year}-${month}-01`);
    const endDate = startDate.clone().endOf('month');
    const daysInMonth = endDate.date();
    
    // 指定された習慣または全習慣を取得
    let habits;
    if (specificHabitName) {
        const habit = await sheetsUtils.getHabitByName(userId, specificHabitName);
        habits = habit ? [habit] : [];
    } else {
        habits = await sheetsUtils.getUserHabits(userId);
    }
    
    if (habits.length === 0) {
        return {
            description: specificHabitName ? '指定された習慣が見つかりません。' : '登録された習慣がありません。',
            display: 'データがありません。'
        };
    }
    
    // 該当月の習慣ログと日記を取得
    const habitLogs = await sheetsUtils.getHabitLogsInRange(userId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
    const diaryEntries = await sheetsUtils.getDiaryEntriesInRange(userId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
    
    // カレンダー表示を生成
    let calendarDisplay = '```\n';
    calendarDisplay += '日 月 火 水 木 金 土\n';
    
    // 月の最初の日の曜日を取得（0=日曜日）
    const firstDayWeekday = startDate.day();
    
    // 最初の週の空白を追加
    for (let i = 0; i < firstDayWeekday; i++) {
        calendarDisplay += '   ';
    }
    
    // 各日付を処理
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = moment(`${year}-${month}-${day.toString().padStart(2, '0')}`);
        const dateStr = currentDate.format('YYYY-MM-DD');
        
        // その日の習慣達成状況をチェック
        const dayHabitLogs = habitLogs.filter(log => log.date === dateStr);
        const hasDiary = diaryEntries.some(entry => entry.date === dateStr);
        
        let daySymbol;
        if (specificHabitName) {
            // 特定習慣の場合
            const habit = habits[0];
            const isCompleted = dayHabitLogs.some(log => log.habitId === habit.id);
            daySymbol = isCompleted ? '✅' : (hasDiary ? '📝' : '⭕');
        } else {
            // 全習慣の場合
            const completedCount = dayHabitLogs.length;
            const totalHabits = habits.length;
            
            if (completedCount === totalHabits && completedCount > 0) {
                daySymbol = '✅'; // 全完了
            } else if (completedCount > 0) {
                daySymbol = '🔶'; // 一部完了
            } else if (hasDiary) {
                daySymbol = '📝'; // 日記のみ
            } else {
                daySymbol = '⭕'; // 未完了
            }
        }
        
        calendarDisplay += daySymbol;
        
        // 週末で改行
        if ((firstDayWeekday + day - 1) % 7 === 6) {
            calendarDisplay += '\n';
        } else {
            calendarDisplay += ' ';
        }
    }
    
    calendarDisplay += '\n```';
    
    // 統計情報
    const totalDays = daysInMonth;
    const completedDays = specificHabitName ? 
        habitLogs.filter(log => log.habitId === habits[0].id).length :
        Array.from(new Set(habitLogs.map(log => log.date))).length;
    
    const completionRate = totalDays > 0 ? ((completedDays / totalDays) * 100).toFixed(1) : 0;
    
    return {
        description: specificHabitName ? 
            `**${habits[0].name}** の達成状況\n完了日数: ${completedDays}/${totalDays}日 (${completionRate}%)` :
            `全習慣の達成状況\n活動日数: ${completedDays}/${totalDays}日 (${completionRate}%)`,
        display: calendarDisplay
    };
}

module.exports = {
    // 気分関連
    calculateAverageMood,
    countMoodDays,
    
    // 体重関連
    calculateWeightChangeFromEntries,
    calculateBMI,
    getBMICategory,
    getHealthyWeightRange,
    generateWeightGraph,
    
    // 習慣関連
    calculateBestStreak,
    generateHabitCalendar
};
