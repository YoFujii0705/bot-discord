const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('today')
        .setDescription('今日の鳥を表示します📅')
        .addBooleanOption(option =>
            option.setName('weather')
                .setDescription('天気に合わせた鳥を選ぶ（実験的機能）')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // データ初期化チェック
            if (!birdData.initialized) {
                await interaction.reply({
                    content: '🔄 鳥データを読み込み中です...少々お待ちください',
                    ephemeral: true
                });
                await birdData.initialize();
            }

            const weatherMode = interaction.options.getBoolean('weather') || false;
            
            let todaysBird;
            let selectionMethod = '季節';
            
            if (weatherMode) {
                // 天気を考慮した鳥選択（実験的）
                const weatherBird = await this.getBirdByWeather();
                if (weatherBird) {
                    todaysBird = weatherBird.bird;
                    selectionMethod = weatherBird.reason;
                } else {
                    todaysBird = birdData.getTodaysBird();
                    selectionMethod = '季節（天気情報取得失敗）';
                }
            } else {
                // 通常の季節ベース選択
                todaysBird = birdData.getTodaysBird();
            }

            if (!todaysBird) {
                await interaction.reply({
                    content: '❌ 今日の鳥を選ぶことができませんでした。しばらく待ってから再度お試しください。',
                    ephemeral: true
                });
                return;
            }

            // 今日の鳥のEmbed作成
            const embed = this.createTodaysBirdEmbed(todaysBird, selectionMethod);
            
            await interaction.reply({ embeds: [embed] });
            
            // ログ記録
            await logger.logGacha(
                interaction.user.id,
                interaction.user.username,
                '今日の鳥',
                todaysBird.名前,
                `選択方法: ${selectionMethod}`
            );

            // 特別な日付チェック
            await this.checkSpecialDate(interaction, todaysBird);

        } catch (error) {
            console.error('今日の鳥コマンドエラー:', error);
            await logger.logError('今日の鳥コマンド', error, {
                userId: interaction.user.id,
                weatherMode: interaction.options.getBoolean('weather')
            });

            const errorMessage = '今日の鳥の取得中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 今日の鳥のEmbed作成
    createTodaysBirdEmbed(bird, selectionMethod) {
        const today = new Date();
        const dateString = today.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        const currentSeason = birdData.getCurrentSeason();
        
        // 色に基づく背景色
        const colorMap = {
            '茶系': 0x8B4513,
            '白系': 0xF5F5F5,
            '黒系': 0x2F4F4F,
            '赤系': 0xFF6347,
            '黄系': 0xFFD700,
            '青系': 0x4169E1,
            '緑系': 0x228B22,
            '灰系': 0x808080
        };

        const mainColor = bird.色.split('、')[0];
        const embedColor = colorMap[mainColor] || 0x00AE86;

        const embed = new EmbedBuilder()
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
            .setTimestamp();

        // 選択理由
        embed.addFields({
            name: '🎯 選ばれた理由',
            value: this.getSelectionReason(selectionMethod, currentSeason),
            inline: false
        });

        // 今日のメッセージ
        const dailyMessage = this.generateDailyMessage(bird, today);
        embed.addFields({
            name: '💭 今日のメッセージ',
            value: dailyMessage,
            inline: false
        });

        // 曜日特別メッセージ
        const dayOfWeek = today.getDay();
        const weeklyMessage = this.getWeeklyMessage(dayOfWeek);
        if (weeklyMessage) {
            embed.addFields({
                name: '🗓️ 今日は...',
                value: weeklyMessage,
                inline: false
            });
        }

        embed.setFooter({ 
            text: `現在の季節: ${currentSeason} | 選択方法: ${selectionMethod}` 
        });

        return embed;
    },

    // 選択理由の説明
    getSelectionReason(method, season) {
        const reasons = {
            '季節': `現在の季節「${season}」に合わせて選ばれました`,
            '晴天': '今日の晴れた天気に合う鳥が選ばれました',
            '雨天': '今日の雨模様に合う鳥が選ばれました',
            '曇天': '今日の曇り空に合う鳥が選ばれました',
            '雪': '今日の雪に合う鳥が選ばれました',
            '季節（天気情報取得失敗）': `天気情報の取得に失敗したため、季節「${season}」基準で選ばれました`
        };

        return reasons[method] || `${method}に基づいて選ばれました`;
    },

    // 日別メッセージ生成
    generateDailyMessage(bird, date) {
        const messages = [
            `${bird.名前}と一緒に素敵な一日を過ごしませんか？`,
            `今日は${bird.名前}のように${this.getBirdPersonality(bird)}過ごしてみては？`,
            `${bird.名前}が教えてくれる今日のヒント：${this.getBirdWisdom(bird)}`,
            `${bird.名前}から今日のエネルギーをもらいましょう！`,
            `今日の${bird.名前}のような${this.getBirdTrait(bird)}を心がけてみませんか？`
        ];

        return messages[Math.floor(Math.random() * messages.length)];
    },

    // 鳥の性格特徴
    getBirdPersonality(bird) {
        const personalities = {
            '小': '細やかに、丁寧に',
            '中': 'バランスよく、安定して',
            '大': 'ダイナミックに、大胆に',
            '特大': '堂々と、スケールの大きく'
        };

        return personalities[bird.全長区分] || 'のびのびと';
    },

    // 鳥からの知恵
    getBirdWisdom(bird) {
        const wisdom = [
            '小さなことから始めてみましょう',
            '周りをよく観察することが大切です',
            '自分らしさを大切にしましょう',
            '新しいことにチャレンジしてみませんか',
            '仲間との時間を大切にしましょう',
            '自然の美しさに目を向けてみて',
            '今この瞬間を大切に過ごしましょう'
        ];

        return wisdom[Math.floor(Math.random() * wisdom.length)];
    },

    // 鳥の特徴
    getBirdTrait(bird) {
        const environments = bird.環境.split('、')[0];
        const traits = {
            '森林': '静けさと集中力',
            '海': '広い視野と冒険心',
            '河川・湖沼': '流れに身を任せる柔軟性',
            '農耕地': '地に足がついた実直さ',
            '市街・住宅地': '適応力と社交性',
            '草地': '開放感と自由さ',
            '高山': '高い志と忍耐力',
            '裸地': 'たくましさと生命力'
        };

        return traits[environments] || '自然体な魅力';
    },

    // 曜日別メッセージ
    getWeeklyMessage(dayOfWeek) {
        const weeklyMessages = {
            0: '🌅 日曜日！新しい週への準備をゆっくりと',
            1: '💪 月曜日！今週も元気にスタートしましょう',
            2: '⚡ 火曜日！エネルギッシュに活動する日',
            3: '🌸 水曜日！週の真ん中、少し息抜きを',
            4: '🌟 木曜日！週末に向けてもうひと頑張り',
            5: '🎉 金曜日！もうすぐ週末、お疲れ様でした',
            6: '🌈 土曜日！自分の時間を大切にしましょう'
        };

        return weeklyMessages[dayOfWeek];
    },

    // 天気による鳥選択（実験的機能）
    async getBirdByWeather() {
        try {
            // 実際の実装では天気APIを使用
            // ここではダミー実装
            const weather = this.getRandomWeather();
            
            const weatherBirds = {
                'sunny': () => {
                    // 晴天：明るい色の鳥、開けた環境の鳥
                    const brightBirds = birdData.searchBirds({ 色: '黄系' })
                        .concat(birdData.searchBirds({ 環境: '草地' }));
                    return brightBirds.length > 0 ? brightBirds[Math.floor(Math.random() * brightBirds.length)] : null;
                },
                'rainy': () => {
                    // 雨天：水辺の鳥
                    const waterBirds = birdData.searchBirds({ 環境: '河川・湖沼' });
                    return waterBirds.length > 0 ? waterBirds[Math.floor(Math.random() * waterBirds.length)] : null;
                },
                'cloudy': () => {
                    // 曇天：灰色系の鳥
                    const grayBirds = birdData.searchBirds({ 色: '灰系' });
                    return grayBirds.length > 0 ? grayBirds[Math.floor(Math.random() * grayBirds.length)] : null;
                },
                'snowy': () => {
                    // 雪：白い鳥、冬鳥
                    const winterBirds = birdData.searchBirds({ 色: '白系' })
                        .concat(birdData.searchBirds({ 渡り区分: '冬鳥' }));
                    return winterBirds.length > 0 ? winterBirds[Math.floor(Math.random() * winterBirds.length)] : null;
                }
            };

            const selectedBird = weatherBirds[weather.type]();
            
            if (selectedBird) {
                return {
                    bird: selectedBird,
                    reason: weather.reason
                };
            }

            return null;
        } catch (error) {
            console.error('天気による鳥選択エラー:', error);
            return null;
        }
    },

    // ダミー天気取得
    getRandomWeather() {
        const weathers = [
            { type: 'sunny', reason: '晴天' },
            { type: 'rainy', reason: '雨天' },
            { type: 'cloudy', reason: '曇天' },
            { type: 'snowy', reason: '雪' }
        ];

        return weathers[Math.floor(Math.random() * weathers.length)];
    },

    // 特別な日付チェック
    async checkSpecialDate(interaction, bird) {
        const today = new Date();
        const specialDates = this.getSpecialDates();
        
        const todayKey = `${today.getMonth() + 1}-${today.getDate()}`;
        const specialDate = specialDates[todayKey];
        
        if (specialDate) {
            const specialEmbed = new EmbedBuilder()
                .setTitle(`🎊 特別な日！`)
                .setDescription(`今日は **${specialDate.name}** です！\n${bird.名前}と一緒にお祝いしませんか？`)
                .setColor(0xFFD700)
                .addFields({
                    name: '🎉 特別メッセージ',
                    value: specialDate.message,
                    inline: false
                })
                .setTimestamp();

            setTimeout(async () => {
                try {
                    await interaction.followUp({ embeds: [specialEmbed] });
                    
                    // 特別な日のログ
                    await logger.logEvent(
                        '特別な日',
                        `${specialDate.name}: ${bird.名前}が今日の鳥として選ばれました`,
                        bird.名前
                    );
                } catch (error) {
                    console.error('特別な日メッセージ送信エラー:', error);
                }
            }, 2000);
        }
    },

    // 特別な日付の定義
    getSpecialDates() {
        return {
            '1-1': { name: '新年', message: '新しい年の始まり、鳥たちと共に新たなスタートを！' },
            '2-14': { name: 'バレンタインデー', message: '愛する人との時間を、美しい鳥の歌声と共に' },
            '3-21': { name: '春分の日', message: '春の訪れ、渡り鳥たちも戻ってくる季節です' },
            '4-29': { name: '昭和の日', message: '自然を愛でる心を大切に' },
            '5-10': { name: '愛鳥週間開始', message: '鳥たちを愛し、保護する週間の始まりです' },
            '7-7': { name: '七夕', message: '星に願いを、鳥たちと共に空を見上げて' },
            '9-23': { name: '秋分の日', message: '秋の深まり、渡り鳥たちの旅立ちの季節' },
            '11-23': { name: '勤労感謝の日', message: '働き者の鳥たちに感謝を込めて' },
            '12-25': { name: 'クリスマス', message: '聖なる夜を鳥たちと共に平和に過ごしましょう' }
        };
    }
};
