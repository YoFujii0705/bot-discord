// 基本機能
const { handlePing, handleSheetsTest } = require('./basic');

// 作品管理
const { 
    handleWorkRegistration, 
    handleWorkList, 
    handleStatusChange, 
    handleProgressReport 
} = require('./work');

// 統計機能
const { 
    handleStatistics, 
    handleDetailedStatistics 
} = require('./statistics');

// 分析機能
const { 
    handlePaceAnalysis, 
    handleArchive, 
    handleWritingHabit, 
    handleWorkEvaluation 
} = require('./analysis');

// ヘルプ機能
const { handleHelp } = require('./help');

// コマンドハンドラーのマップ
const commandHandlers = {
    // 基本機能
    'ping': handlePing,
    'sheets-test': handleSheetsTest,

    // 作品管理
    '作品登録': handleWorkRegistration,
    '作品一覧': handleWorkList,
    'ステータス変更': handleStatusChange,
    '進捗報告': handleProgressReport,

    // 統計機能
    '統計': handleStatistics,
    '詳細統計': handleDetailedStatistics,

    // 分析機能
    'ペース分析': handlePaceAnalysis,
    'アーカイブ': handleArchive,
    '執筆習慣': handleWritingHabit,
    '作業評価': handleWorkEvaluation,

    // ヘルプ機能
    'ヘルプ': handleHelp
};

// インタラクション処理の統合関数
async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const handler = commandHandlers[commandName];

    if (!handler) {
        console.error(`未知のコマンド: ${commandName}`);
        const reply = { content: `コマンド「${commandName}」は実装されていません。`, ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
        return;
    }

    try {
        await handler(interaction);
    } catch (error) {
        console.error(`コマンド実行エラー (${commandName}):`, error);

        const reply = { 
            content: 'コマンドの実行中にエラーが発生しました。しばらく待ってから再度お試しください。', 
            ephemeral: true 
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        } catch (followUpError) {
            console.error('エラーレスポンス送信失敗:', followUpError);
        }
    }
}

module.exports = {
    handleInteraction,
    commandHandlers
};
