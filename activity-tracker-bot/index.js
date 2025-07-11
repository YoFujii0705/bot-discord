require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { google } = require('googleapis');

class ActivityTrackerBot {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      rest: { 
        timeout: 30000
      }
    });
    
    this.sheets = google.sheets({ version: 'v4' });
    
    // Google認証の設定
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
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
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
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
    
    // 本管理コマンド
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
            option.setName('memo').setDescription('備考').setRequired(false)))
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
        subcommand.setName('list').setDescription('本一覧'));

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

    console.log('定義されたコマンド:', commands.map(cmd => cmd.name));
    return commands;
  }

  async deployCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
      console.log('スラッシュコマンドの登録を開始しています...');
      
      // コマンドをJSON形式に変換
      const commandsData = this.commands.map(command => command.toJSON());
      
      // グローバルコマンドとして登録（全サーバーで利用可能）
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
    // Discord接続時の処理
    this.client.once('ready', async () => {
      console.log(`✅ ${this.client.user.tag} でログインしました！`);
      
      // コマンドを登録
      await this.deployCommands();
    });

    // インタラクション処理
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      try {
        const { commandName } = interaction;
        
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
          default:
            await interaction.reply({ content: '不明なコマンドです。', ephemeral: true });
        }
      } catch (error) {
        console.error('❌ コマンド実行エラー:', error);
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
          } catch (replyError) {
            console.error('❌ エラー応答の送信に失敗:', replyError);
          }
        }
      }
    });

    // エラーハンドリング
    this.client.on('error', error => {
      console.error('❌ Discord.js エラー:', error);
    });

    this.client.on('warn', info => {
      console.warn('⚠️ Discord.js 警告:', info);
    });
  }

  // 以下、すべてのハンドラーメソッドは元のコードと同じ
  async handleBookCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'add':
        const title = interaction.options.getString('title');
        const author = interaction.options.getString('author');
        const memo = interaction.options.getString('memo') || '';
        
        const bookId = await this.addBook(title, author, memo);
        await interaction.reply(`📚 本を追加しました！\nID: ${bookId}\nタイトル: ${title}\n作者: ${author}`);
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
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの本が見つかりませんでした。');
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
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの本が見つかりませんでした。');
        }
        break;
      
      case 'list':
        const books = await this.getBooks();
        const embed = new EmbedBuilder()
          .setTitle('📚 本一覧')
          .setColor('#0099ff')
          .setDescription(books.length > 0 ? books.join('\n') : '登録されている本はありません');
        
        await interaction.reply({ embeds: [embed] });
        break;
    }
  }

  async handleMovieCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'add':
        const title = interaction.options.getString('title');
        const memo = interaction.options.getString('memo') || '';
        
        const movieId = await this.addMovie(title, memo);
        await interaction.reply(`🎬 映画を追加しました！\nID: ${movieId}\nタイトル: ${title}`);
        break;
      
      case 'watch':
        const watchId = interaction.options.getInteger('id');
        const watchedMovie = await this.watchMovie(watchId);
        if (watchedMovie) {
          const embed = new EmbedBuilder()
            .setTitle('🎉 視聴完了！')
            .setColor('#00ff00')
            .addFields(
              { name: 'タイトル', value: watchedMovie.title, inline: true },
              { name: 'ID', value: watchedMovie.id.toString(), inline: true },
              { name: '備考', value: watchedMovie.memo || 'なし', inline: false }
            )
            .setDescription('🎬 視聴済みにしました！面白かったですか？✨')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの映画が見つかりませんでした。');
        }
        break;
      
      case 'skip':
        const skipId = interaction.options.getInteger('id');
        const skippedMovie = await this.skipMovie(skipId);
        if (skippedMovie) {
          const embed = new EmbedBuilder()
            .setTitle('😅 見逃してしまいました')
            .setColor('#ffa500')
            .addFields(
              { name: 'タイトル', value: skippedMovie.title, inline: true },
              { name: 'ID', value: skippedMovie.id.toString(), inline: true },
              { name: '備考', value: skippedMovie.memo || 'なし', inline: false }
            )
            .setDescription('😅 見逃してしまいましたね。また機会があったら見てみてください！')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの映画が見つかりませんでした。');
        }
        break;
      
      case 'list':
        const movies = await this.getMovies();
        const embed = new EmbedBuilder()
          .setTitle('🎬 映画一覧')
          .setColor('#ff6b6b')
          .setDescription(movies.length > 0 ? movies.join('\n') : '登録されている映画はありません');
        
        await interaction.reply({ embeds: [embed] });
        break;
    }
  }

  async handleActivityCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'add':
        const content = interaction.options.getString('content');
        const memo = interaction.options.getString('memo') || '';
        
        const activityId = await this.addActivity(content, memo);
        await interaction.reply(`🎯 活動を追加しました！\nID: ${activityId}\n内容: ${content}`);
        break;
      
      case 'done':
        const doneId = interaction.options.getInteger('id');
        const completedActivity = await this.doneActivity(doneId);
        if (completedActivity) {
          const embed = new EmbedBuilder()
            .setTitle('🎉 活動完了！')
            .setColor('#00ff00')
            .addFields(
              { name: '活動内容', value: completedActivity.content, inline: false },
              { name: 'ID', value: completedActivity.id.toString(), inline: true },
              { name: '備考', value: completedActivity.memo || 'なし', inline: false }
            )
            .setDescription('✅ 活動を完了しました！お疲れ様でした！🎉')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの活動が見つかりませんでした。');
        }
        break;
      
      case 'skip':
        const skipId = interaction.options.getInteger('id');
        const skippedActivity = await this.skipActivity(skipId);
        if (skippedActivity) {
          const embed = new EmbedBuilder()
            .setTitle('😅 やり逃してしまいました')
            .setColor('#ffa500')
            .addFields(
              { name: '活動内容', value: skippedActivity.content, inline: false },
              { name: 'ID', value: skippedActivity.id.toString(), inline: true },
              { name: '備考', value: skippedActivity.memo || 'なし', inline: false }
            )
            .setDescription('😅 今回は見送りましたね。また機会があればチャレンジしてみてください！')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの活動が見つかりませんでした。');
        }
        break;
      
      case 'list':
        const activities = await this.getActivities();
        const embed = new EmbedBuilder()
          .setTitle('🎯 活動一覧')
          .setColor('#4ecdc4')
          .setDescription(activities.length > 0 ? activities.join('\n') : '登録されている活動はありません');
        
        await interaction.reply({ embeds: [embed] });
        break;
    }
  }

  async handleReportCommand(interaction) {
    const category = interaction.options.getString('category');
    const id = interaction.options.getInteger('id');
    const content = interaction.options.getString('content');
    
    const targetInfo = await this.getItemInfo(category, id);
    
    await this.addDailyReport(category, id, content);
    
    if (targetInfo) {
      const categoryEmoji = {
        'book': '📚',
        'movie': '🎬', 
        'activity': '🎯'
      };
      
      const embed = new EmbedBuilder()
        .setTitle(`${categoryEmoji[category]} 日報を記録しました！`)
        .setColor('#9b59b6')
        .addFields(
          { name: '対象', value: targetInfo.title || targetInfo.content, inline: true },
          { name: 'カテゴリ', value: category === 'book' ? '本' : category === 'movie' ? '映画' : '活動', inline: true },
          { name: 'ID', value: id.toString(), inline: true },
          { name: '記録内容', value: content, inline: false }
        )
        .setDescription('今日も頑張りましたね！継続は力なりです✨')
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply(`📝 日報を記録しました！\n**内容:** ${content}\n今日も頑張りましたね✨`);
    }
  }

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
      
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('統計エラー:', error);
      await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    }
  }

  async handleSearchCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const keyword = interaction.options.getString('keyword');
    
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
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply(`🔍 "${keyword}" に一致するアイテムが見つかりませんでした。`);
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
      
      // 今週完了した本・映画・活動をカウント
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

  async getRealMonthlyStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    
    if (!this.auth) return { finishedBooks: 2, watchedMovies: 1, completedActivities: 1, reports: 5 };
    
    try {
      const auth = await this.auth.getClient();
      
      const [booksData, moviesData, activitiesData, reportsData] = await Promise.all([
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'books_master!A:G'
        }),
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'movies_master!A:F'
        }),
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'activities_master!A:F'
        }),
        this.sheets.spreadsheets.values.get({
          auth, spreadsheetId: this.spreadsheetId, range: 'daily_reports!A:E'
        })
      ]);
      
      const finishedBooks = booksData.data.values?.slice(1).filter(row => 
        row[5] === 'finished' && row[6] && row[6] >= monthStartStr
      ).length || 0;
      
      const watchedMovies = moviesData.data.values?.slice(1).filter(row => 
        row[4] === 'watched' && row[5] && row[5] >= monthStartStr
      ).length || 0;
      
      const completedActivities = activitiesData.data.values?.slice(1).filter(row => 
        row[4] === 'done' && row[5] && row[5] >= monthStartStr
      ).length || 0;
      
      const reports = reportsData.data.values?.slice(1).filter(row => 
        row[1] && row[1] >= monthStartStr
      ).length || 0;
      
      return { finishedBooks, watchedMovies, completedActivities, reports };
    } catch (error) {
      console.error('月次統計取得エラー:', error);
      return { finishedBooks: 0, watchedMovies: 0, completedActivities: 0, reports: 0 };
    }
  }

  async getDetailedBookCounts() {
    const baseStats = await this.getBookCounts();
    const weeklyStats = await this.getRealWeeklyStats();
    const monthlyStats = await this.getRealMonthlyStats();
    
    return {
      ...baseStats,
      thisWeek: weeklyStats.finishedBooks,
      thisMonth: monthlyStats.finishedBooks
    };
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
    this.client.login(process.env.DISCORD_TOKEN);
  }
}

