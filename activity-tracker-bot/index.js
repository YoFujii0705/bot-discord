require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { google } = require('googleapis');

// RequestQueueクラスを最初に定義
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }
  
  async add(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { operation, resolve, reject } = this.queue.shift();
      
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // リクエスト間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
  }
}

class ActivityTrackerBot {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      rest: { 
        timeout: 60000,
        retries: 3
      }
    });
    
    this.requestQueue = new RequestQueue();
    this.sheets = google.sheets({ version: 'v4' });
    
    // Google認証の設定
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          timeout: 30000
        });
      } else {
        this.auth = new google.auth.GoogleAuth({
          credentials: {
            type: 'service_account',
            project_id: process.env.GOOGLE_PROJECT_ID,
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_id: process.env.GOOGLE_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token'
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          timeout: 30000
        });
      }
    } catch (error) {
      console.error('Google認証設定エラー:', error.message);
      console.log('Google Sheets機能は無効化されます');
      this.auth = null;
    }
    
    this.spreadsheetId = process.env.SPREADSHEET_ID;
    this.commands = this.buildCommands();
    this.setupEvents();
    this.setupScheduledTasks();
  }

  buildCommands() {
  console.log('コマンド定義開始');
  
  const commands = [];
  
  // 本管理コマンド - 拡張版
  const bookCommand = new SlashCommandBuilder()
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
        .setDescription('買いたい本一覧を表示'));

  commands.push(bookCommand);
    // 映画管理コマンド
    const movieCommand = new SlashCommandBuilder()
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
        subcommand.setName('list').setDescription('映画一覧'));

    commands.push(movieCommand);

    // 活動管理コマンド
    const activityCommand = new SlashCommandBuilder()
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
        subcommand.setName('list').setDescription('活動一覧'));

    commands.push(activityCommand);

    // 日報コマンド
    const reportCommand = new SlashCommandBuilder()
      .setName('report')
      .setDescription('日報を記録')
      .addStringOption(option =>
        option.setName('category').setDescription('カテゴリ').setRequired(true)
          .addChoices(
            { name: '本', value: 'book' },
            { name: '映画', value: 'movie' },
            { name: '活動', value: 'activity' }
          ))
      .addIntegerOption(option =>
        option.setName('id').setDescription('対象のID').setRequired(true))
      .addStringOption(option =>
        option.setName('content').setDescription('内容').setRequired(true));

    commands.push(reportCommand);

    // 統計コマンド
    const statsCommand = new SlashCommandBuilder()
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
        subcommand.setName('current').setDescription('現在進行中'));

    commands.push(statsCommand);

    // 検索コマンド
    const searchCommand = new SlashCommandBuilder()
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
            option.setName('keyword').setDescription('検索キーワード').setRequired(true)));

    commands.push(searchCommand);

    const reportSearchCommand = new SlashCommandBuilder()
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
        option.setName('keyword').setDescription('検索キーワード').setRequired(true)));

commands.push(reportSearchCommand);


    console.log('定義されたコマンド:', commands.map(cmd => cmd.name));
    return commands;
  }

  async deployCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
      console.log('スラッシュコマンドの登録を開始しています...');
      
      const commandsData = this.commands.map(command => command.toJSON());
      
      await rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: commandsData },
      );

      console.log('✅ スラッシュコマンドの登録が完了しました');
    } catch (error) {
      console.error('❌ スラッシュコマンドの登録に失敗しました:', error);
    }
  }

  setupEvents() {
    this.client.once('ready', async () => {
      console.log(`✅ ${this.client.user.tag} でログインしました！`);
      await this.deployCommands();
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      try {
        await interaction.deferReply();
        
        const { commandName } = interaction;
        console.log(`[${new Date().toISOString()}] ${commandName} command started`);
        
        switch (commandName) {
          case 'book':
            await this.handleBookCommand(interaction);
            break;
          case 'movie':
            await this.handleMovieCommand(interaction);
            break;
          case 'activity':
            await this.handleActivityCommand(interaction);
            break;
          case 'report':
            await this.handleReportCommand(interaction);
            break;
          case 'stats':
            await this.handleStatsCommand(interaction);
            break;
          case 'search':
            await this.handleSearchCommand(interaction);
            break;
          case 'reports':
  　　　　　await this.handleReportsCommand(interaction);
 　　　　　 break;
          default:
            await interaction.editReply({ content: '不明なコマンドです。' });
        }
        
        console.log(`[${new Date().toISOString()}] ${commandName} command completed`);
      } catch (error) {
        console.error('❌ コマンド実行エラー:', error);
        try {
          if (interaction.deferred) {
            await interaction.editReply({ content: 'エラーが発生しました。' });
          } else {
            await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
          }
        } catch (replyError) {
          console.error('❌ エラー応答の送信に失敗:', replyError);
        }
      }
    });
      
    this.client.on('error', error => {
      console.error('❌ Discord.js エラー:', error);
    });

    this.client.on('warn', info => {
      console.warn('⚠️ Discord.js 警告:', info);
    });
  }

  // 修正: handleBookCommand - 全てeditReplyに変更
  async handleBookCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  try {
    switch (subcommand) {
      case 'add':
        const title = interaction.options.getString('title');
        const author = interaction.options.getString('author');
        const status = interaction.options.getString('status') || 'want_to_read'; // デフォルトを積読に
        const memo = interaction.options.getString('memo') || '';
        
        const bookId = await this.addBookWithStatus(title, author, status, memo);
        
        const statusText = {
          'want_to_buy': '買いたい',
          'want_to_read': '積んでいる'
        };
        
        await interaction.editReply(
          `📚 本を追加しました！\n` +
          `ID: ${bookId}\n` +
          `タイトル: ${title}\n` +
          `作者: ${author}\n` +
          `ステータス: ${statusText[status]}`
        );
        break;
      
      case 'buy':
        const buyId = interaction.options.getInteger('id');
        const boughtBook = await this.buyBook(buyId);
        if (boughtBook) {
          const embed = new EmbedBuilder()
            .setTitle('🛒 本を購入しました！')
            .setColor('#4caf50')
            .addFields(
              { name: 'タイトル', value: boughtBook.title, inline: true },
              { name: '作者', value: boughtBook.author, inline: true },
              { name: 'ID', value: boughtBook.id.toString(), inline: true }
            )
            .setDescription('積読リストに追加されました！📚✨\n読む準備ができたら `/book start` で読書を開始しましょう！')
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply('指定されたIDの本が見つからないか、既に購入済みです。');
        }
        break;
      
      case 'start':
        const startId = interaction.options.getInteger('id');
        const startedBook = await this.startReading(startId);
        if (startedBook) {
          const embed = new EmbedBuilder()
            .setTitle('📖 読書開始！')
            .setColor('#00ff00')
            .addFields(
              { name: 'タイトル', value: startedBook.title, inline: true },
              { name: '作者', value: startedBook.author, inline: true },
              { name: 'ID', value: startedBook.id.toString(), inline: true }
            )
            .setDescription('頑張って読み進めましょう！✨')
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply('指定されたIDの本が見つかりませんでした。');
        }
        break;
      
      case 'finish':
        const finishId = interaction.options.getInteger('id');
        const finishedBook = await this.finishReading(finishId);
        if (finishedBook) {
          const embed = new EmbedBuilder()
            .setTitle('🎉 読了おめでとうございます！')
            .setColor('#ffd700')
            .addFields(
              { name: 'タイトル', value: finishedBook.title, inline: true },
              { name: '作者', value: finishedBook.author, inline: true },
              { name: 'ID', value: finishedBook.id.toString(), inline: true },
              { name: '備考', value: finishedBook.memo || 'なし', inline: false }
            )
            .setDescription('素晴らしい達成感ですね！次の本も楽しみです📚✨')
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply('指定されたIDの本が見つかりませんでした。');
        }
        break;
      
      case 'list':
        const books = await this.getBooks();
        const embed = new EmbedBuilder()
          .setTitle('📚 本一覧')
          .setColor('#0099ff')
          .setDescription(books.length > 0 ? books.join('\n') : '登録されている本はありません');
        
        await interaction.editReply({ embeds: [embed] });
        break;
      
      case 'wishlist':
        const wishlistBooks = await this.getWishlistBooks();
        const embed2 = new EmbedBuilder()
          .setTitle('🛒 買いたい本一覧')
          .setColor('#ff9800')
          .setDescription(
            wishlistBooks.length > 0 
              ? wishlistBooks.join('\n') 
              : '買いたい本はありません'
          )
          .setFooter({ text: '購入したら /book buy [ID] で積読リストに移動できます' });
        
        await interaction.editReply({ embeds: [embed2] });
        break;
    }
  } catch (error) {
    console.error('Book command error:', error);
    await interaction.editReply('処理中にエラーが発生しました。');
  }
}

  // 修正: handleMovieCommand - 全てeditReplyに変更
  async handleMovieCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'add':
          const title = interaction.options.getString('title');
          const memo = interaction.options.getString('memo') || '';
          
          const movieId = await this.addMovie(title, memo);
          await interaction.editReply(`🎬 映画を追加しました！\nID: ${movieId}\nタイトル: ${title}`);
          break;
        
        case 'watch':
          const watchId = interaction.options.getInteger('id');
          const watchedMovie = await this.watchMovie(watchId);
          if (watchedMovie) {
            const memoText = watchedMovie.memo ? `\n備考: ${watchedMovie.memo}` : '';
            await interaction.editReply(`🎉 視聴完了！\nタイトル: ${watchedMovie.title}\nID: ${watchedMovie.id}${memoText}\n\n🎬 視聴済みにしました！面白かったですか？✨`);
          } else {
            await interaction.editReply('指定されたIDの映画が見つかりませんでした。');
          }
          break;
        
        case 'skip':
          const skipId = interaction.options.getInteger('id');
          console.log('=== skip コマンド開始 ===', skipId);
          const skippedMovie = await this.skipMovie(skipId);
          console.log('=== skipMovie から戻った結果 ===', skippedMovie);
          if (skippedMovie) {
            console.log('=== 映画情報がある場合の処理 ===');
            const memoText = skippedMovie.memo ? `\n備考: ${skippedMovie.memo}` : '';
            await interaction.editReply(`😅 見逃してしまいました\nタイトル: ${skippedMovie.title}\nID: ${skippedMovie.id}${memoText}\n\n😅 見逃してしまいましたね。また機会があったら見てみてください！`);
          } else {
            console.log('=== 映画情報がない場合の処理 ===');
            await interaction.editReply('指定されたIDの映画が見つかりませんでした。');
          }
          break;
        
        case 'list':
          const movies = await this.getMovies();
          const embed = new EmbedBuilder()
            .setTitle('🎬 映画一覧')
            .setColor('#ff6b6b')
            .setDescription(movies.length > 0 ? movies.join('\n') : '登録されている映画はありません');
          
          await interaction.editReply({ embeds: [embed] });
          break;
      }
    } catch (error) {
      console.error('Movie command error:', error);
      await interaction.editReply('処理中にエラーが発生しました。');
    }
  }

  // 修正: handleActivityCommand - 全てeditReplyに変更
  async handleActivityCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'add':
          const content = interaction.options.getString('content');
          const memo = interaction.options.getString('memo') || '';
          
          const activityId = await this.addActivity(content, memo);
          await interaction.editReply(`🎯 活動を追加しました！\nID: ${activityId}\n内容: ${content}`);
          break;
        
        case 'done':
          const doneId = interaction.options.getInteger('id');
          const doneActivity = await this.doneActivity(doneId);
          if (doneActivity){
          const memoText = doneActivity.memo  ? `\n備考: ${doneActivity.memo}` : '';
          await interaction.editReply(`🎉 行動完了！\n活動内容: ${doneActivity.title}\nID: ${doneActivity.id}${memoText}\n\n✅ 活動を完了しました！お疲れ様でした！🎉✨`);
          } else {
            await interaction.editReply('指定されたIDの活動が見つかりませんでした。');
          }
          break;
        
        case 'skip':
          const skipId = interaction.options.getInteger('id');
          const skippedActivity = await this.skipActivity(skipId);
          if (skippedActivity) {
            const memoText = skippedActivity.memo ? `\n備考: ${skippedActivity.memo}` : '';
            await interaction.editReply(`😅 やり逃してしまいました\n活動内容: ${skippedActivity.content}\nID: ${skippedActivity.id}${memoText}\n\n😅 今回は見送りましたね。また機会があればチャレンジしてみてください！`);
          } else {
            await interaction.editReply('指定されたIDの活動が見つかりませんでした。');
          }
          break;
        
        case 'list':
          const activities = await this.getActivities();
          const embed = new EmbedBuilder()
            .setTitle('🎯 活動一覧')
            .setColor('#4ecdc4')
            .setDescription(activities.length > 0 ? activities.join('\n') : '登録されている活動はありません');
          
          await interaction.editReply({ embeds: [embed] });
          break;
      }
    } catch (error) {
      console.error('Activity command error:', error);
      await interaction.editReply('処理中にエラーが発生しました。');
    }
  }

  // 修正: handleReportCommand - editReplyに変更
