module.exports = {
  // ステータス定義
  BOOK_STATUS: {
    WANT_TO_BUY: 'want_to_buy',
    WANT_TO_READ: 'want_to_read',
    READING: 'reading',
    FINISHED: 'finished',
    ABANDONED: 'abandoned'
  },
  
  MOVIE_STATUS: {
    WANT_TO_WATCH: 'want_to_watch',
    WATCHED: 'watched',
    MISSED: 'missed'
  },
  
  ACTIVITY_STATUS: {
    PLANNED: 'planned',
    DONE: 'done',
    SKIPPED: 'skipped'
  },
  
  // 絵文字定義
  EMOJI: {
    BOOK: {
      WANT_TO_BUY: '🛒',
      WANT_TO_READ: '📋',
      READING: '📖',
      FINISHED: '✅',
      ABANDONED: '❌'
    },
    MOVIE: {
      WANT_TO_WATCH: '🎬',
      WATCHED: '✅',
      MISSED: '😅'
    },
    ACTIVITY: {
      PLANNED: '🎯',
      DONE: '✅',
      SKIPPED: '😅'
    }
  },
  
  // 色定義
  COLORS: {
    SUCCESS: '#4CAF50',
    INFO: '#2196F3',
    WARNING: '#FF9800',
    ERROR: '#F44336',
    PRIMARY: '#9C27B0'
  }
};
