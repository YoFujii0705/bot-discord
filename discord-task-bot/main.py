from dotenv import load_dotenv
import os

load_dotenv()

# 他のimport文
import discord
from discord.ext import commands, tasks
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import json
import asyncio
from datetime import datetime, time
from flask import Flask
import threading

# .envファイルを読み込む（Secretsが使えない場合）
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenvがない場合はスキップ

# FlaskアプリでUptimeRobot用のWebサーバー
app = Flask(__name__)

@app.route('/')
def home():
    return "Discord Task Bot is running! 🤖"

@app.route('/health')
def health():
    return {
        "status": "healthy", 
        "bot_ready": bot.is_ready() if 'bot' in globals() else False,
        "timestamp": datetime.now().isoformat()
    }

@app.route('/ping')
def ping():
    return "pong"

def run_flask():
    try:
        print("🌐 Flaskサーバーを起動中...")
        app.run(host='0.0.0.0', port=8080, debug=False, use_reloader=False, threaded=True)
    except Exception as e:
        print(f"❌ Flaskサーバーエラー: {e}")

# DiscordBot設定
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

SPREADSHEET_ID = os.environ.get('SPREADSHEET_ID')
SHEET_NAME = 'tasks'

def setup_google_sheets():
    try:
        # 環境変数チェック
        credentials_json = os.environ.get('GOOGLE_SERVICE_KEY')
        if not credentials_json:
            print("❌ GOOGLE_SERVICE_KEY環境変数が見つかりません")
            return None

        if not SPREADSHEET_ID:
            print("❌ SPREADSHEET_ID環境変数が見つかりません")
            return None

        # JSON解析
        try:
            credentials_dict = json.loads(credentials_json)
        except json.JSONDecodeError as e:
            print(f"❌ Google認証JSON解析エラー: {e}")
            return None

        # スコープ設定
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]

        # 認証情報作成
        try:
            creds = ServiceAccountCredentials.from_json_keyfile_dict(credentials_dict, scope)
            client = gspread.authorize(creds)
        except Exception as e:
            print(f"❌ Google認証エラー: {e}")
            return None

        # スプレッドシート接続
        try:
            spreadsheet = client.open_by_key(SPREADSHEET_ID)
            print(f"✅ スプレッドシート接続成功: {spreadsheet.title}")
        except Exception as e:
            print(f"❌ スプレッドシート接続エラー: {e}")
            print(f"   SPREADSHEET_ID: {SPREADSHEET_ID}")
            return None

        # ワークシート取得
        try:
            sheet = spreadsheet.worksheet(SHEET_NAME)
            print(f"✅ ワークシート接続成功: {SHEET_NAME}")
            return sheet
        except gspread.WorksheetNotFound:
            print(f"❌ ワークシート '{SHEET_NAME}' が見つかりません")
            print(f"   利用可能なシート: {[ws.title for ws in spreadsheet.worksheets()]}")
            # tasksシートがない場合は作成
            try:
                sheet = spreadsheet.add_worksheet(title=SHEET_NAME, rows=1000, cols=10)
                sheet.append_row(['タスク名', '作成日', '完了', '完了日', 'ユーザーID', 'ユーザー名'])
                print(f"✅ ワークシート '{SHEET_NAME}' を作成しました")
                return sheet
            except Exception as create_error:
                print(f"❌ ワークシート作成エラー: {create_error}")
                return None
        except Exception as e:
            print(f"❌ ワークシート取得エラー: {e}")
            return None

    except Exception as e:
        print(f"❌ Google Sheets設定エラー: {e}")
        return None

@bot.event
async def on_ready():
    print(f'🤖 {bot.user} がオンラインになりました！')

    # シート初期化チェック
    sheet = setup_google_sheets()
    if sheet:
        try:
            headers = sheet.row_values(1)
            if not headers or headers[0] != 'タスク名':
                sheet.clear()
                sheet.append_row(['タスク名', '作成日', '完了', '完了日', 'ユーザーID', 'ユーザー名'])
                print("✅ スプレッドシート初期化完了")
        except Exception as e:
            print(f"❌ 初期化エラー: {e}")

    # 毎日通知開始
    if not daily_reminder.is_running():
        daily_reminder.start()
        print("⏰ 毎日通知を開始しました")

