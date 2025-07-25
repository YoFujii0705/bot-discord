const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('統計情報を表示')
    .addSubcommand(subcommand =>
      subcommand.setName('summary').setDescription('全体統計'))
    .addSubcommand(subcommand =>
      subcommand.setName('weekly').setDescription('週次統計'))
    .addSubcommand(subcommand =>
      subcommand.setName('monthly').setDescription('月次統計'))
    .addSubcommand(subcommand =>
      subcommand.setName('books').setDescription('読書統計'))
    .addSubcommand(subcommand =>
      subcommand.setName('current').setDescription('現在進行中'))
};
