const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('条件を指定して鳥を検索します🔍')
        .addStringOption(option =>
            option.setName('size')
                .setDescription('全長区分')
                .addChoices(
                    { name: '小', value: '小' },
                    { name: '中', value: '中' },
                    { name: '大', value: '大' },
                    { name: '特大', value: '特大' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('色系統')
                .addChoices(
                    { name: '茶系', value: '茶系' },
                    { name: '白系', value: '白系' },
                    { name: '黒系', value: '黒系' },
                    { name: '赤系', value: '赤系' },
                    { name: '黄系', value: '黄系' },
                    { name: '青系', value: '青系' },
                    { name: '緑系', value: '緑系' },
                    { name: '灰系', value: '灰系' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('season')
                .setDescription('季節')
                .addChoices(
                    { name: '春', value: '春' },
                    { name: '夏', value: '夏' },
                    { name: '秋', value: '秋' },
                    { name: '冬', value: '冬' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('migration')
                .setDescription('渡り区分')
                .addChoices(
                    { name: '夏鳥', value: '夏鳥' },
                    { name: '冬鳥', value: '冬鳥' },
                    { name: '留鳥', value: '留鳥' },
                    { name: '漂鳥', value: '漂鳥' },
                    { name: '旅鳥', value: '旅鳥' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('environment')
                .setDescription('環境')
                .addChoices(
                    { name: '市街・住宅地', value: '市街・住宅地' },
                    { name: '河川・湖沼', value: '河川・湖沼' },
                    { name: '農耕地', value: '農耕地' },
                    { name: '海', value: '海' },
                    { name: '森林', value: '森林' },
                    { name: '草地', value: '草地' },
                    { name: '裸地', value: '裸地' },
                    { name: '高山', value: '高山' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('鳥の名前（部分一致）')
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

            // 検索条件取得
            const searchConditions = {
                全長区分: interaction.options.getString('size'),
                色: interaction.options.getString('color'),
                季節: interaction.options.getString('season'),
                渡り区分: interaction.options.getString('migration'),
                環境: interaction.options.getString('environment'),
                名前: interaction.options.getString('name')
            };

            // 空の条件を除去
            const filteredConditions = Object.fromEntries(
                Object.entries(searchConditions).filter(([key, value]) => value !== null)
            );

            // 検索条件が空の場合
            if (Object.keys(filteredConditions).length === 0) {
                await interaction.reply({
                    content: '🔍 検索条件を1つ以上指定してください。',
                    ephemeral: true
                });
                return;
            }

            // 検索実行
            const results = birdData.searchBirds(filteredConditions);

            // ログ記録
            await logger.logSearch(
                interaction.user.id,
                interaction.user.username,
                filteredConditions,
                results.length
            );

            // 結果表示
            if (results.length === 0) {
                const embed = this.createNoResultsEmbed(filteredConditions);
                await interaction.reply({ embeds: [embed] });
            } else if (results.length === 1) {
                const embed = this.createSingleResultEmbed(results[0], filteredConditions);
                await interaction.reply({ embeds: [embed] });
            } else {
                const embed = this.createMultipleResultsEmbed(results, filteredConditions);
                
                // 結果が多い場合はセレクトメニューを追加
                if (results.length <= 25) {
                    const selectMenu = this.createBirdSelectMenu(results);
                    const row = new ActionRowBuilder().addComponents(selectMenu);
                    await interaction.reply({ embeds: [embed], components: [row] });
                } else {
                    await interaction.reply({ embeds: [embed] });
                }
            }

        } catch (error) {
            console.error('検索コマンドエラー:', error);
            await logger.logError('検索コマンド', error, {
                userId: interaction.user.id,
                searchConditions: interaction.options.data
            });

            const errorMessage = '検索の実行中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 検索結果なしのEmbed
    createNoResultsEmbed(conditions) {
        const conditionsText = Object.entries(conditions)
            .map(([key, value]) => `**${key}:** ${value}`)
            .join('\n');

        return new EmbedBuilder()
            .setTitle('🔍 検索結果')
            .setColor(0xFF6B6B)
            .setDescription('指定された条件に一致する鳥が見つかりませんでした。')
            .addFields({
                name: '検索条件',
                value: conditionsText,
                inline: false
            })
            .addFields({
                name: '💡 ヒント',
                value: '• 条件を減らしてみてください\n• 別の条件で検索してみてください\n• `/gacha` でランダムな鳥を見つけることもできます',
                inline: false
            })
            .setTimestamp();
    },

    // 単一結果のEmbed
    createSingleResultEmbed(bird, conditions) {
        const conditionsText = Object.entries(conditions)
            .map(([key, value]) => `**${key}:** ${value}`)
            .join(' / ');

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
            .setTitle(`🎯 検索結果: ${bird.名前}`)
            .setColor(embedColor)
            .setDescription(`*${bird.キャッチコピー}*\n\n${bird.説明文}`)
            .addFields(
                { name: '📏 全長', value: `${bird.全長} (${bird.全長区分})`, inline: true },
                { name: '🎨 色', value: bird.色, inline: true },
                { name: '📅 季節', value: bird.季節, inline: true },
                { name: '✈️ 渡り', value: bird.渡り区分, inline: true },
                { name: '🏞️ 環境', value: bird.環境, inline: true },
                { name: '🍽️ 好物', value: bird.好物 || '設定なし', inline: true },
                { name: '🔍 検索条件', value: conditionsText, inline: false }
            )
            .setFooter({ text: '完全一致する鳥が見つかりました！' })
            .setTimestamp();
    },

    // 複数結果のEmbed
    createMultipleResultsEmbed(results, conditions) {
        const conditionsText = Object.entries(conditions)
            .map(([key, value]) => `**${key}:** ${value}`)
            .join(' / ');

        const embed = new EmbedBuilder()
            .setTitle(`🔍 検索結果: ${results.length}羽の鳥が見つかりました`)
            .setColor(0x00AE86)
            .setDescription(`検索条件に一致する鳥たちです。`)
            .addFields({
                name: '🔍 検索条件',
                value: conditionsText,
                inline: false
            });

        // 結果を表示（最大15羽まで）
        const displayResults = results.slice(0, 15);
        const birdList = displayResults.map((bird, index) => {
            const sizeEmoji = this.getSizeEmoji(bird.全長区分);
            const colorEmoji = this.getColorEmoji(bird.色);
            return `${index + 1}. ${sizeEmoji}${colorEmoji} **${bird.名前}** (${bird.全長区分}・${bird.色.split('、')[0]})`;
        }).join('\n');

        embed.addFields({
            name: '🐦 該当する鳥',
            value: birdList,
            inline: false
        });

        // 結果が多い場合の注意
        if (results.length > 15) {
            embed.addFields({
                name: '📄 表示について',
                value: `全${results.length}羽中、上位15羽を表示しています。\nより詳細に見るには条件を絞り込んでください。`,
                inline: false
            });
        } else if (results.length <= 25) {
            embed.addFields({
                name: '👇 詳細表示',
                value: '下のメニューから鳥を選択すると詳細情報が表示されます。',
                inline: false
            });
        }

        embed.setTimestamp();
        return embed;
    },

    // 鳥選択メニュー作成
    createBirdSelectMenu(birds) {
        const options = birds.slice(0, 25).map((bird, index) => {
            const sizeEmoji = this.getSizeEmoji(bird.全長区分);
            const colorEmoji = this.getColorEmoji(bird.色);
            
            return {
                label: bird.名前,
                value: `bird_${index}`,
                description: `${bird.全長区分} | ${bird.色.split('、')[0]} | ${bird.渡り区分}`,
                emoji: sizeEmoji
            };
        });

        return new StringSelectMenuBuilder()
            .setCustomId('bird_detail_select')
            .setPlaceholder('鳥を選択して詳細を表示...')
            .addOptions(options);
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

    // 色絵文字
    getColorEmoji(colors) {
        const colorEmojis = {
            '茶系': '🤎',
            '白系': '⚪',
            '黒系': '⚫',
            '赤系': '🔴',
            '黄系': '🟡',
            '青系': '🔵',
            '緑系': '🟢',
            '灰系': '🩶'
        };
        
        const mainColor = colors.split('、')[0];
        return colorEmojis[mainColor] || '🔵';
    }
};
