const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const { sheets } = require('./basic');
const { findWorkById, getNextWorkId, createWorkSheet, updateStatistics } = require('../utils/database');

// 作品登録処理
async function handleWorkRegistration(interaction) {
    await interaction.deferReply();

    try {
        const title = interaction.options.getString('タイトル');
        const deadline = interaction.options.getString('締切日');
        const theme = interaction.options.getString('テーマ') || '';
        const charLimit = interaction.options.getInteger('字数制限') || '';
        const targetChars = interaction.options.getInteger('目標字数') || '';
        const memo = interaction.options.getString('備考') || '';

        // 日付形式チェック
        if (!moment(deadline, 'YYYY-MM-DD', true).isValid()) {
            await interaction.editReply('❌ 締切日は YYYY-MM-DD 形式で入力してください。（例: 2025-08-01）');
            return;
        }

        // 次のIDを取得
        const nextId = await getNextWorkId();

        // スプレッドシートに登録
        const today = moment().format('YYYY-MM-DD');
        const values = [
            [nextId, title, deadline, theme, charLimit, targetChars, memo, today, '', '未着手', 0]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
            valueInputOption: 'RAW',
            resource: { values }
        });

        // 成功メッセージ
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ 作品登録完了')
            .addFields(
                { name: 'タイトル', value: title, inline: true },
                { name: '締切日', value: deadline, inline: true },
                { name: 'ID', value: nextId.toString(), inline: true }
            )
            .setTimestamp();

        if (theme) embed.addFields({ name: 'テーマ', value: theme, inline: true });
        if (charLimit) embed.addFields({ name: '字数制限', value: charLimit.toString(), inline: true });
        if (targetChars) embed.addFields({ name: '目標字数', value: targetChars.toString(), inline: true });
        if (memo) embed.addFields({ name: '備考', value: memo, inline: false });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('作品登録エラー:', error);
        await interaction.editReply('❌ 作品登録中にエラーが発生しました。');
    }
}

// 作品一覧表示
async function handleWorkList(interaction) {
    await interaction.deferReply();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: '作品管理!A:K',
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            await interaction.editReply('📚 登録されている作品はありません。');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📚 作品一覧')
            .setTimestamp();

        let description = '';

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const id = row[0];
            const title = row[1];
            const deadline = row[2];
            const status = row[9] || '未着手';
            const progress = row[10] || 0;
            const targetChars = row[5] || 0;

            // 締切までの日数計算
            const deadlineDate = moment(deadline, 'YYYY-MM-DD');
            const today = moment();
            const daysLeft = deadlineDate.diff(today, 'days');

            let statusEmoji = '';
            switch (status) {
                case '未着手': statusEmoji = '⏸️'; break;
                case '着手中': statusEmoji = '✍️'; break;
                case '完了': statusEmoji = '✅'; break;
                default: statusEmoji = '❓'; break;
            }

            let deadlineText = '';
            if (daysLeft > 0) {
                deadlineText = `あと${daysLeft}日`;
            } else if (daysLeft === 0) {
                deadlineText = '今日が締切';
            } else {
                deadlineText = `${Math.abs(daysLeft)}日経過`;
            }

            const progressRate = targetChars > 0 ? Math.round((progress / targetChars) * 100) : 0;

            description += `${statusEmoji} **${title}** (ID: ${id})\n`;
            description += `📅 ${deadline} (${deadlineText}) | 進捗: ${progressRate}%\n\n`;
        }

        embed.setDescription(description);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('作品一覧取得エラー:', error);
        await interaction.editReply('❌ 作品一覧の取得中にエラーが発生しました。');
    }
}

// ステータス変更処理
async function handleStatusChange(interaction) {
    await interaction.deferReply();

    try {
        const workId = interaction.options.getInteger('id');
        const newStatus = interaction.options.getString('ステータス');

        // 作品を検索
        const workData = await findWorkById(workId);
        if (!workData) {
            await interaction.editReply(`❌ ID ${workId} の作品が見つかりません。`);
            return;
        }

        const oldStatus = workData.status;
        const title = workData.title;

        // ステータス更新
        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `作品管理!J${workData.rowIndex}`,
            valueInputOption: 'RAW',
            resource: { values: [[newStatus]] }
        });

        // 完了日更新（完了時のみ）
        if (newStatus === '完了') {
            const today = moment().format('YYYY-MM-DD');
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `作品管理!I${workData.rowIndex}`,
                valueInputOption: 'RAW',
                resource: { values: [[today]] }
            });
        }

        // 着手中になった場合、個別シートを作成
        if (newStatus === '着手中' && oldStatus !== '着手中') {
            await createWorkSheet(workId, title, workData.targetChars);
        }

        // 成功メッセージ
        const embed = new EmbedBuilder()
            .setColor(newStatus === '完了' ? 0xffd700 : 0x00ff00)
            .setTitle(`${newStatus === '完了' ? '🎉' : '✅'} ステータス変更完了`)
            .addFields(
                { name: '作品', value: title, inline: true },
                { name: '変更', value: `${oldStatus} → ${newStatus}`, inline: true }
            )
            .setTimestamp();

        if (newStatus === '完了') {
            embed.setDescription('🎊 おめでとうございます！作品が完了しました！素晴らしい達成です！');
        } else if (newStatus === '着手中') {
            embed.setDescription('✍️ 執筆開始ですね！頑張ってください！個別の進捗管理シートを作成しました。');
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('ステータス変更エラー:', error);
        await interaction.editReply('❌ ステータス変更中にエラーが発生しました。');
    }
}

