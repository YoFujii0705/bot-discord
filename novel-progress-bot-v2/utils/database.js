const moment = require('moment');
const { sheets } = require('../handlers/basic');

// IDで作品を検索
async function findWorkById(workId) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return null;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (parseInt(row[0]) === workId) {
                return {
                    id: parseInt(row[0]),
                    title: row[1],
                    deadline: row[2],
                    theme: row[3],
                    charLimit: row[4],
                    targetChars: parseInt(row[5]) || 0,
                    memo: row[6],
                    createdDate: row[7],
                    completedDate: row[8],
                    status: row[9],
                    totalChars: parseInt(row[10]) || 0,
                    rowIndex: i + 1
                };
            }
        }

        return null;
    } catch (error) {
        console.error('作品検索エラー:', error);
        return null;
    }
}

// 次のIDを取得
async function getNextWorkId() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:A',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return 1;
        }

        const lastId = parseInt(rows[rows.length - 1][0]) || 0;
        return lastId + 1;

    } catch (error) {
        console.error('ID取得エラー:', error);
        return 1;
    }
}

// 個別作品シート作成
async function createWorkSheet(workId, title, targetChars) {
    try {
        // 新しいシートを追加
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            resource: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: title
                        }
                    }
                }]
            }
        });

        // ヘッダー行を追加
        const headers = [
            ['日付', '執筆字数', '累計字数', '進捗率(%)', 'メモ', '進捗種別'],
            ['', '', '', '', `タイトル: ${title}`, ''],
            ['', '', '', '', `目標字数: ${targetChars}字`, ''],
            ['', '', '', '', '', ''],
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${title}!A1:F4`,
            valueInputOption: 'RAW',
            resource: { values: headers }
        });

    } catch (error) {
        console.error('個別シート作成エラー:', error);
    }
}

// 統計更新
async function updateStatistics(date, chars, progressType = '執筆') {
    try {
        const yearMonth = moment(date).format('YYYY-MM');

        // 執筆統計シートから該当月のデータを取得
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '執筆統計!A:G',
        });

        const rows = response.data.values || [];
        let updated = false;

        // 既存データを更新
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === yearMonth) {
                const currentTotal = parseInt(rows[i][1]) || 0;
                const currentDays = parseInt(rows[i][2]) || 0;
                const currentWorkDays = parseInt(rows[i][5]) || 0;
                const currentNonWritingDays = parseInt(rows[i][6]) || 0;

                const newWorkDays = currentWorkDays + 1;
                const newNonWritingDays = chars === 0 ? currentNonWritingDays + 1 : currentNonWritingDays;
                const newWritingDays = chars > 0 ? currentDays + 1 : currentDays;

                await sheets.spreadsheets.values.update({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    range: `執筆統計!B${i + 1}:G${i + 1}`,
                    valueInputOption: 'RAW',
                    resource: { 
                        values: [[
                            currentTotal + chars,
                            newWritingDays,
                            newWritingDays > 0 ? Math.round((currentTotal + chars) / newWritingDays) : 0,
                            0,
                            newWorkDays,
                            newNonWritingDays
                        ]]
                    }
                });
                updated = true;
                break;
            }
        }

        // 新規データを追加
        if (!updated) {
            const workDays = 1;
            const nonWritingDays = chars === 0 ? 1 : 0;
            const writingDays = chars > 0 ? 1 : 0;

            await sheets.spreadsheets.values.append({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: '執筆統計!A:G',
                valueInputOption: 'RAW',
                resource: { 
                    values: [[yearMonth, chars, writingDays, chars, 0, workDays, nonWritingDays]]
                }
            });
        }

    } catch (error) {
        console.error('統計更新エラー:', error);
    }
}

// 進行中の作品を取得
async function getActiveWorks() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        const activeWorks = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[9] === '着手中') {
                const deadline = moment(row[2], 'YYYY-MM-DD');
                const daysLeft = deadline.diff(moment(), 'days');
                const progress = Math.round((parseInt(row[10]) || 0) / (parseInt(row[5]) || 1) * 100);

                activeWorks.push({
                    title: row[1],
                    daysLeft: daysLeft,
                    progress: progress
                });
            }
        }

        return activeWorks;
    } catch (error) {
        console.error('作品取得エラー:', error);
        return [];
    }
}

// 全進捗データを取得
async function getAllProgressData() {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        });

        const allData = [];

        for (const sheet of response.data.sheets) {
            const sheetName = sheet.properties.title;

            // 管理シートはスキップ
            if (['作品管理', '執筆統計', '作業評価'].includes(sheetName)) continue;

            try {
                const sheetData = await sheets.spreadsheets.values.get({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    range: `${sheetName}!A:F`,
                });

                const rows = sheetData.data.values;
                if (!rows || rows.length <= 4) continue;

                // 5行目以降がデータ
                for (let i = 4; i < rows.length; i++) {
                    const row = rows[i];
                    if (row[0] && moment(row[0], 'YYYY-MM-DD', true).isValid()) {
                        allData.push({
                            date: row[0],
                            chars: parseInt(row[1]) || 0,
                            work: sheetName,
                            progressType: row[5] || '執筆'
                        });
                    }
                }
            } catch (sheetError) {
                continue;
            }
        }

        return allData.sort((a, b) => moment(a.date).diff(moment(b.date)));

    } catch (error) {
        console.error('全進捗データ取得エラー:', error);
        return [];
    }
}

// 作品進捗データを取得
async function getWorkProgressData(workTitle) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${workTitle}!A:F`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 4) return [];

        const progressData = [];
        for (let i = 4; i < rows.length; i++) {
            const row = rows[i];
            if (row[0] && row[1] && moment(row[0], 'YYYY-MM-DD', true).isValid()) {
                progressData.push({
                    date: row[0],
                    chars: parseInt(row[1]) || 0
                });
            }
        }

        return progressData;

    } catch (error) {
        console.error('作品進捗データ取得エラー:', error);
        return [];
    }
}

