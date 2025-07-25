const { EmbedBuilder } = require('discord.js');

module.exports = {
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'add':
          await this.handleAdd(interaction);
          break;
        case 'buy':
          await this.handleBuy(interaction);
          break;
        case 'start':
          await this.handleStart(interaction);
          break;
        case 'finish':
          await this.handleFinish(interaction);
          break;
        case 'list':
          await this.handleList(interaction);
          break;
        case 'wishlist':
          await this.handleWishlist(interaction);
          break;
        default:
          await interaction.editReply(`❌ 不明なサブコマンド: ${subcommand}`);
      }
    } catch (error) {
      console.error('BookHandler エラー:', error);
      await interaction.editReply('処理中にエラーが発生しました: ' + error.message);
    }
  },

  async handleAdd(interaction) {
    const title = interaction.options.getString('title');
    const author = interaction.options.getString('author');
    const status = interaction.options.getString('status') || 'want_to_read';
    const memo = interaction.options.getString('memo') || '';
    
    // 一時的にダミーIDを生成（後でGoogle Sheets連携）
    const bookId = Math.floor(Math.random() * 1000) + Date.now() % 1000;
    
    const statusText = {
      'want_to_buy': '買いたい',
      'want_to_read': '積んでいる'
    };
    
    const embed = new EmbedBuilder()
      .setTitle('📚 本を追加しました！')
      .setColor('#4CAF50')
      .addFields(
        { name: 'ID', value: bookId.toString(), inline: true },
        { name: 'タイトル', value: title, inline: true },
        { name: '作者', value: author, inline: true },
        { name: 'ステータス', value: statusText[status], inline: true }
      )
      .setTimestamp();
    
    if (memo) {
      embed.addFields({ name: '備考', value: memo, inline: false });
    }
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleBuy(interaction) {
    const buyId = interaction.options.getInteger('id');
    
    const embed = new EmbedBuilder()
      .setTitle('🛒 本を購入しました！')
      .setColor('#2196F3')
      .setDescription('積読リストに追加されました！📚✨')
      .addFields(
        { name: 'ID', value: buyId.toString(), inline: true },
        { name: 'ステータス', value: '買いたい → 積読', inline: true }
      )
      .setFooter({ text: '読む準備ができたら /book start で読書を開始しましょう！' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleStart(interaction) {
    const startId = interaction.options.getInteger('id');
    
    const embed = new EmbedBuilder()
      .setTitle('📖 読書開始！')
      .setColor('#FF9800')
      .setDescription('頑張って読み進めましょう！✨')
      .addFields(
        { name: 'ID', value: startId.toString(), inline: true },
        { name: 'ステータス', value: '積読 → 読書中', inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleFinish(interaction) {
    const finishId = interaction.options.getInteger('id');
    
    const embed = new EmbedBuilder()
      .setTitle('🎉 読了おめでとうございます！')
      .setColor('#FFD700')
      .setDescription('素晴らしい達成感ですね！次の本も楽しみです📚✨')
      .addFields(
        { name: 'ID', value: finishId.toString(), inline: true },
        { name: 'ステータス', value: '読書中 → 読了', inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleList(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📚 本一覧')
      .setColor('#9C27B0')
      .setDescription('登録されている本の一覧です')
      .addFields(
        { name: '🛒 買いたい本', value: '[1] 新刊小説 - 人気作家\n[4] 技術書 - 専門著者', inline: false },
        { name: '📋 積読本', value: '[2] サンプル本 - テスト作者\n[5] 学習本 - 教育著者', inline: false },
        { name: '📖 読書中', value: '[3] 進行本 - 現在作者', inline: false },
        { name: '✅ 読了済み', value: '[6] 完読本 - 完了作者\n[7] 名作 - 古典作家', inline: false }
      )
      .setFooter({ text: '詳細は各IDで操作してください' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  },

  async handleWishlist(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🛒 買いたい本一覧')
      .setColor('#E91E63')
      .setDescription('購入予定の本リストです')
      .addFields(
        { name: '📖 小説・文学', value: '🛒 [1] 話題の新作 - ベストセラー作家\n🛒 [2] 文学賞受賞作 - 注目作家', inline: false },
        { name: '📚 技術書・実用書', value: '🛒 [3] プログラミング入門 - 技術専門家\n🛒 [4] デザイン本 - クリエイター', inline: false },
        { name: '🎯 自己啓発・ビジネス', value: '🛒 [5] 成功哲学 - 経営者\n🛒 [6] 時間術 - 効率専門家', inline: false }
      )
      .setFooter({ text: '購入したら /book buy [ID] で積読リストに移動できます' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};

// === utils/logger.js ===
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();
  }
  
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    
    // ファイルにも記録
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }
  
  info(message, meta) { this.log('info', message, meta); }
  error(message, meta) { this.log('error', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
  debug(message, meta) { this.log('debug', message, meta); }
}

module.exports = new Logger();
