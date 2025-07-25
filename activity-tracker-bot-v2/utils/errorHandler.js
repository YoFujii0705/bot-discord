class ErrorHandler {
  static async handleInteractionError(interaction, error) {
    console.error('❌ Interaction Error:', error);
    console.error('❌ Stack:', error.stack);
    
    const errorMessage = `エラーが発生しました: ${error.message}`;
    
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ 
          content: errorMessage,
          ephemeral: true 
        });
      } else if (!interaction.replied) {
        await interaction.reply({ 
          content: errorMessage, 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      console.error('❌ エラー応答失敗:', replyError);
    }
  }

  static async handleCommandError(commandName, error) {
    console.error(`❌ Command Error [${commandName}]:`, error);
    console.error('❌ Stack:', error.stack);
    
    // ここでログファイルに記録したり、管理者に通知したりできます
    const logger = require('./logger');
    logger.error(`Command ${commandName} failed`, { 
      error: error.message, 
      stack: error.stack 
    });
  }

  static logError(context, error, metadata = {}) {
    console.error(`❌ ${context}:`, error);
    
    const logger = require('./logger');
    logger.error(context, { 
      error: error.message, 
      stack: error.stack,
      ...metadata 
    });
  }
}

module.exports = ErrorHandler;
