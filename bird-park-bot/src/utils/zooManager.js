const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zoo-debug')
        .setDescription('🔧 鳥類園の詳細情報を表示（開発者用）')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('鳥の滞在状況を詳細表示')
                .addStringOption(option =>
                    option.setName('area')
                        .setDescription('表示するエリア（指定しない場合は全体概要）')
                        .addChoices(
                            { name: '🌲 森林エリア', value: '森林' },
                            { name: '🌾 草原エリア', value: '草原' },
                            { name: '🌊 水辺エリア', value: '水辺' },
                            { name: '📊 全体概要', value: 'all' }
                        )
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('schedule')
                .setDescription('今後24時間の鳥の出入りスケジュール'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // 管理者チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: '❌ このコマンドは管理者のみ使用できます。',
                ephemeral: true
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'status':
                    await this.showDetailedStatus(interaction, guildId);
                    break;
                case 'schedule':
                    await this.showSchedule(interaction, guildId);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ 不明なサブコマンドです。',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('zoo-debugエラー:', error);
            await interaction.reply({
                content: '❌ コマンドの実行中にエラーが発生しました。',
                ephemeral: true
            });
        }
    },

    async showDetailedStatus(interaction, guildId) {
        const zooManager = require('../utils/zooManager');
        
        await interaction.deferReply({ ephemeral: true });
        await zooManager.initializeServer(guildId);
        
        const selectedArea = interaction.options.getString('area');
        const zooState = zooManager.getZooState(guildId);
        const now = new Date();

        // 全体概要を表示する場合
        if (!selectedArea || selectedArea === 'all') {
            const embed = new EmbedBuilder()
                .setTitle('🔧 鳥類園全体概要（開発者用）')
                .setDescription('各エリアの鳥数と概要情報')
                .setColor(0x00AE86)
                .setTimestamp();

            const areas = [
                { key: '森林', name: '🌲 森林エリア' },
                { key: '草原', name: '🌾 草原エリア' },
                { key: '水辺', name: '🌊 水辺エリア' }
            ];

            for (const area of areas) {
                const birds = zooState[area.key];
                const hungryCount = birds.filter(b => b.isHungry).length;
                const departingSoon = birds.filter(b => {
                    const actualDeparture = new Date(b.scheduledDeparture.getTime() + ((b.stayExtension || 0) * 24 * 60 * 60 * 1000) + ((b.stayExtensionHours || 0) * 60 * 60 * 1000));
                    return actualDeparture - now < 24 * 60 * 60 * 1000;
                }).length;

                embed.addFields({
                    name: `${area.name} (${birds.length}/5)`,
                    value: `🍽️ 空腹: ${hungryCount}羽\n🛫 24h以内出発: ${departingSoon}羽\n\n詳細は \`/zoo-debug status area:${area.key}\` で確認`,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // 特定エリアの詳細表示
        const areaNames = {
            '森林': '🌲 森林エリア',
            '草原': '🌾 草原エリア', 
            '水辺': '🌊 水辺エリア'
        };

        const embed = new EmbedBuilder()
            .setTitle(`🔧 ${areaNames[selectedArea]} 詳細ステータス`)
            .setDescription('各鳥の滞在状況と詳細情報')
            .setColor(0x00AE86)
            .setTimestamp();

        const birds = zooState[selectedArea];
        
        if (birds.length === 0) {
            embed.addFields({
                name: `${areaNames[selectedArea]}`,
                value: '(鳥がいません)',
                inline: false
            });
        } else {
            const birdDetails = birds.map(bird => {
                // 実際のデータ構造に合わせて修正
                const entryTime = bird.entryTime;
                const scheduledDeparture = bird.scheduledDeparture;
                const stayExtension = bird.stayExtension || 0; // 日数での延長
                const stayExtensionHours = bird.stayExtensionHours || 0; // 時間での延長
                
                // 実際の出発予定時刻を計算（基本予定 + 延長日数 + 延長時間）
                const actualDeparture = new Date(scheduledDeparture.getTime() + (stayExtension * 24 * 60 * 60 * 1000) + (stayExtensionHours * 60 * 60 * 1000));
                
                // 基本滞在期間を計算
                const baseDays = Math.floor((scheduledDeparture - entryTime) / (24 * 60 * 60 * 1000));
                
                // 残り時間計算
                const timeLeft = actualDeparture - now;
                const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
                const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

                // 状態アイコン
                const hungryIcon = bird.isHungry ? '🍽️' : '😊';
                const timeStatus = timeLeft > 0 ? '✅' : '🔴';

                return `${timeStatus} ${hungryIcon} **${bird.name}**
└ 入園: ${entryTime.toLocaleString('ja-JP')}
└ 基本滞在: ${baseDays}日
└ 延長: +${stayExtension}日+${stayExtensionHours}時間
└ 出発予定: ${actualDeparture.toLocaleString('ja-JP')}
└ 残り時間: ${daysLeft}日${hoursLeft}時間${minutesLeft}分
└ 餌やり回数: ${bird.feedCount || 0}回
└ 様子: ${bird.activity}`;
            }).join('\n\n');

            embed.addFields({
                name: `${areaNames[selectedArea]} (${birds.length}/5)`,
                value: birdDetails,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async showSchedule(interaction, guildId) {
        const zooManager = require('../utils/zooManager');
        
        await interaction.deferReply({ ephemeral: true });
        await zooManager.initializeServer(guildId);
        
        const zooState = zooManager.getZooState(guildId);
        const now = new Date();
        const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));

        const events = [];

        // 各エリアの鳥をチェック
        ['森林', '草原', '水辺'].forEach(area => {
            zooState[area].forEach(bird => {
                const entryTime = bird.entryTime;
                const scheduledDeparture = bird.scheduledDeparture;
                const stayExtension = bird.stayExtension || 0;
                const stayExtensionHours = bird.stayExtensionHours || 0;
                
                // 実際の出発時刻を計算
                const actualDeparture = new Date(scheduledDeparture.getTime() + (stayExtension * 24 * 60 * 60 * 1000) + (stayExtensionHours * 60 * 60 * 1000));
                
                // 24時間以内に出発予定の鳥
                if (actualDeparture > now && actualDeparture <= next24Hours) {
                    events.push({
                        time: actualDeparture,
                        type: '🛫 出発',
                        bird: bird.name,
                        area: area
                    });
                }
            });
        });

        // 時刻順にソート
        events.sort((a, b) => a.time - b.time);

        const embed = new EmbedBuilder()
            .setTitle('📅 今後24時間の鳥類園スケジュール')
            .setDescription('鳥の出入りイベント一覧')
            .setColor(0xFFD700)
            .setTimestamp();

        if (events.length === 0) {
            embed.addFields({
                name: '📋 スケジュール',
                value: '今後24時間以内に予定されている鳥の出入りはありません。',
                inline: false
            });
        } else {
            const scheduleText = events.map(event => {
                const timeString = event.time.toLocaleString('ja-JP');
                return `${event.type} **${event.bird}** (${event.area}エリア)\n└ ${timeString}`;
            }).join('\n\n');

            embed.addFields({
                name: `📋 今後のイベント (${events.length}件)`,
                value: scheduleText,
                inline: false
            });
        }

        // 統計情報も追加
        const totalBirds = zooState.森林.length + zooState.草原.length + zooState.水辺.length;
        embed.addFields({
            name: '📊 現在の状況',
            value: `総鳥数: ${totalBirds}羽 (森林:${zooState.森林.length} 草原:${zooState.草原.length} 水辺:${zooState.水辺.length})\n24時間以内の出発予定: ${events.length}羽`,
            inline: true
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
