const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hunger-test')
        .setDescription('🧪 空腹システムのテスト用コマンド（管理者限定）')
        .addSubcommand(subcommand =>
            subcommand
                .setName('force')
                .setDescription('鳥を強制的に空腹にする')
                .addStringOption(option =>
                    option.setName('bird')
                        .setDescription('空腹にする鳥の名前（指定しない場合は全ての鳥）')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('手動で空腹チェックを実行'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('全鳥の空腹状態を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('全鳥の空腹状態をリセット'))
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

    const action = interaction.options.getString('action');
    const birdName = interaction.options.getString('bird');
    const guildId = interaction.guild.id; // サーバーID取得

    try {
        switch (action) {
            case 'force_hungry':
                await this.forceHungry(interaction, birdName, guildId);
                break;
            case 'reset_hunger':
                await this.resetHunger(interaction, birdName, guildId);
                break;
            case 'check_hunger':
                await this.checkHungerStatus(interaction, guildId);
                break;
            case 'show_status':
                await this.showAllBirdStatus(interaction, guildId);
                break;
        }
    } catch (error) {
        console.error('テストコマンドエラー:', error);
        await interaction.reply({
            content: '❌ テストの実行中にエラーが発生しました。',
            ephemeral: true
        });
    }
},


    // 強制的に空腹にする
    async forceHungry(interaction, birdName, guildId) {
    const zooManager = require('../utils/zooManager');
    
    // サーバー初期化
    await zooManager.initializeServer(guildId);
    
    const count = zooManager.forceHungry(birdName, guildId);
    
    if (count === 0) {
        await interaction.reply({
            content: birdName ? 
                `❌ "${birdName}" はこの鳥類園にいません。` : 
                '❌ この鳥類園に鳥がいません。',
            ephemeral: true
        });
        return;
    }

    // データ保存
    await zooManager.saveServerZoo(guildId);

    await interaction.reply({
        content: birdName ? 
            `🧪 **${birdName}** を強制的に空腹状態にしました。` :
            `🧪 この鳥類園の全ての鳥（${count}羽）を強制的に空腹状態にしました。`,
        ephemeral: true
    });
},

    // 手動空腹チェック
    async checkHungerStatus(interaction, guildId) {
    const zooManager = require('../utils/zooManager');
    
    await interaction.deferReply({ ephemeral: true });
    
    // サーバー初期化
    await zooManager.initializeServer(guildId);
    
    const stats = await zooManager.manualHungerCheck(guildId);
    
    const embed = new EmbedBuilder()
        .setTitle('🧪 手動空腹チェック実行結果')
        .setDescription('この鳥類園の空腹チェックを手動実行しました')
        .addFields(
            { name: '🐦 総鳥数', value: stats.totalBirds.toString(), inline: true },
            { name: '🍽️ 空腹の鳥', value: stats.hungryBirds.toString(), inline: true },
            { name: '😊 満足の鳥', value: (stats.totalBirds - stats.hungryBirds).toString(), inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
},

    // 全鳥の状態表示（サーバー別）
async showAllBirdStatus(interaction, guildId) {
    const zooManager = require('../utils/zooManager');
    
    // サーバー初期化
    await zooManager.initializeServer(guildId);
    
    const stats = zooManager.getHungerStatistics(guildId);

    const embed = new EmbedBuilder()
        .setTitle('🧪 この鳥類園の全鳥状態')
        .setDescription(`現在の状況（${stats.totalBirds}羽中${stats.hungryBirds}羽が空腹）`)
        .setColor(stats.hungryBirds > 0 ? 0xFFA500 : 0x00FF00)
        .setTimestamp();

    // エリア別に表示
    const areas = ['森林', '草原', '水辺'];
    
    for (const area of areas) {
        const areaBirds = stats.birdDetails.filter(bird => bird.area === area);
        
        if (areaBirds.length === 0) {
            embed.addFields({
                name: `${area}エリア`,
                value: '(鳥がいません)',
                inline: false
            });
            continue;
        }

        const birdList = areaBirds.map(bird => {
            const hungryIcon = bird.isHungry ? '🍽️' : '😊';
            const notifiedText = bird.hungerNotified ? ' (通知済)' : '';
            return `${hungryIcon} **${bird.name}**\n└ 最後の餌: ${bird.hoursSinceLastFeed}時間前\n└ 状態: ${bird.isHungry ? '空腹' + notifiedText : '満足'}\n└ 様子: ${bird.activity}`;
        }).join('\n\n');

        embed.addFields({
            name: `${area}エリア (${areaBirds.length}/5)`,
            value: birdList,
            inline: false
        });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
},

// 空腹状態リセット（サーバー別）
async resetHunger(interaction, birdName, guildId) {
    const zooManager = require('../utils/zooManager');
    
    // サーバー初期化
    await zooManager.initializeServer(guildId);
    
    const zooState = zooManager.getZooState(guildId);
    const now = new Date();
    
    let count = 0;
    
    for (const area of ['森林', '草原', '水辺']) {
        for (const bird of zooState[area]) {
            if (!birdName || bird.name.includes(birdName) || birdName.includes(bird.name)) {
                if (bird.isHungry) {
                    bird.isHungry = false;
                    bird.hungerNotified = false;
                    bird.lastFed = now;
                    bird.activity = zooManager.generateActivity(area);
                    count++;
                }
                
                if (birdName) break;
            }
        }
        if (birdName && count > 0) break;
    }

    // データ保存
    await zooManager.saveServerZoo(guildId);

    await interaction.reply({
        content: birdName ? 
            `🧪 **${birdName}** の空腹状態をリセットしました。` :
            `🧪 この鳥類園の${count}羽の鳥の空腹状態をリセットしました。`,
        ephemeral: true
    });
};
