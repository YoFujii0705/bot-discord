const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = google.sheets({ version: 'v4' });
    this.auth = null;
    this.spreadsheetId = process.env.SPREADSHEET_ID;
    
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          timeout: 30000
        });
        console.log('✅ Google認証（JSON）設定完了');
      } else {
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
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          timeout: 30000
        });
        console.log('✅ Google認証（環境変数）設定完了');
      }
    } catch (error) {
      console.error('❌ Google認証設定エラー:', error.message);
      console.log('⚠️ Google Sheets機能は無効化されます');
      this.auth = null;
    }
  }

  async getNextId(sheetName) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    try {
      const auth = await this.auth.getClient();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 5000)
      );
      
      const operationPromise = this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`
      });
      
      const response = await Promise.race([operationPromise, timeoutPromise]);
      const values = response.data.values || [];
      return values.length;
      
    } catch (error) {
      console.error(`getNextId エラー:`, error);
      return Math.floor(Math.random() * 1000) + Date.now() % 1000;
    }
  }

  async addBook(title, author, status, memo) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    try {
      const auth = await this.auth.getClient();
      const id = await this.getNextId('books_master');
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 5000)
      );
      
      const operationPromise = this.sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'books_master!A:G',
        valueInputOption: 'RAW',
        resource: {
          values: [[id, now, title, author, memo, status, '']]
        }
      });
      
      await Promise.race([operationPromise, timeoutPromise]);
      console.log('✅ 本の追加成功:', id);
      return id;
      
    } catch (error) {
      console.error('❌ addBook エラー:', error);
      return Math.floor(Math.random() * 1000) + Date.now() % 1000;
    }
  }

  async addMovie(title, memo) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    try {
      const auth = await this.auth.getClient();
      const id = await this.getNextId('movies_master');
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 5000)
      );
      
      const operationPromise = this.sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'movies_master!A:F',
        valueInputOption: 'RAW',
        resource: {
          values: [[id, now, title, memo, 'want_to_watch', now.slice(0, 10)]]
        }
      });
      
      await Promise.race([operationPromise, timeoutPromise]);
      console.log('✅ 映画の追加成功:', id);
      return id;
      
    } catch (error) {
      console.error('❌ addMovie エラー:', error);
      return Math.floor(Math.random() * 1000) + Date.now() % 1000;
    }
  }

  async addActivity(content, memo) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    try {
      const auth = await this.auth.getClient();
      const id = await this.getNextId('activities_master');
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 5000)
      );
      
      const operationPromise = this.sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'activities_master!A:F',
        valueInputOption: 'RAW',
        resource: {
          values: [[id, now, content, memo, 'planned', now.slice(0, 10)]]
        }
      });
      
      await Promise.race([operationPromise, timeoutPromise]);
      console.log('✅ 活動の追加成功:', id);
      return id;
      
    } catch (error) {
      console.error('❌ addActivity エラー:', error);
      return Math.floor(Math.random() * 1000) + Date.now() % 1000;
    }
  }

  async addDailyReport(category, id, content) {
    if (!this.auth) return Math.floor(Math.random() * 1000);
    
    try {
      const auth = await this.auth.getClient();
      const reportId = await this.getNextId('daily_reports');
      const date = new Date().toISOString().slice(0, 10);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 5000)
      );
      
      const operationPromise = this.sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: 'daily_reports!A:E',
        valueInputOption: 'RAW',
        resource: {
          values: [[reportId, date, category, id, content]]
        }
      });
      
      await Promise.race([operationPromise, timeoutPromise]);
      console.log('✅ 日報の追加成功:', reportId);
      return reportId;
      
    } catch (error) {
      console.error('❌ addDailyReport エラー:', error);
      return Math.floor(Math.random() * 1000) + Date.now() % 1000;
    }
  }
}

module.exports = new GoogleSheetsService();