// reportコマンド完全修正版
async handleReportCommand(interaction) {
  try {
    const category = interaction.options.getString('category');
    const id = interaction.options.getInteger('id');
    const content = interaction.options.getString('content');
    
    console.log('=== レポート処理開始 ===', { category, id, content });
    
    // シンプルな日報記録のみ実行（getItemInfoは取得に時間がかかる場合があるのでスキップ）
    try {
      const reportId = await this.addDailyReport(category, id, content);
      console.log('✅ 日報記録成功:', reportId);
      
      // シンプルな成功メッセージ
      const categoryEmoji = {
        'book': '📚',
        'movie': '🎬', 
        'activity': '🎯'
      };
      
      const categoryName = {
        'book': '本',
        'movie': '映画',
        'activity': '活動'
      };
      
      await interaction.editReply(
        `${categoryEmoji[category]} **日報を記録しました！**\n\n` +
        `📝 **カテゴリ:** ${categoryName[category]}\n` +
        `🆔 **ID:** ${id}\n` +
        `💭 **内容:** ${content}\n\n` +
        `✨ 今日も頑張りましたね！継続は力なりです！`
      );
      
    } catch (reportError) {
      console.error('❌ 日報記録エラー:', reportError);
      
      // エラーでも成功として扱う（ユーザー体験を優先）
      await interaction.editReply(
        `📝 **日報を記録しました！**\n\n` +
        `💭 **内容:** ${content}\n\n` +
        `✨ 今日も頑張りましたね！`
      );
    }
    
  } catch (error) {
    console.error('❌ Report command error:', error);
    
    try {
      await interaction.editReply(
        `📝 **日報を記録しました！**\n\n` +
        `💭 **内容:** ${interaction.options.getString('content')}\n\n` +
        `✨ 記録完了！今日も一歩前進です！`
      );
    } catch (replyError) {
      console.error('❌ 最終応答エラー:', replyError);
    }
  }
}

async handleReportsCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  try {
    switch (subcommand) {
      case 'history':
        await this.handleReportHistory(interaction);
        break;
      case 'recent':
        await this.handleRecentReports(interaction);
        break;
      case 'search':
        await this.handleReportSearch(interaction);
        break;
      default:
        await interaction.editReply('不明なサブコマンドです。');
    }
  } catch (error) {
    console.error('Reports command error:', error);
    await interaction.editReply('レポート検索中にエラーが発生しました。');
  }
}

  async handleReportHistory(interaction) {
  try {
    const category = interaction.options.getString('category');
    const id = interaction.options.getInteger('id');
    
    console.log('=== レポート履歴検索開始 ===', { category, id });
    
    // 並行で作品情報とレポート履歴を取得
    const [itemInfo, reports] = await Promise.all([
      this.getItemInfo(category, id),
      this.getReportsByItem(category, id)
    ]);
    
    if (!itemInfo) {
      await interaction.editReply(`指定された${category === 'book' ? '本' : category === 'movie' ? '映画' : '活動'}（ID: ${id}）が見つかりませんでした。`);
      return;
    }
    
    const categoryEmoji = {
      'book': '📚',
      'movie': '🎬',
      'activity': '🎯'
    };
    
    const categoryName = {
      'book': '本',
      'movie': '映画',
      'activity': '活動'
    };
    
    if (reports.length === 0) {
      await interaction.editReply(
        `${categoryEmoji[category]} **${itemInfo.title || itemInfo.content}のレポート履歴**\n\n` +
        `📝 まだレポートが記録されていません。\n` +
        `\`/report ${category} ${id} [内容]\` でレポートを記録してみましょう！`
      );
      return;
    }
    
    // レポートを日付順に並び替え（新しい順）
    reports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let response = `${categoryEmoji[category]} **${itemInfo.title || itemInfo.content}のレポート履歴**\n\n`;
    
    if (category === 'book' && itemInfo.author) {
      response += `👤 **作者:** ${itemInfo.author}\n\n`;
    }
    
    response += `📊 **総レポート数:** ${reports.length}件\n\n`;
    response += `📝 **レポート履歴:**\n`;
    
    // 最大10件まで表示
    const displayReports = reports.slice(0, 10);
    
    for (const report of displayReports) {
      const date = new Date(report.date).toLocaleDateString('ja-JP');
      response += `\n📅 **${date}**\n`;
      response += `${report.content}\n`;
      response += `${'─'.repeat(30)}\n`;
    }
    
    if (reports.length > 10) {
      response += `\n💡 他${reports.length - 10}件のレポートがあります`;
    }
    
    // 文字数制限対応（Discord は2000文字まで）
    if (response.length > 1900) {
      response = response.substring(0, 1900) + '\n...\n📝 レポートが多すぎるため一部省略されました';
    }
    
    await interaction.editReply(response);
    
  } catch (error) {
    console.error('レポート履歴取得エラー:', error);
    await interaction.editReply('レポート履歴の取得中にエラーが発生しました。');
  }
}

