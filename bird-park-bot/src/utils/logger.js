const sheetsManager = require('../../config/sheets');

class Logger {
    constructor() {
        this.logQueue = [];
        this.isProcessing = false;
    }

    // ガチャログ
    async logGacha(userId, userName, commandType, birdName, details = '') {
        const logData = {
            ユーザーID: userId,
            ユーザー名: userName,
            コマンド: commandType,
            鳥名: birdName,
            詳細: details
        };

        await this.addToQueue('gachaLog', logData);
    }

    // 検索ログ
    async logSearch(userId, userName, searchConditions, resultCount) {
        const conditionsText = Object.entries(searchConditions)
            .filter(([key, value]) => value)
            .map(([key, value]) => `${key}:${value}`)
            .join(', ');

        const logData = {
            ユーザーID: userId,
            ユーザー名: userName,
            検索条件: conditionsText,
            結果数: resultCount
        };

        await this.addToQueue('searchLog', logData);
    }

    // 鳥類園ログ
    async logZoo(action, area, birdName, userId = null, userName = null) {
        const logData = {
            アクション: action,
            エリア: area,
            鳥名: birdName,
            ユーザーID: userId || 'システム',
            ユーザー名: userName || 'システム'
        };

        await this.addToQueue('zooLog', logData);
    }

    // 餌やりログ
    async logFeed(userId, userName, birdName, food, effect) {
        const logData = {
            ユーザーID: userId,
            ユーザー名: userName,
            鳥名: birdName,
            餌: food,
            効果: effect
        };

        await this.addToQueue('feedLog', logData);
    }

    // イベントログ
    async logEvent(eventType, content, relatedBird = '') {
        const logData = {
            イベント種類: eventType,
            内容: content,
            関連する鳥: relatedBird
        };

        await this.addToQueue('events', logData);
    }

    // ログキューに追加
    async addToQueue(sheetName, data) {
        this.logQueue.push({ sheetName, data });
        
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    // キュー処理
    async processQueue() {
        if (this.isProcessing || this.logQueue.length === 0) return;
        
        this.isProcessing = true;

        while (this.logQueue.length > 0) {
            const { sheetName, data } = this.logQueue.shift();
            
            try {
                await sheetsManager.addLog(sheetName, data);
                console.log(`📝 ログ記録: ${sheetName} - ${data.ユーザー名 || data.アクション || data.イベント種類}`);
            } catch (error) {
                console.error(`ログ記録エラー (${sheetName}):`, error);
                // エラーの場合、キューに戻さずスキップ（無限ループ防止）
            }

            // 連続アクセス防止のため少し待機
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isProcessing = false;
    }

    // 統計データ取得（管理者用）
    async getStats(days = 7) {
        try {
            const sheets = ['gachaLog', 'searchLog', 'feedLog'];
            const stats = {};

            for (const sheetName of sheets) {
                const sheet = sheetsManager.sheets[sheetName];
                if (sheet) {
                    const rows = await sheet.getRows();
                    const recentRows = this.filterRecentRows(rows, days);
                    stats[sheetName] = {
                        total: rows.length,
                        recent: recentRows.length,
                        recentData: recentRows.slice(0, 10) // 最新10件
                    };
                }
            }

            return stats;
        } catch (error) {
            console.error('統計取得エラー:', error);
            return {};
        }
    }

    // 最近のデータをフィルタ
    filterRecentRows(rows, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return rows.filter(row => {
            try {
                const rowDate = new Date(row.get('日時'));
                return rowDate >= cutoffDate;
            } catch {
                return false;
            }
        });
    }

    // ユーザー別統計
    async getUserStats(userId) {
        try {
            const gachaSheet = sheetsManager.sheets.gachaLog;
            const searchSheet = sheetsManager.sheets.searchLog;
            const feedSheet = sheetsManager.sheets.feedLog;

            const userStats = {
                gachaCount: 0,
                searchCount: 0,
                feedCount: 0,
                favoriteBirds: {},
                recentActivity: []
            };

            // ガチャ統計
            if (gachaSheet) {
                const gachaRows = await gachaSheet.getRows();
                const userGachas = gachaRows.filter(row => row.get('ユーザーID') === userId);
                userStats.gachaCount = userGachas.length;

                // お気に入りの鳥を集計
                userGachas.forEach(row => {
                    const birdName = row.get('鳥名');
                    userStats.favoriteBirds[birdName] = (userStats.favoriteBirds[birdName] || 0) + 1;
                });
            }

            // 検索統計
            if (searchSheet) {
                const searchRows = await searchSheet.getRows();
                const userSearches = searchRows.filter(row => row.get('ユーザーID') === userId);
                userStats.searchCount = userSearches.length;
            }

            // 餌やり統計
            if (feedSheet) {
                const feedRows = await feedSheet.getRows();
                const userFeeds = feedRows.filter(row => row.get('ユーザーID') === userId);
                userStats.feedCount = userFeeds.length;
            }

            return userStats;
        } catch (error) {
            console.error('ユーザー統計取得エラー:', error);
            return null;
        }
    }

    // エラーログ
    logError(context, error, additionalInfo = {}) {
        console.error(`❌ エラー [${context}]:`, error);
        
        // 重要なエラーの場合はスプレッドシートにも記録
        if (error.name === 'UnhandledPromiseRejectionWarning' || 
            error.message.includes('DISCORD_TOKEN') ||
            error.message.includes('GOOGLE_SHEETS')) {
            
            this.logEvent('エラー', `${context}: ${error.message}`, JSON.stringify(additionalInfo));
        }
    }

    // デバッグログ
    debug(message, data = {}) {
        if (process.env.DEBUG === 'true') {
            console.log(`🐛 [DEBUG] ${message}`, data);
        }
    }
}

module.exports = new Logger();
