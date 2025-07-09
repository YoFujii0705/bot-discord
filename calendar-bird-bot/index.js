require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { google } = require('googleapis');
const cron = require('node-cron');

const CONFIG = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
  NOTIFICATION_CHANNEL_ID: process.env.NOTIFICATION_CHANNEL_ID,
  SERVICE_ACCOUNT_EMAIL: process.env.SERVICE_ACCOUNT_EMAIL,
  SERVICE_ACCOUNT_PRIVATE_KEY: process.env.SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

class CalendarBird {
  constructor() {
    console.log('🤖 CalendarBird 初期化中...');
    
    // 🔥 環境変数のデバッグ情報を追加
    this.debugEnvironmentVariables();

    this.client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ] 
    });

    this.auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: CONFIG.SERVICE_ACCOUNT_PRIVATE_KEY,
        client_email: CONFIG.SERVICE_ACCOUNT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(CONFIG.SERVICE_ACCOUNT_EMAIL)}`
      },
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });

    this.setupEventHandlers();
    this.setupCommandHandlers();
  }

  // 🔥 環境変数のデバッグ関数を追加
  debugEnvironmentVariables() {
    console.log('🔍 環境変数確認:');
    console.log('DISCORD_TOKEN:', CONFIG.DISCORD_TOKEN ? '設定済み' : '❌ 未設定');
    console.log('DISCORD_CLIENT_ID:', CONFIG.DISCORD_CLIENT_ID ? '設定済み' : '❌ 未設定');
    console.log('GOOGLE_CALENDAR_ID:', CONFIG.GOOGLE_CALENDAR_ID ? '設定済み' : '❌ 未設定');
    console.log('SERVICE_ACCOUNT_EMAIL:', CONFIG.SERVICE_ACCOUNT_EMAIL ? '設定済み' : '❌ 未設定');
    console.log('SERVICE_ACCOUNT_PRIVATE_KEY:', CONFIG.SERVICE_ACCOUNT_PRIVATE_KEY ? `設定済み(${CONFIG.SERVICE_ACCOUNT_PRIVATE_KEY.length}文字)` : '❌ 未設定');
    console.log('NOTIFICATION_CHANNEL_ID:', CONFIG.NOTIFICATION_CHANNEL_ID ? '設定済み' : '❌ 未設定');
  }

  // 正確な日本時間を取得
  getJSTNow() {
    return new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"});
  }

  // 日本時間での24時間制表示（完全修正版）
  formatJSTDate(dateInput, includeSeconds = false) {
    let date;

    // 入力が文字列の場合はDateオブジェクトに変換
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    // 日本時間に変換して表示
    const options = {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // 24時間制を強制
    };

    if (includeSeconds) {
      options.second = '2-digit';
    }

    const jstString = date.toLocaleString('ja-JP', options);

    // 日本のロケールで表示される形式を統一
    return jstString.replace(/\//g, '/').replace(/:/g, ':');
  }

  // 日付のみ表示用
  formatJSTDateOnly(dateInput) {
    let date;

    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    return date.toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`✅ ${this.client.user.tag} がログインしました！`);
      console.log(`📅 サーバー数: ${this.client.guilds.cache.size}`);
      console.log(`🕐 現在の日本時間: ${this.formatJSTDate(new Date(), true)}`);
      this.setupCronJob();
    });

    this.client.on('error', (error) => {
      console.error('Discord クライアントエラー:', error);
    });
  }

  setupCommandHandlers() {
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      const { commandName } = interaction;
      const startTime = Date.now(); // 🔥 応答時間測定を追加
      console.log(`コマンド受信: ${commandName} (JST: ${this.formatJSTDate(new Date(), true)})`);

      try {
        if (commandName === 'schedule') {
          await this.handleScheduleCommand(interaction);
        } else if (commandName === 'countdown') {
          await this.handleCountdownCommand(interaction);
        } else if (commandName === 'ping') {
          const jstNow = this.formatJSTDate(new Date(), true);
          const responseTime = Date.now() - startTime; // 🔥 応答時間計算
          await interaction.reply({ 
            content: `🏓 Pong! Botは正常に動作しています。\n🕐 現在の日本時間: ${jstNow}\n⏱️ 応答時間: ${responseTime}ms`, 
            ephemeral: false 
          });
        }
      } catch (error) {
        console.error('コマンド実行エラー:', error);
        const reply = { content: `エラーが発生しました: ${error.message}`, ephemeral: false };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(reply);
          } else {
            await interaction.reply(reply);
          }
        } catch (replyError) {
          console.error('返信エラー:', replyError);
        }
      }
    });
  }

  // 🔥 Google Calendar API呼び出しにタイムアウト対策を追加
  async callCalendarAPIWithTimeout(apiCall, timeoutMs = 15000) {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Google Calendar API タイムアウト')), timeoutMs)
    );

    try {
      return await Promise.race([apiCall, timeoutPromise]);
    } catch (error) {
      if (error.message === 'Google Calendar API タイムアウト') {
        console.error('⏰ Google Calendar API がタイムアウトしました');
        throw new Error('Google Calendar API の応答が遅すぎます。しばらく待ってから再試行してください。');
      }
      throw error;
    }
  }

  async handleScheduleCommand(interaction) {
    if (interaction.options.getSubcommand() !== 'add') return;

    try {
      // 🔥 即座に応答を送信
      await interaction.deferReply({ ephemeral: false });
      
      // 🔥 処理開始の通知
      await interaction.editReply({ content: '📅 予定を作成中です... お待ちください。' });

      const title = interaction.options.getString('title');
      const date = interaction.options.getString('date');
      const time = interaction.options.getString('time') || '17:00';
      const endTime = interaction.options.getString('endtime');
      const planned = interaction.options.getString('planned');
      const isAllDay = interaction.options.getBoolean('allday') || false;
      const countdownEnabled = interaction.options.getBoolean('countdown') ?? true;
      const description = interaction.options.getString('description') || '';

      console.log(`📅 予定作成開始 (JST: ${this.formatJSTDate(new Date(), true)})`);
      console.log('オプション:', { title, date, time, endTime, planned, isAllDay, countdownEnabled });

      // バリデーション
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        await interaction.editReply({ content: '❌ 日付の形式が正しくありません。YYYY-MM-DD形式で入力してください。' });
        return;
      }

      if (planned && !dateRegex.test(planned)) {
        await interaction.editReply({ content: '❌ 想定締切日の形式が正しくありません。YYYY-MM-DD形式で入力してください。' });
        return;
      }

      if (!isAllDay) {
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(time)) {
          await interaction.editReply({ content: '❌ 開始時刻の形式が正しくありません。HH:MM形式で入力してください。' });
          return;
        }

        if (endTime && !timeRegex.test(endTime)) {
          await interaction.editReply({ content: '❌ 終了時刻の形式が正しくありません。HH:MM形式で入力してください。' });
          return;
        }
      }

      let event;

      if (isAllDay) {
        console.log(`🌅 終日予定作成: ${date}`);

        let eventDescription = '';
        eventDescription += countdownEnabled ? 'カウントダウン:on\n' : 'カウントダウン:off\n';

        if (planned) {
          eventDescription += `想定締切:${planned}\n`;
        }

        if (description) {
          eventDescription += description;
        }

        event = {
          summary: title,
          start: {
            date: date,
            timeZone: 'Asia/Tokyo'
          },
          end: {
            date: endTime || date,
            timeZone: 'Asia/Tokyo'
          },
          description: eventDescription
        };

        console.log(`📅 終日予定: ${date} (JST)`);
      } else {
        console.log(`🕐 時刻指定予定作成: ${date} ${time}`);

        // 日本時間での日時作成（修正版）
        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);

        // 日本時間として作成し、タイムゾーン情報を付加
        const startDateTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;

        let endDateTimeString;
        if (endTime) {
          const [endHour, endMinute] = endTime.split(':').map(Number);

          // 終了時刻が開始時刻より早い場合は翌日
          if (endHour < hour || (endHour === hour && endMinute <= minute)) {
            const nextDay = new Date(year, month - 1, day + 1);
            const nextYear = nextDay.getFullYear();
            const nextMonth = nextDay.getMonth() + 1;
            const nextDate = nextDay.getDate();
            endDateTimeString = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDate).padStart(2, '0')}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00+09:00`;
          } else {
            endDateTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00+09:00`;
          }
        } else {
          // 1時間後
          const endHour = hour + 1;
          if (endHour >= 24) {
            const nextDay = new Date(year, month - 1, day + 1);
            const nextYear = nextDay.getFullYear();
            const nextMonth = nextDay.getMonth() + 1;
            const nextDate = nextDay.getDate();
            endDateTimeString = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDate).padStart(2, '0')}T${String(endHour - 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
          } else {
            endDateTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
          }
        }

        console.log(`📅 開始時刻文字列: ${startDateTimeString}`);
        console.log(`📅 終了時刻文字列: ${endDateTimeString}`);

        // 確認用：作成される日時をログ出力
        console.log(`📅 開始時刻(JST確認): ${this.formatJSTDate(new Date(startDateTimeString))}`);
        console.log(`📅 終了時刻(JST確認): ${this.formatJSTDate(new Date(endDateTimeString))}`);

        let eventDescription = '';
        eventDescription += countdownEnabled ? 'カウントダウン:on\n' : 'カウントダウン:off\n';

        if (planned) {
          eventDescription += `想定締切:${planned}\n`;
        }

        if (description) {
          eventDescription += description;
        }

        event = {
          summary: title,
          start: {
            dateTime: startDateTimeString,
            timeZone: 'Asia/Tokyo'
          },
          end: {
            dateTime: endDateTimeString,
            timeZone: 'Asia/Tokyo'
          },
          description: eventDescription
        };
      }

      console.log('📤 Google Calendar API 呼び出し中...');

      // 🔥 タイムアウト対策を適用してGoogle Calendar API呼び出し
      const response = await this.callCalendarAPIWithTimeout(
        this.calendar.events.insert({
          calendarId: CONFIG.GOOGLE_CALENDAR_ID,
          resource: event
        })
      );

      console.log('✅ カレンダーイベント作成完了');

      const embed = new EmbedBuilder()
        .setTitle('✅ 予定を追加しました')
        .setColor(countdownEnabled ? '#00FF00' : '#808080')
        .setTimestamp();

      if (isAllDay) {
        embed.addFields(
          { name: 'タイトル', value: title, inline: true },
          { name: '種類', value: '📅 終日予定', inline: true },
          { name: '日付', value: `${date} (JST)`, inline: true },
          { name: '想定締切', value: planned || 'なし', inline: true },
          { name: 'カウントダウン', value: countdownEnabled ? '🟢 ON' : '🔴 OFF', inline: true }
        );
      } else {
        const endTimeDisplay = endTime || `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:${time.split(':')[1]}`;
        embed.addFields(
          { name: 'タイトル', value: title, inline: true },
          { name: '開始時刻', value: `${date} ${time} (JST)`, inline: true },
          { name: '終了時刻', value: `${endTimeDisplay} (JST)`, inline: true },
          { name: '想定締切', value: planned || 'なし', inline: true },
          { name: 'カウントダウン', value: countdownEnabled ? '🟢 ON' : '🔴 OFF', inline: true }
        );
      }

      // 🔥 最終的な成功メッセージを送信
      await interaction.editReply({ 
        content: null, // 「作成中...」メッセージを削除
        embeds: [embed] 
      });

    } catch (error) {
      console.error('Schedule コマンドエラー:', error);

      try {
        await interaction.editReply({ 
          content: `❌ エラーが発生しました: ${error.message}` 
        });
      } catch (replyError) {
        console.error('返信エラー:', replyError);
      }
    }
  }

  async handleCountdownCommand(interaction) {
    // 🔥 即座に応答を送信
    await interaction.deferReply({ ephemeral: false });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'test') {
      console.log(`🔔 テスト通知実行 (JST: ${this.formatJSTDate(new Date(), true)})`);
      await interaction.editReply({ content: '🔔 カウントダウン通知をテスト送信中...' });
      await this.sendDailyNotification();
      await interaction.editReply({ content: '✅ カウントダウン通知をテスト送信しました！' });
    } 
    else if (subcommand === 'weekly-test') {
      console.log(`📅 週間予定テスト通知実行 (JST: ${this.formatJSTDate(new Date(), true)})`);
      await interaction.editReply({ content: '📅 週間予定通知をテスト送信中...' });
      await this.sendWeeklySchedule();
      await interaction.editReply({ content: '✅ 週間予定通知をテスト送信しました！' });
    }
    else if (subcommand === 'toggle') {
      await this.handleToggleCommand(interaction);
    }
    else if (subcommand === 'list') {
      await this.handleListCommand(interaction);
    }
  }

  async handleToggleCommand(interaction) {
    const keyword = interaction.options.getString('keyword');

    try {
      // 🔥 処理中メッセージを表示
      await interaction.editReply({ content: `🔍 "${keyword}" に一致する予定を検索中...` });

      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      console.log(`🔍 予定検索中 (JST: ${this.formatJSTDate(now)} - ${this.formatJSTDate(futureDate)})`);

      // 🔥 タイムアウト対策を適用
      const response = await this.callCalendarAPIWithTimeout(
        this.calendar.events.list({
          calendarId: CONFIG.GOOGLE_CALENDAR_ID,
          timeMin: now.toISOString(),
          timeMax: futureDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        })
      );

      const allEvents = response.data.items || [];

      const matchingEvents = allEvents.filter(event => 
        event.summary && event.summary.toLowerCase().includes(keyword.toLowerCase())
      );

      if (matchingEvents.length === 0) {
        await interaction.editReply({ 
          content: `❌ "${keyword}" に一致する予定が見つかりませんでした。` 
        });
        return;
      }

      if (matchingEvents.length > 5) {
        await interaction.editReply({ 
          content: `⚠️ "${keyword}" に一致する予定が${matchingEvents.length}件見つかりました。より具体的なキーワードを使用してください。` 
        });
        return;
      }

      if (matchingEvents.length === 1) {
        await interaction.editReply({ content: '🔄 カウントダウンを切り替え中...' });
        await this.toggleEventCountdown(matchingEvents[0]);
        const newStatus = await this.getEventCountdownStatus(matchingEvents[0].id);
        await interaction.editReply({ 
          content: `✅ "${matchingEvents[0].summary}" のカウントダウンを ${newStatus ? 'ON' : 'OFF'} に切り替えました。`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔄 カウントダウン切り替え対象の選択')
        .setDescription(`"${keyword}" に一致する予定:`)
        .setColor('#FFA500');

      matchingEvents.forEach((event, index) => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const description = event.description || '';
        const isCountdownOn = description.toLowerCase().includes('カウントダウン:on');
        const status = isCountdownOn ? '🟢 ON' : '🔴 OFF';

        // 時差修正：日本時間で正確に表示
        let timeDisplay;
        if (event.start.dateTime) {
          // 時刻指定の予定
          timeDisplay = this.formatJSTDate(startTime);
        } else {
          // 終日予定
          timeDisplay = this.formatJSTDateOnly(startTime);
        }

        embed.addFields({
          name: `${index + 1}. ${event.summary}`,
          value: `日時: ${timeDisplay}\nカウントダウン: ${status}`,
          inline: false
        });
      });

      embed.setFooter({ text: '続けて数字（1-' + matchingEvents.length + '）を送信してください。' });
      await interaction.editReply({ embeds: [embed] });

      const filter = (msg) => {
        const num = parseInt(msg.content);
        return msg.author.id === interaction.user.id && 
               num >= 1 && num <= matchingEvents.length;
      };

      const collector = interaction.channel.createMessageCollector({ 
        filter, 
        time: 30000, 
        max: 1 
      });

      collector.on('collect', async (msg) => {
        const selectedIndex = parseInt(msg.content) - 1;
        const selectedEvent = matchingEvents[selectedIndex];

        await this.toggleEventCountdown(selectedEvent);
        const newStatus = await this.getEventCountdownStatus(selectedEvent.id);

        await msg.reply(`✅ "${selectedEvent.summary}" のカウントダウンを ${newStatus ? 'ON' : 'OFF'} に切り替えました。`);
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction.followUp({ content: '⏰ 時間切れです。再度コマンドを実行してください。', ephemeral: false });
        }
      });

    } catch (error) {
      console.error('カウントダウン切り替えエラー:', error);
      await interaction.editReply({ content: '❌ エラーが発生しました。再度お試しください。' });
    }
  }

  async handleListCommand(interaction) {
    const days = interaction.options.getInteger('days') || 30;

    try {
      // 🔥 処理中メッセージを表示
      await interaction.editReply({ content: `📋 今後${days}日間の予定を取得中...` });

      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      console.log(`📋 予定一覧取得 (JST: ${this.formatJSTDate(now)} - ${this.formatJSTDate(futureDate)})`);

      // 🔥 タイムアウト対策を適用
      const response = await this.callCalendarAPIWithTimeout(
        this.calendar.events.list({
          calendarId: CONFIG.GOOGLE_CALENDAR_ID,
          timeMin: now.toISOString(),
          timeMax: futureDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        })
      );

      const allEvents = response.data.items || [];

      if (allEvents.length === 0) {
        await interaction.editReply({ content: `📅 今後${days}日間の予定がありません。` });
        return;
      }

      // ページング処理
      const itemsPerPage = 15;
      const totalPages = Math.ceil(allEvents.length / itemsPerPage);
      let currentPage = 0;

      const generateEmbed = (page) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageEvents = allEvents.slice(start, end);

        const embed = new EmbedBuilder()
          .setTitle(`📅 今後の予定一覧（${days}日間）`)
          .setDescription(`🕐 現在の日本時間: ${this.formatJSTDate(new Date(), true)}\n📖 ページ ${page + 1}/${totalPages} (全${allEvents.length}件)`)
          .setColor('#0099FF')
          .setTimestamp();

        pageEvents.forEach(event => {
          const startTime = new Date(event.start.dateTime || event.start.date);
          const description = event.description || '';
          const isCountdownOn = description.toLowerCase().includes('カウントダウン:on');
          const status = isCountdownOn ? '🟢' : '🔴';
          const daysLeft = this.calculateDaysLeft(startTime);

          // 時差修正：日本時間で正確に表示
          let timeDisplay;
          if (event.start.dateTime) {
            // 時刻指定の予定：日本時間で24時間制表示
            timeDisplay = this.formatJSTDate(startTime);
          } else {
            // 終日予定：日付のみ表示
            timeDisplay = this.formatJSTDateOnly(startTime);
          }

          embed.addFields({
            name: `${status} ${event.summary}`,
            value: `${timeDisplay} (あと${daysLeft}日)`,
            inline: false
          });
        });

        return embed;
      };

      const generateButtons = (page) => {
        const row = [];

        if (page > 0) {
          row.push({
            type: 2,
            style: 2,
            label: '⬅️ 前のページ',
            custom_id: 'prev_page'
          });
        }

        if (page < totalPages - 1) {
          row.push({
            type: 2,
            style: 2,
            label: '次のページ ➡️',
            custom_id: 'next_page'
          });
        }

        row.push({
          type: 2,
          style: 4,
          label: '❌ 閉じる',
          custom_id: 'close_list'
        });

        return row.length > 0 ? [{
          type: 1,
          components: row
        }] : [];
      };

      // 初期表示
      const initialEmbed = generateEmbed(currentPage);
      const initialComponents = generateButtons(currentPage);

      const reply = await interaction.editReply({ 
        embeds: [initialEmbed], 
        components: initialComponents
      });

      // 1ページしかない場合はボタン操作不要
      if (totalPages <= 1) return;

      // ボタン操作のコレクター
      const collector = reply.createMessageComponentCollector({ 
        time: 300000 // 5分間
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({ 
            content: '❌ この操作はコマンドを実行したユーザーのみ使用できます。', 
            ephemeral: true 
          });
          return;
        }

        try {
          if (buttonInteraction.customId === 'prev_page' && currentPage > 0) {
            currentPage--;
          } else if (buttonInteraction.customId === 'next_page' && currentPage < totalPages - 1) {
            currentPage++;
          } else if (buttonInteraction.customId === 'close_list') {
            collector.stop();
            await buttonInteraction.update({ 
              embeds: [initialEmbed.setDescription('🔒 予定一覧を閉じました。')], 
              components: [] 
            });
            return;
          }

          const newEmbed = generateEmbed(currentPage);
          const newComponents = generateButtons(currentPage);

          await buttonInteraction.update({ 
            embeds: [newEmbed], 
            components: newComponents 
          });

        } catch (error) {
          console.error('ボタン操作エラー:', error);
          await buttonInteraction.reply({ 
            content: '❌ 操作中にエラーが発生しました。', 
            ephemeral: true 
          });
        }
      });

      collector.on('end', async () => {
        try {
          await interaction.editReply({ 
            embeds: [initialEmbed.setDescription('⏰ 操作時間が終了しました。')], 
            components: [] 
          });
        } catch (error) {
          console.error('コレクター終了エラー:', error);
        }
      });

    } catch (error) {
      console.error('予定一覧取得エラー:', error);
      await interaction.editReply({ content: '❌ 予定の取得に失敗しました。' });
    }
  }

  async toggleEventCountdown(event) {
    const description = event.description || '';
    let newDescription;

    if (description.toLowerCase().includes('カウントダウン:on')) {
      newDescription = description.replace(/カウントダウン:on/gi, 'カウントダウン:off');
    } else {
      if (description.toLowerCase().includes('カウントダウン:off')) {
        newDescription = description.replace(/カウントダウン:off/gi, 'カウントダウン:on');
      } else {
        newDescription = 'カウントダウン:on\n' + description;
      }
    }

    // 🔥 タイムアウト対策を適用
    await this.callCalendarAPIWithTimeout(
      this.calendar.events.update({
        calendarId: CONFIG.GOOGLE_CALENDAR_ID,
        eventId: event.id,
        resource: {
          ...event,
          description: newDescription
        }
      })
    );
  }

  async getEventCountdownStatus(eventId) {
    try {
      // 🔥 タイムアウト対策を適用
      const response = await this.callCalendarAPIWithTimeout(
        this.calendar.events.get({
          calendarId: CONFIG.GOOGLE_CALENDAR_ID,
          eventId: eventId
        })
      );

      const description = response.data.description || '';
      return description.toLowerCase().includes('カウントダウン:on');
    } catch (error) {
      console.error('イベント取得エラー:', error);
      return false;
    }
  }

  calculateDaysLeft(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  setupCronJob() {
    console.log('📅 Cronジョブを設定中...');

    // 送信済みフラグ（日付ベース）
    this.lastWeeklyScheduleDate = null;
    this.lastCountdownDate = null;

    // 毎朝7時00分：一週間の予定一覧を送信
    cron.schedule('0 7 * * *', async () => {
      const now = new Date();
      const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
      const today = this.formatJSTDateOnly(jstTime);

      // 今日まだ送信していない場合のみ実行
      if (this.lastWeeklyScheduleDate !== today) {
        console.log(`📅 週間予定通知の時間です (JST: ${this.formatJSTDate(jstTime, true)})`);
        await this.sendWeeklySchedule();
        this.lastWeeklyScheduleDate = today;
        console.log(`✅ 週間予定通知送信完了`);
      } else {
        console.log(`⏭️ 本日(${today})は既に週間予定通知済みです`);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    // 毎朝7時30分：カウントダウン通知を送信
    cron.schedule('30 7 * * *', async () => {
      const now = new Date();
      const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
      const today = this.formatJSTDateOnly(jstTime);

      // 今日まだ送信していない場合のみ実行
      if (this.lastCountdownDate !== today) {
        console.log(`🔔 カウントダウン通知の時間です (JST: ${this.formatJSTDate(jstTime, true)})`);
        await this.sendDailyNotification();
        this.lastCountdownDate = today;
        console.log(`✅ カウントダウン通知送信完了`);
      } else {
        console.log(`⏭️ 本日(${today})は既にカウントダウン通知済みです`);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });

    console.log('✅ Cronジョブが設定されました（毎朝7:00に週間予定、7:30にカウントダウン通知 JST）');
  }

  async sendWeeklySchedule() {
    try {
      console.log(`📅 週間予定通知準備中... (JST: ${this.formatJSTDate(new Date(), true)})`);

      const now = new Date();
      const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // 🔥 タイムアウト対策を適用
      const response = await this.callCalendarAPIWithTimeout(
        this.calendar.events.list({
          calendarId: CONFIG.GOOGLE_CALENDAR_ID,
          timeMin: now.toISOString(),
          timeMax: oneWeekLater.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        })
      );

      const events = response.data.items || [];

      if (events.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('📅 今週の予定')
          .setDescription(`🕐 日本時間: ${this.formatJSTDate(new Date(), true)}\n\n📭 今後一週間の予定がありません。`)
          .setColor('#808080')
          .setTimestamp();

        const channel = this.client.channels.cache.get(CONFIG.NOTIFICATION_CHANNEL_ID);
        if (channel) {
          await channel.send({ embeds: [embed] });
          console.log('✅ 週間予定通知（予定なし）を送信しました');
        }
        return;
      }

      // 日付別にグループ化
      const eventsByDate = {};
      events.forEach(event => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const dateKey = this.formatJSTDateOnly(startTime);

        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push(event);
      });

      const embed = new EmbedBuilder()
        .setTitle('📅 今週の予定一覧')
        .setDescription(`🕐 日本時間: ${this.formatJSTDate(new Date(), true)}\n📊 全${events.length}件の予定`)
        .setColor('#4169E1')
        .setTimestamp();

      // 日付順に表示
      const sortedDates = Object.keys(eventsByDate).sort();
      let totalDisplayed = 0;
      const maxEventsPerDay = 10;
      const maxTotalEvents = 20;

      for (const date of sortedDates) {
        if (totalDisplayed >= maxTotalEvents) break;

        const dayEvents = eventsByDate[date];
        const displayEvents = dayEvents.slice(0, maxEventsPerDay);

        // 曜日を取得
        const dayOfWeek = new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', { 
          weekday: 'short',
          timeZone: 'Asia/Tokyo'
        });

        let dayText = '';
        displayEvents.forEach(event => {
          if (totalDisplayed >= maxTotalEvents) return;

          const description = event.description || '';
          const isCountdownOn = description.toLowerCase().includes('カウントダウン:on');
          const status = isCountdownOn ? '🟢' : '⚪';

          let timeDisplay;
          if (event.start.dateTime) {
            // 時刻指定の予定
            const startTime = new Date(event.start.dateTime);
            const timeStr = this.formatJSTDate(startTime).split(' ')[1]; // 時刻部分のみ
            timeDisplay = `${timeStr}`;
          } else {
            // 終日予定
            timeDisplay = '終日';
          }

          dayText += `${status} ${timeDisplay} ${event.summary}\n`;
          totalDisplayed++;
        });

        if (dayEvents.length > maxEventsPerDay) {
          dayText += `... 他${dayEvents.length - maxEventsPerDay}件\n`;
        }

        embed.addFields({
          name: `📆 ${date} (${dayOfWeek})`,
          value: dayText || '予定なし',
          inline: false
        });
      }

      if (events.length > maxTotalEvents) {
        embed.setFooter({ text: `※ 表示制限により、${maxTotalEvents}件まで表示。詳細は /countdown list で確認してください。` });
      }

      const channel = this.client.channels.cache.get(CONFIG.NOTIFICATION_CHANNEL_ID);
      if (channel) {
        await channel.send({ embeds: [embed] });
        console.log('✅ 週間予定通知を送信しました');
      } else {
        console.error('❌ 通知チャンネルが見つかりません');
      }

    } catch (error) {
      console.error('週間予定通知送信エラー:', error);
    }
  }

  async sendDailyNotification() {
    try {
      console.log(`📬 カウントダウン通知準備中... (JST: ${this.formatJSTDate(new Date(), true)})`);

      const now = new Date();
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 🔥 タイムアウト対策を適用
      const response = await this.callCalendarAPIWithTimeout(
        this.calendar.events.list({
          calendarId: CONFIG.GOOGLE_CALENDAR_ID,
          timeMin: now.toISOString(),
          timeMax: futureDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        })
      );

      const events = response.data.items || [];

      const countdownEvents = events.filter(event => {
        const description = event.description || '';
        return description.toLowerCase().includes('カウントダウン:on');
      });

      if (countdownEvents.length === 0) {
        console.log('📭 カウントダウン対象の予定がありません');
        return;
      }

      const topEvents = countdownEvents.slice(0, 3);

      const embed = new EmbedBuilder()
        .setTitle('📅 本日のカウントダウン')
        .setDescription(`🕐 日本時間: ${this.formatJSTDate(new Date(), true)}`)
        .setColor('#FFD700')
        .setTimestamp();

      topEvents.forEach(event => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const daysLeft = this.calculateDaysLeft(startTime);
        const description = event.description || '';

        const plannedMatch = description.match(/想定締切:(\d{4}-\d{2}-\d{2})/);
        let plannedText = '';

        if (plannedMatch) {
          const plannedDate = new Date(plannedMatch[1] + 'T23:59:59');
          const plannedDaysLeft = this.calculateDaysLeft(plannedDate);
          plannedText = `\n   └ 想定締切まで：あと${plannedDaysLeft}日`;
        }

        let urgencyEmoji = '🟢';
        if (daysLeft <= 1) urgencyEmoji = '🔴';
        else if (daysLeft <= 3) urgencyEmoji = '🟡';
        else if (daysLeft <= 7) urgencyEmoji = '🟠';

        embed.addFields({
          name: `${urgencyEmoji} ${event.summary}`,
          value: `   └ 実際締切まで：あと${daysLeft}日${plannedText}`,
          inline: false
        });
      });

      const channel = this.client.channels.cache.get(CONFIG.NOTIFICATION_CHANNEL_ID);
      if (channel) {
        await channel.send({ embeds: [embed] });
        console.log('✅ カウントダウン通知を送信しました');
      } else {
        console.error('❌ 通知チャンネルが見つかりません');
      }

    } catch (error) {
      console.error('通知送信エラー:', error);
    }
  }

  async registerCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Google カレンダーに予定を追加（日本時間・24時間制）')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('新しい予定を追加')
            .addStringOption(option =>
              option.setName('title')
                .setDescription('予定のタイトル')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('date')
                .setDescription('日付 (YYYY-MM-DD) ※日本時間')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('time')
                .setDescription('開始時刻 (HH:MM) ※24時間制・日本時間')
                .setRequired(false))
            .addStringOption(option =>
              option.setName('endtime')
                .setDescription('終了時刻 (HH:MM) ※24時間制・日本時間')
                .setRequired(false))
            .addStringOption(option =>
              option.setName('planned')
                .setDescription('想定締切日 (YYYY-MM-DD)')
                .setRequired(false))
            .addBooleanOption(option =>
              option.setName('allday')
                .setDescription('終日予定にする')
                .setRequired(false))
            .addBooleanOption(option =>
              option.setName('countdown')
                .setDescription('カウントダウン通知を有効にする')
                .setRequired(false))
            .addStringOption(option =>
              option.setName('description')
                .setDescription('詳細説明')
                .setRequired(false))),

      new SlashCommandBuilder()
        .setName('countdown')
        .setDescription('カウントダウン管理')
        .addSubcommand(subcommand =>
          subcommand
            .setName('test')
            .setDescription('カウントダウン通知をテスト送信'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('weekly-test')
            .setDescription('週間予定通知をテスト送信'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('toggle')
            .setDescription('予定のカウントダウンをオン/オフ切り替え')
            .addStringOption(option =>
              option.setName('keyword')
                .setDescription('切り替える予定のキーワード')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('今後の予定一覧を表示（日本時間・24時間制）')
            .addIntegerOption(option =>
              option.setName('days')
                .setDescription('表示する日数（1-365日）')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(365))),

      new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botの動作確認（日本時間・24時間制表示）')
    ];

    const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);

    try {
      console.log('🔄 スラッシュコマンドを登録中...');

      await rest.put(
        Routes.applicationCommands(CONFIG.DISCORD_CLIENT_ID),
        { body: commands.map(command => command.toJSON()) }
      );

      console.log('✅ スラッシュコマンドの登録が完了しました');
    } catch (error) {
      console.error('❌ スラッシュコマンドの登録に失敗しました:', error);
    }
  }

  async start() {
    try {
      console.log('🚀 Calendar Bird を起動中...');

      await this.registerCommands();
      await this.client.login(CONFIG.DISCORD_TOKEN);

    } catch (error) {
      console.error('❌ Bot起動エラー:', error);
      process.exit(1);
    }
  }
}

function checkEnvironmentVariables() {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID', 
    'GOOGLE_CALENDAR_ID',
    'NOTIFICATION_CHANNEL_ID',
    'SERVICE_ACCOUNT_EMAIL',
    'SERVICE_ACCOUNT_PRIVATE_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ 必要な環境変数が設定されていません:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }

  console.log('✅ 環境変数チェック完了');
}

async function main() {
  console.log('🤖 === Calendar Bird Bot 起動 ===');

  checkEnvironmentVariables();

  const bot = new CalendarBird();
  await bot.start();
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

main().catch(console.error);
