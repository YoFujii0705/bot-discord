const birdData = require('./birdData');
const logger = require('./logger');
const cron = require('node-cron');

class ZooManager {
    constructor() {
        this.zooState = {
            森林: [],
            草原: [],
            水辺: [],
            lastUpdate: new Date(),
            events: [],
            isInitialized: false
        };
        
        this.isProcessing = false;
        this.scheduledTasks = [];
    }

    // 鳥類園初期化
    async initialize() {
        if (this.zooState.isInitialized) return;
        
        console.log('🏞️ 鳥類園管理システムを初期化中...');
        
        try {
            await this.populateAllAreas();
            this.startAutomaticManagement();
            this.zooState.isInitialized = true;
            
            console.log('✅ 鳥類園管理システムの初期化完了');
            
            // 初期化完了イベント
            await this.addEvent('システム', '鳥類園が開園しました！', '');
            
        } catch (error) {
            console.error('❌ 鳥類園初期化エラー:', error);
            throw error;
        }
    }

    // 全エリアに鳥を配置
    async populateAllAreas() {
        const areas = ['森林', '草原', '水辺'];
        
        for (const area of areas) {
            this.zooState[area] = await this.populateArea(area, 5);
            console.log(`✅ ${area}エリア: ${this.zooState[area].length}羽配置完了`);
        }
        
        this.zooState.lastUpdate = new Date();
    }

    // 特定エリアに鳥を配置
    async populateArea(area, targetCount) {
        const suitableBirds = birdData.getBirdsForZooArea(area);
        
        if (suitableBirds.length === 0) {
            console.warn(`⚠️ ${area}エリアに適した鳥が見つかりません`);
            return [];
        }

        const selectedBirds = [];
        const maxAttempts = targetCount * 3; // 無限ループ防止
        let attempts = 0;

        while (selectedBirds.length < targetCount && attempts < maxAttempts) {
            const randomBird = suitableBirds[Math.floor(Math.random() * suitableBirds.length)];
            
            // 同じ鳥の重複を避ける
            if (!selectedBirds.some(b => b.name === randomBird.名前)) {
                const birdInstance = this.createBirdInstance(randomBird, area);
                selectedBirds.push(birdInstance);
                
                // ログ記録
                await logger.logZoo('入園', area, randomBird.名前);
            }
            attempts++;
        }

        return selectedBirds;
    }

    // 鳥インスタンス作成
    createBirdInstance(birdData, area) {
        return {
            name: birdData.名前,
            data: birdData,
            area: area,
            entryTime: new Date(),
            lastFed: null,
            lastFedBy: null,
            feedCount: 0,
            feedHistory: [],
            activity: this.generateActivity(area),
            mood: this.getRandomMood(),
            stayExtension: 0,
            scheduledDeparture: this.calculateDepartureTime(),
            isHungry: false,
            hungerNotified: false
        };
    }

    // 出発時間計算（3-7日後のランダム）
    calculateDepartureTime() {
        const minDays = 3;
        const maxDays = 7;
        const daysToStay = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
        
        const departureTime = new Date();
        departureTime.setDate(departureTime.getDate() + daysToStay);
        
        return departureTime;
    }

    // 自動管理開始
    startAutomaticManagement() {
        console.log('🔄 鳥類園の自動管理を開始...');
        
        // 鳥の入れ替え（1時間に1回チェック）
        const migrationTask = cron.schedule('0 * * * *', async () => {
            await this.checkBirdMigration();
        }, { scheduled: false });

        // 活動更新（30分に1回）
        const activityTask = cron.schedule('*/30 * * * *', async () => {
            await this.updateBirdActivities();
        }, { scheduled: false });

        // ランダムイベント（2-6時間に1回）
        const eventTask = cron.schedule('0 */3 * * *', async () => {
            if (Math.random() < 0.7) { // 70%の確率
                await this.generateRandomEvent();
            }
        }, { scheduled: false });

        // 空腹通知（1時間に1回チェック）
        const hungerTask = cron.schedule('*/30 * * * *', async () => {
            await this.checkHungerStatus();
        }, { scheduled: false });

        // タスク開始
        migrationTask.start();
        activityTask.start();
        eventTask.start();
        hungerTask.start();

        this.scheduledTasks = [migrationTask, activityTask, eventTask, hungerTask];
        
        console.log('✅ 自動管理タスクを開始しました');
    }

