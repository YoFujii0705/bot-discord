const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');
const zooCommand = require('./zoo');

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
                    { name: '🌾 種子', value: '種子' },
                    { name: '🐛 虫', value: '虫' },
                    { name: '🐟 魚', value: '魚' },
                    { name: '🍯 蜜', value: '蜜' },
                    { name: '🥜 木の実', value: '木の実' },
                    { name: '🌿 青菜', value: '青菜' }
                )
                .setRequired(true)),

    async execute(interaction) {
        try {
            // 鳥たちの睡眠時間チェック（日本時間0:00-7:00）
            const sleepCheck = this.checkBirdSleepTime();
            if (sleepCheck.isSleeping) {
                await interaction.reply({
                    content: sleepCheck.message,
                    ephemeral: true
                });
                return;
            }

            // データ初期化チェック
            if (!birdData.initialized) {
                await interaction.reply({
                    content: '🔄 鳥データを読み込み中です...少々お待ちください',
                    ephemeral: true
                });
                await birdData.initialize();
            }

            const birdName = interaction.options.getString('bird');
            const food = interaction.options.getString('food');

            await interaction.reply({
                content: `🍽️ ${birdName}に${food}をあげようとしましたが、現在この機能は開発中です。`,
                ephemeral: true
            });

        } catch (error) {
            console.error('餌やりコマンドエラー:', error);
            
            const errorMessage = '餌やりの実行中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
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
                '💤 Zzz... 鳥たちは夢の中。起こさないであげてくださいね'
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