@bot.command(name='addtask')
async def add_task(ctx, *, task_name):
    try:
        sheet = setup_google_sheets()
        if not sheet:
            await ctx.send("❌ スプレッドシートに接続できません")
            return

        now = datetime.now().strftime('%Y/%m/%d %H:%M:%S')

        sheet.append_row([
            task_name,
            now,
            'FALSE',
            '',
            str(ctx.author.id),
            ctx.author.display_name
        ])

        embed = discord.Embed(
            title="✅ タスク追加完了",
            description=f"**{task_name}**",
            color=0x00ff00
        )
        embed.set_author(name=ctx.author.display_name)

        await ctx.send(embed=embed)
        print(f"✅ タスク追加: {task_name} by {ctx.author.display_name}")

    except Exception as e:
        await ctx.send(f"❌ エラー: {str(e)}")
        print(f"❌ タスク追加エラー: {e}")

@bot.command(name='tasks')
async def list_tasks(ctx):
    try:
        sheet = setup_google_sheets()
        if not sheet:
            await ctx.send("❌ スプレッドシートに接続できません")
            return

        all_values = sheet.get_all_values()

        if len(all_values) <= 1:
            await ctx.send("📋 現在、タスクはありません")
            return

        user_tasks = []
        for i, row in enumerate(all_values[1:], start=2):
            if len(row) >= 6 and row[4] == str(ctx.author.id) and row[2] != 'TRUE':
                user_tasks.append({
                    'row': i,
                    'name': row[0],
                    'created': row[1]
                })

        if not user_tasks:
            embed = discord.Embed(
                title="🎊 素晴らしい！",
                description="未完了のタスクはありません！",
                color=0xffd700
            )
            await ctx.send(embed=embed)
            return

        # メッセージ分割処理
        max_tasks_per_message = 5
        tasks_chunks = [user_tasks[i:i + max_tasks_per_message] for i in range(0, len(user_tasks), max_tasks_per_message)]

        for chunk_index, chunk in enumerate(tasks_chunks):
            embed = discord.Embed(
                title=f"📋 {ctx.author.display_name}さんのタスク ({chunk_index + 1}/{len(tasks_chunks)})",
                color=0x3498db
            )

            task_list = ""
            for i, task in enumerate(chunk):
                global_index = chunk_index * max_tasks_per_message + i + 1
                task_list += f"**{global_index}.** {task['name']}\n　📅 {task['created']}\n\n"

            embed.description = task_list
            if chunk_index == len(tasks_chunks) - 1:  # 最後のメッセージにのみフッターを追加
                embed.set_footer(text="完了: !complete [番号] | 例: !complete 1")

            await ctx.send(embed=embed)
            if chunk_index < len(tasks_chunks) - 1:  # 最後以外は少し間隔を空ける
                await asyncio.sleep(1)

    except Exception as e:
        await ctx.send(f"❌ エラー: {str(e)}")
        print(f"❌ タスク一覧エラー: {e}")

