const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zoo-debug')
        .setDescription('🔧 鳥類園の詳細情報を表示（開発者用）')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('全鳥の滞在状況を詳細表示'))
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
        
        const zooState = zooManager.getZooState(guildId);
        const now = new Date();

        const embed = new EmbedBuilder()
            .setTitle('🔧 鳥類園詳細ステータス（開発者用）')
            .setDescription('各鳥の滞在状況と詳細情報')
            .setColor(0x00AE86)
            .setTimestamp();

        const areas = ['森林', '草原', '水辺'];
        
        for (const area of areas) {
            const birds = zooState[area];
            
            if (birds.length === 0) {
                embed.addFields({
                    name: `${area}エリア`,
                    value: '(鳥がいません)',
                    inline: false
                });
                continue;
            }

            const birdDetails = birds.map(bird => {
                // 滞在時間計算
                const arrivalTime = new Date(bird.arrivalTime);
                const stayDuration = bird.stayDuration || 0; // 基本滞在時間（日）
                const stayExtensionHours = bird.stayExtensionHours || 0; // 餌やりによる延長（時間）
                
                // 出発予定時刻を計算
                const departureTime = new Date(arrivalTime.getTime() + (stayDuration * 24 * 60 * 60 * 1000) + (stayExtensionHours * 60 * 60 * 1000));
                
                // 残り時間計算
                const timeLeft = departureTime - now;
                const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
                const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

                // 状態アイコン
                const hungryIcon = bird.isHungry ? '🍽️' : '😊';
                const timeStatus = timeLeft > 0 ? '✅' : '🔴';

                return `${timeStatus} ${hungryIcon} **${bird.name}**
└ 入園: ${arrivalTime.toLocaleString('ja-JP')}
└ 基本滞在: ${stayDuration}日
└ 餌延長: +${stayExtensionHours}時間
└ 出発予定: ${departureTime.toLocaleString('ja-JP')}
└ 残り時間: ${daysLeft}日${hoursLeft}時間${minutesLeft}分
└ 餌やり回数: ${bird.feedCount || 0}回
└ 様子: ${bird.activity}`;
            }).join('\n\n');

            embed.addFields({
                name: `${area}エリア (${birds.length}/5)`,
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
                const arrivalTime = new Date(bird.arrivalTime);
                const stayDuration = bird.stayDuration || 0;
                const stayExtensionHours = bird.stayExtensionHours || 0;
                
                const departureTime = new Date(arrivalTime.getTime() + (stayDuration * 24 * 60 * 60 * 1000) + (stayExtensionHours * 60 * 60 * 1000));
                
                // 24時間以内に出発予定の鳥
                if (departureTime > now && departureTime <= next24Hours) {
                    events.push({
                        time: departureTime,
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
        const totalBirds = Object.values(zooState).flat().length;
        embed.addFields({
            name: '📊 現在の状況',
            value: `総鳥数: ${totalBirds}羽\n24時間以内の出発予定: ${events.length}羽`,
            inline: true
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
