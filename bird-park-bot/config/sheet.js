const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class SheetsManager {
    constructor() {
        this.doc = null;
        this.sheets = {};
        this.initializeAuth();
    }

    // 認証初期化
    initializeAuth() {
        try {
            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
        } catch (error) {
            console.error('Google Sheets認証エラー:', error);
            throw error;
        }
    }

    // シート接続・初期化
    async initialize() {
        try {
            await this.doc.loadInfo();
            console.log('✅ Google Sheetsに接続しました:', this.doc.title);

            // 各シートを取得または作成
            this.sheets.birds = await this.getOrCreateSheet('birds', [
                '名前', '全長', '全長区分', '色', '季節', '渡り区分', '環境', 
                'キャッチコピー', '説明文', '好物', '食べられる餌'
            ]);

            this.sheets.gachaLog = await this.getOrCreateSheet('gacha_log', [
                '日時', 'ユーザーID', 'ユーザー名', 'コマンド', '鳥名', '詳細'
            ]);

            this.sheets.searchLog = await this.getOrCreateSheet('search_log', [
                '日時', 'ユーザーID', 'ユーザー名', '検索条件', '結果数'
            ]);

            this.sheets.zooLog = await this.getOrCreateSheet('zoo_log', [
                '日時', 'アクション', 'エリア', '鳥名', 'ユーザーID', 'ユーザー名'
            ]);

            this.sheets.feedLog = await this.getOrCreateSheet('feed_log', [
                '日時', 'ユーザーID', 'ユーザー名', '鳥名', '餌', '効果'
            ]);

            this.sheets.events = await this.getOrCreateSheet('events', [
                '日時', 'イベント種類', '内容', '関連する鳥'
            ]);

            console.log('✅ 全シートの初期化完了');
        } catch (error) {
            console.error('シート初期化エラー:', error);
            throw error;
        }
    }

    // シート取得または作成
    async getOrCreateSheet(title, headers) {
        try {
            let sheet = this.doc.sheetsByTitle[title];
            
            if (!sheet) {
                console.log(`シート "${title}" を作成中...`);
                sheet = await this.doc.addSheet({ title, headerValues: headers });
            } else {
                await sheet.loadHeaderRow();
            }
            
            return sheet;
        } catch (error) {
            console.error(`シート "${title}" の取得/作成エラー:`, error);
            throw error;
        }
    }

    // ログ追加
    async addLog(sheetName, data) {
        try {
            const sheet = this.sheets[sheetName];
            if (!sheet) {
                console.error(`シート "${sheetName}" が見つかりません`);
                return false;
            }

            const logData = {
                日時: new Date().toLocaleString('ja-JP'),
                ...data
            };

            await sheet.addRow(logData);
            return true;
        } catch (error) {
            console.error(`ログ追加エラー (${sheetName}):`, error);
            return false;
        }
    }

    // 鳥データ取得
    async getBirds() {
        try {
            const sheet = this.sheets.birds;
            const rows = await sheet.getRows();
            
            return rows.map(row => ({
                名前: row.get('名前'),
                全長: row.get('全長'),
                全長区分: row.get('全長区分'),
                色: row.get('色'),
                季節: row.get('季節'),
                渡り区分: row.get('渡り区分'),
                環境: row.get('環境'),
                キャッチコピー: row.get('キャッチコピー'),
                説明文: row.get('説明文'),
                好物: row.get('好物'),
                食べられる餌: row.get('食べられる餌')
            }));
        } catch (error) {
            console.error('鳥データ取得エラー:', error);
            return [];
        }
    }
}

module.exports = new SheetsManager();
