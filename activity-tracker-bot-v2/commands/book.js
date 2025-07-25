const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('book')
    .setDescription('本の管理')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('本を追加')
        .addStringOption(option =>
          option.setName('title').setDescription('タイトル').setRequired(true))
        .addStringOption(option =>
          option.setName('author').setDescription('作者').setRequired(true))
        .addStringOption(option =>
          option.setName('status').setDescription('初期ステータス').setRequired(false)
            .addChoices(
              { name: '買いたい', value: 'want_to_buy' },
              { name: '積んでいる', value: 'want_to_read' }
            ))
        .addStringOption(option =>
          option.setName('memo').setDescription('備考').setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('本を購入した（want_to_buy → want_to_read）')
        .addIntegerOption(option =>
          option.setName('id').setDescription('本のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('読み始める')
        .addIntegerOption(option =>
          option.setName('id').setDescription('本のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('finish')
        .setDescription('読み終わる')
        .addIntegerOption(option =>
          option.setName('id').setDescription('本のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand.setName('list').setDescription('本一覧'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('wishlist')
        .setDescription('買いたい本一覧を表示'))
};
