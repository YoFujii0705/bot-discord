const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scheduler-test')
        .setDescription('🧪 スケジューラーのテスト（管理者限定）')
        .addSubcommand(subcommand =>
            subcommand
                .setName('zoo-status')
                .setDescription('鳥類園状況投稿をテスト'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('morning-greeting')
                .setDescription('朝の挨拶投稿をテスト'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('daily-bird')
                .setDescription('今日の鳥投稿をテスト'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('weekly-report')
                .setDescription('週次レポートをテスト'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check-channels')
                .setDescription('投稿チャンネルの設定を確認'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: '❌ このコマンドは管理者のみ使用できます。',
                ephemeral: true
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const scheduler = require('../utils/scheduler');

        try {
            switch (subcommand) {
                case 'zoo-status':
                    await this.testZooStatus(interaction, scheduler);
                    break;
                case 'morning-greeting':
                    await this.testMorningGreeting(interaction, scheduler);
                    break;
                case 'daily-bird':
                    await this.testDailyBird(interaction, scheduler);
                    break;
                case 'weekly-report':
                    await this.testWeeklyReport(interaction, scheduler);
                    break;
                case 'check-channels':
                    await this.checkChannels(interaction);
                    break;
            }
        } catch (error) {
            console.error('スケジューラーテストエラー:', error);
            
            const errorMessage = '❌ テストの実行中にエラーが発生しました。';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 鳥類園状況投稿テスト
    async testZooStatus(interaction, scheduler) {
        await interaction.deferReply({ ephemeral: true });
        
        console.log('🧪 鳥類園状況投稿テストを開始...');
        
        try {
            await scheduler.manualZooStatus();
            
            await interaction.editReply({
                content: '✅ 鳥類園状況投稿テストが完了しました！\n各サーバーの指定チャンネルに投稿されているか確認してください。',
            });
        } catch (error) {
            console.error('鳥類園状況投稿テストエラー:', error);
            await interaction.editReply({
                content: '❌ 鳥類園状況投稿テストでエラーが発生しました。ログを確認してください。',
            });
        }
    },

    // 朝の挨拶投稿テスト
    async testMorningGreeting(interaction, scheduler) {
        await interaction.deferReply({ ephemeral: true });
        
        console.log('🧪 朝の挨拶投稿テストを開始...');
        
        try {
            await scheduler.manualMorningGreeting();
            
            await interaction.editReply({
                content: '✅ 朝の挨拶投稿テストが完了しました！\n各サーバーの指定チャンネルに投稿されているか確認してください。',
            });
        } catch (error) {
            console.error('朝の挨拶投稿テストエラー:', error);
            await interaction.editReply({
                content: '❌ 朝の挨拶投稿テストでエラーが発生しました。ログを確認してください。',
            });
        }
    },

    // 今日の鳥投稿テスト
    async testDailyBird(interaction, scheduler) {
        await interaction.deferReply({ ephemeral: true });
        
        console.log('🧪 今日の鳥投稿テストを開始...');
        
        try {
            await scheduler.manualDailyBird();
            
            await interaction.editReply({
                content: '✅ 今日の鳥投稿テストが完了しました！\n各サーバーの指定チャンネルに投稿されているか確認してください。',
            });
        } catch (error) {
            console.error('今日の鳥投稿テストエラー:', error);
            await interaction.editReply({
                content: '❌ 今日の鳥投稿テストでエラーが発生しました。ログを確認してください。',
            });
        }
    },

    // 週次レポートテスト
    async testWeeklyReport(interaction, scheduler) {
        await interaction.deferReply({ ephemeral: true });
        
        console.log('🧪 週次レポートテストを開始...');
        
        try {
            await scheduler.manualWeeklyReport();
            
            await interaction.editReply({
                content: '✅ 週次レポートテストが完了しました！\n各サーバーの指定チャンネルに投稿されているか確認してください。',
            });
        } catch (error) {
            console.error('週次レポートテストエラー:', error);
            await interaction.editReply({
                content: '❌ 週次レポートテストでエラーが発生しました。ログを確認してください。',
            });
        }
    },

    // チャンネル設定確認
    async checkChannels(interaction) {
        const client = interaction.client;
        const embed = new EmbedBuilder()
            .setTitle('🔍 投稿チャンネル設定確認')
            .setColor(0x00AE86)
            .setTimestamp();

        let description = '';
        
        // 環境変数確認
        const zooChannelId = process.env.ZOO_CHANNEL_ID;
        const notificationChannelId = process.env.NOTIFICATION_CHANNEL_ID;
        
        description += '**環境変数設定:**\n';
        description += `ZOO_CHANNEL_ID: ${zooChannelId ? `設定済み (${zooChannelId})` : '未設定'}\n`;
        description += `NOTIFICATION_CHANNEL_ID: ${notificationChannelId ? `設定済み (${notificationChannelId})` : '未設定'}\n\n`;

        // 各サーバーのチャンネル確認
        description += '**各サーバーの投稿先チャンネル:**\n';
        
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const scheduler = require('../utils/scheduler');
                const channel = scheduler.findBroadcastChannel(guild);
                
                if (channel) {
                    description += `✅ **${guild.name}**: #${channel.name} (${channel.id})\n`;
                } else {
                    description += `❌ **${guild.name}**: 投稿可能なチャンネルが見つかりません\n`;
                }
            } catch (error) {
                description += `⚠️ **${guild.name}**: チャンネル確認エラー\n`;
            }
        }

        embed.setDescription(description);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
