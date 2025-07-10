require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');

class ActivityTrackerBot {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      rest: { 
        timeout: 30000  // 30秒に延長
      }
    });
    
    this.sheets = google.sheets({ version: 'v4' });
    
    // Google認証の設定
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        // JSON全体が環境変数にある場合
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
      } else {
        // 個別の環境変数を使用する場合
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
    
    console.log('setupCommands を呼び出しています...');
    this.setupCommands();
    this.setupEvents();
  }

  async setupCommands() {
    console.log('setupCommands メソッドが呼ばれました');
    
    const commands = [
      // 本管理
      new SlashCommandBuilder()
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
          subcommand.setName('list').setDescription('本一覧')),

      // 映画管理
      new SlashCommandBuilder()
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
          subcommand.setName('list').setDescription('映画一覧')),

      // 活動管理
      new SlashCommandBuilder()
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
          subcommand.setName('list').setDescription('活動一覧')),

      // 日報
      new SlashCommandBuilder()
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
          option.setName('content').setDescription('内容').setRequired(true))
    ];

    this.client.on('ready', async () => {
      console.log(`${this.client.user.tag} でログインしました！`);
      
      try {
        // グローバルコマンドをクリア
        await this.client.application.commands.set([]);
        console.log('既存のグローバルコマンドをクリアしました');
        
        // 特定のギルド（サーバー）にコマンドを登録（即座に反映される）
        const guild = this.client.guilds.cache.first(); // 最初のサーバー
        if (guild) {
          await guild.commands.set(commands);
          console.log(`ギルド "${guild.name}" にコマンドを登録しました`);
        }
        
        // グローバルコマンドも登録（反映に時間がかかる場合がある）
        await this.client.application.commands.set(commands);
        console.log('グローバルコマンドを登録しました');
        
        // 登録されたコマンド一覧を表示
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
    
    // 対象のアイテム情報を取得
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

  // Google Sheets操作メソッド
  async getNextId(sheetName) {
    const auth = await this.auth.getClient();
    const response = await this.sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:A`
    });
    
    const values = response.data.values || [];
    return values.length; // ヘッダー行を含むので、次のIDになる
  }

  async addBook(title, author, memo) {
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
    const auth = await this.auth.getClient();
    const startDate = new Date().toISOString().slice(0, 10);
    
    // IDに該当する行を見つけて更新
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
      
      // 更新した本の情報を返す
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
      
      // 完了した本の情報を返す
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
    const auth = await this.auth.getClient();
    let range, titleColumn, contentColumn;
    
    switch (category) {
      case 'book':
        range = 'books_master!A:G';
        titleColumn = 2; // タイトル列
        contentColumn = 3; // 作者列
        break;
      case 'movie':
        range = 'movies_master!A:F';
        titleColumn = 2; // タイトル列
        break;
      case 'activity':
        range = 'activities_master!A:F';
        contentColumn = 2; // 活動内容列
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

  start() {
    this.client.login(process.env.DISCORD_TOKEN);
  }
}

const bot = new ActivityTrackerBot();
bot.start();
