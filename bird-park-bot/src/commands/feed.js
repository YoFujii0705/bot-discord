const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('feed')
        .setDescription('鳥類園の鳥に餌をあげます🍽️')
        .addStringOption(option =>
            option.setName('bird')
                .setDescription('餌をあげる鳥の名前')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('food')
                .setDescription('あげる餌の種類')
                .addChoices(
                    { name: '🌾 麦', value: '麦' },
                    { name: '🐛 虫', value: '虫' },
                    { name: '🐟 魚', value: '魚' },
                    { name: '🍯 花蜜', value: '花蜜' },
                    { name: '🥜 木の実', value: '木の実' },
                    { name: '🌿 青菜', value: '青菜' },
                    { name: '🐁 ねずみ', value: 'ねずみ' }
                )
                .setRequired(true)),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            
            const sleepCheck = this.checkBirdSleepTime();
            if (sleepCheck.isSleeping) {
                await interaction.reply({
                    content: sleepCheck.message,
                    ephemeral: true
                });
                return;
            }

            if (!birdData.initialized) {
                await interaction.reply({
                    content: '🔄 鳥データを読み込み中です...少々お待ちください',
                    ephemeral: true
                });
                await birdData.initialize();
            }

            const zooManager = require('../utils/zooManager');
            await zooManager.initializeServer(guildId);

            const birdName = interaction.options.getString('bird');
            const food = interaction.options.getString('food');

            const birdInfo = this.findBirdInZoo(birdName, guildId);
            
            if (!birdInfo) {
                await interaction.reply({
                    content: `🔍 "${birdName}" は現在この鳥類園にいないようです。\n\`/zoo view\` で現在いる鳥を確認してください。`,
                    ephemeral: true
                });
                return;
            }

            const cooldownResult = this.checkFeedingCooldown(birdInfo.bird, interaction.user.id);
            if (!cooldownResult.canFeed) {
                await interaction.reply({
                    content: `⏰ ${birdInfo.bird.name}にはまだ餌をあげられません。\n次回餌やり可能時刻: ${cooldownResult.nextFeedTime}`,
                    ephemeral: true
                });
                return;
            }

            const preference = birdData.getFoodPreference(birdName, food);
            const feedResult = this.processFeedingResult(birdInfo, food, preference, interaction.user);

            this.updateBirdAfterFeeding(birdInfo.bird, food, preference, interaction.user.id);

            const embed = this.createFeedingResultEmbed(birdInfo, food, feedResult);
            await interaction.reply({ embeds: [embed] });

            await logger.logFeed(
                interaction.user.id,
                interaction.user.username,
                birdName,
                food,
                feedResult.effect,
                guildId
            );

            await this.checkForSpecialEvents(birdInfo, food, preference, interaction, guildId);

            await zooManager.saveServerZoo(guildId);

        } catch (error) {
            console.error('餌やりコマンドエラー:', error);
            await logger.logError('餌やりコマンド', error, {
                userId: interaction.user.id,
                birdName: interaction.options.getString('bird'),
                food: interaction.options.getString('food'),
                guildId: interaction.guild.id
            });

            const errorMessage = '餌やりの実行中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    findBirdInZoo(birdName, guildId) {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        
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

    checkFeedingCooldown(bird, userId) {
        const now = new Date();
        const cooldownMinutes = 30;
        
        if (!bird.lastFed) {
            return { canFeed: true };
        }

        if (bird.lastFedBy === userId) {
            const timeDiff = now - bird.lastFed;
            const minutesPassed = Math.floor(timeDiff / (1000 * 60));
            
            if (minutesPassed < cooldownMinutes) {
                const nextFeedTime = new Date(bird.lastFed.getTime() + cooldownMinutes * 60 * 1000);
                return { 
                    canFeed: false, 
                    nextFeedTime: nextFeedTime.toLocaleTimeString('ja-JP', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                };
            }
        }

        return { canFeed: true };
    },

    processFeedingResult(birdInfo, food, preference, user) {
        const results = {
            favorite: {
                effect: '大喜び',
                message: 'は大好物の餌に大喜びしています！✨',
                stayExtension: 2,
                moodChange: 'happy',
                specialChance: 0.15
            },
            acceptable: {
                effect: '満足',
                message: 'は餌をおいしそうに食べました！',
                stayExtension: 1,
                moodChange: 'normal',
                specialChance: 0.05
            },
            dislike: {
                effect: '微妙',
                message: 'は餌をつついてみましたが、あまり興味がないようです...',
                stayExtension: 0,
                moodChange: 'normal',
                specialChance: 0.02
            }
        };

        return results[preference] || results.acceptable;
    },

    updateBirdAfterFeeding(bird, food, preference, userId) {
        const now = new Date();
        const result = this.processFeedingResult(null, food, preference, null);
        
        bird.lastFed = now;
        bird.lastFedBy = userId;
        bird.feedCount = (bird.feedCount || 0) + 1;
        bird.mood = result.moodChange;
        
        if (result.stayExtension > 0) {
            bird.stayExtension = (bird.stayExtension || 0) + result.stayExtension;
        }
        
        bird.activity = this.generateFeedingActivity(food, preference);
        
        if (!bird.feedHistory) bird.feedHistory = [];
        bird.feedHistory.push({
            food,
            preference,
            time: now,
            fedBy: userId
        });

        bird.isHungry = false;
    },

    generateFeedingActivity(food, preference) {
        const activities = {
            favorite: [
                'とても満足そうにしています',
                '嬉しそうに羽ばたいています',
                'ご機嫌で歌っています',
                '幸せそうに羽繕いしています'
            ],
            acceptable: [
                'おなかいっぱいで休んでいます',
                '満足そうに過ごしています',
                '穏やかに過ごしています',
                'のんびりしています'
            ],
            dislike: [
                '別の餌を探しているようです',
                '少し困惑しているようです',
                '他の餌に興味を示しています',
                '様子を見ています'
            ]
        };

        const activityList = activities[preference] || activities.acceptable;
        return activityList[Math.floor(Math.random() * activityList.length)];
    },

    createFeedingResultEmbed(birdInfo, food, result) {
        const { bird, area } = birdInfo;
        
        const foodEmojis = {
            '麦': '🌾',
            '🌾麦': '🌾',
            '虫': '🐛',
            '🐛虫': '🐛',
            '魚': '🐟',
            '🐟魚': '🐟',
            '花蜜': '🍯',
            '🍯花蜜': '🍯',
            '木の実': '🥜',
            '🥜木の実': '🥜',
            '青菜': '🌿',
            '🌿青菜': '🌿',
            'ねずみ': '🐁',
            '🐁ねずみ': '🐁'
        };
        
        const effectColors = {
            '大喜び': 0xFF69B4,
            '満足': 0x00FF00,
            '微妙': 0xFFA500
        };

        const embed = new EmbedBuilder()
            .setTitle(`🍽️ 餌やり結果`)
            .setDescription(`**${bird.name}**${result.message}`)
            .setColor(effectColors[result.effect] || 0x00AE86)
            .addFields(
                { name: '🐦 鳥', value: bird.name, inline: true },
                { name: '📍 場所', value: `${area}エリア`, inline: true },
                { name: '🍽️ 餌', value: `${foodEmojis[food]} ${food}`, inline: true },
                { name: '😊 反応', value: result.effect, inline: true },
                { name: '📅 効果', value: result.stayExtension > 0 ? `滞在期間 +${result.stayExtension}日` : '効果なし', inline: true },
                { name: '🎭 現在の様子', value: bird.activity, inline: true }
            )
            .setTimestamp();

        const feedCount = bird.feedCount || 1;
        embed.addFields({
            name: '📊 餌やり統計',
            value: `この鳥への餌やり回数: ${feedCount}回`,
            inline: false
        });

        return embed;
    },

    async checkForSpecialEvents(birdInfo, food, preference, interaction, guildId) {
        const result = this.processFeedingResult(birdInfo, food, preference, interaction.user);
        
        if (Math.random() < result.specialChance) {
            const event = this.generateSpecialEvent(birdInfo, food, preference, interaction.user);
            
            setTimeout(async () => {
                try {
                    await interaction.followUp({ embeds: [event.embed] });
                    
                    await logger.logEvent(
                        '餌やりイベント',
                        event.description,
                        birdInfo.bird.name,
                        guildId
                    );
                } catch (error) {
                    console.error('特別イベント送信エラー:', error);
                }
            }, 3000);
        }
    },

    generateSpecialEvent(birdInfo, food, preference, user) {
        const { bird, area } = birdInfo;
        const events = {
            favorite: [
                {
                    type: '仲良し',
                    description: `${bird.name}が${user.username}さんをとても気に入ったようです！`,
                    effect: '特別な絆が生まれました'
                },
                {
                    type: '歌声',
                    description: `${bird.name}が美しい歌声を披露しています♪`,
                    effect: 'エリア全体が音楽に包まれています'
                }
            ],
            acceptable: [
                {
                    type: '探索',
                    description: `${bird.name}が新しい場所を発見したようです`,
                    effect: 'エリア内で新しいスポットを見つけました'
                }
            ],
            dislike: [
                {
                    type: '学習',
                    description: `${bird.name}が好みを学習したようです`,
                    effect: '次回はもっと好みに合う餌が分かるかもしれません'
                }
            ]
        };

        const eventList = events[preference] || events.acceptable;
        const selectedEvent = eventList[Math.floor(Math.random() * eventList.length)];

        const embed = new EmbedBuilder()
            .setTitle('✨ 特別なできごと！')
            .setDescription(selectedEvent.description)
            .addFields({
                name: '🎊 効果',
                value: selectedEvent.effect,
                inline: false
            })
            .setColor(0xFFD700)
            .setTimestamp();

        return {
            embed,
            description: selectedEvent.description
        };
    },

    checkBirdSleepTime() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        
        if (hour >= 0 && hour < 7) {
            const sleepMessages = [
                '😴 鳥たちはぐっすり眠っています...静かに見守りましょう',
                '🌙 夜間は鳥たちの睡眠時間です。朝7時以降に餌やりができます',
                '💤 Zzz... 鳥たちは夢の中。起こさないであげてくださいね',
                '🌃 夜の鳥類園は静寂に包まれています。鳥たちは朝まで休息中です',
                '⭐ 星空の下、鳥たちは安らかに眠っています'
            ];
            
            const randomMessage = sleepMessages[Math.floor(Math.random() * sleepMessages.length)];
            
            return {
                isSleeping: true,
                message: `${randomMessage}\n🌅 餌やり再開時刻: 朝7:00 (JST)`
            };
        }
        
        return { isSleeping: false };
    }
};
                try {
                    await interaction.followUp({ embeds: [event.embed] });
                    
                    // イベントログ記録（サーバーID追加）
                    await logger.logEvent(
                        '餌やりイベント',
                        event.description,
                        birdInfo.bird.name,
                        guildId
                    );
                } catch (error) {
                    console.error('特別イベント送信エラー:', error);
                }
            }, 3000); // 3秒後に発生
        }
    },

    // 特別イベント生成
    generateSpecialEvent(birdInfo, food, preference, user) {
        const { bird, area } = birdInfo;
        const events = {
            favorite: [
                {
                    type: '仲良し',
                    description: `${bird.name}が${user.username}さんをとても気に入ったようです！`,
                    effect: '特別な絆が生まれました'
                },
                {
                    type: '歌声',
                    description: `${bird.name}が美しい歌声を披露しています♪`,
                    effect: 'エリア全体が音楽に包まれています'
                }
            ],
            acceptable: [
                {
                    type: '探索',
                    description: `${bird.name}が新しい場所を発見したようです`,
                    effect: 'エリア内で新しいスポットを見つけました'
                }
            ],
            dislike: [
                {
                    type: '学習',
                    description: `${bird.name}が好みを学習したようです`,
                    effect: '次回はもっと好みに合う餌が分かるかもしれません'
                }
            ]
        };

        const eventList = events[preference] || events.acceptable;
        const selectedEvent = eventList[Math.floor(Math.random() * eventList.length)];

        const embed = new EmbedBuilder()
            .setTitle('✨ 特別なできごと！')
            .setDescription(selectedEvent.description)
            .addFields({
                name: '🎊 効果',
                value: selectedEvent.effect,
                inline: false
            })
            .setColor(0xFFD700)
            .setTimestamp();

        return {
            embed,
            description: selectedEvent.description
        };
    },

    // 鳥たちの睡眠時間チェック
    checkBirdSleepTime() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        
        // 0:00-7:00は睡眠時間
        if (hour >= 0 && hour < 7) {
            const sleepMessages = [
                '😴 鳥たちはぐっすり眠っています...静かに見守りましょう',
                '🌙 夜間は鳥たちの睡眠時間です。朝7時以降に餌やりができます',
                '💤 Zzz... 鳥たちは夢の中。起こさないであげてくださいね',
                '🌃 夜の鳥類園は静寂に包まれています。鳥たちは朝まで休息中です',
                '⭐ 星空の下、鳥たちは安らかに眠っています'
            ];
            
            const randomMessage = sleepMessages[Math.floor(Math.random() * sleepMessages.length)];
            
            return {
                isSleeping: true,
                message: `${randomMessage}\n🌅 餌やり再開時刻: 朝7:00 (JST)`
            };
        }
        
        return { isSleeping: false };
    }
};
