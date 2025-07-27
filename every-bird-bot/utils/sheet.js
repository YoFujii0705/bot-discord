const { google } = require('googleapis');
const moment = require('moment');
const config = require('../config.json');

// Google Sheets API初期化
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// ===== 日記関連 =====

async function saveDiaryToSheet(userId, date, content, mood) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.diary_sheet_name}!A:E`;
    
    const values = [[
        date,
        userId,
        content,
        mood,
        moment().format('YYYY-MM-DD HH:mm:ss')
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
}

async function getDiaryEntry(userId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.diary_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const entry = rows.find(row => row[0] === date && row[1] === userId);
        
        if (entry) {
            return {
                date: entry[0],
                content: entry[2],
                mood: entry[3]
            };
        }
        return null;
    } catch (error) {
        console.error('日記取得エラー:', error);
        return null;
    }
}

async function getDiaryEntriesInRange(userId, startDate, endDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.diary_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => {
            const entryDate = row[0];
            const entryUserId = row[1];
            return entryUserId === userId && 
                   moment(entryDate).isBetween(startDate, endDate, 'day', '[]');
        }).map(row => ({
            date: row[0],
            content: row[2],
            mood: row[3]
        }));
    } catch (error) {
        console.error('日記取得エラー:', error);
        return [];
    }
}

// ===== 体重関連 =====

async function saveWeightToSheet(userId, date, weight, memo) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    // 既存のエントリーをチェック
    const existingEntry = await getWeightEntry(userId, date);
    
    if (existingEntry) {
        // 更新処理
        await updateWeightInSheet(userId, date, weight, memo);
    } else {
        // 新規追加
        const values = [[
            date,
            userId,
            weight,
            memo,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ]];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values }
        });
    }
}

async function getWeightEntry(userId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const entry = rows.find(row => row[0] === date && row[1] === userId);
        
        if (entry) {
            return {
                date: entry[0],
                userId: entry[1],
                weight: entry[2],
                memo: entry[3],
                timestamp: entry[4]
            };
        }
        return null;
    } catch (error) {
        console.error('体重取得エラー:', error);
        return null;
    }
}

async function updateWeightInSheet(userId, date, weight, memo) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === date && row[1] === userId);
        
        if (rowIndex !== -1) {
            const updateRange = `${config.google_sheets.weight_sheet_name}!C${rowIndex + 1}:E${rowIndex + 1}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [[weight, memo, moment().format('YYYY-MM-DD HH:mm:ss')]]
                }
            });
        }
    } catch (error) {
        console.error('体重更新エラー:', error);
        throw error;
    }
}

async function getWeightEntriesInRange(userId, startDate, endDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => {
            const entryDate = row[0];
            const entryUserId = row[1];
            return entryUserId === userId && 
                   moment(entryDate).isBetween(startDate, endDate, 'day', '[]');
        }).map(row => ({
            date: row[0],
            userId: row[1],
            weight: row[2],
            memo: row[3] || '',
            timestamp: row[4]
        })).sort((a, b) => moment(a.date).diff(moment(b.date)));
    } catch (error) {
        console.error('体重範囲取得エラー:', error);
        return [];
    }
}

async function getLastWeightEntry(userId, excludeDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const userEntries = rows.filter(row => row[1] === userId && row[0] !== excludeDate)
            .map(row => ({
                date: row[0],
                weight: row[2]
            }))
            .sort((a, b) => moment(b.date).diff(moment(a.date)));
        
        return userEntries[0] || null;
    } catch (error) {
        console.error('前回体重取得エラー:', error);
        return null;
    }
}

async function getLatestWeightEntry(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const userEntries = rows.filter(row => row[1] === userId)
            .map(row => ({
                date: row[0],
                weight: row[2],
                memo: row[3] || ''
            }))
            .sort((a, b) => moment(b.date).diff(moment(a.date)));
        
        return userEntries[0] || null;
    } catch (error) {
        console.error('最新体重取得エラー:', error);
        return null;
    }
}