// Bot の起動
const bot = new ActivityTrackerBot();
bot.start();require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { google } = require('googleapis');

class ActivityTrackerBot {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      rest: { 
        timeout: 30000
      }
    });
    
    this.sheets = google.sheets({ version: 'v4' });
    
    // Google認証の設定
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
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
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
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
    
    // 本管理コマンド
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
            option.setName('memo').setDescription('備考').setRequired(false)))
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
        subcommand.setName('list').setDescription('本一覧'));

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

    console.log('定義されたコマンド:', commands.map(cmd => cmd.name));
    return commands;
  }

  async deployCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
      console.log('スラッシュコマンドの登録を開始しています...');
      
      // コマンドをJSON形式に変換
      const commandsData = this.commands.map(command => command.toJSON());
      
      // グローバルコマンドとして登録（全サーバーで利用可能）
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
    // Discord接続時の処理
    this.client.once('ready', async () => {
      console.log(`✅ ${this.client.user.tag} でログインしました！`);
      
      // コマンドを登録
      await this.deployCommands();
    });

    // インタラクション処理
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      try {
        const { commandName } = interaction;
        
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
          default:
            await interaction.reply({ content: '不明なコマンドです。', ephemeral: true });
        }
      } catch (error) {
        console.error('❌ コマンド実行エラー:', error);
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
          } catch (replyError) {
            console.error('❌ エラー応答の送信に失敗:', replyError);
          }
        }
      }
    });

    // エラーハンドリング
    this.client.on('error', error => {
      console.error('❌ Discord.js エラー:', error);
    });

    this.client.on('warn', info => {
      console.warn('⚠️ Discord.js 警告:', info);
    });
  }

  // 以下、すべてのハンドラーメソッドは元のコードと同じ
  async handleBookCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'add':
        const title = interaction.options.getString('title');
        const author = interaction.options.getString('author');
        const memo = interaction.options.getString('memo') || '';
        
        const bookId = await this.addBook(title, author, memo);
        await interaction.reply(`📚 本を追加しました！\nID: ${bookId}\nタイトル: ${title}\n作者: ${author}`);
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
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの本が見つかりませんでした。');
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
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの本が見つかりませんでした。');
        }
        break;
      
      case 'list':
        const books = await this.getBooks();
        const embed = new EmbedBuilder()
          .setTitle('📚 本一覧')
          .setColor('#0099ff')
          .setDescription(books.length > 0 ? books.join('\n') : '登録されている本はありません');
        
        await interaction.reply({ embeds: [embed] });
        break;
    }
  }

  async handleMovieCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'add':
        const title = interaction.options.getString('title');
        const memo = interaction.options.getString('memo') || '';
        
        const movieId = await this.addMovie(title, memo);
        await interaction.reply(`🎬 映画を追加しました！\nID: ${movieId}\nタイトル: ${title}`);
        break;
      
      case 'watch':
        const watchId = interaction.options.getInteger('id');
        const watchedMovie = await this.watchMovie(watchId);
        if (watchedMovie) {
          const embed = new EmbedBuilder()
            .setTitle('🎉 視聴完了！')
            .setColor('#00ff00')
            .addFields(
              { name: 'タイトル', value: watchedMovie.title, inline: true },
              { name: 'ID', value: watchedMovie.id.toString(), inline: true },
              { name: '備考', value: watchedMovie.memo || 'なし', inline: false }
            )
            .setDescription('🎬 視聴済みにしました！面白かったですか？✨')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの映画が見つかりませんでした。');
        }
        break;
      
      case 'skip':
        const skipId = interaction.options.getInteger('id');
        const skippedMovie = await this.skipMovie(skipId);
        if (skippedMovie) {
          const embed = new EmbedBuilder()
            .setTitle('😅 見逃してしまいました')
            .setColor('#ffa500')
            .addFields(
              { name: 'タイトル', value: skippedMovie.title, inline: true },
              { name: 'ID', value: skippedMovie.id.toString(), inline: true },
              { name: '備考', value: skippedMovie.memo || 'なし', inline: false }
            )
            .setDescription('😅 見逃してしまいましたね。また機会があったら見てみてください！')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの映画が見つかりませんでした。');
        }
        break;
      
      case 'list':
        const movies = await this.getMovies();
        const embed = new EmbedBuilder()
          .setTitle('🎬 映画一覧')
          .setColor('#ff6b6b')
          .setDescription(movies.length > 0 ? movies.join('\n') : '登録されている映画はありません');
        
        await interaction.reply({ embeds: [embed] });
        break;
    }
  }

  async handleActivityCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'add':
        const content = interaction.options.getString('content');
        const memo = interaction.options.getString('memo') || '';
        
        const activityId = await this.addActivity(content, memo);
        await interaction.reply(`🎯 活動を追加しました！\nID: ${activityId}\n内容: ${content}`);
        break;
      
      case 'done':
        const doneId = interaction.options.getInteger('id');
        const completedActivity = await this.doneActivity(doneId);
        if (completedActivity) {
          const embed = new EmbedBuilder()
            .setTitle('🎉 活動完了！')
            .setColor('#00ff00')
            .addFields(
              { name: '活動内容', value: completedActivity.content, inline: false },
              { name: 'ID', value: completedActivity.id.toString(), inline: true },
              { name: '備考', value: completedActivity.memo || 'なし', inline: false }
            )
            .setDescription('✅ 活動を完了しました！お疲れ様でした！🎉')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの活動が見つかりませんでした。');
        }
        break;
      
      case 'skip':
        const skipId = interaction.options.getInteger('id');
        const skippedActivity = await this.skipActivity(skipId);
        if (skippedActivity) {
          const embed = new EmbedBuilder()
            .setTitle('😅 やり逃してしまいました')
            .setColor('#ffa500')
            .addFields(
              { name: '活動内容', value: skippedActivity.content, inline: false },
              { name: 'ID', value: skippedActivity.id.toString(), inline: true },
              { name: '備考', value: skippedActivity.memo || 'なし', inline: false }
            )
            .setDescription('😅 今回は見送りましたね。また機会があればチャレンジしてみてください！')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply('指定されたIDの活動が見つかりませんでした。');
        }
        break;
      
      case 'list':
        const activities = await this.getActivities();
        const embed = new EmbedBuilder()
          .setTitle('🎯 活動一覧')
          .setColor('#4ecdc4')
          .setDescription(activities.length > 0 ? activities.join('\n') : '登録されている活動はありません');
        
        await interaction.reply({ embeds: [embed] });
        break;
    }
  }

  async handleReportCommand(interaction) {
    const category = interaction.options.getString('category');
    const id = interaction.options.getInteger('id');
    const content = interaction.options.getString('content');
    
    const targetInfo = await this.getItemInfo(category, id);
    
    await this.addDailyReport(category, id, content);
    
    if (targetInfo) {
      const categoryEmoji = {
        'book': '📚',
        'movie': '🎬', 
        'activity': '🎯'
      };
      
      const embed = new EmbedBuilder()
        .setTitle(`${categoryEmoji[category]} 日報を記録しました！`)
        .setColor('#9b59b6')
        .addFields(
          { name: '対象', value: targetInfo.title || targetInfo.content, inline: true },
          { name: 'カテゴリ', value: category === 'book' ? '本' : category === 'movie' ? '映画' : '活動', inline: true },
          { name: 'ID', value: id.toString(), inline: true },
          { name: '記録内容', value: content, inline: false }
        )
        .setDescription('今日も頑張りましたね！継続は力なりです✨')
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply(`📝 日報を記録しました！\n**内容:** ${content}\n今日も頑張りましたね✨`);
    }
  }

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
      
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('統計エラー:', error);
      await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    }
  }

  async handleSearchCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const keyword = interaction.options.getString('keyword');
    
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
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply(`🔍 "${keyword}" に一致するアイテムが見つかりませんでした。`);
    }
  }

  // Google Sheets操作メソッド
  async getNextId(sheetName) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    const auth = await this.auth.getClient();
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:A`
    });
    
    const values = response.data.values || [];
    return values.length;
  }

  async addBook(title, author, memo) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    const auth = await this.auth.getClient();
    const id = await this.getNextId('books_master');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    await this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G',
      valueInputOption: 'RAW',
      resource: {
        values: [[id, now, title, author, memo, 'registered', '']]
      }
    });
    
    return id;
  }

  async startReading(id) {
    if (!this.auth) return { id, title: 'テスト本', author: 'テスト作者', memo: '' };
    
    const auth = await this.auth.getClient();
    const startDate = new Date().toISOString().slice(0, 10);
    
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G'
    });
    
    const values = response.data.values || [];
    const rowIndex = values.findIndex(row => row[0] == id);
    
    if (rowIndex !== -1) {
      await this.sheets.spreadsheets.values.update({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: `books_master!F${rowIndex + 1}:G${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [['reading', startDate]]
        }
      });
      
      const row = values[rowIndex];
      return {
        id: row[0],
        title: row[2],
        author: row[3],
        memo: row[4]
      };
    }
    
    return null;
  }

  async finishReading(id) {
    if (!this.auth) return { id, title: 'テスト本', author: 'テスト作者', memo: '' };
    
    const auth = await this.auth.getClient();
    const finishDate = new Date().toISOString().slice(0, 10);
    
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G'
    });
    
    const values = response.data.values || [];
    const rowIndex = values.findIndex(row => row[0] == id);
    
    if (rowIndex !== -1) {
      await this.sheets.spreadsheets.values.update({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: `books_master!F${rowIndex + 1}:G${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [['finished', finishDate]]
        }
      });
      
      const row = values[rowIndex];
      return {
        id: row[0],
        title: row[2],
        author: row[3],
        memo: row[4]
      };
    }
    
    return null;
  }

  async getBooks() {
    if (!this.auth) return ['📋 [1] テスト本 - テスト作者 (registered)'];
    
    const auth = await this.auth.getClient();
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'books_master!A:G'
    });
    
    const values = response.data.values || [];
    return values.slice(1).map(row => {
      const [id, date, title, author, memo, status] = row;
      const statusEmoji = {
        'registered': '📋',
        'reading': '📖',
        'finished': '✅',
        'abandoned': '❌'
      };
      
      return `${statusEmoji[status] || '📋'} [${id}] ${title} - ${author} (${status})`;
    });
  }

  async addMovie(title, memo) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    const auth = await this.auth.getClient();
    const id = await this.getNextId('movies_master');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    await this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'movies_master!A:F',
      valueInputOption: 'RAW',
      resource: {
        values: [[id, now, title, memo, 'want_to_watch', now.slice(0, 10)]]
      }
    });
    
    return id;
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
    
    const auth = await this.auth.getClient();
    const date = new Date().toISOString().slice(0, 10);
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'movies_master!A:F'
      });
      
      const values = response.data.values || [];
      const rowIndex = values.findIndex(row => row[0] == id);
      
      if (rowIndex !== -1) {
        // ステータス更新
        await this.sheets.spreadsheets.values.update({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: `movies_master!E${rowIndex + 1}:F${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[status, date]]
          }
        });
        
        // 映画情報を返す
        const row = values[rowIndex];
        return {
          id: row[0],
          title: row[2],
          memo: row[3]
        };
      }
    } catch (error) {
      console.error('映画ステータス更新エラー:', error);
    }
    
    return null;
  }

  async getMovies() {
    if (!this.auth) return ['🎬 [1] テスト映画 (want_to_watch)'];
    
    const auth = await this.auth.getClient();
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'movies_master!A:F'
    });
    
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
  }

  async addActivity(content, memo) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    const auth = await this.auth.getClient();
    const id = await this.getNextId('activities_master');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    await this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'activities_master!A:F',
      valueInputOption: 'RAW',
      resource: {
        values: [[id, now, content, memo, 'planned', now.slice(0, 10)]]
      }
    });
    
    return id;
  }

  async doneActivity(id) {
    const activityInfo = await this.updateActivityStatus(id, 'done');
    return activityInfo;
  }

  async skipActivity(id) {
    const activityInfo = await this.updateActivityStatus(id, 'skipped');
    return activityInfo;
  }

  async updateActivityStatus(id, status) {
    if (!this.auth) {
      return { id, content: 'テスト活動', memo: 'テストメモ' };
    }
    
    const auth = await this.auth.getClient();
    const date = new Date().toISOString().slice(0, 10);
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'activities_master!A:F'
      });
      
      const values = response.data.values || [];
      const rowIndex = values.findIndex(row => row[0] == id);
      
      if (rowIndex !== -1) {
        // ステータス更新
        await this.sheets.spreadsheets.values.update({
          auth,
          spreadsheetId: this.spreadsheetId,
          range: `activities_master!E${rowIndex + 1}:F${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[status, date]]
          }
        });
        
        // 活動情報を返す
        const row = values[rowIndex];
        return {
          id: row[0],
          content: row[2],
          memo: row[3]
        };
      }
    } catch (error) {
      console.error('活動ステータス更新エラー:', error);
    }
    
    return null;
  }

  async getActivities() {
    if (!this.auth) return ['🎯 [1] テスト活動 (planned)'];
    
    const auth = await this.auth.getClient();
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'activities_master!A:F'
    });
    
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
  }

  async addDailyReport(category, id, content) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    const auth = await this.auth.getClient();
    const reportId = await this.getNextId('daily_reports');
    const date = new Date().toISOString().slice(0, 10);
    
    await this.sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'daily_reports!A:E',
      valueInputOption: 'RAW',
      resource: {
        values: [[reportId, date, category, id, content]]
      }
    });
    
    return reportId;
  }

  async getItemInfo(category, id) {
    if (!this.auth) return { title: 'テストアイテム' };
    
    const auth = await this.auth.getClient();
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
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range
      });
      
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
    } catch (error) {
      console.error('アイテム情報取得エラー:', error);
    }
    
    return null;
  }

  // 定期通知機能のセットアップ
  setupScheduledTasks() {
    const cron = require('node-cron');
    console.log('定期通知機能を初期化しています...');
    
    // 毎朝7時: 読書中の本を通知
    cron.schedule('0 7 * * *', async () => {
      await this.sendMorningReminder();
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

  async sendMorningReminder() {
    try {
      const readingBooks = await this.getCurrentReadingBooks();
      
      if (readingBooks.length > 0) {
        const channel = this.getNotificationChannel();
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('☀️ おはようございます！')
            .setDescription('今日はどの本を読みますか？📚')
            .addFields({
              name: '📖 読書中の本',
              value: readingBooks.map(book => `• [${book.id}] ${book.title} - ${book.author}`).join('\n'),
              inline: false
            })
            .setColor('#ffeb3b')
            .setTimestamp();
          
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

    start() {
    this.client.login(process.env.DISCORD_TOKEN);
  }
}

// Bot の起動
const bot = new ActivityTrackerBot();
bot.start();