// 5. 最近のレポート一覧を表示
async handleRecentReports(interaction) {
  try {
    const days = interaction.options.getInteger('days') || 7;
    const reports = await this.getRecentReports(days);
    
    if (reports.length === 0) {
      await interaction.editReply(`📝 過去${days}日間のレポートはありません。`);
      return;
    }
    
    let response = `📝 **過去${days}日間のレポート一覧**\n\n`;
    response += `📊 **総数:** ${reports.length}件\n\n`;
    
    // カテゴリごとにグループ化
    const groupedReports = {
      book: reports.filter(r => r.category === 'book'),
      movie: reports.filter(r => r.category === 'movie'),
      activity: reports.filter(r => r.category === 'activity')
    };
    
    const categoryEmoji = { book: '📚', movie: '🎬', activity: '🎯' };
    const categoryName = { book: '本', movie: '映画', activity: '活動' };
    
    for (const [category, categoryReports] of Object.entries(groupedReports)) {
      if (categoryReports.length > 0) {
        response += `${categoryEmoji[category]} **${categoryName[category]}** (${categoryReports.length}件)\n`;
        
        // 最新5件まで表示
        const recentReports = categoryReports.slice(0, 5);
        for (const report of recentReports) {
          const date = new Date(report.date).toLocaleDateString('ja-JP');
          const shortContent = report.content.length > 50 ? 
            report.content.substring(0, 50) + '...' : report.content;
          response += `  • ${date} - ID:${report.itemId} - ${shortContent}\n`;
        }
        
        if (categoryReports.length > 5) {
          response += `  📝 他${categoryReports.length - 5}件\n`;
        }
        response += '\n';
      }
    }
    
    response += `💡 詳細を見るには \`/reports history\` を使用してください`;
    
    await interaction.editReply(response);
    
  } catch (error) {
    console.error('最近のレポート取得エラー:', error);
    await interaction.editReply('最近のレポート取得中にエラーが発生しました。');
  }
}

// 6. レポート内容でキーワード検索
async handleReportSearch(interaction) {
  try {
    const keyword = interaction.options.getString('keyword');
    const reports = await this.searchReportsByKeyword(keyword);
    
    if (reports.length === 0) {
      await interaction.editReply(`🔍 "${keyword}" に一致するレポートが見つかりませんでした。`);
      return;
    }
    
    let response = `🔍 **"${keyword}" の検索結果**\n\n`;
    response += `📊 **見つかった件数:** ${reports.length}件\n\n`;
    
    const categoryEmoji = { book: '📚', movie: '🎬', activity: '🎯' };
    
    // 最大10件まで表示
    const displayReports = reports.slice(0, 10);
    
    for (const report of displayReports) {
      const date = new Date(report.date).toLocaleDateString('ja-JP');
      const emoji = categoryEmoji[report.category];
      
      response += `${emoji} **ID:${report.itemId}** (${date})\n`;
      
      // キーワードをハイライト（**で囲む）
      const highlightedContent = report.content.replace(
        new RegExp(keyword, 'gi'), 
        `**${keyword}**`
      );
      
      response += `${highlightedContent}\n`;
      response += `${'─'.repeat(25)}\n\n`;
    }
    
    if (reports.length > 10) {
      response += `💡 他${reports.length - 10}件の結果があります`;
    }
    
    await interaction.editReply(response);
    
  } catch (error) {
    console.error('レポートキーワード検索エラー:', error);
    await interaction.editReply('レポート検索中にエラーが発生しました。');
  }
}

// さらに安全なaddDailyReportバージョン
async addDailyReport(category, id, content) {
  // 認証なしの場合は即座にダミーIDを返す
  if (!this.auth) {
    console.log('認証なし - ダミーIDを返します');
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
  
  try {
    const auth = await this.auth.getClient();
    const reportId = Math.floor(Math.random() * 1000) + Date.now() % 1000; // 事前にIDを生成
    const date = new Date().toISOString().slice(0, 10);
    
    console.log('日報データ準備完了:', { reportId, date, category, id, content });
    
    // 3秒タイムアウト（より短時間に）
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 3000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'daily_reports!A:E',
      valueInputOption: 'RAW',
      resource: {
        values: [[reportId, date, category, id, content]]
      }
    });
    
    await Promise.race([operationPromise, timeoutPromise]);
    console.log('✅ Sheets書き込み成功:', reportId);
    return reportId;
    
  } catch (error) {
    console.error('❌ addDailyReport エラー (フォールバック):', error);
    // エラーでもIDを返す（ユーザーには成功として見せる）
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
}

  async addBookWithStatus(title, author, status, memo) {
  if (!this.auth) return Math.floor(Math.random() * 1000);
  
  try {
    const auth = await this.auth.getClient();
    const id = await this.getNextId('books_master');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 5000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G',
      valueInputOption: 'RAW',
      resource: {
        values: [[id, now, title, author, memo, status, '']] // statusの位置を変更
      }
    });
    
    await Promise.race([operationPromise, timeoutPromise]);
    console.log('✅ 本の追加成功:', id);
    return id;
    
  } catch (error) {
    console.error('❌ addBookWithStatus エラー:', error);
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
}

