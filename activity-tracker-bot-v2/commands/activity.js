const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('活動の管理')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('活動を追加')
        .addStringOption(option =>
          option.setName('content').setDescription('活動内容').setRequired(true))
        .addStringOption(option =>
          option.setName('memo').setDescription('備考').setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('done')
        .setDescription('実行済みにする')
        .addIntegerOption(option =>
          option.setName('id').setDescription('活動のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('やり逃した')
        .addIntegerOption(option =>
          option.setName('id').setDescription('活動のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand.setName('list').setDescription('活動一覧'))
};
