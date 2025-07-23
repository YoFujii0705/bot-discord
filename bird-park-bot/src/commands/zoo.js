const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                        .setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'view':
                    await this.handleViewCommand(interaction);
                    break;
                case 'area':
                    await this.handleAreaCommand(interaction);
                    break;
            }

        } catch (error) {
            console.error('鳥類園コマンドエラー:', error);
            
            const errorMessage = '鳥類園の表示中にエラーが発生しました。';
            try {
                if (interaction.replied) {
                    await interaction.followUp({ content: errorMessage, flags: 64 });
                } else {
                    await interaction.reply({ content: errorMessage, flags: 64 });
                }
            } catch (replyError) {
                console.log('インタラクションタイムアウト:', replyError.code);
            }
        }
    },

    // 鳥類園全体表示
    async handleViewCommand(interaction) {
        const embed = this.createZooOverviewEmbed();
        
        await interaction.reply({ embeds: [embed] });
        
        // ログ記録
        await logger.logZoo('全体表示', '全体', '', interaction.user.id, interaction.user.username);
    },

    // エリア詳細表示
    async handleAreaCommand(interaction) {
        const area = interaction.options.getString('area');
        const embed = await this.createAreaDetailEmbed(area);
        
        await interaction.reply({ embeds: [embed] });
        
        // ログ記録
        await logger.logZoo('エリア表示', area, '', interaction.user.id, interaction.user.username);
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

        embed.setFooter({ 
            text: `最終更新: ${zooState.lastUpdate.toLocaleString('ja-JP')}` 
        });

        return embed;
    },

    // エリア詳細Embed（天気連動・睡眠対応版）
    async createAreaDetailEmbed(area) {
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
            // 鳥ごとの処理（睡眠時は特別ステータス）
            for (let i = 0; i < birds.length; i++) {
                const bird = birds[i];
                const stayDuration = this.getStayDuration(bird.entryTime);
                let activityText;
                
                if (sleepStatus.isSleeping) {
                    // 睡眠時間限定の特別ステータス（天気連動）
                    const sleepActivity = await this.generateSleepActivity(bird, area);
                    activityText = `😴 ${sleepActivity}\n📅 滞在期間: ${stayDuration}`;
                } else {
                    // 通常時のステータス
                    activityText = `${bird.activity}\n📅 滞在期間: ${stayDuration}`;
                }
                
                embed.addFields({
                    name: `${i + 1}. ${this.getSizeEmoji(bird.data.全長区分)} ${bird.name}`,
                    value: activityText,
                    inline: true
                });
            }
        }

        return embed;
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

    // 睡眠時間限定の特別ステータス生成（天気連動版）
    async generateSleepActivity(bird, area) {
        try {
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
        } catch (error) {
            console.log('天気取得エラー（睡眠ステータス）:', error.message);
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

    // サイズ絵文字
    getSizeEmoji(size) {
        const sizeEmojis = {
            '小': '🐤',
            '中': '🐦',
            '大': '🦅',
            '特大': '🦢'
        };
        return sizeEmojis[size] || '🐦';
    }
};
