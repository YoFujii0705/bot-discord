const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const birdData = require('./birdData');
const logger = require('./logger');
const zooManager = require('./zooManager');

class Scheduler {
    constructor() {
        this.client = null;
        this.tasks = {};
        this.isInitialized = false;
    }

    // スケジューラー初期化
    initialize(client) {
        if (this.isInitialized) return;
        
        this.client = client;
        console.log('⏰ スケジューラーを初期化中...');
        
        try {
            this.setupDailyBirdTask();
            this.setupWeeklyReportTask();
            this.setupMaintenanceTask();
            this.setupEventBroadcastTask();
            
            this.isInitialized = true;
            console.log('✅ スケジューラーの初期化完了');
            
        } catch (error) {
            console.error('❌ スケジューラー初期化エラー:', error);
            throw error;
        }
    }

    // 今日の鳥投稿タスク
    setupDailyBirdTask() {
        const hour = parseInt(process.env.DAILY_BIRD_HOUR) || 9;
        const minute = parseInt(process.env.DAILY_BIRD_MINUTE) || 0;
        
        this.tasks.dailyBird = cron.schedule(`${minute} ${hour} * * *`, async () => {
            await this.postDailyBird();
        }, {
            scheduled: false,
            timezone: 'Asia/Tokyo'
        });

        this.tasks.dailyBird.start();
        console.log(`📅 今日の鳥投稿: 毎日 ${hour}:${minute.toString().padStart(2, '0')} に設定`);
    }

    // 週次レポートタスク
    setupWeeklyReportTask() {
        // 毎週日曜日の20:00
        this.tasks.weeklyReport = cron.schedule('0 20 * * 0', async () => {
            await this.postWeeklyReport();
        }, {
            scheduled: false,
            timezone: 'Asia/Tokyo'
        });

        this.tasks.weeklyReport.start();
        console.log('📊 週次レポート: 毎週日曜日 20:00 に設定');
    }

    // メンテナンスタスク
    setupMaintenanceTask() {
        // 毎日深夜3:00
        this.tasks.maintenance = cron.schedule('0 3 * * *', async () => {
            await this.performMaintenance();
        }, {
            scheduled: false,
            timezone: 'Asia/Tokyo'
        });

        this.tasks.maintenance.start();
        console.log('🔧 メンテナンス: 毎日 03:00 に設定');
    }

    // イベント放送タスク
    setupEventBroadcastTask() {
        // 2時間ごとにイベントをチェック
        this.tasks.eventBroadcast = cron.schedule('0 */2 * * *', async () => {
            await this.broadcastZooEvents();
        }, {
            scheduled: false,
            timezone: 'Asia/Tokyo'
        });

        this.tasks.eventBroadcast.start();
        console.log('📢 イベント放送: 2時間ごとに設定');
    }

    // 今日の鳥投稿
    async postDailyBird() {
        try {
            console.log('📅 今日の鳥を投稿中...');
            
            if (!birdData.initialized) {
                await birdData.initialize();
            }

            const todaysBird = birdData.getTodaysBird();
            if (!todaysBird) {
                console.error('今日の鳥が取得できませんでした');
                return;
            }

            const embed = this.createDailyBirdEmbed(todaysBird);
            
            // 全サーバーに投稿
            await this.broadcastToAllGuilds(embed, '今日の鳥');
            
            // ログ記録
            await logger.logEvent('自動投稿', `今日の鳥: ${todaysBird.名前}`, todaysBird.名前);
            
            console.log(`✅ 今日の鳥投稿完了: ${todaysBird.名前}`);
            
        } catch (error) {
            console.error('今日の鳥投稿エラー:', error);
            await logger.logError('今日の鳥投稿', error);
        }
    }

