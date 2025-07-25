module.exports = {
  // Google Sheets の設定
  sheets: {
    // シート名の定義
    SHEET_NAMES: {
      BOOKS_MASTER: 'books_master',
      MOVIES_MASTER: 'movies_master',
      ACTIVITIES_MASTER: 'activities_master',
      DAILY_REPORTS: 'daily_reports'
    },
    
    // 列の定義
    COLUMNS: {
      BOOKS: {
        ID: 0,
        CREATED_AT: 1,
        TITLE: 2,
        AUTHOR: 3,
        MEMO: 4,
        STATUS: 5,
        UPDATED_AT: 6
      },
      MOVIES: {
        ID: 0,
        CREATED_AT: 1,
        TITLE: 2,
        MEMO: 3,
        STATUS: 4,
        UPDATED_AT: 5
      },
      ACTIVITIES: {
        ID: 0,
        CREATED_AT: 1,
        CONTENT: 2,
        MEMO: 3,
        STATUS: 4,
        UPDATED_AT: 5
      },
      REPORTS: {
        ID: 0,
        DATE: 1,
        CATEGORY: 2,
        ITEM_ID: 3,
        CONTENT: 4
      }
    },
    
    // 範囲の定義
    RANGES: {
      BOOKS_ALL: 'books_master!A:G',
      MOVIES_ALL: 'movies_master!A:F',
      ACTIVITIES_ALL: 'activities_master!A:F',
      REPORTS_ALL: 'daily_reports!A:E'
    }
  },
  
  // タイムアウト設定
  timeouts: {
    OPERATION_TIMEOUT: 10000,
    AUTH_TIMEOUT: 30000
  }
};