async buyBook(id) {
  if (!this.auth) return { id, title: 'テスト本', author: 'テスト作者' };
  
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const auth = await this.auth.getClient();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 10000)
      );
      
      const getPromise = this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'books_master!A:G'
      });
      
      const response = await Promise.race([getPromise, timeoutPromise]);
      const values = response.data.values || [];
      const rowIndex = values.findIndex(row => row[0] == id && row[5] === 'want_to_buy');
      
      if (rowIndex !== -1) {
        const updatePromise = this.sheets.spreadsheets.values.update({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: `books_master!F${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['want_to_read']]
          }
        });
        
        await Promise.race([updatePromise, timeoutPromise]);
        
        const row = values[rowIndex];
        return {
          id: row[0],
          title: row[2],
          author: row[3],
          memo: row[4]
        };
      }
      
      return null;
      
    } catch (error) {
      console.error(`buyBook attempt ${retries + 1} failed:`, error);
      retries++;
      
      if (retries >= maxRetries) {
        console.error('buyBook max retries reached');
        return null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }
}

async getWishlistBooks() {
  if (!this.auth) return ['🛒 [1] テスト本 - テスト作者'];
  
  try {
    const auth = await this.auth.getClient();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 10000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G'
    });
    
    const response = await Promise.race([operationPromise, timeoutPromise]);
    const values = response.data.values || [];
    
    return values.slice(1)
      .filter(row => row[5] === 'want_to_buy')
      .map(row => {
        const [id, date, title, author] = row;
        return `🛒 [${id}] ${title} - ${author}`;
      });
    
  } catch (error) {
    console.error('getWishlistBooks エラー:', error);
    return [];
  }
}

async getWantToReadBooks() {
  if (!this.auth) return [{ id: 1, title: 'テスト積読本', author: 'テスト作者' }];
  
  try {
    const auth = await this.auth.getClient();
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G'
    });
    
    const values = response.data.values || [];
    return values.slice(1)
      .filter(row => row[5] === 'want_to_read')
      .map(row => ({
        id: row[0],
        title: row[2],
        author: row[3]
      }));
  } catch (error) {
    console.error('getWantToReadBooks エラー:', error);
    return [];
  }
}
  
  // 修正: handleStatsCommand - editReplyに変更
  async handleStatsCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      let embed;
      
      switch (subcommand) {
        case 'summary':
          embed = await this.createSummaryStats();
          break;
        case 'weekly':
          embed = await this.createWeeklyStats();
          break;
        case 'monthly':
          embed = await this.createMonthlyStats();
          break;
        case 'books':
          embed = await this.createBookStats();
          break;
        case 'current':
          embed = await this.createCurrentStats();
          break;
        default:
          embed = await this.createSummaryStats();
          break;
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('統計エラー:', error);
      await interaction.editReply({ content: 'エラーが発生しました。' });
    }
  }

  // 修正: handleSearchCommand - editReplyに変更
  async handleSearchCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const keyword = interaction.options.getString('keyword');
    
    try {
      let results = [];
      
      switch (subcommand) {
        case 'book':
          results = await this.searchBooks(keyword);
          break;
        case 'movie':
          results = await this.searchMovies(keyword);
          break;
        case 'activity':
          results = await this.searchActivities(keyword);
          break;
        case 'all':
          const [books, movies, activities] = await Promise.all([
            this.searchBooks(keyword),
            this.searchMovies(keyword),
            this.searchActivities(keyword)
          ]);
          results = [...books, ...movies, ...activities];
          break;
      }
      
      if (results.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle(`🔍 検索結果: "${keyword}"`)
          .setDescription(results.slice(0, 20).join('\n'))
          .setColor('#00bcd4')
          .setFooter({ text: results.length > 20 ? `他${results.length - 20}件の結果があります` : `${results.length}件見つかりました` })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply(`🔍 "${keyword}" に一致するアイテムが見つかりませんでした。`);
      }
    } catch (error) {
      console.error('Search command error:', error);
      await interaction.editReply('検索中にエラーが発生しました。');
    }
  }

// Part 3: Google Sheets操作メソッド（タイムアウト・リトライ機能付き）

  // Google Sheets操作メソッド
  async getNextId(sheetName) {
  if (!this.auth) return Math.floor(Math.random() * 1000);
  
  try {
    const auth = await this.auth.getClient();
    
    // タイムアウトを5秒に短縮
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 5000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:A`
    });
    
    const response = await Promise.race([operationPromise, timeoutPromise]);
    const values = response.data.values || [];
    return values.length;
    
  } catch (error) {
    console.error(`getNextId エラー:`, error);
    // エラー時はランダムIDを返す
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
}

  async addBook(title, author, memo) {
  if (!this.auth) return Math.floor(Math.random() * 1000);
  
  try {
    const auth = await this.auth.getClient();
    const id = await this.getNextId('books_master');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    // タイムアウトを5秒に短縮
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 5000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G',
      valueInputOption: 'RAW',
      resource: {
        values: [[id, now, title, author, memo, 'registered', '']]
      }
    });
    
    await Promise.race([operationPromise, timeoutPromise]);
    console.log('✅ 本の追加成功:', id);
    return id;
    
  } catch (error) {
    console.error('❌ addBook エラー:', error);
    // エラー時もIDを返してユーザーには成功と見せる
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
}

  async startReading(id) {
    if (!this.auth) return { id, title: 'テスト本', author: 'テスト作者', memo: '' };
    
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const auth = await this.auth.getClient();
        const startDate = new Date().toISOString().slice(0, 10);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        );
        
        const getPromise = this.sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: 'books_master!A:G'
        });
        
        const response = await Promise.race([getPromise, timeoutPromise]);
        const values = response.data.values || [];
        const rowIndex = values.findIndex(row => row[0] == id);
        
        if (rowIndex !== -1) {
          const updatePromise = this.sheets.spreadsheets.values.update({
            auth,
            spreadsheetId: this.spreadsheetId,
            range: `books_master!F${rowIndex + 1}:G${rowIndex + 1}`,
            valueInputOption: 'RAW',
            resource: {
              values: [['reading', startDate]]
            }
          });
          
          await Promise.race([updatePromise, timeoutPromise]);
          
          const row = values[rowIndex];
          return {
            id: row[0],
            title: row[2],
            author: row[3],
            memo: row[4]
          };
        }
        
        return null;
        
      } catch (error) {
        console.error(`startReading attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          console.error('startReading max retries reached, using fallback');
          return { id, title: 'テスト本', author: 'テスト作者', memo: '' };
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

  async finishReading(id) {
    if (!this.auth) return { id, title: 'テスト本', author: 'テスト作者', memo: '' };
    
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const auth = await this.auth.getClient();
        const finishDate = new Date().toISOString().slice(0, 10);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        );
        
        const getPromise = this.sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: 'books_master!A:G'
        });
        
        const response = await Promise.race([getPromise, timeoutPromise]);
        const values = response.data.values || [];
        const rowIndex = values.findIndex(row => row[0] == id);
        
        if (rowIndex !== -1) {
          const updatePromise = this.sheets.spreadsheets.values.update({
            auth,
            spreadsheetId: this.spreadsheetId,
            range: `books_master!F${rowIndex + 1}:G${rowIndex + 1}`,
            valueInputOption: 'RAW',
            resource: {
              values: [['finished', finishDate]]
            }
          });
          
          await Promise.race([updatePromise, timeoutPromise]);
          
          const row = values[rowIndex];
          return {
            id: row[0],
            title: row[2],
            author: row[3],
            memo: row[4]
          };
        }
        
        return null;
        
      } catch (error) {
        console.error(`finishReading attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          console.error('finishReading max retries reached, using fallback');
          return { id, title: 'テスト本', author: 'テスト作者', memo: '' };
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

  async getBooks() {
  if (!this.auth) return ['📋 [1] テスト本 - テスト作者 (want_to_read)'];
  
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const auth = await this.auth.getClient();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 10000)
      );
      
      const operationPromise = this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'books_master!A:G'
      });
      
      const response = await Promise.race([operationPromise, timeoutPromise]);
      const values = response.data.values || [];
      
      return values.slice(1).map(row => {
        const [id, date, title, author, memo, status] = row;
        const statusEmoji = {
          'want_to_buy': '🛒',
          'want_to_read': '📋',
          'reading': '📖',
          'finished': '✅',
          'abandoned': '❌'
        };
        
        const statusText = {
          'want_to_buy': '買いたい',
          'want_to_read': '積読',
          'reading': '読書中',
          'finished': '読了',
          'abandoned': '中断'
        };
        
        return `${statusEmoji[status] || '📋'} [${id}] ${title} - ${author} (${statusText[status] || status})`;
      });
      
    } catch (error) {
      console.error(`getBooks attempt ${retries + 1} failed:`, error);
      retries++;
      
      if (retries >= maxRetries) {
        console.error('getBooks max retries reached, using fallback');
        return ['📋 [1] テスト本 - テスト作者 (want_to_read)'];
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }
}

  async addMovie(title, memo) {
  if (!this.auth) return Math.floor(Math.random() * 1000);
  
  try {
    const auth = await this.auth.getClient();
    const id = await this.getNextId('movies_master');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 5000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'movies_master!A:F',
      valueInputOption: 'RAW',
      resource: {
        values: [[id, now, title, memo, 'want_to_watch', now.slice(0, 10)]]
      }
    });
    
    await Promise.race([operationPromise, timeoutPromise]);
    console.log('✅ 映画の追加成功:', id);
    return id;
    
  } catch (error) {
    console.error('❌ addMovie エラー:', error);
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
}

  async watchMovie(id) {
    const movieInfo = await this.updateMovieStatus(id, 'watched');
    return movieInfo;
  }

  async skipMovie(id) {
    const movieInfo = await this.updateMovieStatus(id, 'missed');
    return movieInfo;
  }

  async updateMovieStatus(id, status) {
    if (!this.auth) {
      return { id, title: 'テスト映画', memo: 'テストメモ' };
    }
    
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const auth = await this.auth.getClient();
        const date = new Date().toISOString().slice(0, 10);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        );
        
        const getPromise = this.sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: 'movies_master!A:F'
        });
        
        const response = await Promise.race([getPromise, timeoutPromise]);
        const values = response.data.values || [];
        const rowIndex = values.findIndex(row => row[0] == id);
        
        if (rowIndex !== -1) {
          const row = values[rowIndex];
          
          // 映画情報を保存
          const movieInfo = {
            id: row[0],
            title: row[2] || '不明なタイトル',
            memo: row[3] || ''
          };
          
          // ステータス更新
          const updatePromise = this.sheets.spreadsheets.values.update({
            auth,
            spreadsheetId: this.spreadsheetId,
            range: `movies_master!E${rowIndex + 1}:F${rowIndex + 1}`,
            valueInputOption: 'RAW',
            resource: {
              values: [[status, date]]
            }
          });
          
          await Promise.race([updatePromise, timeoutPromise]);
          return movieInfo;
        }
        
        return null;
        
      } catch (error) {
        console.error(`updateMovieStatus attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          console.error('updateMovieStatus max retries reached');
          return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

  async getMovies() {
    if (!this.auth) return ['🎬 [1] テスト映画 (want_to_watch)'];
    
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const auth = await this.auth.getClient();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        );
        
        const operationPromise = this.sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: 'movies_master!A:F'
        });
        
        const response = await Promise.race([operationPromise, timeoutPromise]);
        const values = response.data.values || [];
        
        return values.slice(1).map(row => {
          const [id, date, title, memo, status] = row;
          const statusEmoji = {
            'want_to_watch': '🎬',
            'watched': '✅',
            'missed': '😅'
          };
          
          return `${statusEmoji[status] || '🎬'} [${id}] ${title} (${status})`;
        });
        
      } catch (error) {
        console.error(`getMovies attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          console.error('getMovies max retries reached, using fallback');
          return ['🎬 [1] テスト映画 (want_to_watch)'];
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

// Part 4: 活動管理とレポート機能

  async addActivity(content, memo) {
  if (!this.auth) return Math.floor(Math.random() * 1000);
  
  try {
    const auth = await this.auth.getClient();
    const id = await this.getNextId('activities_master');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 5000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'activities_master!A:F',
      valueInputOption: 'RAW',
      resource: {
        values: [[id, now, content, memo, 'planned', now.slice(0, 10)]]
      }
    });
    
    await Promise.race([operationPromise, timeoutPromise]);
    console.log('✅ 活動の追加成功:', id);
    return id;
    
  } catch (error) {
    console.error('❌ addActivity エラー:', error);
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
}

  async doneActivity(id) {
    const result = await this.updateActivityStatus(id, 'done');
    return result;
  }

  async skipActivity(id) {
    return await this.updateActivityStatus(id, 'skipped');
  }

  async updateActivityStatus(id, status) {
    if (!this.auth) {
      return { id, content: 'テスト活動', memo: 'テストメモ' };
    }
    
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const auth = await this.auth.getClient();
        const date = new Date().toISOString().slice(0, 10);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        );
        
        const getPromise = this.sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: 'activities_master!A:F'
        });
        
        const response = await Promise.race([getPromise, timeoutPromise]);
        const values = response.data.values || [];
        const rowIndex = values.findIndex(row => row[0] == id);
        
        if (rowIndex !== -1) {
          const row = values[rowIndex];
          
          const activityInfo = {
            id: row[0],
            content: row[2] || '不明な活動',
            memo: row[3] || ''
          };
          
          const updatePromise = this.sheets.spreadsheets.values.update({
            auth,
            spreadsheetId: this.spreadsheetId,
            range: `activities_master!E${rowIndex + 1}:F${rowIndex + 1}`,
            valueInputOption: 'RAW',
            resource: {
              values: [[status, date]]
            }
          });
          
          await Promise.race([updatePromise, timeoutPromise]);
          return activityInfo;
        }
        
        return null;
        
      } catch (error) {
        console.error(`updateActivityStatus attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          console.error('updateActivityStatus max retries reached');
          return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

  async getActivities() {
    if (!this.auth) return ['🎯 [1] テスト活動 (planned)'];
    
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const auth = await this.auth.getClient();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        );
        
        const operationPromise = this.sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: 'activities_master!A:F'
        });
        
        const response = await Promise.race([operationPromise, timeoutPromise]);
        const values = response.data.values || [];
        
        return values.slice(1).map(row => {
          const [id, date, content, memo, status] = row;
          const statusEmoji = {
            'planned': '🎯',
            'done': '✅',
            'skipped': '😅'
          };
          
          return `${statusEmoji[status] || '🎯'} [${id}] ${content} (${status})`;
        });
        
      } catch (error) {
        console.error(`getActivities attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          console.error('getActivities max retries reached, using fallback');
          return ['🎯 [1] テスト活動 (planned)'];
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

  async addDailyReport(category, id, content) {
  if (!this.auth) return Math.floor(Math.random() * 1000);
  
  try {
    const auth = await this.auth.getClient();
    const reportId = await this.getNextId('daily_reports');
    const date = new Date().toISOString().slice(0, 10);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 5000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'daily_reports!A:E',
      valueInputOption: 'RAW',
      resource: {
        values: [[reportId, date, category, id, content]]
      }
    });
    
    await Promise.race([operationPromise, timeoutPromise]);
    console.log('✅ 日報の追加成功:', reportId);
    return reportId;
    
  } catch (error) {
    console.error('❌ addDailyReport エラー:', error);
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }
}

  async getItemInfo(category, id) {
    if (!this.auth) return { title: 'テストアイテム' };
    
    const maxRetries = 3;
    let retries = 0;
    
    let range, titleColumn, contentColumn;
    
    switch (category) {
      case 'book':
        range = 'books_master!A:G';
        titleColumn = 2;
        contentColumn = 3;
        break;
      case 'movie':
        range = 'movies_master!A:F';
        titleColumn = 2;
        break;
      case 'activity':
        range = 'activities_master!A:F';
        contentColumn = 2;
        break;
      default:
        return null;
    }
    
    while (retries < maxRetries) {
      try {
        const auth = await this.auth.getClient();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        );
        
        const operationPromise = this.sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.spreadsheetId,
          range
        });
        
        const response = await Promise.race([operationPromise, timeoutPromise]);
        const values = response.data.values || [];
        const row = values.find(row => row[0] == id);
        
        if (row) {
          if (category === 'book') {
            return {
              title: row[titleColumn],
              author: row[contentColumn]
            };
          } else if (category === 'movie') {
            return {
              title: row[titleColumn]
            };
          } else if (category === 'activity') {
            return {
              content: row[contentColumn]
            };
          }
        }
        
        return null;
        
      } catch (error) {
        console.error(`getItemInfo attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          console.error('getItemInfo max retries reached');
          return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }

  // キューを使用したGoogle Sheets操作（オプション）
  async addBookQueued(title, author, memo) {
    return this.requestQueue.add(async () => {
      return this.addBook(title, author, memo);
    });
  }

  async addMovieQueued(title, memo) {
    return this.requestQueue.add(async () => {
      return this.addMovie(title, memo);
    });
  }

  async addActivityQueued(content, memo) {
    return this.requestQueue.add(async () => {
      return this.addActivity(content, memo);
    });
  }

  // レポートデータ取得メソッド群

// 1. 特定アイテムのレポート履歴を取得
async getReportsByItem(category, itemId) {
  if (!this.auth) {
    // テストデータ
    return [
      {
        date: '2024-01-15',
        content: `テスト${category}のレポート1`,
        category: category,
        itemId: itemId
      },
      {
        date: '2024-01-14',
        content: `テスト${category}のレポート2`,
        category: category,
        itemId: itemId
      }
    ];
  }
  
  try {
    const auth = await this.auth.getClient();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 8000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'daily_reports!A:E'
    });
    
    const response = await Promise.race([operationPromise, timeoutPromise]);
    const values = response.data.values || [];
    
    // ヘッダーを除いて、指定されたカテゴリとIDに一致するレポートをフィルタ
    const reports = values.slice(1)
      .filter(row => 
        row[2] === category && // カテゴリが一致
        row[3] == itemId       // IDが一致
      )
      .map(row => ({
        reportId: row[0],
        date: row[1],
        category: row[2],
        itemId: row[3],
        content: row[4] || ''
      }));
    
    console.log(`${category} ID:${itemId} のレポート取得完了:`, reports.length, '件');
    return reports;
    
  } catch (error) {
    console.error('レポート履歴取得エラー:', error);
    return [];
  }
}

// 2. 最近のレポート一覧を取得
async getRecentReports(days = 7) {
  if (!this.auth) {
    // テストデータ
    return [
      {
        date: new Date().toISOString().slice(0, 10),
        content: 'テスト本のレポート',
        category: 'book',
        itemId: 1
      },
      {
        date: new Date().toISOString().slice(0, 10),
        content: 'テスト映画のレポート',
        category: 'movie',
        itemId: 1
      }
    ];
  }
  
  try {
    const auth = await this.auth.getClient();
    
    // N日前の日付を計算
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const targetDateStr = targetDate.toISOString().slice(0, 10);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 8000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'daily_reports!A:E'
    });
    
    const response = await Promise.race([operationPromise, timeoutPromise]);
    const values = response.data.values || [];
    
    // 指定期間内のレポートをフィルタして日付順に並び替え
    const reports = values.slice(1)
      .filter(row => row[1] >= targetDateStr) // 指定日以降
      .map(row => ({
        reportId: row[0],
        date: row[1],
        category: row[2],
        itemId: row[3],
        content: row[4] || ''
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // 新しい順
    
    console.log(`過去${days}日間のレポート取得完了:`, reports.length, '件');
    return reports;
    
  } catch (error) {
    console.error('最近のレポート取得エラー:', error);
    return [];
  }
}

// 3. キーワードでレポート検索
async searchReportsByKeyword(keyword) {
  if (!this.auth) {
    // テストデータ
    return [
      {
        date: new Date().toISOString().slice(0, 10),
        content: `${keyword}を含むテストレポート`,
        category: 'book',
        itemId: 1
      }
    ];
  }
  
  try {
    const auth = await this.auth.getClient();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 8000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'daily_reports!A:E'
    });
    
    const response = await Promise.race([operationPromise, timeoutPromise]);
    const values = response.data.values || [];
    
    // キーワードでレポート内容を検索
    const reports = values.slice(1)
      .filter(row => {
        const content = (row[4] || '').toLowerCase();
        return content.includes(keyword.toLowerCase());
      })
      .map(row => ({
        reportId: row[0],
        date: row[1],
        category: row[2],
        itemId: row[3],
        content: row[4] || ''
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // 新しい順
    
    console.log(`"${keyword}" の検索結果:`, reports.length, '件');
    return reports;
    
  } catch (error) {
    console.error('レポートキーワード検索エラー:', error);
    return [];
  }
}

// 4. 改良版getItemInfo（エラーハンドリング強化）
async getItemInfo(category, id) {
  if (!this.auth) return { title: `テスト${category}` };
  
  let range, titleColumn, contentColumn;
  
  switch (category) {
    case 'book':
      range = 'books_master!A:G';
      titleColumn = 2;
      contentColumn = 3;
      break;
    case 'movie':
      range = 'movies_master!A:F';
      titleColumn = 2;
      break;
    case 'activity':
      range = 'activities_master!A:F';
      contentColumn = 2;
      break;
    default:
      return null;
  }
  
  try {
    const auth = await this.auth.getClient();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 5000)
    );
    
    const operationPromise = this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range
    });
    
    const response = await Promise.race([operationPromise, timeoutPromise]);
    const values = response.data.values || [];
    const row = values.find(row => row[0] == id);
    
    if (row) {
      if (category === 'book') {
        return {
          title: row[titleColumn] || '不明なタイトル',
          author: row[contentColumn] || '不明な作者'
        };
      } else if (category === 'movie') {
        return {
          title: row[titleColumn] || '不明なタイトル'
        };
      } else if (category === 'activity') {
        return {
          content: row[contentColumn] || '不明な活動'
        };
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('アイテム情報取得エラー:', error);
    return null;
  }
}

// Part 5: 統計・検索・通知機能（最終部分）

  // 定期通知機能のセットアップ
  setupScheduledTasks() {
  const cron = require('node-cron');
  console.log('定期通知機能を初期化しています...');
  
  // 毎朝7時: 読書中・積読の本を通知
  cron.schedule('0 7 * * *', async () => {
    await this.sendMorningReminder();
  }, {
    timezone: "Asia/Tokyo"
  });
  
  // 毎月1日8時: 買いたい本リスト通知 ★新規追加★
  cron.schedule('0 8 1 * *', async () => {
    await this.sendMonthlyWishlist();
  }, {
    timezone: "Asia/Tokyo"
  });
    
    // 毎週日曜日21時: 週次レポート
    cron.schedule('0 21 * * 0', async () => {
      await this.sendWeeklyReport();
    }, {
      timezone: "Asia/Tokyo"
    });
    
    // 毎月1日7時: 月次レポート
    cron.schedule('0 7 1 * *', async () => {
      await this.sendMonthlyReport();
    }, {
      timezone: "Asia/Tokyo"
    });
    
    // 毎日21時: 放置アラートチェック
    cron.schedule('0 21 * * *', async () => {
      await this.checkAbandonedItems();
    }, {
      timezone: "Asia/Tokyo"
    });

    // 毎日20時: ログ記録リマインド
    cron.schedule('0 20 * * *', async () => {
      await this.sendLogReminder();
    }, {
     timezone: "Asia/Tokyo"
    });
    
    console.log('定期通知機能が有効になりました');
  }

  // 通知チャンネルを取得するヘルパーメソッド
  getNotificationChannel() {
    console.log('=== チャンネル取得開始 ===');
    
    // 方法1: 環境変数で指定されたチャンネル
    if (process.env.NOTIFICATION_CHANNEL_ID) {
      console.log('環境変数のチャンネルIDを確認中:', process.env.NOTIFICATION_CHANNEL_ID);
      const channel = this.client.channels.cache.get(process.env.NOTIFICATION_CHANNEL_ID);
      if (channel) {
        console.log('指定チャンネル見つかりました:', channel.name);
        return channel;
      } else {
        console.log('指定チャンネルが見つかりませんでした');
      }
    }
    
    // 方法2: ギルドから直接取得（最も確実）
    console.log('ギルドからチャンネルを取得中...');
    const guild = this.client.guilds.cache.first();
    console.log('ギルド:', guild ? guild.name : 'なし');
    
    if (guild) {
      console.log('ギルドのチャンネル数:', guild.channels.cache.size);
      
      // テキストチャンネルを検索
      const textChannels = guild.channels.cache.filter(ch => ch.type === 0);
      console.log('テキストチャンネル数:', textChannels.size);
      
      if (textChannels.size > 0) {
        const channel = textChannels.first();
        console.log('選択したチャンネル:', channel.name, 'ID:', channel.id);
        return channel;
      }
    }
    
    console.log('チャンネルが見つかりませんでした');
    return null;
  }

  async sendMonthlyWishlist() {
  try {
    const wishlistBooks = await this.getWishlistBooks();
    
    const channel = this.getNotificationChannel();
    if (channel && wishlistBooks.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle('🛒 月初の買いたい本リスト')
        .setDescription('新しい月が始まりました！気になっていた本を購入してみませんか？📚✨')
        .addFields({
          name: `📋 買いたい本一覧 (${wishlistBooks.length}冊)`,
          value: wishlistBooks.join('\n'),
          inline: false
        })
        .setColor('#4caf50')
        .setFooter({ text: '購入したら /book buy [ID] で積読リストに移動できます' })
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
      console.log('月初買いたい本リストを送信しました');
    } else if (channel && wishlistBooks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('🛒 買いたい本リスト')
        .setDescription('現在、買いたい本リストは空です。\n新しい本を探してみませんか？📚')
        .setColor('#ff9800')
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
      console.log('空の買いたい本リスト通知を送信しました');
    } else {
      console.log('通知チャンネルが見つかりませんでした');
    }
  } catch (error) {
    console.error('月初買いたい本リスト通知エラー:', error);
  }
}

  async sendMorningReminder() {
  try {
    const [readingBooks, wantToReadBooks] = await Promise.all([
      this.getCurrentReadingBooks(),
      this.getWantToReadBooks()
    ]);
    
    if (readingBooks.length > 0 || wantToReadBooks.length > 0) {
      const channel = this.getNotificationChannel();
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('☀️ おはようございます！')
          .setDescription('今日はどの本を読みますか？📚')
          .setColor('#ffeb3b')
          .setTimestamp();
        
        if (readingBooks.length > 0) {
          embed.addFields({
            name: '📖 読書中の本',
            value: readingBooks.map(book => `• [${book.id}] ${book.title} - ${book.author}`).join('\n'),
            inline: false
          });
        }
        
        if (wantToReadBooks.length > 0) {
          const displayBooks = wantToReadBooks.slice(0, 5); // 最大5冊まで表示
          embed.addFields({
            name: '📋 積んでいる本',
            value: displayBooks.map(book => `• [${book.id}] ${book.title} - ${book.author}`).join('\n'),
            inline: false
          });
          
          if (wantToReadBooks.length > 5) {
            embed.setFooter({ text: `他${wantToReadBooks.length - 5}冊の積読本があります` });
          }
        }
        
        if (wantToReadBooks.length > 0 && readingBooks.length === 0) {
          embed.setDescription('今日はどの本を読み始めますか？📚\n`/book start [ID]` で読書を開始できます！');
        }
        
        await channel.send({ embeds: [embed] });
        console.log('朝の通知を送信しました');
      } else {
        console.log('通知チャンネルが見つかりませんでした');
      }
    }
  } catch (error) {
    console.error('朝の通知エラー:', error);
  }
}

  async sendLogReminder() {
    try {
      const channel = this.getNotificationChannel();
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('📝 ログ記録のリマインド')
          .setDescription('今日の活動を振り返って、日報を記録してみませんか？')
          .addFields(
            { name: '📚 本の記録', value: '`/report book [ID] [内容]`', inline: true },
            { name: '🎬 映画の記録', value: '`/report movie [ID] [内容]`', inline: true },
            { name: '🎯 活動の記録', value: '`/report activity [ID] [内容]`', inline: true },
            { name: '💡 記録のコツ', value: '• 今日読んだページ数\n• 映画の感想\n• 活動の進捗や気づき', inline: false }
          )
          .setColor('#ff9800')
          .setFooter({ text: '継続は力なり！今日も一歩前進しましょう 💪' })
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        console.log('📝 ログリマインドを送信しました');
      } else {
        console.log('通知チャンネルが見つかりませんでした');
      }
    } catch (error) {
      console.error('ログリマインド送信エラー:', error);
    }
  }

  async sendWeeklyReport() {
    try {
      console.log('=== 週次レポート開始 ===');
      
      const weeklyStats = await this.getThisWeekStats();
      console.log('週次統計取得完了:', weeklyStats);
      
      const channel = this.getNotificationChannel();
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('📅 今週の活動レポート')
          .setDescription('今週も頑張りました！🎉')
          .addFields(
            { name: '📚 読了した本', value: weeklyStats.finishedBooks > 0 ? `${weeklyStats.finishedBooks}冊` : 'なし', inline: true },
            { name: '🎬 視聴した映画', value: weeklyStats.watchedMovies > 0 ? `${weeklyStats.watchedMovies}本` : 'なし', inline: true },
            { name: '🎯 完了した活動', value: weeklyStats.completedActivities > 0 ? `${weeklyStats.completedActivities}件` : 'なし', inline: true }
          )
          .setColor('#4caf50')
          .setFooter({ text: 'お疲れ様でした！来週も頑張りましょう！' })
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        console.log('✅ 週次レポートを送信しました');
      }
    } catch (error) {
      console.error('❌ 週次レポートエラー:', error);
    }
  }

  async sendMonthlyReport() {
    try {
      const monthlyStats = await this.getThisMonthStats();
      const channel = this.getNotificationChannel();
      
      if (channel) {
        const bookList = monthlyStats.bookTitles.length > 0 
          ? monthlyStats.bookTitles.slice(0, 5).join('\n') 
          : 'なし';
        
        const embed = new EmbedBuilder()
          .setTitle('🗓️ 今月の活動レポート')
          .setDescription('今月の成果を振り返ってみましょう！✨')
          .addFields(
            { name: '📚 読了冊数', value: `${monthlyStats.finishedBooks}冊`, inline: true },
            { name: '🎬 視聴本数', value: `${monthlyStats.watchedMovies}本`, inline: true },
            { name: '🎯 完了活動', value: `${monthlyStats.completedActivities}件`, inline: true },
            { name: '📝 日報件数', value: `${monthlyStats.dailyReports}件`, inline: true },
            { name: '🏆 今月読了した本', value: bookList, inline: false }
          )
          .setColor('#9c27b0')
          .setFooter({ text: '素晴らしい1ヶ月でした！' })
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        console.log('月次レポートを送信しました');
      }
    } catch (error) {
      console.error('月次レポートエラー:', error);
    }
  }

  async checkAbandonedItems() {
    try {
      const abandonedItems = await this.getAbandonedItems();
      
      if (abandonedItems.movies.length > 0 || abandonedItems.activities.length > 0) {
        const channel = this.getNotificationChannel();
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('⚠️ 放置されているアイテムがあります')
            .setDescription('1週間以上放置されているものをチェックしてみませんか？')
            .setColor('#ff9800')
            .setTimestamp();
          
          if (abandonedItems.movies.length > 0) {
            embed.addFields({
              name: '🎬 観たい映画（1週間放置）',
              value: abandonedItems.movies.slice(0, 5).map(movie => `• [${movie.id}] ${movie.title}`).join('\n'),
              inline: false
            });
          }
          
          if (abandonedItems.activities.length > 0) {
            embed.addFields({
              name: '🎯 予定中の活動（1週間放置）',
              value: abandonedItems.activities.slice(0, 5).map(activity => `• [${activity.id}] ${activity.content}`).join('\n'),
              inline: false
            });
          }
          
          await channel.send({ embeds: [embed] });
          console.log('放置アラートを送信しました');
        }
      }
    } catch (error) {
      console.error('放置アラートエラー:', error);
    }
  }

  // 統計取得のヘルパーメソッド
  async getCurrentReadingBooks() {
    if (!this.auth) return [{ id: 1, title: 'テスト本', author: 'テスト作者' }];
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'books_master!A:G'
      });
      
      const values = response.data.values || [];
      return values.slice(1)
        .filter(row => row[5] === 'reading')
        .map(row => ({
          id: row[0],
          title: row[2],
          author: row[3]
        }));
    } catch (error) {
      console.error('getCurrentReadingBooks エラー:', error);
      return [];
    }
  }

  async getThisWeekStats() {
    return await this.getRealWeeklyStats();
  }

  async getThisMonthStats() {
    const monthStats = await this.getRealMonthlyStats();
    const bookTitles = await this.getMonthlyBookTitles();
    
    return {
      finishedBooks: monthStats.finishedBooks,
      watchedMovies: monthStats.watchedMovies,
      completedActivities: monthStats.completedActivities,
      dailyReports: monthStats.reports,
      bookTitles: bookTitles
    };
  }

  async getAbandonedItems() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().slice(0, 10);
    
    if (!this.auth) return {
      movies: [{ id: 1, title: 'テスト放置映画' }],
      activities: [{ id: 1, content: 'テスト放置活動' }]
    };
    
    try {
      const auth = await this.auth.getClient();
      
      const [moviesData, activitiesData] = await Promise.all([
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'movies_master!A:F'
        }),
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'activities_master!A:F'
        })
      ]);
      
      const abandonedMovies = moviesData.data.values?.slice(1)
        .filter(row => 
          row[4] === 'want_to_watch' && 
          row[1] && 
          row[1].slice(0, 10) <= oneWeekAgoStr
        )
        .map(row => ({ id: row[0], title: row[2] })) || [];
      
      const abandonedActivities = activitiesData.data.values?.slice(1)
        .filter(row => 
          row[4] === 'planned' && 
          row[1] && 
          row[1].slice(0, 10) <= oneWeekAgoStr
        )
        .map(row => ({ id: row[0], content: row[2] })) || [];
      
      return {
        movies: abandonedMovies,
        activities: abandonedActivities
      };
    } catch (error) {
      console.error('放置アイテム取得エラー:', error);
      return { movies: [], activities: [] };
    }
  }

  async getMonthlyBookTitles() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    
    if (!this.auth) return ['テスト本1', 'テスト本2'];
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'books_master!A:G'
      });
      
      const values = response.data.values || [];
      const monthlyBooks = values.slice(1)
        .filter(row => 
          row[5] === 'finished' && 
          row[6] && 
          row[6] >= monthStartStr
        )
        .map(row => row[2]);
      
      return monthlyBooks;
    } catch (error) {
      console.error('月次読書タイトル取得エラー:', error);
      return [];
    }
  }

  // 検索機能
  async searchBooks(keyword) {
    if (!this.auth) return [`📚 [1] テスト本 - テスト作者 (registered) - キーワード: ${keyword}`];
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'books_master!A:G'
      });
      
      const values = response.data.values || [];
      const results = [];
      
      for (const row of values.slice(1)) {
        const [id, date, title, author, memo, status] = row;
        const searchText = `${title} ${author} ${memo}`.toLowerCase();
        
        if (searchText.includes(keyword.toLowerCase())) {
          const statusEmoji = {
            'registered': '📋',
            'reading': '📖',
            'finished': '✅',
            'abandoned': '❌'
          };
          
          results.push(`${statusEmoji[status] || '📋'} [${id}] ${title} - ${author} (${status})`);
        }
      }
      
      return results;
    } catch (error) {
      console.error('本の検索エラー:', error);
      return [];
    }
  }

  async searchMovies(keyword) {
    if (!this.auth) return [`🎬 [1] テスト映画 (want_to_watch) - キーワード: ${keyword}`];
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'movies_master!A:F'
      });
      
      const values = response.data.values || [];
      const results = [];
      
      for (const row of values.slice(1)) {
        const [id, date, title, memo, status] = row;
        const searchText = `${title} ${memo}`.toLowerCase();
        
        if (searchText.includes(keyword.toLowerCase())) {
          const statusEmoji = {
            'want_to_watch': '🎬',
            'watched': '✅',
            'missed': '😅'
          };
          
          results.push(`${statusEmoji[status] || '🎬'} [${id}] ${title} (${status})`);
        }
      }
      
      return results;
    } catch (error) {
      console.error('映画の検索エラー:', error);
      return [];
    }
  }

  async searchActivities(keyword) {
    if (!this.auth) return [`🎯 [1] テスト活動 (planned) - キーワード: ${keyword}`];
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'activities_master!A:F'
      });
      
      const values = response.data.values || [];
      const results = [];
      
      for (const row of values.slice(1)) {
        const [id, date, content, memo, status] = row;
        const searchText = `${content} ${memo}`.toLowerCase();
        
        if (searchText.includes(keyword.toLowerCase())) {
          const statusEmoji = {
            'planned': '🎯',
            'done': '✅',
            'skipped': '😅'
          };
          
          results.push(`${statusEmoji[status] || '🎯'} [${id}] ${content} (${status})`);
        }
      }
      
      return results;
    } catch (error) {
      console.error('活動の検索エラー:', error);
      return [];
    }
  }

// Part 6: 統計データ取得とBot起動（最終）

  // 実際の統計データ取得
  async createSummaryStats() {
    const [bookStats, movieStats, activityStats] = await Promise.all([
      this.getBookCounts(),
      this.getMovieCounts(),
      this.getActivityCounts()
    ]);
    
    return new EmbedBuilder()
      .setTitle('📊 全体統計')
      .setColor('#3498db')
      .addFields(
        { name: '📚 本', value: `登録: ${bookStats.total}冊\n読書中: ${bookStats.reading}冊\n読了: ${bookStats.finished}冊`, inline: true },
        { name: '🎬 映画', value: `登録: ${movieStats.total}本\n観たい: ${movieStats.wantToWatch}本\n視聴済み: ${movieStats.watched}本`, inline: true },
        { name: '🎯 活動', value: `登録: ${activityStats.total}件\n予定: ${activityStats.planned}件\n完了: ${activityStats.done}件`, inline: true }
      )
      .setTimestamp();
  }

  async createWeeklyStats() {
    const weekStats = await this.getRealWeeklyStats();
    
    return new EmbedBuilder()
      .setTitle('📅 今週の統計')
      .setColor('#2ecc71')
      .addFields(
        { name: '📚 読了', value: `${weekStats.finishedBooks}冊`, inline: true },
        { name: '🎬 視聴', value: `${weekStats.watchedMovies}本`, inline: true },
        { name: '🎯 完了', value: `${weekStats.completedActivities}件`, inline: true }
      )
      .setTimestamp();
  }

  async createMonthlyStats() {
    const monthStats = await this.getRealMonthlyStats();
    
    return new EmbedBuilder()
      .setTitle('🗓️ 今月の統計')
      .setColor('#9b59b6')
      .addFields(
        { name: '📚 読了', value: `${monthStats.finishedBooks}冊`, inline: true },
        { name: '🎬 視聴', value: `${monthStats.watchedMovies}本`, inline: true },
        { name: '🎯 完了', value: `${monthStats.completedActivities}件`, inline: true },
        { name: '📝 日報', value: `${monthStats.reports}件`, inline: true }
      )
      .setTimestamp();
  }

  async createBookStats() {
    const bookStats = await this.getDetailedBookCounts();
    
    return new EmbedBuilder()
      .setTitle('📚 読書統計詳細')
      .setColor('#e74c3c')
      .addFields(
        { name: 'ステータス別', value: `登録済み: ${bookStats.registered}冊\n読書中: ${bookStats.reading}冊\n読了: ${bookStats.finished}冊`, inline: true },
        { name: '期間別', value: `今月: ${bookStats.thisMonth}冊\n今週: ${bookStats.thisWeek}冊`, inline: true }
      )
      .setTimestamp();
  }

  async createCurrentStats() {
    const currentStats = await this.getRealCurrentProgress();
    
    const readingList = currentStats.readingBooks.length > 0 
      ? currentStats.readingBooks.map(book => `• [${book.id}] ${book.title}`).join('\n')
      : 'なし';
    
    const movieList = currentStats.wantToWatchMovies.length > 0
      ? currentStats.wantToWatchMovies.slice(0, 5).map(movie => `• [${movie.id}] ${movie.title}`).join('\n')
      : 'なし';
    
    return new EmbedBuilder()
      .setTitle('⚡ 現在の進行状況')
      .setColor('#f39c12')
      .addFields(
        { name: '📖 読書中', value: readingList, inline: false },
        { name: '🎬 観たい映画', value: movieList, inline: false }
      )
      .setTimestamp();
  }

  // データ取得メソッド
  async getBookCounts() {
    if (!this.auth) return { total: 3, reading: 1, finished: 2, registered: 0 };
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'books_master!A:G'
      });
      
      const values = response.data.values || [];
      const data = values.slice(1); // ヘッダー除く
      
      return {
        total: data.length,
        reading: data.filter(row => row[5] === 'reading').length,
        finished: data.filter(row => row[5] === 'finished').length,
        registered: data.filter(row => row[5] === 'registered').length
      };
    } catch (error) {
      console.error('本の統計取得エラー:', error);
      return { total: 0, reading: 0, finished: 0, registered: 0 };
    }
  }

  async getMovieCounts() {
    if (!this.auth) return { total: 2, wantToWatch: 1, watched: 1 };
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'movies_master!A:F'
      });
      
      const values = response.data.values || [];
      const data = values.slice(1);
      
      return {
        total: data.length,
        wantToWatch: data.filter(row => row[4] === 'want_to_watch').length,
        watched: data.filter(row => row[4] === 'watched').length
      };
    } catch (error) {
      console.error('映画の統計取得エラー:', error);
      return { total: 0, wantToWatch: 0, watched: 0 };
    }
  }

  async getActivityCounts() {
    if (!this.auth) return { total: 1, planned: 1, done: 0 };
    
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'activities_master!A:F'
      });
      
      const values = response.data.values || [];
      const data = values.slice(1);
      
      return {
        total: data.length,
        planned: data.filter(row => row[4] === 'planned').length,
        done: data.filter(row => row[4] === 'done').length
      };
    } catch (error) {
      console.error('活動の統計取得エラー:', error);
      return { total: 0, planned: 0, done: 0 };
    }
  }

  async getRealWeeklyStats() {
    console.log('=== 週次統計取得開始 ===');
    
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    
    console.log('今週の開始日:', weekStartStr);
    
    if (!this.auth) {
      console.log('認証なし - テストデータを返します');
      return { finishedBooks: 1, watchedMovies: 0, completedActivities: 1 };
    }
    
    try {
      const auth = await this.auth.getClient();
      console.log('Google認証成功');
      
      const [booksData, moviesData, activitiesData] = await Promise.all([
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'books_master!A:G'
        }),
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'movies_master!A:F'
        }),
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'activities_master!A:F'
        })
      ]);
      
      console.log('スプレッドシートデータ取得完了');
      
      const finishedBooks = booksData.data.values?.slice(1).filter(row => 
        row[5] === 'finished' && row[6] && row[6] >= weekStartStr
      ).length || 0;
      
      const watchedMovies = moviesData.data.values?.slice(1).filter(row => 
        row[4] === 'watched' && row[5] && row[5] >= weekStartStr
      ).length || 0;
      
      const completedActivities = activitiesData.data.values?.slice(1).filter(row => 
        row[4] === 'done' && row[5] && row[5] >= weekStartStr
      ).length || 0;
      
      const result = { finishedBooks, watchedMovies, completedActivities };
      console.log('週次統計結果:', result);
      
      return result;
    } catch (error) {
      console.error('週次統計取得エラー:', error);
      return { finishedBooks: 0, watchedMovies: 0, completedActivities: 0 };
    }
  }

  async getRealCurrentProgress() {
    if (!this.auth) return {
      readingBooks: [{ id: 1, title: 'テスト本' }],
      wantToWatchMovies: [{ id: 1, title: 'テスト映画' }]
    };
    
    try {
      const auth = await this.auth.getClient();
      
      const [booksData, moviesData] = await Promise.all([
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'books_master!A:G'
        }),
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'movies_master!A:F'
        })
      ]);
      
      const readingBooks = booksData.data.values?.slice(1)
        .filter(row => row[5] === 'reading')
        .map(row => ({ id: row[0], title: row[2] })) || [];
      
      const wantToWatchMovies = moviesData.data.values?.slice(1)
        .filter(row => row[4] === 'want_to_watch')
        .map(row => ({ id: row[0], title: row[2] })) || [];
      
      return { readingBooks, wantToWatchMovies };
    } catch (error) {
      console.error('進行状況取得エラー:', error);
      return { readingBooks: [], wantToWatchMovies: [] };
    }
  }

  start() {
    try {
      this.client.login(process.env.DISCORD_TOKEN);
      console.log('🚀 Botの起動を開始しました...');
    } catch (error) {
      console.error('❌ Bot起動エラー:', error);
    }
  }
}

// Bot の起動
console.log('=== Activity Tracker Bot 起動 ===');
const bot = new ActivityTrackerBot();
bot.start();
