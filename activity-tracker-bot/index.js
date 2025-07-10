require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
    this.setupCommands();
    this.setupEvents();
    this.setupScheduledTasks();
  }

setupCommands() {
    console.log('setupCommands開始');
    
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

    // Discord接続時の処理
    this.client.on('ready', async () => {
      console.log(`${this.client.user.tag} でログインしました！`);
      
      try {
        await this.client.application.commands.set([]);
        console.log('既存のグローバルコマンドをクリアしました');
        
        const guild = this.client.guilds.cache.first();
        if (guild) {
          await guild.commands.set(commands);
          console.log(`ギルド "${guild.name}" にコマンドを登録しました`);
        }
        
        await this.client.application.commands.set(commands);
        console.log('グローバルコマンドを登録しました');
        
        const registeredCommands = await this.client.application.commands.fetch();
        console.log('登録されたコマンド:', registeredCommands.map(cmd => cmd.name).join(', '));
      } catch (error) {
        console.error('コマンド登録エラー:', error);
      }
    });
  }
setupEvents() {
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
        }
      } catch (error) {
        console.error('エラー:', error);
        await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
      }
    });
  }

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
        await this.watchMovie(watchId);
        await interaction.reply(`🎬 視聴済みにしました！面白かったですか？`);
        break;
      
      case 'skip':
        const skipId = interaction.options.getInteger('id');
        await this.skipMovie(skipId);
        await interaction.reply(`😅 見逃してしまいましたね。また機会があったら見てみてください！`);
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
        await this.doneActivity(doneId);
        await interaction.reply(`✅ 活動を完了しました！お疲れ様でした！🎉`);
        break;
      
      case 'skip':
        const skipId = interaction.options.getInteger('id');
        await this.skipActivity(skipId);
        await interaction.reply(`😅 今回は見送りましたね。また機会があればチャレンジしてみてください！`);
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
    
    // 簡単な統計表示（詳細な統計は後で実装）
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${subcommand} 統計`)
      .setColor('#3498db')
      .setDescription(`${subcommand} の統計情報です。\n（詳細な統計機能は実装中です）`)
      .addFields(
        { name: '📚 本', value: '登録数: 計算中...', inline: true },
        { name: '🎬 映画', value: '登録数: 計算中...', inline: true },
        { name: '🎯 活動', value: '登録数: 計算中...', inline: true }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
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
    await this.updateMovieStatus(id, 'watched');
  }

  async skipMovie(id) {
    await this.updateMovieStatus(id, 'missed');
  }

  async updateMovieStatus(id, status) {
    if (!this.auth) return;
    
    const auth = await this.auth.getClient();
    const date = new Date().toISOString().slice(0, 10);
    
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'movies_master!A:F'
    });
    
    const values = response.data.values || [];
    const rowIndex = values.findIndex(row => row[0] == id);
    
    if (rowIndex !== -1) {
      await this.sheets.spreadsheets.values.update({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: `movies_master!E${rowIndex + 1}:F${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[status, date]]
        }
      });
    }
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
    await this.updateActivityStatus(id, 'done');
  }

  async skipActivity(id) {
    await this.updateActivityStatus(id, 'skipped');
  }

  async updateActivityStatus(id, status) {
    if (!this.auth) return;
    
    const auth = await this.auth.getClient();
    const date = new Date().toISOString().slice(0, 10);
    
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: 'activities_master!A:F'
    });
    
    const values = response.data.values || [];
    const rowIndex = values.findIndex(row => row[0] == id);
    
    if (rowIndex !== -1) {
      await this.sheets.spreadsheets.values.update({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: `activities_master!E${rowIndex + 1}:F${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[status, date]]
        }
      });
    }
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

  async sendMorningReminder() {
    try {
      const readingBooks = await this.getCurrentReadingBooks();
      
      if (readingBooks.length > 0) {
        const channel = this.client.channels.cache.first();
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
        }
      }
    } catch (error) {
      console.error('朝の通知エラー:', error);
    }
  }

  async sendWeeklyReport() {
    try {
      const weeklyStats = await this.getThisWeekStats();
      const channel = this.client.channels.cache.first();
      
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
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('週次レポートエラー:', error);
    }
  }

  async sendMonthlyReport() {
    try {
      const monthlyStats = await this.getThisMonthStats();
      const channel = this.client.channels.cache.first();
      
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🗓️ 今月の活動レポート')
          .setDescription('今月の成果を振り返ってみましょう！✨')
          .addFields(
            { name: '📚 読了冊数', value: `${monthlyStats.finishedBooks}冊`, inline: true },
            { name: '🎬 視聴本数', value: `${monthlyStats.watchedMovies}本`, inline: true },
            { name: '🎯 完了活動', value: `${monthlyStats.completedActivities}件`, inline: true },
            { name: '📝 日報件数', value: `${monthlyStats.dailyReports}件`, inline: true },
            { name: '🏆 今月の読書', value: monthlyStats.bookTitles.length > 0 ? monthlyStats.bookTitles.slice(0, 3).join('\n') : 'なし', inline: false }
          )
          .setColor('#9c27b0')
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('月次レポートエラー:', error);
    }
  }

  async checkAbandonedItems() {
    try {
      const abandonedItems = await this.getAbandonedItems();
      
      if (abandonedItems.movies.length > 0 || abandonedItems.activities.length > 0) {
        const channel = this.client.channels.cache.first();
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
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    
    // 簡易実装（後で詳細化）
    return {
      finishedBooks: 0,
      watchedMovies: 0,
      completedActivities: 0
    };
  }

  async getThisMonthStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 簡易実装（後で詳細化）
    return {
      finishedBooks: 0,
      watchedMovies: 0,
      completedActivities: 0,
      dailyReports: 0,
      bookTitles: []
    };
  }

  async getAbandonedItems() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 簡易実装（後で詳細化）
    return {
      movies: [],
      activities: []
    };
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

  start() {
    this.client.login(process.env.DISCORD_TOKEN);
  }
}

// Bot の起動
const bot = new ActivityTrackerBot();
bot.start();
