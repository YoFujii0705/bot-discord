const { EmbedBuilder } = require('discord.js');

module.exports = {
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'summary':
          await this.showSummary(interaction);
          break;
        case 'weekly':
          await this.showWeekly(interaction);
          break;
        case 'monthly':
          await this.showMonthly(interaction);
          break;
        case 'books':
          await this.showBooks(interaction);
          break;
        case 'current':
          await this.showCurrent(interaction);
          break;
        default:
          await interaction.editReply(`❌ 不明なサブコマンド: ${subcommand}`);
      }
    } catch (error) {
      console.error('StatsHandler エラー:', error);
      await interaction.editReply('統計情報取得中にエラーが発生しました: ' + error.message);
    }
  },

  async showSummary(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📊 全体統計')
      .setColor('#3498DB')
      .addFields(
        { name: '📚 本', value: '登録: 15冊\n読書中: 3冊\n読了: 8冊', inline: true },
        { name: '🎬 映画', value: '登録: 12本\n観たい: 5本\n視聴済み: 7本', inline: true },
        { name: '🎯 活動', value: '登録: 20件\n予定: 6件\n完了: 14件', inline: true }
      )
      .setFooter({ text: '継続的な活動記録、素晴らしいですね！' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async showWeekly(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📅 今週の統計')
      .setColor('#2ECC71')
      .addFields(
        { name: '📚 読了', value: '2冊', inline: true },
        { name: '🎬 視聴', value: '3本', inline: true },
        { name: '🎯 完了', value: '5件', inline: true },
        { name: '📝 日報', value: '12件', inline: true }
      )
      .setFooter({ text: '今週も充実した週でしたね！' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async showMonthly(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🗓️ 今月の統計')
      .setColor('#9B59B6')
      .addFields(
        { name: '📚 読了冊数', value: '6冊', inline: true },
        { name: '🎬 視聴本数', value: '8本', inline: true },
        { name: '🎯 完了活動', value: '18件', inline: true },
        { name: '📝 日報件数', value: '45件', inline: true },
        { 
          name: '🏆 今月読了した本', 
          value: '• JavaScript入門\n• プログラミング思考\n• Web開発基礎\n• データ構造とアルゴリズム\n• その他2冊', 
          inline: false 
        }
      )
      .setFooter({ text: '素晴らしい1ヶ月でした！' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async showBooks(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📚 読書統計詳細')
      .setColor('#E74C3C')
      .addFields(
        { name: 'ステータス別', value: '買いたい: 4冊\n積読: 6冊\n読書中: 3冊\n読了: 8冊', inline: true },
        { name: '期間別', value: '今月: 6冊\n今週: 2冊\n今日: 0冊', inline: true },
        { name: 'ジャンル別', value: '技術書: 5冊\n小説: 3冊\nビジネス: 2冊\nその他: 5冊', inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async showCurrent(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('⚡ 現在の進行状況')
      .setColor('#F39C12')
      .addFields(
        { 
          name: '📖 読書中', 
          value: '• [3] プログラミング入門 - コード花子\n• [12] Web開発基礎 - 開発次郎\n• [18] データベース設計 - DB太郎', 
          inline: false 
        },
        { 
          name: '🎬 観たい映画', 
          value: '• [2] アクション映画大作\n• [6] SF映画の傑作\n• [9] 最新アニメ映画\n• [11] 名作ドラマ\n• [15] コメディ映画', 
          inline: false 
        },
        { 
          name: '🎯 予定中の活動', 
          value: '• [1] ジョギング 30分\n• [4] 部屋の片付け\n• [7] 英語の勉強\n• [10] 料理の練習', 
          inline: false 
        }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};