async function saveWeightGoal(userId, target, deadline) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.goals_sheet_name}!A:E`;
    
    const goalId = `weight_goal_${Date.now()}`;
    const values = [[
        goalId,
        userId,
        'weight',
        JSON.stringify({ target, deadline }),
        moment().format('YYYY-MM-DD HH:mm:ss')
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
}

async function getWeightGoal(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.goals_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const goalEntry = rows.filter(row => row[1] === userId && row[2] === 'weight')
            .sort((a, b) => moment(b[4]).diff(moment(a[4])))[0];
        
        if (goalEntry) {
            const goalData = JSON.parse(goalEntry[3]);
            return {
                target: goalData.target,
                deadline: goalData.deadline
            };
        }
        return null;
    } catch (error) {
        console.error('体重目標取得エラー:', error);
        return null;
    }
}

// ===== 習慣関連 =====

async function getUserHabits(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => row[1] === userId && row[7] !== 'deleted').map(row => ({
            id: row[0],
            userId: row[1],
            name: row[2],
            category: row[3],
            frequency: row[4],
            difficulty: row[5],
            currentStreak: parseInt(row[6]) || 0,
            status: row[7] || 'active'
        }));
    } catch (error) {
        console.error('習慣取得エラー:', error);
        return [];
    }
}

async function getHabitByName(userId, habitName) {
    const habits = await getUserHabits(userId);
    return habits.find(habit => habit.name === habitName);
}

async function getHabitById(habitId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const habitRow = rows.find(row => row[0] === habitId);
        
        if (habitRow) {
            return {
                id: habitRow[0],
                userId: habitRow[1],
                name: habitRow[2],
                category: habitRow[3],
                frequency: habitRow[4],
                difficulty: habitRow[5],
                currentStreak: parseInt(habitRow[6]) || 0,
                status: habitRow[7] || 'active'
            };
        }
        return null;
    } catch (error) {
        console.error('習慣ID取得エラー:', error);
        return null;
    }
}

async function saveHabitToSheet(userId, name, category, frequency, difficulty) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    const habitId = `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const values = [[
        habitId,
        userId,
        name,
        category,
        frequency,
        difficulty,
        0, // 初期ストリーク
        'active'
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
    
    return habitId;
}

async function saveHabitLog(userId, habitId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    const values = [[
        moment().format('YYYY-MM-DD HH:mm:ss'),
        userId,
        habitId,
        date
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
}

async function getHabitLog(userId, habitId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.find(row => row[1] === userId && row[2] === habitId && row[3] === date);
    } catch (error) {
        console.error('習慣ログ取得エラー:', error);
        return null;
    }
}

async function getHabitLogsForDate(userId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => row[1] === userId && row[3] === date).map(row => ({
            timestamp: row[0],
            userId: row[1],
            habitId: row[2],
            date: row[3]
        }));
    } catch (error) {
        console.error('習慣ログ取得エラー:', error);
        return [];
    }
}

async function getHabitLogsInRange(userId, startDate, endDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => {
            const logDate = row[3];
            const logUserId = row[1];
            return logUserId === userId && 
                   moment(logDate).isBetween(startDate, endDate, 'day', '[]');
        }).map(row => ({
            timestamp: row[0],
            userId: row[1],
            habitId: row[2],
            date: row[3]
        }));
    } catch (error) {
        console.error('習慣ログ範囲取得エラー:', error);
        return [];
    }
}

async function updateHabitStreak(userId, habitId) {
    // ストリーク計算ロジック
    const habit = await getHabitById(habitId);
    if (!habit) return 0;
    
    let streak = 0;
    let currentDate = moment();
    
    // 今日から遡ってストリークを計算
    while (true) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        const log = await getHabitLog(userId, habitId, dateStr);
        
        if (log) {
            streak++;
            currentDate.subtract(1, 'day');
        } else {
            break;
        }
        
        // 無限ループ防止（最大100日）
        if (streak >= 100) break;
    }
    
    // スプレッドシートのストリーク更新
    await updateHabitStreakInSheet(habitId, streak);
    
    return streak;
}

async function updateHabitStreakInSheet(habitId, newStreak) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === habitId);
        
        if (rowIndex !== -1) {
            const updateRange = `${config.google_sheets.habits_sheet_name}!G${rowIndex + 1}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [[newStreak]]
                }
            });
        }
    } catch (error) {
        console.error('ストリーク更新エラー:', error);
    }
}

async function deleteHabitFromSheet(habitId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === habitId);
        
        if (rowIndex !== -1) {
            // ステータスを 'deleted' に変更
            const updateRange = `${config.google_sheets.habits_sheet_name}!H${rowIndex + 1}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [['deleted']]
                }
            });
        }
    } catch (error) {
        console.error('習慣削除エラー:', error);
        throw error;
    }
}

// ===== ユーザープロフィール関連 =====

