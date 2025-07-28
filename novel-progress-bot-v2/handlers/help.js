const { EmbedBuilder } = require('discord.js');

async function handleHelp(interaction) {
    const category = interaction.options.getString('カテゴリ');

    if (!category) {
        // 全体概要
        const embed = new EmbedBuilder()
            .setColor(0x00bfff)
            .setTitle('📚 小説執筆管理Bot - 機能一覧')
            .setDescription('小説の執筆進捗を管理し、統計分析で執筆習慣をサポートします')
            .addFields(
                { 
                    name: '📝 基本機能', 
                    value: '作品登録、進捗報告、ステータス管理\n`/ヘルプ カテゴリ:基本機能` で詳細表示', 
                    inline: false 
                },
                { 
                    name: '📊 統計・分析', 
                    value: '執筆統計、ペース分析、習慣トラッキング\n`/ヘルプ カテゴリ:統計・分析` で詳細表示', 
                    inline: false 
                },
                { 
                    name: '⏰ 定期実行', 
                    value: '日次リマインダー、週間・月間レポート\n`/ヘルプ カテゴリ:定期実行` で詳細表示', 
                    inline: false 
                },
                { 
                    name: '💡 使い方のコツ', 
                    value: 'コマンドの具体例と活用法\n`/ヘルプ カテゴリ:コマンド例` で詳細表示', 
                    inline: false 
                }
            )
            .setFooter({ text: '各カテゴリを選択して詳細をご確認ください' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

    } else if (category === '基本機能') {
        const embed = new EmbedBuilder()
            .setColor(0x32cd32)
            .setTitle('📝 基本機能')
            .addFields(
                { 
                    name: '/作品登録', 
                    value: '新しい作品を登録\n必須: タイトル、締切日\nオプション: テーマ、字数制限、目標字数、備考', 
                    inline: false 
                },
                { 
                    name: '/作品一覧', 
                    value: '登録済み作品の一覧とカウントダウンを表示\nステータス別の絵文字と進捗率も確認可能', 
                    inline: false 
                },
                { 
                    name: '/ステータス変更', 
                    value: '作品のステータスを変更\n未着手 → 着手中 → 完了\n「着手中」で個別シート自動作成', 
                    inline: false 
                },
                { 
                    name: '/進捗報告', 
                    value: '日々の執筆字数を報告\n字数は0字でもOK（非執筆作業も記録可能）\n進捗種別: 執筆、プロット作成、キャラ設定、リサーチなど', 
                    inline: false 
                },
                { 
                    name: '/作業評価', 
                    value: 'プロットやキャラ設定などの定性的な進捗を評価\n完成度を0-100%で記録し、トレンドを分析', 
                    inline: false 
                }
            )
            .setFooter({ text: 'まずは作品登録から始めましょう！' });

        await interaction.reply({ embeds: [embed] });

    } else if (category === '統計・分析') {
        const embed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle('📊 統計・分析機能')
            .addFields(
                { 
                    name: '/統計', 
                    value: '期間別執筆統計（今週・今月・先週・先月）\n総字数、執筆日数、平均字数、最高執筆日など', 
                    inline: false 
                },
                { 
                    name: '/詳細統計', 
                    value: '執筆と非執筆作業を含む詳細な統計\n作業種別内訳、作業継続率、文字ベースの作業パターンチャート', 
                    inline: false 
                },
                { 
                    name: '/ペース分析', 
                    value: '作品別の執筆ペース分析\n締切達成に必要な日次字数と現在ペースを比較\n予測完了日も算出', 
                    inline: false 
                },
                { 
                    name: '/執筆習慣', 
                    value: '執筆習慣と連続日数をトラッキング\n最近7日間の執筆パターンを文字グラフで表示', 
                    inline: false 
                },
                { 
                    name: '/アーカイブ', 
                    value: '完了作品の実績一覧\n執筆期間、達成率、日平均字数など詳細情報', 
                    inline: false 
                }
            )
            .setFooter({ text: '統計で執筆パターンを把握して効率アップ！' });

        await interaction.reply({ embeds: [embed] });

    } else if (category === '定期実行') {
        const embed = new EmbedBuilder()
            .setColor(0xff6b35)
            .setTitle('⏰ 定期実行機能')
            .addFields(
                { 
                    name: '📅 毎日19時', 
                    value: '進捗入力リマインダー\n進行中の作品がある場合、執筆を促すメッセージを自動送信', 
                    inline: false 
                },
                { 
                    name: '📊 毎週月曜9時', 
                    value: '先週の執筆レポート\n先週の統計と励ましメッセージを自動送信', 
                    inline: false 
                },
                { 
                    name: '🏆 毎月1日9時', 
                    value: '先月の振り返りレポート\n月間統計と達成状況を自動送信', 
                    inline: false 
                }
            )
            .setDescription('Replitの「Always On」機能で24時間稼働\n設定されたチャンネルに自動通知')
            .setFooter({ text: 'タイムゾーン: Asia/Tokyo（日本時間）' });

        await interaction.reply({ embeds: [embed] });

    } else if (category === 'コマンド例') {
        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('💡 コマンド使用例')
            .addFields(
                { 
                    name: '🚀 基本的な流れ', 
                    value: '```\n1. /作品登録 タイトル:短編小説 締切日:2025-08-01 目標字数:5000\n2. /ステータス変更 id:1 ステータス:着手中\n3. /進捗報告 id:1 字数:800 進捗種別:執筆\n4. /作業評価 id:1 評価項目:プロット完成度 完成度:80\n5. /作品一覧 （進捗確認）\n```', 
                    inline: false 
                },
                { 
                    name: '📊 統計活用例', 
                    value: '```\n/統計 期間:今週\n/詳細統計 期間:今月 進捗種別表示:True\n/ペース分析 id:1\n/執筆習慣\n/アーカイブ\n```', 
                    inline: false 
                },
                { 
                    name: '⚡ 非執筆作業の記録', 
                    value: '```\n/進捗報告 id:1 字数:0 進捗種別:プロット作成 メモ:登場人物の関係図完成\n/進捗報告 id:1 字数:0 進捗種別:リサーチ メモ:時代背景調査\n/作業評価 id:1 評価項目:キャラクター設定 完成度:70\n```', 
                    inline: false 
                },
                { 
                    name: '💡 活用のコツ', 
                    value: '• 毎日同じ時間に進捗報告（0字でもOK）\n• 週末に統計で振り返り\n• 作業評価で定性的な進捗も記録\n• ペース分析で計画調整\n• アーカイブで達成感を味わう', 
                    inline: false 
                },
                { 
                    name: '📝 効果的な目標設定', 
                    value: '• 現実的な目標字数を設定\n• 余裕のある締切設定\n• 毎日少しずつでも継続\n• 非執筆作業も大切な進捗として記録\n• 完了時は自分を褒める', 
                    inline: false 
                }
            )
            .setFooter({ text: '継続は力なり！小説執筆を楽しみましょう📚' });

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = {
    handleHelp
};