// 進捗報告処理
async function handleProgressReport(interaction) {
    await interaction.deferReply();

    try {
        const workId = interaction.options.getInteger('id');
        const todayChars = interaction.options.getInteger('字数');
        const progressType = interaction.options.getString('進捗種別') || '執筆';
        const memo = interaction.options.getString('メモ') || '';

        // 作品を検索
        const workData = await findWorkById(workId);
        if (!workData) {
            await interaction.editReply(`❌ ID ${workId} の作品が見つかりません。`);
            return;
        }

        if (workData.status !== '着手中') {
            await interaction.editReply('❌ この作品は「着手中」ステータスではありません。');
            return;
        }

        const title = workData.title;
        const targetChars = workData.targetChars || 0;
        const currentTotal = workData.totalChars || 0;
        const newTotal = currentTotal + todayChars;

        // 個別シートに進捗記録
        const today = moment().format('YYYY-MM-DD');
        const progressRate = targetChars > 0 ? Math.round((newTotal / targetChars) * 100) : 0;

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${title}!A:F`,
            valueInputOption: 'RAW',
            resource: { 
                values: [[today, todayChars, newTotal, progressRate, memo, progressType]]
            }
        });

        // 作品管理シートの総字数更新
        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `作品管理!K${workData.rowIndex}`,
            valueInputOption: 'RAW',
            resource: { values: [[newTotal]] }
        });

        // 執筆統計を更新
        await updateStatistics(today, todayChars, progressType);

        // 励ましメッセージ
        let encouragement = '';
        if (todayChars > 0) {
            if (progressRate >= 100) {
                encouragement = '🎉 目標達成おめでとうございます！素晴らしい成果です！';
            } else if (progressRate >= 75) {
                encouragement = '🔥 もうすぐゴールですね！最後まで頑張って！';
            } else if (progressRate >= 50) {
                encouragement = '💪 半分を超えました！このペースで続けましょう！';
            } else if (progressRate >= 25) {
                encouragement = '✨ 順調に進んでいますね！継続は力なりです！';
            } else {
                encouragement = '📝 今日も執筆お疲れ様でした！積み重ねが大切です！';
            }
        } else {
            switch (progressType) {
                case 'プロット作成':
                    encouragement = '🗺️ プロット作業お疲れ様！構成がしっかりしていると執筆がスムーズになります！';
                    break;
                case 'キャラ設定':
                    encouragement = '👤 キャラクター設定お疲れ様！魅力的なキャラは物語の核心です！';
                    break;
                case 'リサーチ':
                    encouragement = '🔍 リサーチお疲れ様！深い知識は作品の説得力を高めます！';
                    break;
                case '推敲・校正':
                    encouragement = '✏️ 推敲作業お疲れ様！細部への気配りが作品を輝かせます！';
                    break;
                case 'アイデア出し':
                    encouragement = '💡 アイデア出しお疲れ様！創造性を育む大切な時間でした！';
                    break;
                default:
                    encouragement = '⚡ 今日も作品に向き合ってくださってありがとうございます！すべての作業が執筆につながります！';
            }
        }

        const typeEmoji = {
            '執筆': '✍️',
            'プロット作成': '🗺️',
            'キャラ設定': '👤',
            'リサーチ': '🔍',
            '推敲・校正': '✏️',
            'アイデア出し': '💡',
            'その他': '⚡'
        };

        const embed = new EmbedBuilder()
            .setColor(todayChars > 0 ? 0x00ff00 : 0x4ecdc4)
            .setTitle(`${typeEmoji[progressType] || '📝'} 進捗報告受理`)
            .addFields(
                { name: '作品', value: title, inline: true },
                { name: '進捗種別', value: progressType, inline: true },
                { name: '今日の字数', value: `${todayChars}字`, inline: true }
            )
            .setDescription(encouragement)
            .setTimestamp();

        if (todayChars > 0) {
            embed.addFields(
                { name: '総字数', value: `${newTotal}字`, inline: true },
                { name: '目標', value: targetChars > 0 ? `${targetChars}字` : '未設定', inline: true },
                { name: '進捗率', value: `${progressRate}%`, inline: true },
                { name: '残り', value: targetChars > 0 ? `${Math.max(0, targetChars - newTotal)}字` : '-', inline: true }
            );
        } else {
            embed.
