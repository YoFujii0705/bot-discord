class Helpers {
  // 日付フォーマット
  static formatDate(date) {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  // 時間フォーマット
  static formatDateTime(date) {
    return new Date(date).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ランダムID生成
  static generateId() {
    return Math.floor(Math.random() * 1000) + Date.now() % 1000;
  }

  // テキスト切り詰め
  static truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  // ステータス絵文字取得
  static getStatusEmoji(category, status) {
    const emojis = {
      book: {
        want_to_buy: '🛒',
        want_to_read: '📋',
        reading: '📖',
        finished: '✅',
        abandoned: '❌'
      },
      movie: {
        want_to_watch: '🎬',
        watched: '✅',
        missed: '😅'
      },
      activity: {
        planned: '🎯',
        done: '✅',
        skipped: '😅'
      }
    };

    return emojis[category]?.[status] || '❓';
  }

  // ステータステキスト取得
  static getStatusText(category, status) {
    const texts = {
      book: {
        want_to_buy: '買いたい',
        want_to_read: '積読',
        reading: '読書中',
        finished: '読了',
        abandoned: '中断'
      },
      movie: {
        want_to_watch: '観たい',
        watched: '視聴済み',
        missed: '見逃し'
      },
      activity: {
        planned: '予定',
        done: '完了',
        skipped: 'スキップ'
      }
    };

    return texts[category]?.[status] || status;
  }

  // カテゴリ絵文字取得
  static getCategoryEmoji(category) {
    const emojis = {
      book: '📚',
      movie: '🎬',
      activity: '🎯'
    };

    return emojis[category] || '❓';
  }

  // カテゴリ名取得
  static getCategoryName(category) {
    const names = {
      book: '本',
      movie: '映画',
      activity: '活動'
    };

    return names[category] || category;
  }

  // 配列を安全に取得
  static safeArray(arr) {
    return Array.isArray(arr) ? arr : [];
  }

  // 文字列を安全に取得
  static safeString(str) {
    return typeof str === 'string' ? str : '';
  }

  // 数値を安全に取得
  static safeNumber(num) {
    return typeof num === 'number' && !isNaN(num) ? num : 0;
  }

  // オブジェクトの深いコピー
  static deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // 週の開始日を取得
  static getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // 月の開始日を取得
  static getMonthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  // 文字列をハイライト
  static highlightText(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, 'gi');
    return text.replace(regex, '**$1**');
  }
}

module.exports = Helpers;
