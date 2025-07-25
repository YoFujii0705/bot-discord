const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');

class NotificationService {
  constructor(client) {
    this.client = client;
    this.setupScheduledTasks();
  }

  getNotificationChannel() {
    console.log('📡 通知チャンネルを取得中...');
    
    // 環境変数で指定されたチャンネル
    if (process.env.NOTIFICATION_CHANNEL_ID) {
      const channel = this.client.channels.cache.get(process.env.NOTIFICATION_CHANNEL_ID);
      if (channel) {
        console.log('✅ 指定チャンネル:', channel.name);
        return channel;
      }
    }
    
    // ギルドから最初のテキストチャンネル
    const guild = this.client.guilds.cache.first();
    if (guild) {
      const textChannels = guild.channels.cache.filter(ch => ch.type === 0);
      if (textChannels.size > 0) {
        const channel = textChannels.first();
        console.log('✅ デフォルトチャンネル:', channel.name);
        return channel;
      }
    }
    
    console.log('❌ 通知チャンネルが見つかりません');
    return null;
  }

  setupScheduledTasks() {
    console.log('⏰ 定期通知を設定中...');
    
    // 毎朝7時: 朝の挨拶と読書リマインド
    cron.schedule('0 7 * * *', async () => {
      await this.sendMorningReminder();
    }, {
      timezone: "Asia/Tokyo"
    });
    
    // 毎月1日8時: 買いたい本リスト通知
    cron.schedule('0 8 1 * *', async () => {
      await this.sendMonthlyWishlist();
    }, {
      timezone: "Asia/Tokyo"
    });
    
    // 毎日20時: ログ記録リマインド
    cron.schedule('0 20 * * *', async () => {
      await this.sendLogReminder();
    }, {
      timezone: "Asia/Tokyo"
    });
    
    // 毎週日曜日21時: 週次レポート
    cron.schedule('0 21 * * 0', async () => {
      await this.sendWeeklyReport();
    }, {
      timezone: "Asia/Tokyo"
    });
    
    console.log('✅ 定期通知設定完了');
  }

  async sendMorningReminder() {
    try {
      const channel = this.getNotificationChannel();
      if (!channel) return;
      
      const embed = new EmbedBuilder()
        .setTitle('☀️ おはようございます！')
        .setDescription('今日はどの本を読みますか？📚')
        .addFields(
          { name: '📖 読書中の本', value: '• [3] プログラミング入門\n• [12] Web開発基礎', inline: false },
          { name: '📋 積んでいる本', value: '• [1] JavaScript教科書\n• [7] データベース設計\n• [15] アルゴリズム入門', inline: false }
        )
        .setColor('#FFEB3B')
        .setFooter({ text: '今日も素晴らしい一日にしましょう！' })
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
      console.log('📨 朝の通知を送信しました');
      
    } catch (error) {
      console.error('❌ 朝の通知エラー:', error);
    }
  }

  async sendMonthlyWishlist() {
    try {
      const channel = this.getNotificationChannel();
      if (!channel) return;
      
      const embed = new EmbedBuilder()
        .setTitle('🛒 月初の買いたい本リスト')
        .setDescription('新しい月が始まりました！気になっていた本を購入してみませんか？📚✨')
        .addFields({
          name: '📋 買いたい本一覧 (6冊)',
          value: '🛒 [21] 最新技術書 - 専門著者\n🛒 [22] ビジネス書 - 経営者\n🛒 [23] 小説新刊 - 人気作家\n🛒 [24] 自己啓発書 - 成功者\n🛒 [25] 料理本 - シェフ\n🛒 [26] 旅行ガイド - 旅行家',
          inline: false
        })
        .setColor('#4CAF50')
        .setFooter({ text: '購入したら /book buy [ID] で積読リストに移動できます' })
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
      console.log('📨 月初買いたい本リストを送信しました');
      
    } catch (error) {
      console.error('❌ 月初通知エラー:', error);
    }
  }

  async sendLogReminder() {
    try {
      const channel = this.getNotificationChannel();
      if (!channel) return;
      
      const embed = new EmbedBuilder()
        .setTitle('📝 ログ記録のリマインド')
        .setDescription('今日の活動を振り返って、日報を記録してみませんか？')
        .addFields(
          { name: '📚 本の記録', value: '`/report book [ID] [内容]`', inline: true },
          { name: '🎬 映画の記録', value: '`/report movie [ID] [内容]`', inline: true },
          { name: '🎯 活動の記録', value: '`/report activity [ID] [内容]`', inline: true },
          { name: '💡 記録のコツ', value: '• 今日読んだページ数\n• 映画の感想\n• 活動の進捗や気づき', inline: false }
        )
        .setColor('#FF9800')
        .setFooter({ text: '継続は力なり！今日も一歩前進しましょう 💪' })
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
      console.log('📨 ログリマインドを送信しました');
      
    } catch (error) {
      console.error('❌ ログリマインドエラー:', error);
    }
  }

  async sendWeeklyReport() {
    try {
      const channel = this.getNotificationChannel();
      if (!channel) return;
      
      const embed = new EmbedBuilder()
        .setTitle('📅 今週の活動レポート')
        .setDescription('今週も頑張りました！🎉')
        .addFields(
          { name: '📚 読了した本', value: '2冊', inline: true },
          { name: '🎬 視聴した映画', value: '3本', inline: true },
          { name: '🎯 完了した活動', value: '5件', inline: true },
          { name: '📝 記録した日報', value: '12件', inline: true }
        )
        .setColor('#4CAF50')
        .setFooter({ text: 'お疲れ様でした！来週も頑張りましょう！' })
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
      console.log('📨 週次レポートを送信しました');
      
    } catch (error) {
      console.error('❌ 週次レポートエラー:', error);
    }
  }
}

module.exports = NotificationService;