@bot.command(name='alltasks')
async def all_tasks(ctx):
    try:
        sheet = setup_google_sheets()
        if not sheet:
            await ctx.send("❌ スプレッドシートに接続できません")
            return

        all_values = sheet.get_all_values()

        if len(all_values) <= 1:
            await ctx.send("📋 現在、タスクはありません")
            return

        user_tasks = {}
        for row in all_values[1:]:
            if len(row) >= 6 and row[2] != 'TRUE':
                user_name = row[5]
                if user_name not in user_tasks:
                    user_tasks[user_name] = []
                user_tasks[user_name].append(row[0])

        if not user_tasks:
            embed = discord.Embed(
                title="🎊 全員完了！",
                description="すべてのタスクが完了しています！",
                color=0x00ff00
            )
            await ctx.send(embed=embed)
            return

        # メッセージ分割処理（1人あたり最大表示タスク数を増やす）
        max_message_length = 1800
        current_message = "📊 **全体タスク状況**\n\n"

        for user_name, tasks in user_tasks.items():
            user_section = f"**{user_name}さん ({len(tasks)}件):**\n"

            # 全てのタスクを表示（省略なし）
            for i, task in enumerate(tasks):
                task_line = f"• {task}\n"
                # メッセージ長制限チェック
                if len(current_message + user_section + task_line) > max_message_length:
                    # 現在のメッセージを送信
                    await ctx.send(current_message)
                    await asyncio.sleep(1)
                    current_message = "📊 **全体タスク状況（続き）**\n\n"
                    user_section = f"**{user_name}さん ({len(tasks)}件):**\n"

                user_section += task_line

            user_section += "\n"
            current_message += user_section

        # 最後のメッセージを送信
        if current_message.strip():
            await ctx.send(current_message)

    except Exception as e:
        await ctx.send(f"❌ エラー: {str(e)}")
        print(f"❌ 全タスク一覧エラー: {e}")

@bot.command(name='complete')
async def complete_task(ctx, task_number: int):
    try:
        sheet = setup_google_sheets()
        if not sheet:
            await ctx.send("❌ スプレッドシートに接続できません")
            return

        all_values = sheet.get_all_values()

        user_tasks = []
        for i, row in enumerate(all_values[1:], start=2):
            if len(row) >= 6 and row[4] == str(ctx.author.id) and row[2] != 'TRUE':
                user_tasks.append({'row': i, 'name': row[0]})

        if not user_tasks:
            await ctx.send("❌ 完了可能なタスクがありません")
            return

        if task_number < 1 or task_number > len(user_tasks):
            await ctx.send(f"❌ 無効な番号です (1-{len(user_tasks)})")
            return

        target_task = user_tasks[task_number - 1]
        target_row = target_task['row']
        now = datetime.now().strftime('%Y/%m/%d %H:%M:%S')

        sheet.update_cell(target_row, 3, 'TRUE')
        sheet.update_cell(target_row, 4, now)

        embed = discord.Embed(
            title="🎉 タスク完了！",
            description=f"**{target_task['name']}**\n\nお疲れさまでした！",
            color=0xffd700
        )
        embed.set_author(name=ctx.author.display_name)

        await ctx.send(embed=embed)
        print(f"✅ タスク完了: {target_task['name']} by {ctx.author.display_name}")

    except ValueError:
        await ctx.send("❌ 有効な番号を入力してください")
    except Exception as e:
        await ctx.send(f"❌ エラー: {str(e)}")
        print(f"❌ タスク完了エラー: {e}")

@bot.command(name='taskstats')
async def task_stats(ctx):
    """タスク統計情報を表示"""
    try:
        sheet = setup_google_sheets()
        if not sheet:
            await ctx.send("❌ スプレッドシートに接続できません")
            return

        all_values = sheet.get_all_values()

        if len(all_values) <= 1:
            await ctx.send("📊 まだタスクが登録されていません")
            return

        total_tasks = 0
        completed_tasks = 0
        user_stats = {}

        for row in all_values[1:]:
            if len(row) >= 6:
                user_name = row[5]
                is_completed = row[2] == 'TRUE'

                if user_name not in user_stats:
                    user_stats[user_name] = {'total': 0, 'completed': 0, 'pending': 0}

                user_stats[user_name]['total'] += 1
                total_tasks += 1

                if is_completed:
                    user_stats[user_name]['completed'] += 1
                    completed_tasks += 1
                else:
                    user_stats[user_name]['pending'] += 1

        embed = discord.Embed(
            title="📊 タスク統計",
            color=0x3498db
        )

        # 全体統計
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        embed.add_field(
            name="🌍 全体統計",
            value=f"総タスク数: {total_tasks}\n完了: {completed_tasks}\n未完了: {total_tasks - completed_tasks}\n完了率: {completion_rate:.1f}%",
            inline=False
        )

        # ユーザー別統計
        user_stats_text = ""
        for user_name, stats in user_stats.items():
            user_completion_rate = (stats['completed'] / stats['total'] * 100) if stats['total'] > 0 else 0
            user_stats_text += f"**{user_name}**: {stats['pending']}件未完了 ({user_completion_rate:.1f}%完了)\n"

        embed.add_field(
            name="👥 ユーザー別",
            value=user_stats_text if user_stats_text else "データなし",
            inline=False
        )

        await ctx.send(embed=embed)

    except Exception as e:
        await ctx.send(f"❌ 統計エラー: {str(e)}")

