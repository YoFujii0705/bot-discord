const { EmbedBuilder } = require('discord.js');

module.exports = {
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const keyword = interaction.options.getString('keyword');
    
    try {
      switch (subcommand) {
        case 'book':
          await this.searchBooks(interaction, keyword);
          break;
        case 'movie':
          await this.searchMovies(interaction, keyword);
          break;
        case 'activity':
          await this.searchActivities(interaction, keyword);
          break;
        case 'all':
          await this.searchAll(interaction, keyword);
          break;
        default:
          await interaction.editReply(`❌ 不明なサブコマンド: ${subcommand}`);
      }
    } catch (error) {
      console.error('SearchHandler エラー:', error);
      await interaction.editReply('検索中にエラーが発生しました: ' + error.message);
    }
  },

  async searchBooks(interaction, keyword) {
    const results = [
      '📚 [1] JavaScriptの教科書 - 技術太郎 (積読)',
      '📖 [3] プログラミング入門 - コード花子 (読書中)',
      '✅ [7] Web開発基礎 - 開発次郎 (読了)'
    ].filter(book => book.toLowerCase().includes(keyword.toLowerCase()));
    
    const embed = new EmbedBuilder()
      .setTitle(`🔍 本の検索結果: "${keyword}"`)
      .setColor('#9C27B0')
      .setDescription(results.length > 0 ? results.join('\n') : '該当する本が見つかりませんでした')
      .setFooter({ text: `${results.length}件見つかりました` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async searchMovies(interaction, keyword) {
    const results = [
      '🎬 [2] アクション映画大作 (観たい)',
      '✅ [5] SF映画の傑作 (視聴済み)',
      '😅 [8] 配信終了した映画 (見逃し)'
    ].filter(movie => movie.toLowerCase().includes(keyword.toLowerCase()));
    
    const embed = new EmbedBuilder()
      .setTitle(`🔍 映画の検索結果: "${keyword}"`)
      .setColor('#E91E63')
      .setDescription(results.length > 0 ? results.join('\n') : '該当する映画が見つかりませんでした')
      .setFooter({ text: `${results.length}件見つかりました` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async searchActivities(interaction, keyword) {
    const results = [
      '🎯 [1] ジョギング 30分 (予定)',
      '✅ [5] 朝の散歩 (完了)',
      '😅 [9] 昨日の運動 (スキップ)'
    ].filter(activity => activity.toLowerCase().includes(keyword.toLowerCase()));
    
    const embed = new EmbedBuilder()
      .setTitle(`🔍 活動の検索結果: "${keyword}"`)
      .setColor('#00BCD4')
      .setDescription(results.length > 0 ? results.join('\n') : '該当する活動が見つかりませんでした')
      .setFooter({ text: `${results.length}件見つかりました` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async searchAll(interaction, keyword) {
    const allResults = [
      '📚 [1] JavaScriptの教科書 - 技術太郎',
      '🎬 [2] アクション映画大作',
      '🎯 [3] プログラミング学習',
      '📖 [4] Web開発入門 - コード花子',
      '✅ [5] 朝の散歩'
    ].filter(item => item.toLowerCase().includes(keyword.toLowerCase()));
    
    const embed = new EmbedBuilder()
      .setTitle(`🔍 全体検索結果: "${keyword}"`)
      .setColor('#FF9800')
      .setDescription(allResults.length > 0 ? allResults.join('\n') : '該当するアイテムが見つかりませんでした')
      .setFooter({ text: `${allResults.length}件見つかりました` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};