    // 今日の鳥Embed作成
    createDailyBirdEmbed(bird) {
        const today = new Date();
        const dateString = today.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        const currentSeason = birdData.getCurrentSeason();
        
        const colorMap = {
            '茶系': 0x8B4513, '白系': 0xF5F5F5, '黒系': 0x2F4F4F,
            '赤系': 0xFF6347, '黄系': 0xFFD700, '青系': 0x4169E1,
            '緑系': 0x228B22, '灰系': 0x808080
        };

        const mainColor = bird.色.split('、')[0];
        const embedColor = colorMap[mainColor] || 0x00AE86;

        return new EmbedBuilder()
            .setTitle(`📅 今日の鳥 - ${dateString}`)
            .setDescription(`**${bird.名前}**\n*${bird.キャッチコピー}*\n\n${bird.説明文}`)
            .setColor(embedColor)
            .addFields(
                { name: '📏 全長', value: `${bird.全長} (${bird.全長区分})`, inline: true },
                { name: '🎨 色', value: bird.色, inline: true },
                { name: '📅 季節', value: bird.季節, inline: true },
                { name: '✈️ 渡り', value: bird.渡り区分, inline: true },
                { name: '🏞️ 環境', value: bird.環境, inline: true },
                { name: '🍽️ 好物', value: bird.好物 || '設定なし', inline: true }
            )
            .addFields({
                name: '💭 今日のメッセージ',
                value: this.getDailyMessage(bird, today),
                inline: false
            })
            .setFooter({ 
                text: `現在の季節: ${currentSeason} | 自動投稿` 
            })
            .setTimestamp();
    }

    // 今日のメッセージ生成
    getDailyMessage(bird, date) {
        const dayOfWeek = date.getDay();
        const messages = [
            `${bird.名前}と一緒に今日も素敵な一日を！`,
            `${bird.名前}のように自由に今日を楽しみませんか？`,
            `今日は${bird.名前}から元気をもらいましょう！`,
            `${bird.名前}が見守る中、今日も頑張りましょう！`
        ];

        // 曜日別特別メッセージ
        const weeklyMessages = {
            1: '今週も${bird.名前}と一緒に頑張りましょう！', // 月曜日
            5: '今週もお疲れ様！${bird.名前}と一緒に週末を迎えませんか？', // 金曜日
            0: '日曜日の朝、${bird.名前}とゆったり過ごしませんか？', // 日曜日
            6: '土曜日！${bird.名前}と一緒にのんびりしましょう！' // 土曜日
        };

        if (weeklyMessages[dayOfWeek]) {
            return weeklyMessages[dayOfWeek].replace('${bird.名前}', bird.名前);
        }

        return messages[Math.floor(Math.random() * messages.length)];
    }

    // 週次レポート投稿
    async postWeeklyReport() {
        try {
            console.log('📊 週次レポートを生成中...');
            
            const stats = await this.generateWeeklyStats();
            const embed = this.createWeeklyReportEmbed(stats);
            
            await this.broadcastToAllGuilds(embed, '週次レポート');
            
            console.log('✅ 週次レポート投稿完了');
            
        } catch (error) {
            console.error('週次レポートエラー:', error);
            await logger.logError('週次レポート', error);
        }
    }

    // 週次統計生成
    async generateWeeklyStats() {
        const stats = await logger.getStats(7); // 過去7日
        const zooStats = zooManager.getStatistics();
        
        return {
            period: '過去7日間',
            gachaCount: stats.gachaLog?.recent || 0,
            searchCount: stats.searchLog?.recent || 0,
            feedCount: stats.feedLog?.recent || 0,
            zooStats: zooStats,
            popularBirds: this.getPopularBirds(stats.gachaLog?.recentData || []),
            totalUsers: this.getUniqueUserCount(stats)
        };
    }

