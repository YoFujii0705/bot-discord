const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reports')
    .setDescription('レポート履歴を検索・表示')
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('特定の作品・活動のレポート履歴を表示')
        .addStringOption(option =>
          option.setName('category').setDescription('カテゴリ').setRequired(true)
            .addChoices(
              { name: '本', value: 'book' },
              { name: '映画', value: 'movie' },
              { name: '活動', value: 'activity' }
            ))
        .addIntegerOption(option =>
          option.setName('id').setDescription('対象のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('recent')
        .setDescription('最近のレポート一覧を表示')
        .addIntegerOption(option =>
          option.setName('days').setDescription('何日前まで表示するか（デフォルト: 7日）').setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('レポート内容でキーワード検索')
        .addStringOption(option =>
          option.setName('keyword').setDescription('検索キーワード').setRequired(true)))
};