@bot.command(name='clearcompleted')
async def clear_completed_tasks(ctx):
    """完了済みタスクを削除（管理者用）"""
    try:
        sheet = setup_google_sheets()
        if not sheet:
            await ctx.send("❌ スプレッドシートに接続できません")
            return

        all_values = sheet.get_all_values()
        if len(all_values) <= 1:
            await ctx.send("📋 削除するタスクがありません")
            return

        # 完了済みタスクをカウント
        completed_count = 0
        for row in all_values[1:]:
            if len(row) >= 3 and row[2] == 'TRUE':
                completed_count += 1

        if completed_count == 0:
            await ctx.send("✅ 完了済みタスクはありません")
            return

        # 確認メッセージ
        embed = discord.Embed(
            title="⚠️ 確認",
            description=f"{completed_count}件の完了済みタスクを削除しますか？\n\n✅ `yes` または ❌ `no` で回答してください",
            color=0xff9500
        )
        await ctx.send(embed=embed)

        def check(message):
            return message.author == ctx.author and message.channel == ctx.channel and message.content.lower() in ['yes', 'no']

        try:
            response = await bot.wait_for('message', check=check, timeout=30.0)

            if response.content.lower() == 'yes':
                # ヘッダーと未完了タスクのみを保持
                new_data = [all_values[0]]  # ヘッダー行
                for row in all_values[1:]:
                    if len(row) >= 3 and row[2] != 'TRUE':
                        new_data.append(row)

                # シートをクリアして新しいデータを書き込み
                sheet.clear()
                sheet.update('A1', new_data)

                embed = discord.Embed(
                    title="🗑️ 削除完了",
                    description=f"{completed_count}件の完了済みタスクを削除しました",
                    color=0x00ff00
                )
                await ctx.send(embed=embed)
            else:
                await ctx.send("❌ 削除をキャンセルしました")

        except asyncio.TimeoutError:
            await ctx.send("⏰ タイムアウトしました。削除をキャンセルします")

    except Exception as e:
        await ctx.send(f"❌ 削除エラー: {str(e)}")

@tasks.loop(time=time(hour=0, minute=0))  # 日本時間の朝9時の場合は hour=0 (UTC)
async def daily_reminder():
    try:
        channel_id = os.environ.get('NOTIFICATION_CHANNEL_ID')
        if not channel_id:
            print("⚠️ 通知チャンネルIDが設定されていません")
            return

        channel = bot.get_channel(int(channel_id))
        if not channel:
            print("⚠️ 通知チャンネルが見つかりません")
            return

        sheet = setup_google_sheets()
        if not sheet:
            print("❌ スプレッドシートに接続できません")
            return

        all_values = sheet.get_all_values()

        if len(all_values) <= 1:
            return

        user_task_count = {}

        for row in all_values[1:]:
            if len(row) >= 6 and row[2] != 'TRUE':
                user_name = row[5]
                user_task_count[user_name] = user_task_count.get(user_name, 0) + 1

        if not user_task_count:
            embed = discord.Embed(
                title="🌅 おはようございます！",
                description="現在、未完了のタスクはありません！",
                color=0x00ff00
            )
            await channel.send(embed=embed)
            return

        embed = discord.Embed(
            title="🌅 おはようございます！",
            description="今日のタスク状況をお知らせします",
            color=0xff9500
        )

        reminder_text = ""
        for user_name, count in user_task_count.items():
            reminder_text += f"📝 **{user_name}さん**: {count}件\n"

        embed.add_field(
            name="未完了タスク",
            value=reminder_text,
            inline=False
        )

        embed.add_field(
            name="📱 コマンド",
            value="`!tasks` - 自分のタスク確認\n`!alltasks` - 全体状況",
            inline=False
        )

        await channel.send(embed=embed)
        print("📢 毎日通知を送信しました")

    except Exception as e:
        print(f"❌ 毎日通知エラー: {e}")

