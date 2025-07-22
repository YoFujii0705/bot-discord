const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('theme')
        .setDescription('ランダムなテーマで鳥を召喚します！創作のヒントに🎨')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('召喚する鳥の数（1-5羽）')
                .setMinValue(1)
                .setMaxValue(5)
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
            
            // ランダムテーマ生成
            const theme = birdData.getRandomTheme();
            
            // テーマに合う鳥を検索
            const matchingBirds = birdData.searchBirds(theme);
            
            if (matchingBirds.length === 0) {
                // テーマに合う鳥がいない場合、テーマを緩和
                const relaxedTheme = this.relaxTheme(theme);
                const relaxedBirds = birdData.searchBirds(relaxedTheme);
                
                if (relaxedBirds.length === 0) {
                    await interaction.reply({
                        content: '❌ テーマに合う鳥が見つかりませんでした。もう一度お試しください。',
                        ephemeral: true
                    });
                    return;
                }
                
                const selectedBirds = this.selectRandomBirds(relaxedBirds, count);
                const embed = this.createThemeEmbed(relaxedTheme, selectedBirds, true);
                
                await interaction.reply({ embeds: [embed] });
                
                // ログ記録
                await this.logThemeGacha(interaction, relaxedTheme, selectedBirds, true);
            } else {
                const selectedBirds = this.selectRandomBirds(matchingBirds, count);
                const embed = this.createThemeEmbed(theme, selectedBirds, false);
                
                await interaction.reply({ embeds: [embed] });
                
                // ログ記録
                await this.logThemeGacha(interaction, theme, selectedBirds, false);
            }

        } catch (error) {
            console.error('テーマガチャコマンドエラー:', error);
            await logger.logError('テーマガチャコマンド', error, {
                userId: interaction.user.id,
                count: interaction.options.getInteger('count')
            });

            const errorMessage = 'テーマガチャの実行中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // テーマ緩和（条件を減らす）
    relaxTheme(theme) {
        const relaxed = { ...theme };
        const keys = Object.keys(relaxed);
        
        // ランダムに1-2個の条件を削除
        const keysToRemove = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < keysToRemove && keys.length > 1; i++) {
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            delete relaxed[randomKey];
            keys.splice(keys.indexOf(randomKey), 1);
        }
        
        return relaxed;
    },

    // ランダムに鳥を選択
    selectRandomBirds(birds, count) {
        const shuffled = [...birds].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, birds.length));
    },

    // テーマEmbed作成
    createThemeEmbed(theme, birds, isRelaxed) {
        const embed = new EmbedBuilder()
            .setTitle('🎨✨ テーマガチャ結果！')
            .setColor(0xFF69B4)
            .setTimestamp();

        // テーマ表示
        const themeText = Object.entries(theme)
            .map(([key, value]) => `**${key}:** ${value}`)
            .join('\n');
        
        const themeTitle = isRelaxed ? '🔍 緩和されたテーマ' : '🎯 生成されたテーマ';
        embed.addFields({
            name: themeTitle,
            value: themeText,
            inline: false
        });

        // 鳥表示
        if (birds.length === 1) {
            const bird = birds[0];
            embed.setDescription(`テーマに合った鳥が現れました！\n\n🐦 **${bird.名前}**\n*${bird.キャッチコピー}*\n\n${bird.説明文}`);
            
            embed.addFields(
                { name: '📏 詳細', value: `${bird.全長} (${bird.全長区分})`, inline: true },
                { name: '🎨 色', value: bird.色, inline: true },
                { name: '🏞️ 環境', value: bird.環境, inline: true }
            );
        } else {
            embed.setDescription(`テーマに合った${birds.length}羽の鳥が現れました！`);
            
            const birdList = birds.map((bird, index) => {
                const sizeEmoji = this.getSizeEmoji(bird.全長区分);
                const colorEmoji = this.getColorEmoji(bird.色);
                return `${index + 1}. ${sizeEmoji}${colorEmoji} **${bird.名前}**\n   *${bird.キャッチコピー}*`;
            }).join('\n\n');
            
            embed.addFields({
                name: '召喚された鳥たち',
                value: birdList,
                inline: false
            });
        }

        // 創作ヒント
        const creativePrompt = this.generateCreativePrompt(theme, birds);
        embed.addFields({
            name: '✍️ 創作ヒント',
            value: creativePrompt,
            inline: false
        });

        // マッチ度表示
        if (isRelaxed) {
            embed.setFooter({ text: '⚠️ 完全一致する鳥が見つからなかったため、条件を緩和しました' });
        } else {
            embed.setFooter({ text: '✅ テーマに完全一致する鳥が見つかりました！' });
        }

        return embed;
    },

    // 創作プロンプト生成
    generateCreativePrompt(theme, birds) {
        const prompts = [
            `この鳥が主人公の物語を書いてみては？`,
            `この鳥の視点で俳句を詠んでみませんか？`,
            `この鳥との出会いを短編小説にしてみましょう`,
            `この鳥が住む世界を描写してみては？`,
            `この鳥の一日を日記形式で書いてみませんか？`,
            `この鳥が歌う歌の歌詞を考えてみては？`,
            `この鳥との対話を創作してみましょう`
        ];

        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        
        // テーマに基づく追加ヒント
        const themeHints = [];
        
        if (theme.季節) {
            themeHints.push(`「${theme.季節}」の季節感を表現してみてください`);
        }
        
        if (theme.環境) {
            themeHints.push(`「${theme.環境}」の環境を舞台にしてみては？`);
        }
        
        if (theme.色) {
            themeHints.push(`「${theme.色}」の色彩を意識した描写はいかがでしょう`);
        }

        let fullPrompt = randomPrompt;
        if (themeHints.length > 0) {
            fullPrompt += `\n\n💡 ${themeHints.join('、')}。`;
        }

        return fullPrompt;
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
    },

    // ログ記録
    async logThemeGacha(interaction, theme, birds, isRelaxed) {
        const themeText = Object.entries(theme)
            .map(([key, value]) => `${key}:${value}`)
            .join(', ');
        
        const birdNames = birds.map(b => b.名前).join(', ');
        const details = `テーマ:(${themeText}) 緩和:${isRelaxed ? 'あり' : 'なし'}`;
        
        await logger.logGacha(
            interaction.user.id,
            interaction.user.username,
            'テーマガチャ',
            birdNames,
            details
        );
    }
};