async function saveUserProfile(userId, profile) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.user_profile_sheet_name}!A:D`;
    
    // 既存プロフィールをチェック
    const existing = await getUserProfile(userId);
    
    if (existing) {
        // 更新
        await updateUserProfile(userId, profile);
    } else {
        // 新規作成
        const values = [[
            userId,
            profile.height || '',
            profile.age || '',
            moment().format('YYYY-MM-DD HH:mm:ss')
        ]];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values }
        });
    }
}

async function getUserProfile(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.user_profile_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const profile = rows.find(row => row[0] === userId);
        
        if (profile) {
            return {
                height: parseFloat(profile[1]) || null,
                age: parseInt(profile[2]) || null
            };
        }
        return null;
    } catch (error) {
        console.error('プロフィール取得エラー:', error);
        return null;
    }
}

async function updateUserProfile(userId, profile) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.user_profile_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === userId);
        
        if (rowIndex !== -1) {
            const existing = await getUserProfile(userId);
            const updateRange = `${config.google_sheets.user_profile_sheet_name}!B${rowIndex + 1}:D${rowIndex + 1}`;
            
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [[
                        profile.height || existing?.height || '',
                        profile.age || existing?.age || '',
                        moment().format('YYYY-MM-DD HH:mm:ss')
                    ]]
                }
            });
        }
    } catch (error) {
        console.error('プロフィール更新エラー:', error);
    }
}

// ===== ヘルスチェック =====

async function testConnection() {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId
        });
        
        return {
            success: true,
            title: response.data.properties.title,
            sheetCount: response.data.sheets.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== バックアップ =====

async function exportSheetData(sheetName) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${sheetName}!A:Z`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        return {
            success: true,
            data: response.data.values || [],
            exportDate: moment().format('YYYY-MM-DD HH:mm:ss')
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    // 日記関連
    saveDiaryToSheet,
    getDiaryEntry,
    getDiaryEntriesInRange,
    
    // 体重関連
    saveWeightToSheet,
    getWeightEntry,
    updateWeightInSheet,
    getWeightEntriesInRange,
    getLastWeightEntry,
    getLatestWeightEntry,
    saveWeightGoal,
    getWeightGoal,
    
    // 習慣関連
    getUserHabits,
    getHabitByName,
    getHabitById,
    saveHabitToSheet,
    saveHabitLog,
    getHabitLog,
    getHabitLogsForDate,
    getHabitLogsInRange,
    updateHabitStreak,
    updateHabitStreakInSheet,
    deleteHabitFromSheet,
    
    // ユーザープロフィール関連
    saveUserProfile,
    getUserProfile,
    updateUserProfile,
    
    // ユーティリティ
    testConnection,
    exportSheetData
};const { google } = require('googleapis');
const moment = require('moment');
const config = require('../config.json');

// Google Sheets API初期化
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// ===== 日記関連 =====

async function saveDiaryToSheet(userId, date, content, mood) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.diary_sheet_name}!A:E`;
    
    const values = [[
        date,
        userId,
        content,
        mood,
        moment().format('YYYY-MM-DD HH:mm:ss')
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
}

async function getDiaryEntry(userId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.diary_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const entry = rows.find(row => row[0] === date && row[1] === userId);
        
        if (entry) {
            return {
                date: entry[0],
                content: entry[2],
                mood: entry[3]
            };
        }
        return null;
    } catch (error) {
        console.error('日記取得エラー:', error);
        return null;
    }
}

async function getDiaryEntriesInRange(userId, startDate, endDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.diary_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => {
            const entryDate = row[0];
            const entryUserId = row[1];
            return entryUserId === userId && 
                   moment(entryDate).isBetween(startDate, endDate, 'day', '[]');
        }).map(row => ({
            date: row[0],
            content: row[2],
            mood: row[3]
        }));
    } catch (error) {
        console.error('日記取得エラー:', error);
        return [];
    }
}

// ===== 体重関連 =====

async function saveWeightToSheet(userId, date, weight, memo) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    // 既存のエントリーをチェック
    const existingEntry = await getWeightEntry(userId, date);
    
    if (existingEntry) {
        // 更新処理
        await updateWeightInSheet(userId, date, weight, memo);
    } else {
        // 新規追加
        const values = [[
            date,
            userId,
            weight,
            memo,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ]];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values }
        });
    }
}

async function getWeightEntry(userId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const entry = rows.find(row => row[0] === date && row[1] === userId);
        
        if (entry) {
            return {
                date: entry[0],
                userId: entry[1],
                weight: entry[2],
                memo: entry[3],
                timestamp: entry[4]
            };
        }
        return null;
    } catch (error) {
        console.error('体重取得エラー:', error);
        return null;
    }
}

async function updateWeightInSheet(userId, date, weight, memo) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === date && row[1] === userId);
        
        if (rowIndex !== -1) {
            const updateRange = `${config.google_sheets.weight_sheet_name}!C${rowIndex + 1}:E${rowIndex + 1}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [[weight, memo, moment().format('YYYY-MM-DD HH:mm:ss')]]
                }
            });
        }
    } catch (error) {
        console.error('体重更新エラー:', error);
        throw error;
    }
}

