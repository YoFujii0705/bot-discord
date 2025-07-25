const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('movie')
    .setDescription('映画の管理')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('映画を追加')
        .addStringOption(option =>
          option.setName('title').setDescription('タイトル').setRequired(true))
        .addStringOption(option =>
          option.setName('memo').setDescription('備考').setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('watch')
        .setDescription('視聴済みにする')
        .addIntegerOption(option =>
          option.setName('id').setDescription('映画のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('見逃した')
        .addIntegerOption(option =>
          option.setName('id').setDescription('映画のID').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand.setName('list').setDescription('映画一覧'))
};