@bot.command(name='taskhelp')
async def help_command(ctx):
    embed = discord.Embed(
        title="🤖 タスク管理Bot",
        description="Discordでタスク管理を簡単に！",
        color=0x3498db
    )

    embed.add_field(
        name="📝 基本コマンド",
        value="`!addtask [内容]` - タスク追加\n`!tasks` - 自分のタスク確認\n`!complete [番号]` - タスク完了",
        inline=False
    )

    embed.add_field(
        name="📊 確認コマンド",
        value="`!alltasks` - 全員のタスク状況\n`!taskstats` - 統計情報",
        inline=False
    )

    embed.add_field(
        name="🔧 管理コマンド",
        value="`!clearcompleted` - 完了済みタスク削除\n`!debug` - デバッグ情報",
        inline=False
    )

    embed.add_field(
        name="🔔 自動機能",
        value="毎日朝に未完了タスクを通知",
        inline=False
    )

    embed.set_footer(text="例: !addtask 買い物に行く")

    await ctx.send(embed=embed)

@bot.command(name='testconnection')
async def test_connection(ctx):
    """Google Sheets接続テスト専用コマンド"""
    try:
        await ctx.send("🔍 **Google Sheets接続テスト開始**")

        # 1. 環境変数確認
        spreadsheet_id = os.environ.get('SPREADSHEET_ID')
        google_key = os.environ.get('GOOGLE_SERVICE_KEY')

        if not spreadsheet_id:
            await ctx.send("❌ **SPREADSHEET_ID が設定されていません**")
            return

        if not google_key:
            await ctx.send("❌ **GOOGLE_SERVICE_KEY が設定されていません**")
            return

        await ctx.send(f"✅ 環境変数: 設定済み")
        await ctx.send(f"📋 スプレッドシートID: `{spreadsheet_id[:20]}...`")

        # 2. JSON解析テスト
        try:
            credentials_dict = json.loads(google_key)
            await ctx.send("✅ JSON解析: 成功")
            await ctx.send(f"📧 Service Email: `{credentials_dict.get('client_email', 'なし')}`")
        except json.JSONDecodeError as e:
            await ctx.send(f"❌ JSON解析エラー: {str(e)}")
            return

        # 3. Google認証テスト
        try:
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]
            creds = ServiceAccountCredentials.from_json_keyfile_dict(credentials_dict, scope)
            client = gspread.authorize(creds)
            await ctx.send("✅ Google認証: 成功")
        except Exception as auth_error:
            await ctx.send(f"❌ Google認証エラー: {str(auth_error)}")
            return

        # 4. スプレッドシート接続テスト
        try:
            spreadsheet = client.open_by_key(spreadsheet_id)
            await ctx.send(f"✅ スプレッドシート接続: 成功")
            await ctx.send(f"📝 スプレッドシート名: `{spreadsheet.title}`")

            # 全シート一覧
            worksheets = spreadsheet.worksheets()
            sheet_names = [ws.title for ws in worksheets]
            await ctx.send(f"📄 利用可能なシート: {sheet_names}")

        except Exception as sheet_error:
            await ctx.send(f"❌ スプレッドシート接続エラー: {str(sheet_error)}")
            await ctx.send("🔧 **確認事項**:")
            await ctx.send("1. スプレッドシートIDが正しいか")
            await ctx.send("2. サービスアカウントがスプレッドシートにアクセス権を持っているか")
            await ctx.send("3. スプレッドシートが削除されていないか")
            return

        # 5. ワークシート接続テスト
        try:
            worksheet = spreadsheet.worksheet(SHEET_NAME)
            await ctx.send(f"✅ ワークシート '{SHEET_NAME}': 存在")

            # データ確認
            all_values = worksheet.get_all_values()
            await ctx.send(f"📊 データ行数: {len(all_values)}")

            if len(all_values) > 0:
                await ctx.send(f"📋 ヘッダー: {all_values[0]}")

        except gspread.WorksheetNotFound:
            await ctx.send(f"⚠️ ワークシート '{SHEET_NAME}' が存在しません")
            await ctx.send("🔧 **自動作成を試行中...**")

            try:
                new_sheet = spreadsheet.add_worksheet(title=SHEET_NAME, rows=1000, cols=10)
                new_sheet.append_row(['タスク名', '作成日', '完了', '完了日', 'ユーザーID', 'ユーザー名'])
                await ctx.send(f"✅ ワークシート '{SHEET_NAME}' を作成しました")
            except Exception as create_error:
                await ctx.send(f"❌ ワークシート作成エラー: {str(create_error)}")
                return

        except Exception as ws_error:
            await ctx.send(f"❌ ワークシートエラー: {str(ws_error)}")
            return

        await ctx.send("🎉 **すべてのテストが成功しました！**")
        await ctx.send("💡 **`!alltasks` などのコマンドが使用可能になりました**")

    except Exception as e:
        await ctx.send(f"❌ **テスト実行エラー**: {str(e)}")

