const moment = require('moment');
const { getAllProgressData, getAllProgressDataWithTypes, getWorksStatistics } = require('./database');

// 期間統計を計算
async function calculatePeriodStatistics(startDate, endDate) {
    try {
        const allProgressData = await getAllProgressData();

        let totalChars = 0;
        let writingDays = 0;
        let maxDayChars = 0;
        const dailyTotals = {};

        // 期間内のデータを集計
        allProgressData.forEach(entry => {
            const entryDate = moment(entry.date);
            if (entryDate.isBetween(startDate, endDate, 'day', '[]')) {
                const dateStr = entry.date;
                if (!dailyTotals[dateStr]) {
                    dailyTotals[dateStr] = 0;
                }
                dailyTotals[dateStr] += entry.chars;
            }
        });

        // 統計計算
        Object.values(dailyTotals).forEach(dayChars => {
            totalChars += dayChars;
            if (dayChars > 0) {
                writingDays++;
                maxDayChars = Math.max(maxDayChars, dayChars);
            }
        });

        const averageChars = writingDays > 0 ? Math.round(totalChars / writingDays) : 0;

        // 作品統計
        const worksData = await getWorksStatistics(startDate, endDate);

        // 連続執筆日数計算
        const writingStreak = await calculateWritingStreak();

        return {
            totalChars,
            writingDays,
            averageChars,
            maxDayChars,
            activeWorks: worksData.activeWorks,
            completedWorks: worksData.completedWorks,
            writingStreak
        };

    } catch (error) {
        console.error('期間統計計算エラー:', error);
        return {
            totalChars: 0,
            writingDays: 0,
            averageChars: 0,
            maxDayChars: 0,
            activeWorks: 0,
            completedWorks: 0,
            writingStreak: 0
        };
    }
}

// 詳細統計計算
async function calculateDetailedStatistics(startDate, endDate) {
    try {
        const allProgressData = await getAllProgressDataWithTypes();

        let totalChars = 0;
        let writingDays = 0;
        let nonWritingDays = 0;
        let totalWorkDays = 0;
        const progressTypes = {};
        const dailyData = {};

        // 期間内のデータを集計
        allProgressData.forEach(entry => {
            const entryDate = moment(entry.date);
            if (entryDate.isBetween(startDate, endDate, 'day', '[]')) {
                const dateStr = entry.date;
                
                if (!dailyData[dateStr]) {
                    dailyData[dateStr] = { chars: 0, hasWriting: false, hasNonWriting: false, types: new Set() };
                }
                
                dailyData[dateStr].chars += entry.chars;
                dailyData[dateStr].types.add(entry.progressType || '執筆');
                
                if (entry.chars > 0) {
                    dailyData[dateStr].hasWriting = true;
                } else {
                    dailyData[dateStr].hasNonWriting = true;
                }

                // 進捗種別をカウント
                const type = entry.progressType || '執筆';
                progressTypes[type] = (progressTypes[type] || 0) + 1;
            }
        });

        // 日別データから統計を計算
        Object.values(dailyData).forEach(dayData => {
            totalChars += dayData.chars;
            totalWorkDays++;
            
            if (dayData.hasWriting) {
                writingDays++;
            }
            if (dayData.hasNonWriting) {
                nonWritingDays++;
            }
        });

        const avgWritingChars = writingDays > 0 ? Math.round(totalChars / writingDays) : 0;
        const totalPeriodDays = endDate.diff(startDate, 'days') + 1;
        const workConsistencyRate = Math.round((totalWorkDays / totalPeriodDays) * 100);

        return {
            totalChars,
            writingDays,
            nonWritingDays,
            totalWorkDays,
            avgWritingChars,
            workConsistencyRate,
            progressTypes
        };

    } catch (error) {
        console.error('詳細統計計算エラー:', error);
        return {
            totalChars: 0,
            writingDays: 0,
            nonWritingDays: 0,
            totalWorkDays: 0,
            avgWritingChars: 0,
            workConsistencyRate: 0,
            progressTypes: {}
        };
    }
}

// 作業パターンチャート生成
async function generateWorkPatternChart(startDate, endDate) {
    try {
        const allProgressData = await getAllProgressDataWithTypes();
        const dailyData = {};

        // 期間内のデータを日別に集計
        for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, 'day')) {
            const dateStr = date.format('YYYY-MM-DD');
            dailyData[dateStr] = { writing: false, nonWriting: false };
        }

        allProgressData.forEach(entry => {
            const entryDate = moment(entry.date);
            if (entryDate.isBetween(startDate, endDate, 'day', '[]')) {
                const dateStr = entry.date;
                if (entry.chars > 0) {
                    dailyData[dateStr].writing = true;
                } else {
                    dailyData[dateStr].nonWriting = true;
                }
            }
        });

        // チャート生成（最大21日まで表示）
        const dates = Object.keys(dailyData).slice(-21);
        let chart = '```\n';
        
        dates.forEach(dateStr => {
            const dayData = dailyData[dateStr];
            const date = moment(dateStr);
            const dayOfWeek = date.format('ddd');
            const dayMonth = date.format('MM/DD');
            
            let symbol = '⬜'; // 作業なし
            if (dayData.writing && dayData.nonWriting) {
                symbol = '🟪'; // 両方
            } else if (dayData.writing) {
                symbol = '🟩'; // 執筆のみ
            } else if (dayData.nonWriting) {
                symbol = '🟨'; // 非執筆作業のみ
            }
            
            chart += `${dayMonth}(${dayOfWeek}): ${symbol}\n`;
        });
        
        chart += '\n🟩執筆 🟨非執筆作業 🟪両方 ⬜作業なし\n```';
        
        return chart;

    } catch (error) {
        console.error('作業パターンチャート生成エラー:', error);
        return null;
    }
}

// 連続執筆日数を計算
async function calculateWritingStreak() {
    try {
        const allProgressData = await getAllProgressData();

        if (allProgressData.length === 0) return 0;

        // 日付別に集計
        const dailyTotals = {};
        allProgressData.forEach(entry => {
            if (!dailyTotals[entry.date]) {
                dailyTotals[entry.date] = 0;
            }
            dailyTotals[entry.date] += entry.chars;
        });

        // 執筆があった日のみを取得してソート
        const writingDates = Object.keys(dailyTotals)
            .filter(date => dailyTotals[date] > 0)
            .sort()
            .reverse();

        if (writingDates.length === 0) return 0;

        // 連続日数計算
        let streak = 0;
        let lastDate = null;

        for (const dateStr of writingDates) {
            const currentDate = moment(dateStr);

            if (!lastDate || lastDate.diff(currentDate, 'days') === 1) {
                streak++;
                lastDate = currentDate;
            } else {
                break;
            }
        }

        return streak;

    } catch (error) {
        console.error('連続執筆日数計算エラー:', error);
        return 0;
    }
}

module.exports = {
    calculatePeriodStatistics,
    calculateDetailedStatistics,
    generateWorkPatternChart,
    calculateWritingStreak
};
