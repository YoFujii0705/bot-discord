require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

class ActivityTrackerBot {
  constructor() {
    console.log('🚀 ActivityTrackerBot v2 初期化開始...');
    
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      rest: { timeout: 60000, retries: 3 }
    });
    
    this.commands = new Map();
    this.handlers = new Map();
    
    this.loadCommands();
    this.loadHandlers();
    this.setupEvents();
  }

  loadCommands() {
    console.log('📝 コマンド読み込み中...');
    
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
      console.log('⚠️ commandsディレクトリが見つかりません');
      return;
    }
    
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        const command = require(path.join(commandsPath, file));
        this.commands.set(command.data.name, command);
        console.log(`✅ コマンド読み込み: ${command.data.name}`);
      } catch (error) {
        console.error(`❌ ${file} 読み込みエラー:`, error.message);
      }
    }
  }

  loadHandlers() {
    console.log('🔧 ハンドラー読み込み中...');
    
    const handlersPath = path.join(__dirname, 'handlers');
    if (!fs.existsSync(handlersPath)) {
      console.log('⚠️ handlersディレクトリが見つかりません');
      return;
    }
    
    const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));
    
    for (const file of handlerFiles) {
      try {
        const handler = require(path.join(handlersPath, file));
        const handlerName = path.basename(file, '.js').replace('Handler', '');
        this.handlers.set(handlerName, handler);
        console.log(`✅ ハンドラー読み込み: ${handlerName}`);
      } catch (error) {
        console.error(`❌ ${file} 読み込みエラー:`, error.message);
      }
    }
  }

  async deployCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
      console.log('🔄 コマンド登録開始...');
      
      const commandsData = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
      
      await rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: commandsData }
      );

      console.log(`✅ ${commandsData.length}個のコマンドを登録しました`);
    } catch (error) {
      console.error('❌ コマンド登録失敗:', error);
    }
  }

  setupEvents() {
    this.client.once('ready', async () => {
      console.log(`✅ ${this.client.user.tag} ログイン成功！`);
      console.log(`🏛️ ${this.client.guilds.cache.size}個のサーバーに参加中`);
      
      await this.deployCommands();
      console.log('🎉 Bot初期化完了！');
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      console.log(`📨 ${interaction.commandName} by ${interaction.user.tag}`);

      try {
        await interaction.deferReply();
        
        const handler = this.handlers.get(interaction.commandName);
        if (!handler) {
          await interaction.editReply('❌ ハンドラーが見つかりません');
          return;
        }
        
        await handler.execute(interaction);
        console.log(`✅ ${interaction.commandName} 完了`);
        
      } catch (error) {
        console.error(`❌ ${interaction.commandName} エラー:`, error);
        
        try {
          await interaction.editReply(`エラー: ${error.message}`);
        } catch (e) {
          console.error('応答エラー:', e);
        }
      }
    });
    
    this.client.on('error', error => console.error('Discord エラー:', error));
    this.client.on('warn', info => console.warn('Discord 警告:', info));
  }

  start() {
    console.log('🚀 Bot起動中...');
    this.client.login(process.env.DISCORD_TOKEN);
  }
}

const bot = new ActivityTrackerBot();
bot.start();
