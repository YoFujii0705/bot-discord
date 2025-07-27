const moment = require('moment');
const calculations = require('./calculations');
const config = require('../config.json');

// 体重目標の健康分析
function analyzeWeightGoal(currentWeight, targetWeight, deadline, height) {
    const analysis = {
        isHealthy: true,
        warnings: [],
        recommendations: []
    };
    
    const weightChange = Math.abs(targetWeight - currentWeight);
    const isLoss = targetWeight < currentWeight;
    
    // 期限がある場合の分析
    if (deadline) {
        const daysUntilDeadline = moment(deadline).diff(moment(), 'days');
        const weeksUntilDeadline = daysUntilDeadline / 7;
        
        if (daysUntilDeadline <= 0) {
            analysis.warnings.push('⚠️ 期限が過去または今日になっています。現実的な期限を設定してください。');
            analysis.isHealthy = false;
        } else if (weeksUntilDeadline > 0) {
            const weeklyRate = weightChange / weeksUntilDeadline;
            
            if (isLoss) {
                // 減量の場合
                if (weeklyRate > config.weight_guidance.safe_loss_rate.weekly_max) {
                    analysis.warnings.push(config.weight_guidance.warnings.too_fast);
                    analysis.recommendations.push(`💚 より安全な目標: ${Math.ceil(weeksUntilDeadline * config.weight_guidance.safe_loss_rate.weekly_max)}週後に${(currentWeight - weeksUntilDeadline * config.weight_guidance.safe_loss_rate.weekly_max).toFixed(1)}kg`);
                    analysis.isHealthy = false;
                } else if (weeklyRate < config.weight_guidance.safe_loss_rate.weekly_min) {
                    analysis.recommendations.push('💪 もう少し積極的な目標設定も可能です。週0.5-1kgのペースが効果的です。');
                }
            } else {
                // 増量の場合
                if (weeklyRate > 0.5) {
                    analysis.warnings.push('⚠️ 急激な増量は健康に良くありません。週0.2-0.5kgのペースが推奨されます。');
                    analysis.isHealthy = false;
                }
            }
        }
    }
    
    // BMI基準の分析
    if (height) {
        const currentBMI = calculations.calculateBMI(currentWeight, height);
        const targetBMI = calculations.calculateBMI(targetWeight, height);
        const healthyRange = calculations.getHealthyWeightRange(height);
        
        // 現在が健康的範囲内で、さらに減量しようとしている場合
        if (currentBMI >= config.weight_guidance.bmi_ranges.normal_min && 
            currentBMI <= config.weight_guidance.bmi_ranges.normal_max && 
            isLoss && 
            targetBMI < config.weight_guidance.bmi_ranges.normal_min) {
            analysis.warnings.push('⚠️ 目標体重はBMI的に低体重になります。健康的な範囲での体重維持をお勧めします。');
            analysis.recommendations.push(`💚 健康的な目標範囲: ${healthyRange.min}-${healthyRange.max}kg`);
            analysis.isHealthy = false;
        }
        
        // 健康的範囲内にいて維持が良い場合
        if (currentBMI >= config.weight_guidance.bmi_ranges.normal_min && 
            currentBMI <= config.weight_guidance.bmi_ranges.normal_max && 
            Math.abs(currentWeight - targetWeight) < 2) {
            analysis.recommendations.push(config.weight_guidance.warnings.already_healthy);
        }
        
        // 目標が健康的範囲内の場合
        if (targetBMI >= config.weight_guidance.bmi_ranges.normal_min && 
            targetBMI <= config.weight_guidance.bmi_ranges.normal_max) {
            analysis.recommendations.push('✅ 目標体重は健康的なBMI範囲内です！');
        }
    }
    
    // 極端な変化の警告
    if (weightChange > 20) {
        analysis.warnings.push('🚨 大幅な体重変化は段階的に行うことをお勧めします。まずは5-10kgの中間目標を設定してみませんか？');
        analysis.isHealthy = false;
    }
    
    return analysis;
}

