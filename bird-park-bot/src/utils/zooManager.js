const birdData = require('./birdData');
const logger = require('./logger');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class ZooManager {
    constructor() {
        this.serverZoos = new Map(); // Map<サーバーID, 鳥類園データ>
        this.isInitialized = false;
        this.isProcessing = false;
        this.scheduledTasks = [];
        this.dataPath = './data/zoos/';
        
        // データディレクトリを作成
        this.ensureDataDirectory();
    }

    // データディレクトリ確保
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
            console.log('📁 鳥類園データディレクトリを作成しました');
        }
    }

    // 鳥類園管理システム初期化
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🏞️ 鳥類園管理システムを初期化中...');
        
        try {
            // 既存の全サーバーデータを読み込み
            await this.loadAllServerZoos();
            
            // 自動管理開始
            this.startAutomaticManagement();
            
            this.isInitialized = true;
            console.log('✅ 鳥類園管理システムの初期化完了');
            
        } catch (error) {
            console.error('❌ 鳥類園初期化エラー:', error);
            throw error;
        }
    }

    // 全サーバーデータ読み込み
    async loadAllServerZoos() {
        try {
            const files = fs.readdirSync(this.dataPath);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of jsonFiles) {
                const guildId = path.basename(file, '.json');
                await this.loadServerZoo(guildId);
            }
            
            console.log(`📂 ${jsonFiles.length}個のサーバー鳥類園データを読み込みました`);
        } catch (error) {
            console.error('全サーバーデータ読み込みエラー:', error);
        }
    }

    // サーバー別データ読み込み
    async loadServerZoo(guildId) {
        const filePath = path.join(this.dataPath, `${guildId}.json`);
        
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                // 日付オブジェクトの復元
                this.restoreDates(data);
                
                this.serverZoos.set(guildId, data);
                console.log(`📖 サーバー ${guildId} のデータを読み込みました`);
                return data;
            }
        } catch (error) {
            console.error(`サーバー ${guildId} のデータ読み込みエラー:`, error);
        }
        
        return null;
    }

    // 日付オブジェクトの復元
    restoreDates(data) {
        if (data.lastUpdate) data.lastUpdate = new Date(data.lastUpdate);
        
        ['森林', '草原', '水辺'].forEach(area => {
            if (data[area]) {
                data[area].forEach(bird => {
                    if (bird.entryTime) bird.entryTime = new Date(bird.entryTime);
                    if (bird.lastFed) bird.lastFed = new Date(bird.lastFed);
                    if (bird.scheduledDeparture) bird.scheduledDeparture = new Date(bird.scheduledDeparture);
                    if (bird.hungerStartTime) bird.hungerStartTime = new Date(bird.hungerStartTime);
                    
                    if (bird.feedHistory) {
                        bird.feedHistory.forEach(feed => {
                            if (feed.time) feed.time = new Date(feed.time);
                        });
                    }
                });
            }
        });
        
        if (data.events) {
            data.events.forEach(event => {
                if (event.timestamp) event.timestamp = new Date(event.timestamp);
            });
        }
    }

    // サーバー別データ保存
    async saveServerZoo(guildId) {
        const zooState = this.getZooState(guildId);
        const filePath = path.join(this.dataPath, `${guildId}.json`);
        
        try {
            fs.writeFileSync(filePath, JSON.stringify(zooState, null, 2));
            console.log(`💾 サーバー ${guildId} のデータを保存しました`);
        } catch (error) {
            console.error(`サーバー ${guildId} のデータ保存エラー:`, error);
        }
    }

    // サーバー別鳥類園データ取得
    getZooState(guildId) {
        if (!this.serverZoos.has(guildId)) {
            // 新しいサーバーの場合、初期データを作成
            const newZooState = {
                森林: [],
                草原: [],
                水辺: [],
                lastUpdate: new Date(),
                events: [],
                isInitialized: false,
                guildId: guildId
            };
            this.serverZoos.set(guildId, newZooState);
        }
        return this.serverZoos.get(guildId);
    }

    // サーバー別初期化
    async initializeServer(guildId) {
        // まずファイルから読み込み試行
        let zooState = await this.loadServerZoo(guildId);
        
        if (!zooState) {
            // ファイルがない場合は新規作成
            zooState = this.getZooState(guildId);
        }
        
        if (zooState.isInitialized) return;
        
        console.log(`🏞️ サーバー ${guildId} の鳥類園を初期化中...`);
        
        try {
            await this.populateAllAreas(guildId);
            zooState.isInitialized = true;
            
            console.log(`✅ サーバー ${guildId} の鳥類園初期化完了`);
            
            // 初期化完了イベント
            await this.addEvent(guildId, 'システム', 'この鳥類園が開園しました！', '');
            
            // データ保存
            await this.saveServerZoo(guildId);
            
        } catch (error) {
            console.error(`❌ サーバー ${guildId} の鳥類園初期化エラー:`, error);
            throw error;
        }
    }

    // サーバー別全エリア鳥配置
    async populateAllAreas(guildId) {
        const zooState = this.getZooState(guildId);
        const areas = ['森林', '草原', '水辺'];
        
        for (const area of areas) {
            zooState[area] = await this.populateArea(area, 5);
            console.log(`✅ サーバー ${guildId} - ${area}エリア: ${zooState[area].length}羽配置完了`);
        }
        
        zooState.lastUpdate = new Date();
    }

    // 特定エリアに鳥を配置（既存のメソッドをそのまま使用）
    async populateArea(area, targetCount) {
        const suitableBirds = birdData.getBirdsForZooArea(area);
        
        if (suitableBirds.length === 0) {
            console.warn(`⚠️ ${area}エリアに適した鳥が見つかりません`);
            return [];
        }

        const selectedBirds = [];
        const maxAttempts = targetCount * 3;
        let attempts = 0;

        while (selectedBirds.length < targetCount && attempts < maxAttempts) {
            const randomBird = suitableBirds[Math.floor(Math.random() * suitableBirds.length)];
            
            if (!selectedBirds.some(b => b.name === randomBird.名前)) {
                const birdInstance = this.createBirdInstance(randomBird, area);
                selectedBirds.push(birdInstance);
            }
            attempts++;
        }

        return selectedBirds;
    }

    // 鳥インスタンス作成（既存のメソッドをそのまま使用）
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

    // 出発時間計算（既存）
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
        console.log('🔄 全サーバー鳥類園の自動管理を開始...');
        
        // 鳥の入れ替え（1時間に1回チェック）
        const migrationTask = cron.schedule('0 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.checkBirdMigration(guildId);
            }
        }, { scheduled: false });

        // 活動更新（30分に1回）
        const activityTask = cron.schedule('*/30 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.updateBirdActivities(guildId);
            }
        }, { scheduled: false });

        // 空腹通知（30分に1回チェック）
        const hungerTask = cron.schedule('*/30 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.checkHungerStatus(guildId);
            }
        }, { scheduled: false });

        // 自動保存（10分に1回）
        const saveTask = cron.schedule('*/10 * * * *', async () => {
            await this.saveAllServerZoos();
        }, { scheduled: false });

        // ランダムイベント（3時間に1回）
        const eventTask = cron.schedule('0 */3 * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                if (Math.random() < 0.7) {
                    await this.generateRandomEvent(guildId);
                }
            }
        }, { scheduled: false });

        // タスク開始
        migrationTask.start();
        activityTask.start();
        hungerTask.start();
        saveTask.start();
        eventTask.start();

        this.scheduledTasks = [migrationTask, activityTask, hungerTask, saveTask, eventTask];
        
        console.log('✅ 自動管理タスクを開始しました');
    }

    // 全サーバーデータ保存
    async saveAllServerZoos() {
        for (const guildId of this.serverZoos.keys()) {
            await this.saveServerZoo(guildId);
        }
        console.log('🔄 全サーバーのデータを自動保存しました');
    }

    // サーバー別鳥移動チェック
    async checkBirdMigration(guildId) {
        if (this.isProcessing) return;
        
        const zooState = this.getZooState(guildId);
        if (!zooState.isInitialized) return;

        try {
            const now = new Date();
            let migrationOccurred = false;

            for (const area of ['森林', '草原', '水辺']) {
                const birds = zooState[area];
                
                for (let i = birds.length - 1; i >= 0; i--) {
                    const bird = birds[i];
                    const actualDeparture = new Date(bird.scheduledDeparture.getTime() + (bird.stayExtension * 24 * 60 * 60 * 1000));
                    
                    if (now >= actualDeparture) {
                        await this.removeBird(guildId, area, i);
                        migrationOccurred = true;
                    }
                }
                
                if (zooState[area].length < 5) {
                    await this.addNewBirdToArea(guildId, area);
                    migrationOccurred = true;
                }
            }

            if (migrationOccurred) {
                zooState.lastUpdate = new Date();
                await this.saveServerZoo(guildId);
                console.log(`🔄 サーバー ${guildId} の鳥類園構成が更新されました`);
            }

        } catch (error) {
            console.error(`サーバー ${guildId} の鳥移動チェックエラー:`, error);
        }
    }

    // サーバー別鳥除去
    async removeBird(guildId, area, index) {
        const zooState = this.getZooState(guildId);
        const bird = zooState[area][index];
        zooState[area].splice(index, 1);
        
        await logger.logZoo('退園', area, bird.name, '', '', guildId);
        
        if (Math.random() < 0.3) {
            await this.addEvent(
                guildId,
                'お別れ',
                `${bird.name}が旅立っていきました。また会える日まで...👋`,
                bird.name
            );
        }
    }

    // サーバー別新鳥追加
    async addNewBirdToArea(guildId, area) {
        const newBirds = await this.populateArea(area, 1);
        
        if (newBirds.length > 0) {
            const zooState = this.getZooState(guildId);
            zooState[area].push(newBirds[0]);
            
            await logger.logZoo('入園', area, newBirds[0].name, '', '', guildId);
            
            if (Math.random() < 0.4) {
                await this.addEvent(
                    guildId,
                    '新入り',
                    `${newBirds[0].name}が新しく${area}エリアに仲間入りしました！🎉`,
                    newBirds[0].name
                );
            }
        }
    }

    // サーバー別活動更新
    async updateBirdActivities(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized) return;

            for (const area of ['森林', '草原', '水辺']) {
                zooState[area].forEach(bird => {
                    if (Math.random() < 0.3) {
                        bird.activity = this.generateActivity(area);
                        
                        if (Math.random() < 0.2) {
                            bird.mood = this.getRandomMood();
                        }
                    }
                });
            }
        } catch (error) {
            console.error(`サーバー ${guildId} の活動更新エラー:`, error);
        }
    }

    // サーバー別空腹チェック
    async checkHungerStatus(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized) return;

            if (this.isSleepTime()) return;
            
            const now = new Date();
                
            for (const area of ['森林', '草原', '水辺']) {
                for (const bird of zooState[area]) {
                    const hungryThreshold = 4 * 60 * 60 * 1000; // 4時間
                    const lastFeedTime = bird.lastFed || bird.entryTime;
                    
                    if ((now - lastFeedTime) > hungryThreshold) {
                        if (!bird.isHungry) {
                            bird.isHungry = true;
                            bird.hungerNotified = false;
                            bird.activity = this.generateHungryActivity(area);
                            
                            if (Math.random() < 0.50) {
                                await this.addEvent(
                                    guildId,
                                    '空腹通知',
                                    `${bird.name}がお腹を空かせているようです！🍽️ \`/feed bird:${bird.name} food:[餌の種類]\` で餌をあげてみましょう`,
                                    bird.name
                                );
                                bird.hungerNotified = true;
                            }
                            
                            console.log(`🍽️ サーバー ${guildId} - ${bird.name} が空腹になりました (${area}エリア)`);
                        }
                    } else {
                        if (bird.isHungry) {
                            bird.isHungry = false;
                            bird.activity = this.generateActivity(area);
                            console.log(`😊 サーバー ${guildId} - ${bird.name} が満腹になりました (${area}エリア)`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`サーバー ${guildId} の空腹状態チェックエラー:`, error);
        }
    }

    // サーバー別ランダムイベント
    async generateRandomEvent(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized) return;

            const allBirds = this.getAllBirds(guildId);
            if (allBirds.length === 0) return;

            const eventTypes = ['interaction', 'discovery', 'weather', 'special'];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const event = await this.createEvent(eventType, allBirds);
            
            if (event) {
                await this.addEvent(guildId, event.type, event.content, event.relatedBird);
                console.log(`🎪 サーバー ${guildId} でランダムイベント発生: ${event.type}`);
            }

        } catch (error) {
            console.error(`サーバー ${guildId} のランダムイベント生成エラー:`, error);
        }
    }

    // サーバー別イベント追加
    async addEvent(guildId, type, content, relatedBird = '') {
        const zooState = this.getZooState(guildId);
        
        const event = {
            type,
            content,
            relatedBird,
            timestamp: new Date()
        };

        zooState.events.push(event);

        if (zooState.events.length > 20) {
            zooState.events = zooState.events.slice(-20);
        }

        await logger.logEvent(type, content, relatedBird, guildId);
    }

    // サーバー別全鳥取得
    getAllBirds(guildId) {
        const zooState = this.getZooState(guildId);
        return [
            ...zooState.森林,
            ...zooState.草原,
            ...zooState.水辺
        ];
    }

    // 既存のヘルパーメソッド（変更なし）
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

    generateHungryActivity(area) {
        const hungryActivities = {
            '森林': [
                'お腹を空かせて餌を探し回っています',
                '木の枝で寂しそうに鳴いています', 
                '餌を求めてあちこち見回しています',
                'お腹がぺこぺこで元気がありません'
            ],
            '草原': [
                '地面をつついて何か食べ物を探しています',
                'お腹を空かせてそわそわしています',
                '餌を求めて草むらを探しています',
                '空腹で少し疲れているようです'
            ],
            '水辺': [
                '水面を見つめて魚を探しています',
                'お腹を空かせて水辺をうろうろしています',
                '餌を求めて浅瀬を歩き回っています',
                '空腹で羽を垂らしています'
            ]
        };

        const activities = hungryActivities[area] || hungryActivities['森林'];
        return activities[Math.floor(Math.random() * activities.length)];
    }

    getRandomMood() {
        const moods = ['happy', 'normal', 'sleepy', 'excited', 'calm'];
        return moods[Math.floor(Math.random() * moods.length)];
    }

    isSleepTime() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        return hour >= 0 && hour < 7;
    }

    // イベント作成メソッド（既存のものを流用）
    async createEvent(eventType, allBirds) {
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

    // 統計情報取得（サーバー別）
    getStatistics(guildId) {
        const allBirds = this.getAllBirds(guildId);
        const zooState = this.getZooState(guildId);
        
        return {
            totalBirds: allBirds.length,
            areaDistribution: {
                森林: zooState.森林.length,
                草原: zooState.草原.length,
                水辺: zooState.水辺.length
            },
            averageStay: this.calculateAverageStay(allBirds),
            hungryBirds: allBirds.filter(b => b.isHungry).length,
            recentEvents: zooState.events.slice(-5),
            lastUpdate: zooState.lastUpdate
        };
    }

    calculateAverageStay(birds) {
        if (birds.length === 0) return 0;
        
        const now = new Date();
        const totalStayHours = birds.reduce((sum, bird) => {
            const stayTime = now - bird.entryTime;
            return sum + (stayTime / (1000 * 60 * 60));
        }, 0);
        
        return Math.round(totalStayHours / birds.length);
    }

    // テスト用メソッド
    forceHungry(birdName = null, guildId) {
        const now = new Date();
        const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
        const zooState = this.getZooState(guildId);
        
        let count = 0;
        
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of zooState[area]) {
                if (!birdName || bird.name.includes(birdName) || birdName.includes(bird.name)) {
                    bird.lastFed = fiveHoursAgo;
                    bird.isHungry = true;
                    bird.hun