async function getWeightEntriesInRange(userId, startDate, endDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => {
            const entryDate = row[0];
            const entryUserId = row[1];
            return entryUserId === userId && 
                   moment(entryDate).isBetween(startDate, endDate, 'day', '[]');
        }).map(row => ({
            date: row[0],
            userId: row[1],
            weight: row[2],
            memo: row[3] || '',
            timestamp: row[4]
        })).sort((a, b) => moment(a.date).diff(moment(b.date)));
    } catch (error) {
        console.error('体重範囲取得エラー:', error);
        return [];
    }
}

async function getLastWeightEntry(userId, excludeDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const userEntries = rows.filter(row => row[1] === userId && row[0] !== excludeDate)
            .map(row => ({
                date: row[0],
                weight: row[2]
            }))
            .sort((a, b) => moment(b.date).diff(moment(a.date)));
        
        return userEntries[0] || null;
    } catch (error) {
        console.error('前回体重取得エラー:', error);
        return null;
    }
}

async function getLatestWeightEntry(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.weight_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const userEntries = rows.filter(row => row[1] === userId)
            .map(row => ({
                date: row[0],
                weight: row[2],
                memo: row[3] || ''
            }))
            .sort((a, b) => moment(b.date).diff(moment(a.date)));
        
        return userEntries[0] || null;
    } catch (error) {
        console.error('最新体重取得エラー:', error);
        return null;
    }
}

async function saveWeightGoal(userId, target, deadline) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.goals_sheet_name}!A:E`;
    
    const goalId = `weight_goal_${Date.now()}`;
    const values = [[
        goalId,
        userId,
        'weight',
        JSON.stringify({ target, deadline }),
        moment().format('YYYY-MM-DD HH:mm:ss')
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
}

async function getWeightGoal(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.goals_sheet_name}!A:E`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const goalEntry = rows.filter(row => row[1] === userId && row[2] === 'weight')
            .sort((a, b) => moment(b[4]).diff(moment(a[4])))[0];
        
        if (goalEntry) {
            const goalData = JSON.parse(goalEntry[3]);
            return {
                target: goalData.target,
                deadline: goalData.deadline
            };
        }
        return null;
    } catch (error) {
        console.error('体重目標取得エラー:', error);
        return null;
    }
}

// ===== 習慣関連 =====

async function getUserHabits(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => row[1] === userId && row[7] !== 'deleted').map(row => ({
            id: row[0],
            userId: row[1],
            name: row[2],
            category: row[3],
            frequency: row[4],
            difficulty: row[5],
            currentStreak: parseInt(row[6]) || 0,
            status: row[7] || 'active'
        }));
    } catch (error) {
        console.error('習慣取得エラー:', error);
        return [];
    }
}

async function getHabitByName(userId, habitName) {
    const habits = await getUserHabits(userId);
    return habits.find(habit => habit.name === habitName);
}

async function getHabitById(habitId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const habitRow = rows.find(row => row[0] === habitId);
        
        if (habitRow) {
            return {
                id: habitRow[0],
                userId: habitRow[1],
                name: habitRow[2],
                category: habitRow[3],
                frequency: habitRow[4],
                difficulty: habitRow[5],
                currentStreak: parseInt(habitRow[6]) || 0,
                status: habitRow[7] || 'active'
            };
        }
        return null;
    } catch (error) {
        console.error('習慣ID取得エラー:', error);
        return null;
    }
}

