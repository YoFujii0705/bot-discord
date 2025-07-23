const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zoo')
        .setDescription('オリジナル鳥類園の様子を見ます🏞️')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('鳥類園全体を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('area')
                .setDescription('特定エリアの詳細を表示')
                .addStringOption(option =>
                    option.setName('area')
                        .setDescription('表示するエリア')
                        .addChoices(
                            { name: '森林エリア', value: '森林' },
                            { name: '草原エリア', value: '草原' },
                            { name: '水辺エリア', value: '水辺' }
                        )
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('特定の鳥の様子を見る')
                .addStringOption(option =>
                    option.setName('bird')
                        .setDescription('鳥の名前')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('🔧 園長専用: 鳥類園をリセット')),

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

            const subcommand = interaction.options.getSubcommand();

            // 鳥類園の初期化チェック
            if (this.isZooEmpty()) {
                await this.initializeZoo();
            }

            switch (subcommand) {
                case 'view':
                    await this.handleViewCommand(interaction);
                    break;
                case 'area':
                    await this.handleAreaCommand(interaction);
                    break;
                case 'status':
                    await this.handleStatusCommand(interaction);
                    break;
                case 'reset':
                    await this.handleResetCommand(interaction);
                    break;
            }

        } catch (error) {
            console.error('鳥類園コマンドエラー:', error);
            await logger.logError('鳥類園コマンド', error, {
                userId: interaction.user.id,
                subcommand: interaction.options.getSubcommand()
            });

            const errorMessage = '鳥類園の表示中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 鳥類園全体表示
    async handleViewCommand(interaction) {
        const embed = this.createZooOverviewEmbed();
        const buttons = this.createZooButtons();
        
        await interaction.reply({ embeds: [embed], components: [buttons] });
        
        // ログ記録
        await logger.logZoo('全体表示', '全体', '', interaction.user.id, interaction.user.username);
    },

    // エリア詳細表示
    async handleAreaCommand(interaction) {
        const area = interaction.options.getString('area');
        const embed = this.createAreaDetailEmbed(area);
        
        await interaction.reply({ embeds: [embed] });
        
        // ログ記録
        await logger.logZoo('エリア表示', area, '', interaction.user.id, interaction.user.username);
    },

    // 鳥の様子表示
    async handleStatusCommand(interaction) {
        const birdName = interaction.options.getString('bird');
        const birdInfo = this.findBirdInZoo(birdName);
        
        if (!birdInfo) {
            await interaction.reply({
                content: `🔍 "${birdName}" は現在鳥類園にいないようです。正確な名前で検索するか、\`/zoo view\` で現在いる鳥を確認してください。`,
                ephemeral: true
            });
            return;
        }

        const embed = this.createBirdStatusEmbed(birdInfo);
        await interaction.reply({ embeds: [embed] });
        
        // ログ記録
        await logger.logZoo('鳥の様子確認', birdInfo.area, birdName, interaction.user.id, interaction.user.username);
    },

    // リセット（園長専用）
    async handleResetCommand(interaction) {
        // 園長権限チェック
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            await interaction.reply({
                content: '🚫 この機能は園長（管理者）専用です。',
                ephemeral: true
            });
            return;
        }

        await this.initializeZoo();
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 鳥類園リセット完了')
            .setDescription('新しい鳥たちが各エリアに配置されました！')
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        
        // ログ記録
        await logger.logZoo('園長リセット', '全体', '', interaction.user.id, interaction.user.username);
        await logger.logEvent('園長操作', `${interaction.user.username}が鳥類園をリセットしました`);
    },

    // 鳥類園が空かチェック
    isZooEmpty() {
    const zooManager = require('../utils/zooManager');
    const zooState = zooManager.getZooState();
    return zooState.森林.length === 0 && zooState.草原.length === 0 && zooState.水辺.length === 0;
},

    // 鳥類園初期化
    async initializeZoo() {
        console.log('🏞️ 鳥類園を初期化中...');
        
        // 各エリアに5羽ずつ配置
        const zooManager = require('../utils/zooManager');
     const zooState = zooManager.getZooState();
     zooState.森林 = this.assignBirdsToArea('森林', 5);
     zooState.草原 = this.assignBirdsToArea('草原', 5);
     zooState.水辺 = this.assignBirdsToArea('水辺', 5);
     zooState.lastUpdate = new Date();
     zooState.events = [];

for (const bird of zooState[area]) {
                await logger.logZoo('入園', area, bird.name);
            }
        }

        console.log('✅ 鳥類園の初期化完了');
    },

    // エリアに鳥を配置
    assignBirdsToArea(area, count) {
        const areaBirds = birdData.getBirdsForZooArea(area);
        if (areaBirds.length === 0) {
            console.warn(`⚠️ ${area}エリアに適した鳥が見つかりません`);
            return [];
        }

        const selectedBirds = birdData.getRandomBirds(count).filter(bird => {
            const environments = bird.環境.split('、').map(e => e.trim());
            const areaMapping = {
                '森林': ['森林', '高山'],
                '草原': ['農耕地', '草地', '裸地', '市街・住宅地'],
                '水辺': ['河川・湖沼', '海']
            };
            return areaMapping[area].some(env => environments.includes(env));
        });

        // 足りない場合は追加で選択
        while (selectedBirds.length < count && areaBirds.length > 0) {
            const randomBird = areaBirds[Math.floor(Math.random() * areaBirds.length)];
            if (!selectedBirds.some(b => b.名前 === randomBird.名前)) {
                selectedBirds.push(randomBird);
            }
        }

        return selectedBirds.slice(0, count).map(bird => ({
            name: bird.名前,
            data: bird,
            entryTime: new Date(),
            lastFed: null,
            activity: this.generateRandomActivity(area),
            mood: 'normal'
        }));
    },

    // 鳥類園全体のEmbed
    createZooOverviewEmbed() {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState();
        
        const totalBirds = zooState.森林.length + zooState.草原.length + zooState.水辺.length;
        
        const embed = new EmbedBuilder()
            .setTitle('🏞️ オリジナル鳥類園')
            .setDescription(`現在 **${totalBirds}羽** の鳥たちが園内で過ごしています`)
            .setColor(0x228B22)
            .setTimestamp();

        // 各エリアの概要
        const areas = [
            { name: '🌲 森林エリア', key: '森林', emoji: '🌳' },
            { name: '🌾 草原エリア', key: '草原', emoji: '🌱' },
            { name: '🌊 水辺エリア', key: '水辺', emoji: '💧' }
        ];

        areas.forEach(area => {
            const birds = zooState[area.key];
            const birdList = birds.length > 0 
                ? birds.map(bird => {
                    const sizeEmoji = this.getSizeEmoji(bird.data.全長区分);
                    return `${sizeEmoji} ${bird.name}`;
                }).join('\n')
                : '(現在いません)';

            embed.addFields({
                name: `${area.emoji} ${area.name} (${birds.length}/5)`,
                value: birdList,
                inline: true
            });
        });

        // 最近のイベント
        if (zooState.events.length > 0) {
            const recentEvent = zooState.events[zooState.events.length - 1];
            embed.addFields({
                name: '📢 最新情報',
                value: recentEvent.content,
                inline: false
            });
        }

        embed.setFooter({ 
            text: `最終更新: ${zooState.lastUpdate.toLocaleString('ja-JP')}` 
        });

        return embed;
    },

    // エリア詳細Embed
    createAreaDetailEmbed(area) {
    const areaInfo = {
        '森林': { emoji: '🌲', description: '高い木々に囲まれた静かなエリア', color: 0x228B22 },
        '草原': { emoji: '🌾', description: '開けた草地で鳥たちが自由に過ごすエリア', color: 0x9ACD32 },
        '水辺': { emoji: '🌊', description: '池や小川がある水鳥たちのエリア', color: 0x4682B4 }
    };

    const info = areaInfo[area];
    const zooManager = require('../utils/zooManager');
    const zooState = zooManager.getZooState();
    const birds = zooState[area];

    // 睡眠時間チェック
    const sleepStatus = this.checkSleepTime();

    const embed = new EmbedBuilder()
        .setTitle(`${info.emoji} ${area}エリア詳細`)
        .setDescription(sleepStatus.isSleeping ? 
            `${info.description}\n🌙 現在は夜間のため、鳥たちは静かに眠っています` : 
            info.description)
        .setColor(sleepStatus.isSleeping ? 0x2F4F4F : info.color)
        .setTimestamp();

    if (birds.length === 0) {
        embed.addFields({
            name: '現在の状況',
            value: '現在このエリアには鳥がいません',
            inline: false
        });
    } else {
        birds.forEach((bird, index) => {
            const stayDuration = this.getStayDuration(bird.entryTime);
            let activityText;
            
            if (sleepStatus.isSleeping) {
                // 睡眠時間限定の特別ステータス
                const sleepActivity = this.generateSleepActivity(bird, area);
                activityText = `😴 ${sleepActivity}\n📅 滞在期間: ${stayDuration}`;
            } else {
                // 通常時のステータス
                activityText = `${bird.activity}\n📅 滞在期間: ${stayDuration}`;
            }
            
            embed.addFields({
                name: `${index + 1}. ${this.getSizeEmoji(bird.data.全長区分)} ${bird.name}`,
                value: activityText,
                inline: true
            });
        });
    }

    return embed;
},

    // 鳥の状態Embed
    createBirdStatusEmbed(birdInfo) {
        const { bird, area } = birdInfo;
        const stayDuration = this.getStayDuration(bird.entryTime);
        
        const embed = new EmbedBuilder()
            .setTitle(`🐦 ${bird.name}の様子`)
            .setDescription(`*${bird.data.キャッチコピー}*`)
            .setColor(0x00AE86)
            .addFields(
                { name: '📍 現在地', value: `${area}エリア`, inline: true },
                { name: '📅 滞在期間', value: stayDuration, inline: true },
                { name: '😊 気分', value: this.getMoodEmoji(bird.mood), inline: true },
                { name: '🎭 現在の様子', value: bird.activity, inline: false }
            )
            .setTimestamp();

        // 餌やり状況
        if (bird.lastFed) {
            const fedAgo = this.getTimeSince(bird.lastFed);
            embed.addFields({
                name: '🍽️ 最後の餌やり',
                value: `${fedAgo}前`,
                inline: true
            });
        } else {
            embed.addFields({
                name: '🍽️ 餌やり',
                value: 'まだ餌をもらっていません',
                inline: true
            });
        }

        // 基本情報
        embed.addFields({
            name: '📊 基本情報',
            value: `**全長:** ${bird.data.全長} (${bird.data.全長区分})\n**色:** ${bird.data.色}\n**好物:** ${bird.data.好物 || '設定なし'}`,
            inline: false
        });

        return embed;
    },

    // 鳥類園ボタン
    createZooButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('zoo_refresh')
                    .setLabel('🔄 更新')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('zoo_forest')
                    .setLabel('🌲 森林')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('zoo_grassland')
                    .setLabel('🌾 草原')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('zoo_waterside')
                    .setLabel('🌊 水辺')
                    .setStyle(ButtonStyle.Primary)
            );
    },

    // 園内の鳥を検索
    findBirdInZoo(birdName) {
        for (const area of ['森林', '草原', '水辺']) {
            const bird = zooState[area].find(b => 
                b.name.includes(birdName) || birdName.includes(b.name)
            );
            if (bird) {
                return { bird, area };
            }
        }
        return null;
    },

    // ランダムな活動生成
    generateRandomActivity(area) {
        const activities = {
            '森林': [
                '木の枝で休んでいます',
                '木の実を探しています', 
                '美しい声でさえずっています',
                '羽繕いをしています',
                '枝から枝へ飛び移っています',
                '虫を捕まえています',
                '巣の材料を集めています'
            ],
            '草原': [
                '草地を歩き回っています',
                '種を探しています',
                '気持ちよさそうに日向ぼっこしています',
                '他の鳥と遊んでいます',
                '風に羽を広げています',
                '地面で餌を探しています',
                'のんびりと過ごしています'
            ],
            '水辺': [
                '水面に映る自分を見ています',
                '魚を狙っています',
                '水浴びを楽しんでいます',
                '水辺を静かに歩いています',
                '小さな波と戯れています',
                '羽を乾かしています',
                '水草の中を泳いでいます'
            ]
        };

        const areaActivities = activities[area] || activities['森林'];
        return areaActivities[Math.floor(Math.random() * areaActivities.length)];
    },

    // 鳥の状態Embed
    createBirdStatusEmbed(birdInfo) {
        const { bird, area } = birdInfo;
        const stayDuration = this.getStayDuration(bird.entryTime);
        
        // 睡眠時間チェック
        const sleepStatus = this.checkSleepTime();
        
        const embed = new EmbedBuilder()
            .setTitle(`🐦 ${bird.name}の様子`)
            .setDescription(`*${bird.data.キャッチコピー}*`)
            .setColor(sleepStatus.isSleeping ? 0x2F4F4F : 0x00AE86) // 睡眠時は暗い色
            .addFields(
                { name: '📍 現在地', value: `${area}エリア`, inline: true },
                { name: '📅 滞在期間', value: stayDuration, inline: true },
                { name: '😊 気分', value: sleepStatus.isSleeping ? '😴 夢の中' : this.getMoodEmoji(bird.mood), inline: true },
                { name: '🎭 現在の様子', value: sleepStatus.isSleeping ? sleepStatus.sleepActivity : bird.activity, inline: false }
            )
            .setTimestamp();

        // 餌やり状況（睡眠時は表示しない）
        if (!sleepStatus.isSleeping) {
            if (bird.lastFed) {
                const fedAgo = this.getTimeSince(bird.lastFed);
                embed.addFields({
                    name: '🍽️ 最後の餌やり',
                    value: `${fedAgo}前`,
                    inline: true
                });
            } else {
                embed.addFields({
                    name: '🍽️ 餌やり',
                    value: 'まだ餌をもらっていません',
                    inline: true
                });
            }
        } else {
            embed.addFields({
                name: '💤 睡眠中',
                value: '朝7:00まで餌やりはお休みです',
                inline: true
            });
        }

        // 基本情報
        embed.addFields({
            name: '📊 基本情報',
            value: `**全長:** ${bird.data.全長} (${bird.data.全長区分})\n**色:** ${bird.data.色}\n**好物:** ${bird.data.好物 || '設定なし'}`,
            inline: false
        });

        return embed;
    },

    // 滞在期間計算
    getStayDuration(entryTime) {
        const now = new Date();
        const diff = now - entryTime;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) {
            return `${days}日${hours}時間`;
        } else {
            return `${hours}時間`;
        }
    },

    // 経過時間計算
    getTimeSince(time) {
        const now = new Date();
        const diff = now - time;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}時間${minutes}分`;
        } else {
            return `${minutes}分`;
        }
    },

    // 気分絵文字
    getMoodEmoji(mood) {
        const moods = {
            'happy': '😊 ご機嫌',
            'normal': '😐 普通',
            'sleepy': '😴 眠そう',
            'excited': '🤩 興奮気味',
            'calm': '😌 穏やか'
        };
        return moods[mood] || moods['normal'];
    },

    // サイズ絵文字
    getSizeEmoji(size) {
        const sizeEmojis = {
            '小': '🐤',
            '中': '🐦',
            '大': '🦅',
            '特大': '🦢'
        };
        return sizeEmojis[size] || '🐦';
    },

// 睡眠時間チェック
checkSleepTime() {
    const now = new Date();
    const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    const hour = jstTime.getHours();
    
    if (hour >= 0 && hour < 7) {
        return { isSleeping: true };
    }
    
    return { isSleeping: false };
},

// 睡眠時間限定の特別ステータス生成
generateSleepActivity(bird, area) {
    // エリア別睡眠ステータス
    const sleepActivities = {
        '森林': [
            '羽を丸めて枝の上で眠っています',
            '頭を羽の下に隠して休んでいます',
            '木の洞で安全に眠っています',
            '仲間と寄り添って眠っています',
            '片脚で立ったまま器用に眠っています',
            '羽繕いをしてから眠りにつきました',
            '月明かりの下で静かに休んでいます',
            '夜露に濡れながらも深く眠っています'
        ],
        '草原': [
            '草むらの中で身を寄せ合って眠っています',
            '地面に座り込んで丸くなって眠っています',
            '風に揺れる草に包まれて眠っています',
            '星空を見上げてから眠りについたようです',
            '羽を広げて地面を温めながら眠っています',
            '夜の静寂の中でぐっすりと眠っています',
            '脚を羽にしまって丸い毛玉のようになっています',
            '朝露が降りる前に夢の中です'
        ],
        '水辺': [
            '水面近くの岩の上で眠っています',
            '片脚を上げたまま器用に眠っています',
            '首を背中に回して眠っています',
            '水際で波音を聞きながら眠っています',
            '羽に顔を埋めて眠っています',
            'さざ波の音に包まれて安らかに眠っています',
            '水草の間で身を隠して眠っています',
            '月光が水面に映る中で静かに休んでいます'
        ]
    };

    // 鳥のサイズ別睡眠ステータス
    const sizeSleepActivities = {
        '小': [
            '小さな体を羽毛で包んで眠っています',
            'ふわふわの羽毛が膨らんで丸いボールのようです',
            '小さな足を羽の中にしまって眠っています'
        ],
        '中': [
            '翼を体に巻きつけて眠っています',
            '首を斜めに傾けて眠っています',
            'バランスよく片脚で立って眠っています'
        ],
        '大': [
            '堂々とした姿勢で眠っています',
            '大きな翼を広げて仲間を包むように眠っています',
            '威厳を保ったまま静かに眠っています'
        ],
        '特大': [
            '大きな体でエリアを見守るように眠っています',
            '王者の風格を漂わせながら眠っています',
            '圧倒的な存在感で安らかに眠っています'
        ]
    };

    // エリア別とサイズ別を組み合わせて選択
    const areaActivities = sleepActivities[area] || sleepActivities['森林'];
    const sizeActivities = sizeSleepActivities[bird.data.全長区分] || sizeSleepActivities['中'];
    
    // 70%の確率でエリア別、30%の確率でサイズ別
    const selectedActivities = Math.random() < 0.7 ? areaActivities : sizeActivities;
    
    return selectedActivities[Math.floor(Math.random() * selectedActivities.length)];
},

// 睡眠時間限定の特別ステータス生成（天気連動版）
async generateSleepActivity(bird, area) {
    const weatherManager = require('../utils/weather');
    const weather = await weatherManager.getCurrentWeather();
    
    // 天気別睡眠ステータス
    const weatherSleepActivities = {
        rainy: [
            '雨音を聞きながら安らかに眠っています',
            '雨宿りをしながら静かに眠っています',
            '雨の夜の涼しさの中で深く眠っています',
            '雨粒の音に包まれて眠っています'
        ],
        snowy: [
            '雪景色の中で静かに眠っています',
            '雪に包まれて暖かく眠っています', 
            '雪の結晶が舞い散る中で眠っています',
            '雪明かりの下で安らかに眠っています'
        ],
        stormy: [
            '嵐を避けて安全な場所で眠っています',
            '風雨から身を守って眠っています',
            '嵐が過ぎるのを待ちながら眠っています'
        ],
        foggy: [
            '霧に包まれて神秘的に眠っています',
            '霧の中でひっそりと眠っています',
            '霧の静寂の中で安らかに眠っています'
        ]
    };

    // 天気に応じた特別ステータスがあるかチェック
    if (weather.condition !== 'unknown' && weatherSleepActivities[weather.condition]) {
        const weatherActivities = weatherSleepActivities[weather.condition];
        return weatherActivities[Math.floor(Math.random() * weatherActivities.length)];
    }

    // 天気情報がない場合は通常の睡眠ステータス
    const sleepActivities = {
        '森林': [
            '羽を丸めて枝の上で眠っています',
            '頭を羽の下に隠して休んでいます',
            '木の洞で安全に眠っています',
            '仲間と寄り添って眠っています',
            '片脚で立ったまま器用に眠っています',
            '羽繕いをしてから眠りにつきました',
            '月明かりの下で静かに休んでいます',
            '夜露に濡れながらも深く眠っています'
        ],
        '草原': [
            '草むらの中で身を寄せ合って眠っています',
            '地面に座り込んで丸くなって眠っています',
            '風に揺れる草に包まれて眠っています',
            '星空を見上げてから眠りについたようです',
            '羽を広げて地面を温めながら眠っています',
            '夜の静寂の中でぐっすりと眠っています',
            '脚を羽にしまって丸い毛玉のようになっています',
            '朝露が降りる前に夢の中です'
        ],
        '水辺': [
            '水面近くの岩の上で眠っています',
            '片脚を上げたまま器用に眠っています',
            '首を背中に回して眠っています',
            '水際で波音を聞きながら眠っています',
            '羽に顔を埋めて眠っています',
            'さざ波の音に包まれて安らかに眠っています',
            '水草の間で身を隠して眠っています',
            '月光が水面に映る中で静かに休んでいます'
        ]
    };

    const areaActivities = sleepActivities[area] || sleepActivities['森林'];
    return areaActivities[Math.floor(Math.random() * areaActivities.length)];
},

    // 鳥類園の状態取得（外部からアクセス用）
    getZooState() {
    const zooManager = require('../utils/zooManager');
    return zooManager.getZooState();
},

setZooState(newState) {
    const zooManager = require('../utils/zooManager');
    zooManager.setZooState(newState);
}
};
