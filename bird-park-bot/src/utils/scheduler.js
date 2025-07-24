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
    },

    // scheduler.js に以下を追加

// 鳥類園状況の自動投稿（例：毎日9:00と18:00）
const zooStatusTask = cron.schedule('0 9,18 * * *', async () => {
    try {
        console.log('🏞️ 鳥類園状況の自動投稿を開始...');
        await postZooStatusToAllServers();
    } catch (error) {
        console.error('鳥類園自動投稿エラー:', error);
        await logger.logError('鳥類園自動投稿', error);
    }
}, { scheduled: false });

// 全サーバーに鳥類園状況を投稿
async function postZooStatusToAllServers() {
    const zooManager = require('./zooManager');
    const zooCommand = client.commands.get('zoo');
    
    if (!zooCommand) {
        console.error('❌ zooコマンドが見つかりません');
        return;
    }

    // Bot参加中の全サーバーを取得
    const guilds = client.guilds.cache;
    console.log(`📡 ${guilds.size}個のサーバーに鳥類園状況を投稿中...`);

    for (const [guildId, guild] of guilds) {
        try {
            // 投稿チャンネルを取得（環境変数またはデフォルト）
            const channelId = process.env.ZOO_CHANNEL_ID || process.env.NOTIFICATION_CHANNEL_ID;
            let channel = null;

            if (channelId) {
                channel = guild.channels.cache.get(channelId);
            }
            
            // 指定チャンネルがない場合は、一般的なチャンネル名で検索
            if (!channel) {
                channel = guild.channels.cache.find(ch => 
                    ch.name.includes('鳥類園') || 
                    ch.name.includes('bird') || 
                    ch.name.includes('zoo') ||
                    ch.name.includes('general') ||
                    ch.name.includes('一般')
                );
            }

            // それでもない場合は、最初のテキストチャンネル
            if (!channel) {
                channel = guild.channels.cache.find(ch => ch.type === 0); // テキストチャンネル
            }

            if (!channel) {
                console.log(`⚠️ ${guild.name}: 投稿可能なチャンネルが見つかりません`);
                continue;
            }

            // サーバー別に鳥類園を初期化
            await zooManager.initializeServer(guildId);

            // 鳥類園のEmbedを作成
            const embed = zooCommand.createZooOverviewEmbed(guildId);
            const buttons = zooCommand.createZooButtons();

            // 自動投稿用にタイトルとメッセージを調整
            const autoPostEmbed = EmbedBuilder.from(embed)
                .setTitle('🏞️ 今日の鳥類園の様子')
                .setDescription(`${embed.data.description}\n\n🕐 ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 現在の状況`)
                .setFooter({ 
                    text: `自動投稿 | ${embed.data.footer?.text || ''}` 
                });

            // 投稿
            await channel.send({ 
                embeds: [autoPostEmbed], 
                components: [buttons] 
            });

            console.log(`✅ ${guild.name} (${channel.name}) に投稿完了`);

            // 投稿間隔を空ける（レート制限対策）
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`❌ ${guild.name} への投稿エラー:`, error);
            // エラーが出ても他のサーバーへの投稿は続行
        }
    }

    console.log('🎉 全サーバーへの鳥類園投稿が完了しました');
}

// 特定の時間に特別な投稿（例：朝の挨拶）
const morningZooTask = cron.schedule('0 8 * * *', async () => {
    try {
        console.log('🌅 朝の鳥類園挨拶投稿を開始...');
        await postMorningZooGreeting();
    } catch (error) {
        console.error('朝の挨拶投稿エラー:', error);
    }
}, { scheduled: false });

// 朝の挨拶投稿
async function postMorningZooGreeting() {
    const zooManager = require('./zooManager');
    const guilds = client.guilds.cache;

    for (const [guildId, guild] of guilds) {
        try {
            const channelId = process.env.ZOO_CHANNEL_ID || process.env.NOTIFICATION_CHANNEL_ID;
            let channel = guild.channels.cache.get(channelId);
            
            if (!channel) {
                channel = guild.channels.cache.find(ch => 
                    ch.name.includes('鳥類園') || ch.name.includes('bird')
                );
            }

            if (!channel) continue;

            await zooManager.initializeServer(guildId);
            const zooState = zooManager.getZooState(guildId);
            const totalBirds = zooState.森林.length + zooState.草原.length + zooState.水辺.length;

            const morningMessages = [
                `🌅 おはようございます！今日も鳥類園に${totalBirds}羽の鳥たちが元気に過ごしています`,
                `☀️ 新しい一日の始まりです！鳥たちも活動を開始しました`,
                `🐦 鳥たちの一日が始まりました！今日はどんな発見があるでしょうか`,
                `🌤️ 今日も鳥類園は賑やかです！${totalBirds}羽の鳥たちが皆さんを待っています`
            ];

            const randomMessage = morningMessages[Math.floor(Math.random() * morningMessages.length)];

            await channel.send({
                content: `${randomMessage}\n\n\`/zoo view\` で鳥たちの様子を見てみましょう！`
            });

        } catch (error) {
            console.error(`朝の挨拶投稿エラー (${guild.name}):`, error);
        }
    }
}

// scheduler.js の initialize 関数内に追加
function initializeZooScheduler() {
    console.log('🏞️ 鳥類園自動投稿スケジュールを設定中...');
    
    // タスクを開始
    zooStatusTask.start();
    morningZooTask.start();
    
    console.log('✅ 鳥類園自動投稿スケジュールを開始しました');
    console.log('  - 鳥類園状況投稿: 毎日 9:00, 18:00');
    console.log('  - 朝の挨拶: 毎日 8:00');
},

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
