const sheetsManager = require('../../config/sheets');

class BirdDataManager {
    constructor() {
        this.birds = [];
        this.initialized = false;
    }

    // 初期化
    async initialize() {
        try {
            this.birds = await sheetsManager.getBirds();
            this.initialized = true;
            console.log(`✅ 鳥データを読み込みました: ${this.birds.length}種`);
        } catch (error) {
            console.error('鳥データ初期化エラー:', error);
            this.initialized = false;
        }
    }

    // データ再読み込み
    async refresh() {
        await this.initialize();
    }

    // 全鳥データ取得
    getAllBirds() {
        return this.birds;
    }

    // ランダムな鳥を取得
    getRandomBird() {
        if (this.birds.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.birds.length);
        return this.birds[randomIndex];
    }

    // 複数のランダムな鳥を取得
    getRandomBirds(count) {
        if (this.birds.length === 0) return [];
        
        const shuffled = [...this.birds].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, this.birds.length));
    }

    // 条件に合う鳥を検索
    searchBirds(conditions) {
        return this.birds.filter(bird => {
            return Object.entries(conditions).every(([key, value]) => {
                if (!value || !bird[key]) return true;
                
                // 複数値対応（カンマ区切り）
                const birdValues = bird[key].split('、').map(v => v.trim());
                const searchValues = value.split('、').map(v => v.trim());
                
                return searchValues.some(searchValue => 
                    birdValues.some(birdValue => 
                        birdValue.includes(searchValue) || searchValue.includes(birdValue)
                    )
                );
            });
        });
    }

    // 季節に合う鳥を取得
    getBirdsBySeason(season) {
        return this.birds.filter(bird => {
            const seasons = bird.季節.split('、').map(s => s.trim());
            return seasons.includes(season);
        });
    }

    // 環境に合う鳥を取得
    getBirdsByEnvironment(environment) {
        return this.birds.filter(bird => {
            const environments = bird.環境.split('、').map(e => e.trim());
            return environments.includes(environment);
        });
    }

    // 渡り区分で鳥を取得
    getBirdsByMigration(migration) {
        return this.birds.filter(bird => bird.渡り区分 === migration);
    }

    // 鳥類園用のエリア別鳥取得
    getBirdsForZooArea(area) {
        const areaMapping = {
            '森林': ['森林', '高山'],
            '草原': ['農耕地', '草地', '裸地', '市街・住宅地'],
            '水辺': ['河川・湖沼', '海']
        };

        const environments = areaMapping[area] || [];
        return this.birds.filter(bird => {
            const birdEnvironments = bird.環境.split('、').map(e => e.trim());
            return environments.some(env => birdEnvironments.includes(env));
        });
    }

    // 今日の季節を取得
    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return '春';
        if (month >= 6 && month <= 8) return '夏';
        if (month >= 9 && month <= 11) return '秋';
        return '冬';
    }

    // 今日の鳥を取得（季節に合った鳥）
    getTodaysBird() {
        const currentSeason = this.getCurrentSeason();
        const seasonalBirds = this.getBirdsBySeason(currentSeason);
        
        if (seasonalBirds.length === 0) {
            return this.getRandomBird();
        }
        
        const randomIndex = Math.floor(Math.random() * seasonalBirds.length);
        return seasonalBirds[randomIndex];
    }

    // テーマガチャ用のランダム属性組み合わせ
    getRandomTheme() {
        const themes = {
            色: ['茶系', '白系', '黒系', '赤系', '黄系', '青系', '緑系', '灰系'],
            季節: ['春', '夏', '秋', '冬'],
            環境: ['市街・住宅地', '河川・湖沼', '農耕地', '海', '森林', '草地', '裸地', '高山'],
            渡り区分: ['夏鳥', '冬鳥', '留鳥', '漂鳥', '旅鳥'],
            全長区分: ['小', '中', '大', '特大']
        };

        const selectedThemes = {};
        const themeKeys = Object.keys(themes);
        const numThemes = Math.floor(Math.random() * 2) + 2; // 2-3個のテーマ

        for (let i = 0; i < numThemes; i++) {
            const randomKey = themeKeys[Math.floor(Math.random() * themeKeys.length)];
            if (!selectedThemes[randomKey]) {
                const values = themes[randomKey];
                selectedThemes[randomKey] = values[Math.floor(Math.random() * values.length)];
            }
        }

        return selectedThemes;
    }

    // 鳥の好物チェック
    // birdData.js の getFoodPreference メソッドを以下に置き換え

// 鳥の好物チェック
getFoodPreference(birdName, food) {
    // Discord表記からスプレッドシート表記への変換
    const foodMapping = {
        '種子': '麦',
        '蜜': '花蜜'
    };
    
    // 変換が必要な場合は変換
    const mappedFood = foodMapping[food] || food;
    
    // 部分一致で鳥を検索（feed.jsと同じロジック）
    const bird = this.birds.find(b => 
        b.名前.includes(birdName) || birdName.includes(b.名前)
    );
    
    if (!bird) {
        console.log(`⚠️ 鳥が見つかりません: ${birdName}`);
        return 'unknown';
    }
    
    console.log(`🔍 鳥発見: ${bird.名前}, 餌: ${mappedFood}`);
    
    // 好物チェック
    const favorites = bird.好物 ? bird.好物.split('、').map(f => f.trim()) : [];
    console.log(`❤️ 好物: ${favorites.join(', ')}`);
    
    // 食べられる餌チェック  
    const acceptable = bird.食べられる餌 ? bird.食べられる餌.split('、').map(f => f.trim()) : [];
    console.log(`😊 食べられる餌: ${acceptable.join(', ')}`);
    
    if (favorites.includes(mappedFood)) {
        console.log(`✨ ${mappedFood}は好物です！`);
        return 'favorite';
    }
    if (acceptable.includes(mappedFood)) {
        console.log(`😊 ${mappedFood}は食べられる餌です`);
        return 'acceptable';
    }
    
    console.log(`😐 ${mappedFood}はあまり好きではないようです`);
    return 'dislike';
}

    // 統計情報
    getStats() {
        return {
            total: this.birds.length,
            bySize: this.countBy('全長区分'),
            byColor: this.countBy('色'),
            bySeason: this.countBy('季節'),
            byMigration: this.countBy('渡り区分'),
            byEnvironment: this.countBy('環境')
        };
    }

    // 属性別カウント
    countBy(attribute) {
        const counts = {};
        this.birds.forEach(bird => {
            if (bird[attribute]) {
                const values = bird[attribute].split('、').map(v => v.trim());
                values.forEach(value => {
                    counts[value] = (counts[value] || 0) + 1;
                });
            }
        });
        return counts;
    }
}

module.exports = new BirdDataManager();