@bot.command(name='fixsheet')
async def fix_sheet(ctx):
    """シート問題を自動修正"""
    try:
        await ctx.send("🔧 **シート修復開始**")

        # Google Sheets接続
        credentials_json = os.environ.get('GOOGLE_SERVICE_KEY')
        credentials_dict = json.loads(credentials_json)
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        creds = ServiceAccountCredentials.from_json_keyfile_dict(credentials_dict, scope)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        await ctx.send(f"✅ スプレッドシート接続: {spreadsheet.title}")

        # tasksシートの存在確認
        try:
            worksheet = spreadsheet.worksheet(SHEET_NAME)
            await ctx.send(f"✅ '{SHEET_NAME}' シートは存在します")

            # ヘッダー確認
            headers = worksheet.row_values(1)
            expected_headers = ['タスク名', '作成日', '完了', '完了日', 'ユーザーID', 'ユーザー名']

            if headers != expected_headers:
                await ctx.send("🔧 ヘッダーを修正中...")
                worksheet.clear()
                worksheet.append_row(expected_headers)
                await ctx.send("✅ ヘッダー修正完了")
            else:
                await ctx.send("✅ ヘッダーは正常です")

        except gspread.WorksheetNotFound:
            await ctx.send(f"⚠️ '{SHEET_NAME}' シートが見つかりません - 作成中...")
            worksheet = spreadsheet.add_worksheet(title=SHEET_NAME, rows=1000, cols=10)
            worksheet.append_row(['タスク名', '作成日', '完了', '完了日', 'ユーザーID', 'ユーザー名'])
            await ctx.send("✅ シート作成完了")

        await ctx.send("🎉 **修復完了！** `!alltasks` を試してください")

    except Exception as e:
        await ctx.send(f"❌ 修復エラー: {str(e)}")

