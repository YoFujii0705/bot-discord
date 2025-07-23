const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gacha')
        .setDescription('鳥ガチャを回します！🐦')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('召喚する鳥の数（1-10羽）')
                .setMinValue(1)
                .setMaxValue(10)
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

            const count = interaction.options.getInteger('count') || 1;
            const birds = birdData.getRandomBirds(count);

            if (birds.length === 0) {
                await interaction.reply({
                    content: '❌ 鳥データが見つかりませんでした。管理者に連絡してください。',
                    ephemeral: true
                });
                return;
            }

            // 単体ガチャ
            if (count === 1) {
                const bird = birds[0];
                const embed = this.createBirdEmbed(bird);
                
                await interaction.reply({ embeds: [embed] });
                
                // ログ記録
                await logger.logGacha(
                    interaction.user.id,
                    interaction.user.username,
                    '単体ガチャ',
                    bird.名前
                );
            } 
            // 複数ガチャ
            else {
                const embed = this.createMultipleBirdsEmbed(birds, count);
                
                await interaction.reply({ embeds: [embed] });
                
                // ログ記録
                const birdNames = birds.map(b => b.名前).join(', ');
                await logger.logGacha(
                    interaction.user.id,
                    interaction.user.username,
                    `${count}連ガチャ`,
                    birdNames
                );
            }

        } catch (error) {
            console.error('ガチャコマンドエラー:', error);
            
            const errorMessage = 'ガチャの実行中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 単体鳥用Embed作成
    createBirdEmbed(bird) {
        const colorMap = {
            '茶系': 0x8B4513,
            '白系': 0xFFFFFF,
            '黒系': 0x2F4F4F,
            '赤系': 0xFF6347,
            '黄系': 0xFFD700,
            '青系': 0x4169E1,
            '緑系': 0x228B22,
            '灰系': 0x808080
        };

        const mainColor = bird.色.split('、')[0];
        const embedColor = colorMap[mainColor] || 0x00AE86;

        return new EmbedBuilder()
            .setTitle(`🐦 ${bird.名前}`)
            .setColor(embedColor)
            .setDescription(`*${bird.キャッチコピー}*\n\n${bird.説明文}`)
            .addFields(
                { name: '📏 全長', value: `${bird.全長} (${bird.全長区分})`, inline: true },
                { name: '🎨 色', value: bird.色, inline: true },
                { name: '📅 季節', value: bird.季節, inline: true },
                { name: '✈️ 渡り', value: bird.渡り区分, inline: true },
                { name: '🏞️ 環境', value: bird.環境, inline: true },
                { name: '🍽️ 好物', value: bird.好物 || '設定なし', inline: true }
            )
            .setTimestamp();
    },

    // 複数鳥用Embed作成
    createMultipleBirdsEmbed(birds, count) {
        const embed = new EmbedBuilder()
            .setTitle(`🐦✨ ${count}連ガチャ結果！`)
            .setColor(0x00AE86)
            .setDescription(`${count}羽の鳥が現れました！`)
            .setTimestamp();

        const birdList = birds.map((bird, index) => {
            return `${index + 1}. **${bird.名前}** (${bird.全長区分})\n*${bird.キャッチコピー}*`;
        }).join('\n\n');

        embed.addFields({
            name: '召喚された鳥たち',
            value: birdList,
            inline: false
        });

        return embed;
    }
};
