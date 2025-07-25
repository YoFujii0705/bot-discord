const { EmbedBuilder } = require('discord.js');

module.exports = {
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'history':
          await this.showHistory(interaction);
          break;
        case 'recent':
          await this.showRecent(interaction);
          break;
        case 'search':
          await this.searchReports(interaction);
          break;
        default:
          await interaction.editReply(`❌ 不明なサブコマンド: ${subcommand}`);
      }
    } catch (error) {
      console.error('ReportsHandler エラー:', error);
      await interaction.editReply('レポート検索中にエラーが発生しました: ' + error.message);
    }
  },

  async showHistory(interaction) {
    const category = interaction.options.getString('category');
    const id = interaction.options.getInteger('id');
    
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
    
    // サンプルレポート履歴
    const sampleReports = [
      '📅 **2024-01-20**\n50ページまで読み進めました。面白い展開になってきた。',
      '📅 **2024-01-19**\n30ページ読了。主人公の設定が興味深い。',
      '📅 **2024-01-18**\n読み始めました。期待大！'
    ];
    
    const embed = new EmbedBuilder()
      .setTitle(`${categoryEmoji[category]} ID:${id} のレポート履歴`)
      .setColor('#9C27B0')
      .setDescription('過去のレポート記録です')
      .addFields(
        { name: `📊 総レポート数`, value: `${sampleReports.length}件`, inline: true },
        { name: '📝 レポート履歴', value: sampleReports.join('\n\n─────────────────\n\n'), inline: false }
      )
      .setFooter({ text: `/report ${category} ${id} [内容] で新しいレポートを記録できます` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async showRecent(interaction) {
    const days = interaction.options.getInteger('days') || 7;
    
    const recentReports = [
      '📚 **ID:3** (2024-01-20) - 50ページまで読了。面白い！',
      '🎬 **ID:5** (2024-01-19) - アクション映画視聴。迫力満点でした。',
      '🎯 **ID:2** (2024-01-19) - ジョギング30分完了。爽快！',
      '📚 **ID:7** (2024-01-18) - 技術書読み進める。理解深まった。',
      '🎯 **ID:4** (2024-01-18) - 部屋の片付け。スッキリした。'
    ];
    
    const embed = new EmbedBuilder()
      .setTitle(`📝 過去${days}日間のレポート一覧`)
      .setColor('#4CAF50')
      .setDescription(`最近の活動記録です（${recentReports.length}件）`)
      .addFields(
        { name: '📚 本', value: '2件', inline: true },
        { name: '🎬 映画', value: '1件', inline: true },
        { name: '🎯 活動', value: '2件', inline: true },
        { name: '📋 レポート一覧', value: recentReports.join('\n'), inline: false }
      )
      .setFooter({ text: '詳細を見るには /reports history を使用してください' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async searchReports(interaction) {
    const keyword = interaction.options.getString('keyword');
    
    const searchResults = [
      '📚 **ID:3** (2024-01-20) - 50ページまで読了。**面白い**！',
      '🎬 **ID:8** (2024-01-15) - コメディ映画。**面白い**展開でした。',
      '📚 **ID:12** (2024-01-12) - **面白い**キャラクター設定の本。'
    ];
    
    const embed = new EmbedBuilder()
      .setTitle(`🔍 "${keyword}" の検索結果`)
      .setColor('#FF9800')
      .setDescription(`レポート内容から検索しました`)
      .addFields(
        { name: `📊 見つかった件数`, value: `${searchResults.length}件`, inline: true },
        { name: '🔍 検索結果', value: searchResults.join('\n\n─────────────────\n\n'), inline: false }
      )
      .setFooter({ text: `キーワード "${keyword}" でハイライト表示` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};
