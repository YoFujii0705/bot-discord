const { SlashCommandBuilder } = require('discord.js');

// スラッシュコマンド定義
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botの接続テスト'),

    new SlashCommandBuilder()
        .setName('sheets-test')
        .setDescription('Google Sheets接続テスト'),

    new SlashCommandBuilder()
        .setName('作品登録')
        .setDescription('新しい作品を登録します')
        .addStringOption(option =>
            option.setName('タイトル')
                .setDescription('作品のタイトル')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('締切日')
                .setDescription('締切日（YYYY-MM-DD形式）')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('テーマ')
                .setDescription('作品のテーマ')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('字数制限')
                .setDescription('字数制限（文字数）')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('目標字数')
                .setDescription('目標字数（文字数）')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('備考')
                .setDescription('その他のメモ')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('作品一覧')
        .setDescription('現在の作品一覧とカウントダウンを表示します'),

    new SlashCommandBuilder()
        .setName('ステータス変更')
        .setDescription('作品のステータスを変更します')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('作品ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ステータス')
                .setDescription('新しいステータス')
                .setRequired(true)
                .addChoices(
                    { name: '未着手', value: '未着手' },
                    { name: '着手中', value: '着手中' },
                    { name: '完了', value: '完了' }
                )),

    new SlashCommandBuilder()
        .setName('進捗報告')
        .setDescription('今日の執筆進捗を報告します')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('作品ID')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('字数')
                .setDescription('今日書いた字数（0字でもOK）')
                .setRequired(true)
                .setMinValue(0))
        .addStringOption(option =>
            option.setName('進捗種別')
                .setDescription('今日の作業内容')
                .setRequired(false)
                .addChoices(
                    { name: '執筆', value: '執筆' },
                    { name: 'プロット作成', value: 'プロット作成' },
                    { name: 'キャラ設定', value: 'キャラ設定' },
                    { name: 'リサーチ', value: 'リサーチ' },
                    { name: '推敲・校正', value: '推敲・校正' },
                    { name: 'アイデア出し', value: 'アイデア出し' },
                    { name: 'その他', value: 'その他' }
                ))
        .addStringOption(option =>
            option.setName('メモ')
                .setDescription('今日の作業メモ')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('統計')
        .setDescription('執筆統計を表示します')
        .addStringOption(option =>
            option.setName('期間')
                .setDescription('統計期間')
                .setRequired(true)
                .addChoices(
                    { name: '今週', value: '今週' },
                    { name: '今月', value: '今月' },
                    { name: '先週', value: '先週' },
                    { name: '先月', value: '先月' }
                )),

    new SlashCommandBuilder()
        .setName('詳細統計')
        .setDescription('執筆と非執筆作業を含む詳細な統計を表示します')
        .addStringOption(option =>
            option.setName('期間')
                .setDescription('統計期間')
                .setRequired(true)
                .addChoices(
                    { name: '今週', value: '今週' },
                    { name: '今月', value: '今月' },
                    { name: '先週', value: '先週' },
                    { name: '先月', value: '先月' },
                    { name: '過去3ヶ月', value: '過去3ヶ月' }
                ))
        .addBooleanOption(option =>
            option.setName('進捗種別表示')
                .setDescription('進捗種別ごとの詳細を表示するか')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('作業評価')
        .setDescription('プロットやリサーチなどの定性的な進捗を評価します')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('作品ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('評価項目')
                .setDescription('評価する項目')
                .setRequired(true)
                .addChoices(
                    { name: 'プロット完成度', value: 'プロット完成度' },
                    { name: 'キャラクター設定', value: 'キャラクター設定' },
                    { name: 'リサーチ進捗', value: 'リサーチ進捗' },
                    { name: '世界観構築', value: '世界観構築' },
                    { name: '推敲完成度', value: '推敲完成度' }
                ))
        .addIntegerOption(option =>
            option.setName('完成度')
                .setDescription('完成度（0-100%）')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100))
        .addStringOption(option =>
            option.setName('評価メモ')
                .setDescription('現在の状況や次のステップなど')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('ペース分析')
        .setDescription('作品の執筆ペースを分析します')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('作品ID')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('アーカイブ')
        .setDescription('完了した作品のアーカイブを表示します'),

    new SlashCommandBuilder()
        .setName('執筆習慣')
        .setDescription('執筆習慣と連続日数を表示します'),

    new SlashCommandBuilder()
        .setName('ヘルプ')
        .setDescription('Botの機能一覧とコマンドの使い方を表示します')
        .addStringOption(option =>
            option.setName('カテゴリ')
                .setDescription('詳細を見たいカテゴリを選択')
                .setRequired(false)
                .addChoices(
                    { name: '基本機能', value: '基本機能' },
                    { name: '統計・分析', value: '統計・分析' },
                    { name: '定期実行', value: '定期実行' },
                    { name: 'コマンド例', value: 'コマンド例' }
                )),
];

module.exports = {
    commands
};
