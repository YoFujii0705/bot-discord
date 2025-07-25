const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('アイテムを検索')
    .addSubcommand(subcommand =>
      subcommand
        .setName('book')
        .setDescription('本を検索')
        .addStringOption(option =>
          option.setName('keyword').setDescription('検索キーワード（タイトルまたは作者）').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('movie')
        .setDescription('映画を検索')
        .addStringOption(option =>
          option.setName('keyword').setDescription('検索キーワード（タイトル）').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('activity')
        .setDescription('活動を検索')
        .addStringOption(option =>
          option.setName('keyword').setDescription('検索キーワード（活動内容）').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('全てから検索')
        .addStringOption(option =>
          option.setName('keyword').setDescription('検索キーワード').setRequired(true)))
};
