const { google } = require('googleapis');
const moment = require('moment');
const config = require('../config.json');

// Google Sheets API初期化
const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
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