@bot.command(name='checkpermissions')
async def check_permissions(ctx):
    """スプレッドシートの権限確認"""
    try:
        await ctx.send("🔍 **権限確認開始**")

        # Google Sheets接続
        credentials_json = os.environ.get('GOOGLE_SERVICE_KEY')
        credentials_dict = json.loads(credentials_json)
        service_email = credentials_dict.get('client_email', 'なし')

        await ctx.send(f"📧 **サービスアカウント**: `{service_email}`")
        await ctx.send("🔧 **確認事項**:")
        await ctx.send("1. Google Sheetsでスプレッドシートを開く")
        await ctx.send("2. 右上の「共有」ボタンをクリック")
        await ctx.send(f"3. `{service_email}` が編集者として追加されているか確認")
        await ctx.send("4. 追加されていない場合は編集者として追加")

        # スプレッドシートURLも提供
        spreadsheet_url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit"
        await ctx.send(f"🔗 **スプレッドシートURL**: {spreadsheet_url}")

    except Exception as e:
        await ctx.send(f"❌ 権限確認エラー: {str(e)}")
    """デバッグ情報を表示"""
    try:
        spreadsheet_id = os.environ.get('SPREADSHEET_ID')
        google_key = os.environ.get('GOOGLE_SERVICE_KEY')

        debug_info = f"🔍 **デバッグ情報**\n\n"
        debug_info += f"📊 SPREADSHEET_ID: {'✅ 設定済み' if spreadsheet_id else '❌ 未設定'}\n"
        debug_info += f"🔑 GOOGLE_SERVICE_KEY: {'✅ 設定済み' if google_key else '❌ 未設定'}\n\n"

        if spreadsheet_id:
            debug_info += f"📋 スプレッドシートID: `{spreadsheet_id[:20]}...`\n\n"

        if google_key:
            try:
                credentials_dict = json.loads(google_key)
                debug_info += f"🔐 JSON解析: ✅ 成功\n"
                debug_info += f"📧 Client Email: `{credentials_dict.get('client_email', 'なし')}`\n"
                debug_info += f"🆔 Project ID: `{credentials_dict.get('project_id', 'なし')}`\n\n"

                scope = [
                    'https://spreadsheets.google.com/feeds',
                    'https://www.googleapis.com/auth/drive'
                ]

                creds = ServiceAccountCredentials.from_json_keyfile_dict(credentials_dict, scope)
                client = gspread.authorize(creds)
                debug_info += f"🌐 Google認証: ✅ 成功\n"

                try:
                    spreadsheet = client.open_by_key(spreadsheet_id)
                    debug_info += f"📊 スプレッドシート接続: ✅ 成功\n"
                    debug_info += f"📝 スプレッドシート名: `{spreadsheet.title}`\n"

                    try:
                        worksheet = spreadsheet.worksheet(SHEET_NAME)
                        debug_info += f"📄 ワークシート '{SHEET_NAME}': ✅ 存在\n"

                        headers = worksheet.row_values(1)
                        debug_info += f"📋 ヘッダー: {headers if headers else '空'}\n"

                        all_values = worksheet.get_all_values()
                        debug_info += f"📊 データ行数: {len(all_values)}\n"

                    except gspread.WorksheetNotFound:
                        debug_info += f"📄 ワークシート '{SHEET_NAME}': ❌ 存在しない\n"
                        debug_info += f"🔧 利用可能なシート: {[ws.title for ws in spreadsheet.worksheets()]}\n"

                except Exception as sheet_error:
                    debug_info += f"📊 スプレッドシート接続: ❌ 失敗\n"
                    debug_info += f"📝 エラー詳細: `{str(sheet_error)}`\n"

            except json.JSONDecodeError as json_error:
                debug_info += f"🔐 JSON解析: ❌ 失敗\n"
                debug_info += f"📝 エラー詳細: `{str(json_error)}`\n"

        await ctx.send(debug_info)

    except Exception as e:
        await ctx.send(f"❌ デバッグエラー: {str(e)}")

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.MissingRequiredArgument):
        await ctx.send("❌ 引数が不足しています。`!taskhelp` で確認してください")
    elif isinstance(error, commands.CommandNotFound):
        return
    else:
        await ctx.send(f"❌ エラーが発生しました: {str(error)}")
        print(f"❌ コマンドエラー: {error}")

if __name__ == "__main__":
    token = os.environ.get('DISCORD_BOT_TOKEN')
    if not token:
        print("❌ DISCORD_BOT_TOKEN が設定されていません")
    else:
        print("🚀 Botを起動中...")

        # FlaskサーバーをバックグラウンドでStart
        flask_thread = threading.Thread(target=run_flask, daemon=True)
        flask_thread.start()
        print("🌐 Webサーバー起動完了 (ポート: 8080)")

        # DiscordBot起動
        bot.run(token)