    // 人気の鳥取得
    getPopularBirds(gachaData) {
        const birdCounts = {};
        
        gachaData.forEach(entry => {
            if (entry && entry.get) {
                const birdName = entry.get('鳥名');
                if (birdName) {
                    birdCounts[birdName] = (birdCounts[birdName] || 0) + 1;
                }
            }
        });

        return Object.entries(birdCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));
    }

    // ユニークユーザー数取得
    getUniqueUserCount(stats) {
        const users = new Set();
        
        ['gachaLog', 'searchLog', 'feedLog'].forEach(logType => {
            if (stats[logType]?.recentData) {
                stats[logType].recentData.forEach(entry => {
                    if (entry && entry.get) {
                        const userId = entry.get('ユーザーID');
                        if (userId) users.add(userId);
                    }
                });
            }
        });

        return users.size;
    }

    // 週次レポートEmbed作成
    createWeeklyReportEmbed(stats) {
        const embed = new EmbedBuilder()
            .setTitle('📊 週次アクティビティレポート')
            .setDescription(`${stats.period}の鳥類園活動まとめ`)
            .setColor(0x4169E1)
            .addFields(
                { name: '🎲 ガチャ回数', value: `${stats.gachaCount}回`, inline: true },
                { name: '🔍 検索回数', value: `${stats.searchCount}回`, inline: true },
                { name: '🍽️ 餌やり回数', value: `${stats.feedCount}回`, inline: true },
                { name: '👥 アクティブユーザー', value: `${stats.totalUsers}名`, inline: true },
                { name: '🐦 現在の鳥類園', value: `${stats.zooStats.totalBirds}羽`, inline: true },
                { name: '😋 お腹を空かせた鳥', value: `${stats.zooStats.hungryBirds}羽`, inline: true }
            )
            .setTimestamp();

        // 人気の鳥
        if (stats.popularBirds.length > 0) {
            const popularText = stats.popularBirds
                .map((bird, index) => `${index + 1}. ${bird.name} (${bird.count}回)`)
                .join('\n');
            
            embed.addFields({
                name: '🌟 人気の鳥 TOP3',
                value: popularText,
                inline: false
            });
        }

        // 鳥類園の最新イベント
        if (stats.zooStats.recentEvents.length > 0) {
            const eventText = stats.zooStats.recentEvents
                .slice(-2)
                .map(event => `• ${event.content}`)
                .join('\n');
            
            embed.addFields({
                name: '🎪 最近の鳥類園イベント',
                value: eventText,
                inline: false
            });
        }

        embed.setFooter({ text: '来週もよろしくお願いします！' });
        
        return embed;
    }

    // メンテナンス実行
    async performMaintenance() {
        try {
            console.log('🔧 定期メンテナンスを実行中...');
            
            // データ整合性チェック
            await this.checkDataIntegrity();
            
            // 古いログの整理（必要に応じて）
            await this.cleanupOldData();
            
            // 鳥類園の健康状態チェック
            await this.checkZooHealth();
            
            console.log('✅ 定期メンテナンス完了');
            
        } catch (error) {
            console.error('メンテナンスエラー:', error);
            await logger.logError('定期メンテナンス', error);
        }
    }

    // データ整合性チェック
    async checkDataIntegrity() {
        try {
            // 鳥データの再読み込み
            await birdData.refresh();
            
            // 鳥類園の状態確認
            const zooState = zooManager.getZooState();
            let repairNeeded = false;
            
            // 各エリアの鳥数チェック
            for (const area of ['森林', '草原', '水辺']) {
                if (zooState[area].length === 0) {
                    console.log(`⚠️ ${area}エリアが空です - 補充が必要`);
                    repairNeeded = true;
                }
            }
            
            if (repairNeeded) {
                await zooManager.initialize();
                console.log('🔄 鳥類園の状態を修復しました');
            }
            
        } catch (error) {
            console.error('データ整合性チェックエラー:', error);
        }
    }

    // 古いデータクリーンアップ
    async cleanupOldData() {
        try {
            // 鳥類園イベントの古いデータを削除（30日以上前）
            const zooState = zooManager.getZooState();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const originalEventCount = zooState.events.length;
            zooState.events = zooState.events.filter(event => 
                new Date(event.timestamp) > thirtyDaysAgo
            );
            
            const removedEvents = originalEventCount - zooState.events.length;
            if (removedEvents > 0) {
                console.log(`🗑️ ${removedEvents}件の古いイベントを削除しました`);
            }
            
        } catch (error) {
            console.error('データクリーンアップエラー:', error);
        }
    }

    // 鳥類園健康状態チェック
    async checkZooHealth() {
        try {
            const stats = zooManager.getStatistics();
            
            // 異常な状態をチェック
            if (stats.totalBirds < 10) {
                console.log('⚠️ 鳥類園の鳥の数が少なすぎます');
                await logger.logEvent('メンテナンス', '鳥類園の鳥の数が不足しています', '');
            }
            
            if (stats.hungryBirds > stats.totalBirds * 0.5) {
                console.log('⚠️ 空腹な鳥が多すぎます');
                await logger.logEvent('メンテナンス', '空腹な鳥が増えています - 餌やりを呼びかけましょう', '');
            }
            
        } catch (error) {
            console.error('鳥類園健康チェックエラー:', error);
        }
    }

    // 鳥類園イベント放送
    async broadcastZooEvents() {
        try {
            const zooState = zooManager.getZooState();
            const recentEvents = zooState.events.slice(-2); // 最新2件
            
            for (const event of recentEvents) {
                // 2時間以内のイベントのみ放送
                const twoHoursAgo = new Date();
                twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
                
                if (new Date(event.timestamp) > twoHoursAgo && !event.broadcasted) {
                    const embed = this.createEventEmbed(event);
                    await this.broadcastToAllGuilds(embed, 'イベント通知');
                    
                    // 放送済みマーク
                    event.broadcasted = true;
                }
            }
            
        } catch (error) {
            console.error('イベント放送エラー:', error);
        }
    }

    // イベントEmbed作成
    createEventEmbed(event) {
        return new EmbedBuilder()
            .setTitle('🎪 鳥類園からのお知らせ')
            .setDescription(event.content)
            .setColor(0xFFD700)
            .addFields({
                name: '🕐 発生時刻',
                value: new Date(event.timestamp).toLocaleString('ja-JP'),
                inline: true
            })
            .setFooter({ text: '鳥類園自動通知システム' })
            .setTimestamp();
    }

    // 全サーバーに放送
    async broadcastToAllGuilds(embed, logType) {
        let successCount = 0;
        let errorCount = 0;
        
        for (const guild of this.client.guilds.cache.values()) {
            try {
                // 適切なチャンネルを探す
                const targetChannel = this.findBroadcastChannel(guild);
                
                if (targetChannel) {
                    await targetChannel.send({ embeds: [embed] });
                    successCount++;
                } else {
                    console.log(`⚠️ ${guild.name} に適切な投稿チャンネルが見つかりません`);
                }
                
            } catch (error) {
                console.error(`${guild.name} への投稿エラー:`, error);
                errorCount++;
            }
        }
        
        console.log(`📡 ${logType} 放送完了: 成功 ${successCount}件, エラー ${errorCount}件`);
    }

    // 放送チャンネル検索
    findBroadcastChannel(guild) {
        // チャンネル名の優先順位
        const channelNames = ['鳥', 'bird', 'general', 'ガチャ', 'bot'];
        
        for (const name of channelNames) {
            const channel = guild.channels.cache.find(ch => 
                ch.type === 0 && // テキストチャンネル
                ch.name.toLowerCase().includes(name) &&
                ch.permissionsFor(guild.members.me).has(['SEND_MESSAGES', 'EMBED_LINKS'])
            );
            
            if (channel) return channel;
        }
        
        // 見つからない場合、投稿可能な最初のチャンネル
        return guild.channels.cache.find(ch => 
            ch.type === 0 &&
            ch.permissionsFor(guild.members.me).has(['SEND_MESSAGES', 'EMBED_LINKS'])
        );
    }

    // 手動実行メソッド（管理者用）
    async manualDailyBird() {
        await this.postDailyBird();
    }

    async manualWeeklyReport() {
        await this.postWeeklyReport();
    }

    async manualMaintenance() {
        await this.performMaintenance();
    }

    // スケジューラー停止
    shutdown() {
        console.log('⏰ スケジューラーをシャットダウン中...');
        
        Object.values(this.tasks).forEach(task => {
            if (task && task.destroy) {
                task.destroy();
            }
        });
        
        this.tasks = {};
        this.isInitialized = false;
        
        console.log('✅ スケジューラーのシャットダウン完了');
    }
}

module.exports = new Scheduler();
