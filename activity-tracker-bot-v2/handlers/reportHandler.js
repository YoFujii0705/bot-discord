const { EmbedBuilder } = require('discord.js');

module.exports = {
  async execute(interaction) {
    try {
      const category = interaction.options.getString('category');
      const id = interaction.options.getInteger('id');
      const content = interaction.options.getString('content');
      
      const categoryEmoji = {
        'book': '📚',
        'movie': '🎬', 
        'activity': '🎯'
      };
      
      const categoryName = {
        'book': '本',
        'movie': '映画',
        'activity': '活動'
      };
      
      // レポートIDを生成（実際にはGoogle Sheetsに記録）
      const reportId = Math.floor(Math.random() * 1000) + Date.now() % 1000;
      
      const embed = new EmbedBuilder()
        .setTitle('📝 日報を記録しました！')
        .setColor('#4CAF50')
        .setDescription('今日も頑張りましたね！継続は力なりです！✨')
        .addFields(
          { name: 'レポートID', value: reportId.toString(), inline: true },
          { name: 'カテゴリ', value: `${categoryEmoji[category]} ${categoryName[category]}`, inline: true },
          { name: '対象ID', value: id.toString(), inline: true },
          { name: '内容', value: content, inline: false }
        )
        .setFooter({ text: 'レポート履歴は /reports で確認できます' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('ReportHandler エラー:', error);
      await interaction.editReply('日報記録中にエラーが発生しました: ' + error.message);
    }
  }
};
