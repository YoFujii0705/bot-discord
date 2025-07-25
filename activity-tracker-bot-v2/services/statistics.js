class StatisticsService {
  constructor() {
    this.googleSheets = require('./googleSheets');
  }

  // 全体統計を取得
  async getSummaryStats() {
    try {
      // 実際の実装では Google Sheets からデータを取得
      // 現在はサンプルデータを返す
      return {
        books: {
          total: 15,
          want_to_buy: 4,
          want_to_read: 6,
          reading: 3,
          finished: 8,
          abandoned: 1
        },
        movies: {
          total: 12,
          want_to_watch: 5,
          watched: 7,
          missed: 2
        },
        activities: {
          total: 20,
          planned: 6,
          done: 14,
          skipped: 3
        }
      };
    } catch (error) {
      console.error('統計取得エラー:', error);
      return this.getDefaultStats();
    }
  }

  // 週次統計を取得
  async getWeeklyStats() {
    try {
      return {
        finishedBooks: 2,
        watchedMovies: 3,
        completedActivities: 5,
        dailyReports: 12
      };
    } catch (error) {
      console.error('週次統計取得エラー:', error);
      return { finishedBooks: 0, watchedMovies: 0, completedActivities: 0, dailyReports: 0 };
    }
  }

  // 月次統計を取得
  async getMonthlyStats() {
    try {
      return {
        finishedBooks: 6,
        watchedMovies: 8,
        completedActivities: 18,
        dailyReports: 45,
        bookTitles: [
          'JavaScript入門',
          'プログラミング思考',
          'Web開発基礎',
          'データ構造とアルゴリズム',
          'その他2冊'
        ]
      };
    } catch (error) {
      console.error('月次統計取得エラー:', error);
      return { finishedBooks: 0, watchedMovies: 0, completedActivities: 0, dailyReports: 0, bookTitles: [] };
    }
  }

  // 読書統計を取得
  async getBookStats() {
    try {
      return {
        byStatus: {
          want_to_buy: 4,
          want_to_read: 6,
          reading: 3,
          finished: 8
        },
        byPeriod: {
          thisMonth: 6,
          thisWeek: 2,
          today: 0
        },
        byGenre: {
          technical: 5,
          novel: 3,
          business: 2,
          others: 5
        }
      };
    } catch (error) {
      console.error('読書統計取得エラー:', error);
      return this.getDefaultBookStats();
    }
  }

  // 現在進行中の項目を取得
  async getCurrentProgress() {
    try {
      return {
        readingBooks: [
          { id: 3, title: 'プログラミング入門', author: 'コード花子' },
          { id: 12, title: 'Web開発基礎', author: '開発次郎' },
          { id: 18, title: 'データベース設計', author: 'DB太郎' }
        ],
        wantToWatchMovies: [
          { id: 2, title: 'アクション映画大作' },
          { id: 6, title: 'SF映画の傑作' },
          { id: 9, title: '最新アニメ映画' },
          { id: 11, title: '名作ドラマ' },
          { id: 15, title: 'コメディ映画' }
        ],
        plannedActivities: [
          { id: 1, content: 'ジョギング 30分' },
          { id: 4, content: '部屋の片付け' },
          { id: 7, content: '英語の勉強' },
          { id: 10, content: '料理の練習' }
        ]
      };
    } catch (error) {
      console.error('進行状況取得エラー:', error);
      return { readingBooks: [], wantToWatchMovies: [], plannedActivities: [] };
    }
  }

  getDefaultStats() {
    return {
      books: { total: 0, want_to_buy: 0, want_to_read: 0, reading: 0, finished: 0, abandoned: 0 },
      movies: { total: 0, want_to_watch: 0, watched: 0, missed: 0 },
      activities: { total: 0, planned: 0, done: 0, skipped: 0 }
    };
  }

  getDefaultBookStats() {
    return {
      byStatus: { want_to_buy: 0, want_to_read: 0, reading: 0, finished: 0 },
      byPeriod: { thisMonth: 0, thisWeek: 0, today: 0 },
      byGenre: { technical: 0, novel: 0, business: 0, others: 0 }
    };
  }
}

module.exports = new StatisticsService();