// 気分絵文字の検証
function validateMoodEmoji(mood) {
    return config.mood_emojis.hasOwnProperty(mood);
}

// 習慣カテゴリーの検証
function validateHabitCategory(category) {
    return config.habit_categories.hasOwnProperty(category);
}

// 習慣頻度の検証
function validateHabitFrequency(frequency) {
    return config.habit_frequencies.hasOwnProperty(frequency);
}

// 習慣難易度の検証
function validateHabitDifficulty(difficulty) {
    return config.habit_difficulties.hasOwnProperty(difficulty);
}

// 日付形式の検証
function validateDateFormat(dateString) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
        return false;
    }
    
    const date = moment(dateString, 'YYYY-MM-DD', true);
    return date.isValid();
}

// 体重値の検証（範囲チェック）
function validateWeight(weight) {
    return typeof weight === 'number' && weight >= 20 && weight <= 300;
}

// 身長値の検証（範囲チェック）
function validateHeight(height) {
    return typeof height === 'number' && height >= 100 && height <= 250;
}

// 文字列長の検証
function validateStringLength(str, maxLength) {
    return typeof str === 'string' && str.length <= maxLength;
}

// 期限日の検証（未来の日付かチェック）
function validateDeadline(deadline) {
    if (!validateDateFormat(deadline)) {
        return false;
    }
    
    const deadlineDate = moment(deadline);
    const today = moment();
    
    return deadlineDate.isAfter(today);
}

// 習慣名の重複チェック用バリデーション
function validateUniqueHabitName(habitName, existingHabits) {
    return !existingHabits.some(habit => 
        habit.name.toLowerCase() === habitName.toLowerCase()
    );
}

// BMI妥当性チェック
function validateBMIRange(bmi) {
    return bmi >= 10 && bmi <= 50; // 極端すぎる値を除外
}

// 全体的な入力サニタイゼーション
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    // HTMLタグの除去
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // 特殊文字のエスケープ
    sanitized = sanitized.replace(/[<>&"']/g, (char) => {
        const escapeMap = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;'
        };
        return escapeMap[char];
    });
    
    // 先頭・末尾の空白を除去
    return sanitized.trim();
}

// 複合バリデーション関数
function validateHabitData(habitData) {
    const errors = [];
    
    if (!habitData.name || habitData.name.trim().length === 0) {
        errors.push('習慣名は必須です。');
    } else if (!validateStringLength(habitData.name, 50)) {
        errors.push('習慣名は50文字以内で入力してください。');
    }
    
    if (!validateHabitCategory(habitData.category)) {
        errors.push('無効なカテゴリです。');
    }
    
    if (!validateHabitFrequency(habitData.frequency)) {
        errors.push('無効な頻度です。');
    }
    
    if (!validateHabitDifficulty(habitData.difficulty)) {
        errors.push('無効な難易度です。');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateWeightData(weightData) {
    const errors = [];
    
    if (!validateWeight(weightData.weight)) {
        errors.push('体重は20kg〜300kgの範囲で入力してください。');
    }
    
    if (weightData.memo && !validateStringLength(weightData.memo, 100)) {
        errors.push('メモは100文字以内で入力してください。');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateDiaryData(diaryData) {
    const errors = [];
    
    if (!diaryData.content || diaryData.content.trim().length === 0) {
        errors.push('日記内容は必須です。');
    } else if (!validateStringLength(diaryData.content, 2000)) {
        errors.push('日記内容は2000文字以内で入力してください。');
    }
    
    if (!validateMoodEmoji(diaryData.mood)) {
        errors.push('無効な気分絵文字です。');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    // 体重関連
    analyzeWeightGoal,
    validateWeight,
    validateHeight,
    validateBMIRange,
    validateWeightData,
    
    // 習慣関連
    validateHabitCategory,
    validateHabitFrequency,
    validateHabitDifficulty,
    validateUniqueHabitName,
    validateHabitData,
    
    // 日記関連
    validateMoodEmoji,
    validateDiaryData,
    
    // 共通
    validateDateFormat,
    validateDeadline,
    validateStringLength,
    sanitizeInput
};
