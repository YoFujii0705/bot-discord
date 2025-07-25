const { EmbedBuilder } = require('discord.js');

module.exports = {
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'add':
          await this.handleAdd(interaction);
          break;
        case 'done':
          await this.handleDone(interaction);
          break;
        case 'skip':
          await this.handleSkip(interaction);
          break;
        case 'list':
          await this.handleList(interaction);
          break;
        default:
          await interaction.editReply(`❌ 不明なサブコマンド: ${subcommand}`);
      }
    } catch (error) {
      console.error('ActivityHandler エラー:', error);
      await interaction.editReply('処理中にエラーが発生しました: ' + error.message);
    }
  },

  async handleAdd(interaction) {
    const content = interaction.options.getString('content');
    const memo = interaction.options.getString('memo') || '';
    
    const activityId = Math.floor(Math.random() * 1000) + Date.now() % 1000;
    
    const embed = new EmbedBuilder()
      .setTitle('🎯 活動を追加しました！')
      .setColor('#00BCD4')
      .addFields(
        { name: 'ID', value: activityId.toString(), inline: true },
        { name: '活動内容', value: content, inline: true },
        { name: 'ステータス', value: '予定', inline: true }
      )
      .setTimestamp();
    
    if (memo) {
      embed.addFields({ name: '備考', value: memo, inline: false });
    }
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleDone(interaction) {
    const doneId = interaction.options.getInteger('id');
    
    const embed = new EmbedBuilder()
      .setTitle('🎉 活動完了！')
      .setColor('#4CAF50')
      .setDescription('お疲れ様でした！🎉✨')
      .addFields(
        { name: 'ID', value: doneId.toString(), inline: true },
        { name: 'ステータス', value: '予定 → 完了', inline: true }
      )
      .setFooter({ text: '継続は力なり！次の活動も頑張りましょう！' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleSkip(interaction) {
    const skipId = interaction.options.getInteger('id');
    
    const embed = new EmbedBuilder()
      .setTitle('😅 やり逃してしまいました')
      .setColor('#FF9800')
      .setDescription('今回は見送りましたね。また機会があればチャレンジしてみてください！')
      .addFields(
        { name: 'ID', value: skipId.toString(), inline: true },
        { name: 'ステータス', value: '予定 → スキップ', inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleList(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎯 活動一覧')
      .setColor('#607D8B')
      .setDescription('登録されている活動の一覧です')
      .addFields(
        { 
          name: '🎯 予定中の活動', 
          value: '[1] ジョギング 30分\n[2] プログラミング学習\n[3] 読書時間 1時間\n[4] 部屋の片付け', 
          inline: false 
        },
        { 
          name: '✅ 完了した活動', 
          value: '[5] 朝の散歩\n[6] 英語の勉強\n[7] 料理の練習\n[8] ストレッチ', 
          inline: false 
        },
        { 
          name: '😅 スキップした活動', 
          value: '[9] 昨日の運動\n[10] 先週の掃除', 
          inline: false 
        }
      )
      .setFooter({ text: '詳細は各IDで操作してください' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};