// 作品統計を取得
async function getWorksStatistics(startDate, endDate) {
    try {
        const { sheets } = require('../config/googleSheets');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return { activeWorks: 0, completedWorks: 0 };
        }

        let activeWorks = 0;
        let completedWorks = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const status = row[9];
            const completedDate = row[8];

            if (status === '着手中') {
                activeWorks++;
            } else if (status === '完了' && completedDate) {
                const completed = moment(completedDate, 'YYYY-MM-DD');
                if (completed.isBetween(startDate, endDate, 'day', '[]')) {
                    completedWorks++;
                }
            }
        }

        return { activeWorks, completedWorks };

    } catch (error) {
        console.error('作品統計取得エラー:', error);
        return { activeWorks: 0, completedWorks: 0 };
    }
}

// 進捗種別付きデータ取得
async function getAllProgressDataWithTypes() {
    try {
        const { sheets } = require('../config/googleSheets');
        const response = await sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        });

        const allData = [];

        for (const sheet of response.data.sheets) {
            const sheetName = sheet.properties.title;

            // 管理シートはスキップ
            if (['作品管理', '執筆統計', '作業評価'].includes(sheetName)) continue;

            try {
                const sheetData = await sheets.spreadsheets.values.get({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    range: `${sheetName}!A:F`,
                });

                const rows = sheetData.data.values;
                if (!rows || rows.length <= 4) continue;

                // 5行目以降がデータ
                for (let i = 4; i < rows.length; i++) {
                    const row = rows[i];
                    if (row[0] && moment(row[0], 'YYYY-MM-DD', true).isValid()) {
                        allData.push({
                            date: row[0],
                            chars: parseInt(row[1]) || 0,
                            work: sheetName,
                            progressType: row[5] || '執筆' // F列から進捗種別取得
                        });
                    }
                }
            } catch (sheetError) {
                continue;
            }
        }

        return allData.sort((a, b) => moment(a.date).diff(moment(b.date)));

    } catch (error) {
        console.error('進捗種別付きデータ取得エラー:', error);
        return [];
    }
}

// 作品進捗データを取得
async function getWorkProgressData(workTitle) {
    try {
        const { sheets } = require('../config/googleSheets');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${workTitle}!A:E`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 4) return [];

        const progressData = [];
        for (let i = 4; i < rows.length; i++) {
            const row = rows[i];
            if (row[0] && row[1] && moment(row[0], 'YYYY-MM-DD', true).isValid()) {
                progressData.push({
                    date: row[0],
                    chars: parseInt(row[1]) || 0
                });
            }
        }

        return progressData;

    } catch (error) {
        console.error('作品進捗データ取得エラー:', error);
        return [];
    }
}

module.exports = {
    findWorkById,
    getNextWorkId,
    createWorkSheet,
    updateStatistics,
    getAllProgressData,
    getWorksStatistics,
    getAllProgressDataWithTypes,
    getWorkProgressData
};