async function saveHabitToSheet(userId, name, category, frequency, difficulty) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    const habitId = `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const values = [[
        habitId,
        userId,
        name,
        category,
        frequency,
        difficulty,
        0, // 初期ストリーク
        'active'
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
    
    return habitId;
}

async function saveHabitLog(userId, habitId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    const values = [[
        moment().format('YYYY-MM-DD HH:mm:ss'),
        userId,
        habitId,
        date
    ]];
    
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
    });
}

async function getHabitLog(userId, habitId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.find(row => row[1] === userId && row[2] === habitId && row[3] === date);
    } catch (error) {
        console.error('習慣ログ取得エラー:', error);
        return null;
    }
}

async function getHabitLogsForDate(userId, date) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => row[1] === userId && row[3] === date).map(row => ({
            timestamp: row[0],
            userId: row[1],
            habitId: row[2],
            date: row[3]
        }));
    } catch (error) {
        console.error('習慣ログ取得エラー:', error);
        return [];
    }
}

async function getHabitLogsInRange(userId, startDate, endDate) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habit_logs_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        return rows.filter(row => {
            const logDate = row[3];
            const logUserId = row[1];
            return logUserId === userId && 
                   moment(logDate).isBetween(startDate, endDate, 'day', '[]');
        }).map(row => ({
            timestamp: row[0],
            userId: row[1],
            habitId: row[2],
            date: row[3]
        }));
    } catch (error) {
        console.error('習慣ログ範囲取得エラー:', error);
        return [];
    }
}

async function updateHabitStreak(userId, habitId) {
    // ストリーク計算ロジック
    const habit = await getHabitById(habitId);
    if (!habit) return 0;
    
    let streak = 0;
    let currentDate = moment();
    
    // 今日から遡ってストリークを計算
    while (true) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        const log = await getHabitLog(userId, habitId, dateStr);
        
        if (log) {
            streak++;
            currentDate.subtract(1, 'day');
        } else {
            break;
        }
        
        // 無限ループ防止（最大100日）
        if (streak >= 100) break;
    }
    
    // スプレッドシートのストリーク更新
    await updateHabitStreakInSheet(habitId, streak);
    
    return streak;
}

async function updateHabitStreakInSheet(habitId, newStreak) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === habitId);
        
        if (rowIndex !== -1) {
            const updateRange = `${config.google_sheets.habits_sheet_name}!G${rowIndex + 1}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [[newStreak]]
                }
            });
        }
    } catch (error) {
        console.error('ストリーク更新エラー:', error);
    }
}

async function deleteHabitFromSheet(habitId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.habits_sheet_name}!A:H`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === habitId);
        
        if (rowIndex !== -1) {
            // ステータスを 'deleted' に変更
            const updateRange = `${config.google_sheets.habits_sheet_name}!H${rowIndex + 1}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [['deleted']]
                }
            });
        }
    } catch (error) {
        console.error('習慣削除エラー:', error);
        throw error;
    }
}

// ===== ユーザープロフィール関連 =====

async function saveUserProfile(userId, profile) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.user_profile_sheet_name}!A:D`;
    
    // 既存プロフィールをチェック
    const existing = await getUserProfile(userId);
    
    if (existing) {
        // 更新
        await updateUserProfile(userId, profile);
    } else {
        // 新規作成
        const values = [[
            userId,
            profile.height || '',
            profile.age || '',
            moment().format('YYYY-MM-DD HH:mm:ss')
        ]];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values }
        });
    }
}

async function getUserProfile(userId) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.user_profile_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const profile = rows.find(row => row[0] === userId);
        
        if (profile) {
            return {
                height: parseFloat(profile[1]) || null,
                age: parseInt(profile[2]) || null
            };
        }
        return null;
    } catch (error) {
        console.error('プロフィール取得エラー:', error);
        return null;
    }
}

async function updateUserProfile(userId, profile) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${config.google_sheets.user_profile_sheet_name}!A:D`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === userId);
        
        if (rowIndex !== -1) {
            const existing = await getUserProfile(userId);
            const updateRange = `${config.google_sheets.user_profile_sheet_name}!B${rowIndex + 1}:D${rowIndex + 1}`;
            
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [[
                        profile.height || existing?.height || '',
                        profile.age || existing?.age || '',
                        moment().format('YYYY-MM-DD HH:mm:ss')
                    ]]
                }
            });
        }
    } catch (error) {
        console.error('プロフィール更新エラー:', error);
    }
}

// ===== ヘルスチェック =====

async function testConnection() {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId
        });
        
        return {
            success: true,
            title: response.data.properties.title,
            sheetCount: response.data.sheets.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== バックアップ =====

async function exportSheetData(sheetName) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${sheetName}!A:Z`;
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        return {
            success: true,
            data: response.data.values || [],
            exportDate: moment().format('YYYY-MM-DD HH:mm:ss')
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    // 日記関連
    saveDiaryToSheet,
    getDiaryEntry,
    getDiaryEntriesInRange,
    
    // 体重関連
    saveWeightToSheet,
    getWeightEntry,
    updateWeightInSheet,
    getWeightEntriesInRange,
    getLastWeightEntry,
    getLatestWeightEntry,
    saveWeightGoal,
    getWeightGoal,
    
    // 習慣関連
    getUserHabits,
    getHabitByName,
    getHabitById,
    saveHabitToSheet,
    saveHabitLog,
    getHabitLog,
    getHabitLogsForDate,
    getHabitLogsInRange,
    updateHabitStreak,
    updateHabitStreakInSheet,
    deleteHabitFromSheet,
    
    // ユーザープロフィール関連
    saveUserProfile,
    getUserProfile,
    updateUserProfile,
    
    // ユーティリティ
    testConnection,
    exportSheetData
};
