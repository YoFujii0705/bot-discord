const { google } = require('googleapis');

// Google Sheets設定
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Ping コマンドハンドラー
async function handlePing(interaction) {
    await interaction.reply('🏓 Pong! Botは正常に動作しています！');
}

// Google Sheetsテストハンドラー
async function handleSheetsTest(interaction) {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        });

        await interaction.reply(`✅ Google Sheets接続成功！\nシート名: ${response.data.properties.title}`);
    } catch (error) {
        console.error('Sheetsエラー:', error);
        await interaction.reply('❌ Google Sheets接続に失敗しました。設定を確認してください。');
    }
}

module.exports = {
    handlePing,
    handleSheetsTest,
    sheets // 他のモジュールでも使用するためエクスポート
};