    // 鳥の移動チェック
    async checkBirdMigration() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const now = new Date();
            let migrationOccurred = false;

            for (const area of ['森林', '草原', '水辺']) {
                const birds = this.zooState[area];
                
                for (let i = birds.length - 1; i >= 0; i--) {
                    const bird = birds[i];
                    const actualDeparture = new Date(bird.scheduledDeparture.getTime() + (bird.stayExtension * 24 * 60 * 60 * 1000));
                    
                    if (now >= actualDeparture) {
                        // 鳥が出発
                        await this.removeBird(area, i);
                        migrationOccurred = true;
                    }
                }
                
                // エリアの鳥が5羽未満なら補充
                if (this.zooState[area].length < 5) {
                    await this.addNewBirdToArea(area);
                    migrationOccurred = true;
                }
            }

            if (migrationOccurred) {
                this.zooState.lastUpdate = new Date();
                console.log('🔄 鳥類園の構成が更新されました');
            }

        } catch (error) {
            console.error('鳥の移動チェックエラー:', error);
            await logger.logError('鳥類園管理', error);
        } finally {
            this.isProcessing = false;
        }
    }

    // 鳥を除去
    async removeBird(area, index) {
        const bird = this.zooState[area][index];
        this.zooState[area].splice(index, 1);
        
        await logger.logZoo('退園', area, bird.name);
        
        // 時々お別れイベントを発生
        if (Math.random() < 0.3) {
            await this.addEvent(
                'お別れ',
                `${bird.name}が旅立っていきました。また会える日まで...👋`,
                bird.name
            );
        }
    }

    // 新しい鳥をエリアに追加
    async addNewBirdToArea(area) {
        const newBirds = await this.populateArea(area, 1);
        
        if (newBirds.length > 0) {
            this.zooState[area].push(newBirds[0]);
            
            // 時々歓迎イベントを発生
            if (Math.random() < 0.4) {
                await this.addEvent(
                    '新入り',
                    `${newBirds[0].name}が新しく${area}エリアに仲間入りしました！🎉`,
                    newBirds[0].name
                );
            }
        }
    }

    // 鳥の活動更新
    async updateBirdActivities() {
        try {
            for (const area of ['森林', '草原', '水辺']) {
                this.zooState[area].forEach(bird => {
                    // 30%の確率で活動を更新
                    if (Math.random() < 0.3) {
                        bird.activity = this.generateActivity(area);
                        
                        // 気分も時々変化
                        if (Math.random() < 0.2) {
                            bird.mood = this.getRandomMood();
                        }
                    }
                });
            }
        } catch (error) {
            console.error('活動更新エラー:', error);
        }
    }

    // ランダムイベント生成
    async generateRandomEvent() {
        try {
            const eventTypes = [
                'interaction', // 鳥同士の交流
                'discovery',   // 発見
                'weather',     // 天気関連
                'special'      // 特別な行動
            ];

            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const event = await this.createEvent(eventType);
            
            if (event) {
                await this.addEvent(event.type, event.content, event.relatedBird);
                console.log(`🎪 ランダムイベント発生: ${event.type}`);
            }

        } catch (error) {
            console.error('ランダムイベント生成エラー:', error);
        }
    }

    // イベント作成
    async createEvent(eventType) {
        const allBirds = this.getAllBirds();
        if (allBirds.length === 0) return null;

        switch (eventType) {
            case 'interaction':
                return this.createInteractionEvent(allBirds);
            case 'discovery':
                return this.createDiscoveryEvent(allBirds);
            case 'weather':
                return this.createWeatherEvent(allBirds);
            case 'special':
                return this.createSpecialEvent(allBirds);
            default:
                return null;
        }
    }

    // 交流イベント
    createInteractionEvent(allBirds) {
        if (allBirds.length < 2) return null;

        const bird1 = allBirds[Math.floor(Math.random() * allBirds.length)];
        const bird2 = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        if (bird1.name === bird2.name) return null;

        const interactions = [
            `${bird1.name}と${bird2.name}が仲良くおしゃべりしています`,
            `${bird1.name}が${bird2.name}に何かを教えているようです`,
            `${bird1.name}と${bird2.name}が一緒に遊んでいます`,
            `${bird1.name}と${bird2.name}が美しいデュエットを奏でています`
        ];

        return {
            type: '交流',
            content: interactions[Math.floor(Math.random() * interactions.length)],
            relatedBird: `${bird1.name}, ${bird2.name}`
        };
    }

    // 発見イベント
    createDiscoveryEvent(allBirds) {
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const discoveries = [
            `${bird.name}が珍しい木の実を発見しました`,
            `${bird.name}が新しい隠れ家を見つけたようです`,
            `${bird.name}が美しい羽根を落としていきました`,
            `${bird.name}が興味深い行動を見せています`
        ];

        return {
            type: '発見',
            content: discoveries[Math.floor(Math.random() * discoveries.length)],
            relatedBird: bird.name
        };
    }

    // 天気イベント
    createWeatherEvent(allBirds) {
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const weatherEvents = [
            `暖かい日差しの中、${bird.name}が気持ちよさそうに羽を広げています`,
            `そよ風に乗って、${bird.name}が優雅に舞っています`,
            `雨上がりの清々しい空気を、${bird.name}が楽しんでいます`,
            `薄雲の隙間から差す光を、${bird.name}が見つめています`
        ];

        return {
            type: '天気',
            content: weatherEvents[Math.floor(Math.random() * weatherEvents.length)],
            relatedBird: bird.name
        };
    }

    // 特別イベント
    createSpecialEvent(allBirds) {
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const specialEvents = [
            `${bird.name}が珍しい鳴き声を披露しています`,
            `${bird.name}が普段とは違う場所にいます`,
            `${bird.name}が特別な羽ばたきを見せています`,
            `${bird.name}が訪問者に興味を示しているようです`
        ];

        return {
            type: '特別',
            content: specialEvents[Math.floor(Math.random() * specialEvents.length)],
            relatedBird: bird.name
        };
    }

    // 空腹状態チェック
    async checkHungerStatus() {
    try {
        // 睡眠時間中は空腹チェックをスキップ
        if (this.isSleepTime()) {
            return;
        }
        
        const now = new Date();
            
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of this.zooState[area]) {
                // 最後の餌やりから4時間以上経過で空腹（修正：6時間→4時間）
                const hungryThreshold = 4 * 60 * 60 * 1000; // 4時間
                
                // 最後に餌をもらった時間（なければ入園時間を使用）
                const lastFeedTime = bird.lastFed || bird.entryTime;
                
                if ((now - lastFeedTime) > hungryThreshold) {
                    if (!bird.isHungry) {
                        bird.isHungry = true;
                        bird.hungerNotified = false;
                        
                        // 空腹時の活動に変更
                        bird.activity = this.generateHungryActivity(area);
                        
                        // 空腹通知イベント（修正：25%→50%の確率）
                        if (Math.random() < 0.50) {
                            await this.addEvent(
                                '空腹通知',
                                `${bird.name}がお腹を空かせているようです！🍽️ `/feed bird:${bird.name} food:[餌の種類]` で餌をあげてみましょう`,
                                bird.name
                            );
                            bird.hungerNotified = true;
                        }
                        
                        console.log(`🍽️ ${bird.name} が空腹になりました (${area}エリア)`);
                    }
                } else {
                    // 餌をもらって満腹状態に戻った場合
                    if (bird.isHungry) {
                        bird.isHungry = false;
                        bird.activity = this.generateActivity(area); // 通常活動に戻す
                        console.log(`😊 ${bird.name} が満腹になりました (${area}エリア)`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('空腹状態チェックエラー:', error);
    }
}

    // 空腹時の活動生成
generateHungryActivity(area) {
    const hungryActivities = {
        '森林': [
            'お腹を空かせて餌を探し回っています',
            '木の枝で寂しそうに鳴いています', 
            '餌を求めてあちこち見回しています',
            'お腹がぺこぺこで元気がありません',
            '虫を探して忙しく動き回っています',
            '木の実がないか必死に探しています',
            '空腹で羽を垂らしています',
            '食べ物を求めて鳴き続けています'
        ],
        '草原': [
            '地面をつついて何か食べ物を探しています',
            'お腹を空かせてそわそわしています',
            '餌を求めて草むらを探しています',
            '空腹で少し疲れているようです',
            '種を探して地面を掘っています',
            'お腹が空いて落ち着かない様子です',
            '青菜を求めてうろうろしています',
            '空腹で鳴き声も弱々しいです'
        ],
        '水辺': [
            '水面を見つめて魚を探しています',
            'お腹を空かせて水辺をうろうろしています',
            '餌を求めて浅瀬を歩き回っています',
            '空腹で羽を垂らしています',
            '魚影を追いかけていますが捕まえられません',
            '水草の間を必死に探しています',
            'お腹が空いて水面をじっと見つめています',
            '空腹でため息をついているようです'
        ]
    };

    const activities = hungryActivities[area] || hungryActivities['森林'];
    return activities[Math.floor(Math.random() * activities.length)];
}

    // 活動生成
    generateActivity(area) {
        const activities = {
            '森林': [
                '木の枝で休んでいます', '木の実を探しています', '美しい声でさえずっています',
                '羽繕いをしています', '枝から枝へ飛び移っています', '虫を捕まえています',
                '巣の材料を集めています', '木陰で涼んでいます', '葉っぱと戯れています'
            ],
            '草原': [
                '草地を歩き回っています', '種を探しています', '気持ちよさそうに日向ぼっこしています',
                '他の鳥と遊んでいます', '風に羽を広げています', '地面で餌を探しています',
                'のんびりと過ごしています', '花の蜜を吸っています', '芝生の上を転がっています'
            ],
            '水辺': [
                '水面に映る自分を見ています', '魚を狙っています', '水浴びを楽しんでいます',
                '水辺を静かに歩いています', '小さな波と戯れています', '羽を乾かしています',
                '水草の中を泳いでいます', '石の上で休んでいます', '水面をそっと歩いています'
            ]
        };

        const areaActivities = activities[area] || activities['森林'];
        return areaActivities[Math.floor(Math.random() * areaActivities.length)];
    }

    // ランダムな気分
    getRandomMood() {
        const moods = ['happy', 'normal', 'sleepy', 'excited', 'calm'];
        return moods[Math.floor(Math.random() * moods.length)];
    }

    // 睡眠時間判定
isSleepTime() {
    const now = new Date();
    const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    const hour = jstTime.getHours();
    return hour >= 0 && hour < 7;
}

    // イベント追加
    async addEvent(type, content, relatedBird = '') {
    const event = {
        type,
        content,
        relatedBird,
        timestamp: new Date()
    };

    this.zooState.events.push(event);
    
    // イベント履歴は最新20件まで保持
    if (this.zooState.events.length > 20) {
        this.zooState.events = this.zooState.events.slice(-20);
    }

    // ログ記録
    await logger.logEvent(type, content, relatedBird);
},

    // 手動で空腹チェックを実行（テスト用）
async manualHungerCheck() {
    console.log('🧪 手動空腹チェックを実行...');
    await this.checkHungerStatus();
    return this.getHungerStatistics();
}

// 特定の鳥を強制的に空腹にする（テスト用）
forceHungry(birdName = null) {
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    
    let count = 0;
    
    for (const area of ['森林', '草原', '水辺']) {
        for (const bird of this.zooState[area]) {
            if (!birdName || bird.name.includes(birdName) || birdName.includes(bird.name)) {
                bird.lastFed = fiveHoursAgo; // 5時間前に設定
                bird.isHungry = true;
                bird.hungerNotified = false;
                bird.activity = this.generateHungryActivity(area);
                count++;
                
                if (birdName) break; // 特定の鳥のみの場合は1羽で終了
            }
        }
        if (birdName && count > 0) break;
    }
    
    console.log(`🧪 ${count}羽の鳥を強制的に空腹状態にしました`);
    return count;
}

// 空腹統計取得（テスト用）
getHungerStatistics() {
    const allBirds = this.getAllBirds();
    const now = new Date();
    
    const stats = {
        totalBirds: allBirds.length,
        hungryBirds: 0,
        birdDetails: []
    };
    
    for (const bird of allBirds) {
        const lastFeedTime = bird.lastFed || bird.entryTime;
        const hoursSinceLastFeed = Math.floor((now - lastFeedTime) / (1000 * 60 * 60));
        
        if (bird.isHungry) {
            stats.hungryBirds++;
        }
        
        stats.birdDetails.push({
            name: bird.name,
            area: bird.area,
            isHungry: bird.isHungry,
            hoursSinceLastFeed: hoursSinceLastFeed,
            hungerNotified: bird.hungerNotified,
            activity: bird.activity
        });
    }
    
    return stats;
}

    // 睡眠時間判定
    isSleepTime() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        return hour >= 0 && hour < 7;
    }
        
        // イベント履歴は最新20件まで保持
        if (this.zooState.events.length > 20) {
            this.zooState.events = this.zooState.events.slice(-20);
        }

        // ログ記録
        await logger.logEvent(type, content, relatedBird);
    }

    // 全ての鳥を取得
    getAllBirds() {
        return [
            ...this.zooState.森林,
            ...this.zooState.草原,
            ...this.zooState.水辺
        ];
    }

    // 鳥類園の状態取得
    getZooState() {
        return this.zooState;
    }

    // 鳥類園の状態設定
    setZooState(newState) {
        this.zooState = newState;
    }

    // 統計情報取得
    getStatistics() {
        const allBirds = this.getAllBirds();
        
        return {
            totalBirds: allBirds.length,
            areaDistribution: {
                森林: this.zooState.森林.length,
                草原: this.zooState.草原.length,
                水辺: this.zooState.水辺.length
            },
            averageStay: this.calculateAverageStay(allBirds),
            hungryBirds: allBirds.filter(b => b.isHungry).length,
            recentEvents: this.zooState.events.slice(-5),
            lastUpdate: this.zooState.lastUpdate
        };
    }

    // 平均滞在期間計算
    calculateAverageStay(birds) {
        if (birds.length === 0) return 0;
        
        const now = new Date();
        const totalStayHours = birds.reduce((sum, bird) => {
            const stayTime = now - bird.entryTime;
            return sum + (stayTime / (1000 * 60 * 60)); // 時間単位
        }, 0);
        
        return Math.round(totalStayHours / birds.length);
    }

    // システム終了時のクリーンアップ
    shutdown() {
    console.log('🔄 鳥類園管理システムをシャットダウン中...');
    
    this.scheduledTasks.forEach(task => {
        if (task && typeof task.destroy === 'function') {
            task.destroy();
        } else if (task && typeof task.stop === 'function') {
            task.stop();
        }
    });
    
    this.scheduledTasks = [];
    console.log('✅ 鳥類園管理システムのシャットダウン完了');
}
}

module.exports = new ZooManager();
