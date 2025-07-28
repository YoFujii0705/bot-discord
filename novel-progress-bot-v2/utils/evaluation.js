const moment = require('moment');

// 作業評価記録
async function recordWorkEvaluation(workTitle, evaluationItem, completionRate, memo, date) {
    try {
        const { sheets } = require('../config/googleSheets');
        
        // 作業評価シートに記録（存在しない場合は作成）
        await ensureEvaluationSheet();

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作業評価!A:F',
            valueInputOption: 'RAW',
            resource: { 
                values: [[date, workTitle, evaluationItem, completionRate, memo, moment().format('YYYY-MM-DD HH:mm:ss')]]
            }
        });

    } catch (error) {
        console.error('作業評価記録エラー:', error);
        throw error;
    }
}

// 作業評価シートの確保
async function ensureEvaluationSheet() {
    try {
        const { sheets } = require('../config/googleSheets');
        
        // シートの存在確認
        const response = await sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        });

        const sheetExists = response.data.sheets.some(sheet => 
            sheet.properties.title === '作業評価'
        );

        if (!sheetExists) {
            // シート作成
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: '作業評価'
                            }
                        }
                    }]
                }
            });

            // ヘッダー追加
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: '作業評価!A1:F1',
                valueInputOption: 'RAW',
                resource: { 
                    values: [['評価日', '作品名', '評価項目', '完成度(%)', 'メモ', '記録日時']]
                }
            });
        }

    } catch (error) {
        console.error('作業評価シート確保エラー:', error);
        throw error;
    }
}

// 作品の評価履歴を取得
async function getWorkEvaluationHistory(workTitle) {
    try {
        const { sheets } = require('../config/googleSheets');
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作業評価!A:F',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        const evaluationHistory = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[1] === workTitle) {
                evaluationHistory.push({
                    date: row[0],
                    workTitle: row[1],
                    evaluationItem: row[2],
                    completionRate: parseInt(row[3]) || 0,
                    memo: row[4] || '',
                    recordedAt: row[5]
                });
            }
        }

        // 日付でソート（新しい順）
        return evaluationHistory.sort((a, b) => moment(b.date).diff(moment(a.date)));

    } catch (error) {
        console.error('評価履歴取得エラー:', error);
        return [];
    }
}

// 評価項目別の最新状況を取得
async function getLatestEvaluationsByItem(workTitle) {
    try {
        const history = await getWorkEvaluationHistory(workTitle);
        const latestEvaluations = {};

        // 各評価項目の最新の評価を取得
        history.forEach(evaluation => {
            const item = evaluation.evaluationItem;
            if (!latestEvaluations[item] || 
                moment(evaluation.date).isAfter(moment(latestEvaluations[item].date))) {
                latestEvaluations[item] = evaluation;
            }
        });

        return latestEvaluations;

    } catch (error) {
        console.error('最新評価取得エラー:', error);
        return {};
    }
}

// 評価トレンドを分析
async function analyzeEvaluationTrend(workTitle, evaluationItem) {
    try {
        const history = await getWorkEvaluationHistory(workTitle);
        const itemHistory = history
            .filter(evaluation => evaluation.evaluationItem === evaluationItem)
            .sort((a, b) => moment(a.date).diff(moment(b.date))); // 古い順

        if (itemHistory.length < 2) {
            return {
                trend: 'insufficient_data',
                change: 0,
                message: 'データが不足しています'
            };
        }

        const latest = itemHistory[itemHistory.length - 1];
        const previous = itemHistory[itemHistory.length - 2];
        const change = latest.completionRate - previous.completionRate;

        let trend = 'stable';
        let message = '';

        if (change > 10) {
            trend = 'improving';
            message = `前回から${change}%向上しました！`;
        } else if (change > 0) {
            trend = 'slightly_improving';
            message = `前回から${change}%向上しました。`;
        } else if (change < -10) {
            trend = 'declining';
            message = `前回から${Math.abs(change)}%低下しています。`;
        } else if (change < 0) {
            trend = 'slightly_declining';
            message = `前回から${Math.abs(change)}%低下しています。`;
        } else {
            trend = 'stable';
            message = '前回と同じ評価です。';
        }

        return {
            trend,
            change,
            message,
            current: latest.completionRate,
            previous: previous.completionRate
        };

    } catch (error) {
        console.error('評価トレンド分析エラー:', error);
        return {
            trend: 'error',
            change: 0,
            message: 'トレンド分析中にエラーが発生しました'
        };
    }
}

module.exports = {
    recordWorkEvaluation,
    ensureEvaluationSheet,
    getWorkEvaluationHistory,
    getLatestEvaluationsByItem,
    analyzeEvaluationTrend
};
