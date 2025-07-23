const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('現在の天気と鳥たちへの影響を確認します🌤️'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            const weatherManager = require('../utils/weather');
            const weather = await weatherManager.getCurrentWeather();
            const behavior = weatherManager.getBirdBehavior(weather.condition);
            const emoji = weatherManager.getWeatherEmoji(weather.condition);

            const embed = new EmbedBuilder()
                .setTitle(`${emoji} 現在の天気`)
                .setDescription(`**${weather.description}**`)
                .setColor(0x87CEEB)
                .addFields(
                    { name: '🌡️ 気温', value: `${weather.temperature}°C`, inline: true },
                    { name: '💧 湿度', value: `${weather.humidity}%`, inline: true },
                    { name: '💨 風速', value: `${weather.windSpeed}m/s`, inline: true },
                    { name: '🐦 鳥たちの様子', value: behavior.description, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('天気コマンドエラー:', error);
            await interaction.editReply({ 
                content: '天気情報の取得中にエラーが発生しました。' 
            });
        }
    }
};
