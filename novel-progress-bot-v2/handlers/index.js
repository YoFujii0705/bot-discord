// ハンドラーモジュールのインポート
const basicHandlers = require('./basic');
const workHandlers = require('./work');
const statisticsHandlers = require('./statistics');
const analysisHandlers = require('./analysis');
const helpHandlers = require('./help');

// すべてのハンドラーを統合
const handlers = {
    // 基本機能
    'ping': basicHandlers.handlePing,
    'sheets-test': basicHandlers.handleSheetsTest,
    
    // 作品管理
    '作品登録': workHandlers.handleWorkRegistration,
    '作品一覧': workHandlers.handleWorkList,
    'ステータス変更': workHandlers.handleStatusChange,
    '進捗報告': workHandlers.handleProgressReport,
    
    // 統計・分析
    '統計': statisticsHandlers.handleStatistics,
    '詳細統計': statisticsHandlers.handleDetailedStatistics,
    'ペース分析': analysisHandlers.handlePaceAnalysis,
    'アーカイブ': analysisHandlers.handleArchive,
    '執筆習慣': analysisHandlers.handleWritingHabit,
    
    // 評価機能
    '作業評価': analysisHandlers.handleWorkEvaluation,
    
    // ヘルプ
    'ヘルプ': helpHandlers.handleHelp
};

module.exports = handlers;
