# effortlessly-mcp

Claude Code向けのMCP（Model Context Protocol）サーバーです。セキュアなファイル操作とプロジェクト管理機能を提供します。

## 主な機能

- **セキュアファイル操作**: 読み取り、編集、検索、メタデータ取得
- **AI搭載プロジェクト管理**: スマートメモリシステム、ワークスペース管理
- **学習型検索システム**: パターン学習による高速検索

## 利用可能なツール（16個）

### 🔍 AI搭載検索システム
- **search_with_learning**: 学習型高速検索
  - 検索パターン自動学習
  - ファイル変更検知・自動キャッシュ更新
  - 統合検索（ファイル名・内容・パターン）

### 📁 基本ファイル操作
- **read_file**: ファイル読み取り（UTF-8対応・部分読み取り）
- **list_directory**: ディレクトリ一覧（再帰・パターン対応）
- **get_file_metadata**: ファイル詳細情報取得

### ✏️ スマート編集システム
- **smart_edit_file**: 安全な置換（バックアップ・プレビュー機能付き）
- **smart_insert_text**: 柔軟な位置指定テキスト挿入
- **override_text**: ファイル完全置換（バックアップ機能付き）

### 🧠 プロジェクトメモリ
- **project_memory_write/read**: プロジェクト知識の永続化・取得
- **project_memory_list**: 保存済みメモリ一覧・統計
- **project_memory_smart_read**: AI駆動の最適メモリ検索
- **project_memory_update_workflow**: メモリ更新手順生成

### 🏢 ワークスペース管理
- **workspace_setup**: ワークスペース初期化・設定

### 📏 最適化ツール
- **smart_range_optimizer**: AI駆動の最適読み込み範囲提案

## セットアップ

### 前提条件
- Node.js 20.0.0以上

### インストール

```bash
git clone https://github.com/y-hirakaw/effortlessly-mcp.git
cd effortlessly-mcp
npm install
npm run build
```

### Claude Code統合設定

effortlessly-mcpをClaude Codeで使用するには、Claude Codeの設定ファイルに以下を追加：

**現在推奨の設定**:
```json
{
  "mcpServers": {
    "effortlessly-mcp": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/your/effortlessly-mcp/build/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

> **📝 注意**: `/path/to/your/effortlessly-mcp/build/index.js` は実際のクローンしたディレクトリのパスに置き換えてください。

### ワークスペース構造

effortlessly-mcpは `.claude/workspace/effortlessly/` 配下にデータを管理します：

```
.claude/workspace/effortlessly/
├── config/              # 設定ファイル
├── memory/              # プロジェクト知識・メモリ
├── search_index/        # 検索インデックス（SQLite）
├── logs/                # 監査ログ
├── backups/             # バックアップファイル
└── temp/                # 一時ファイル
```
## トラブルシューティング

### 起動時エラーのデバッグ

MCPサーバーが起動時にエラーになった場合、以下の場所に詳細なエラーログが自動的に保存されます：

```
.claude/workspace/effortlessly/logs/startup-errors/startup-error-[timestamp].txt
```

エラーログには以下の情報が含まれます：
- エラーメッセージとスタックトレース
- Node.jsバージョンとプラットフォーム情報
- 現在のディレクトリ
- 環境変数（デバッグ用）

また、コンソール（標準エラー出力）にもタイムスタンプ付きのリアルタイムログが出力されます。


## セキュリティ

- **パス検証**: シンボリックリンク検知・パストラバーサル攻撃防止
- **ファイルサイズ制限**: DoS攻撃防止のためのサイズ制限
- **オフライン動作**: 外部通信なし

## 技術仕様

- **言語**: TypeScript (ES2022)
- **ランタイム**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk v1.17+
- **データベース**: SQLite（検索インデックス）
- **設定**: YAML形式

## 詳細情報

- **ツールリファレンス**: [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md)
- **変更履歴**: [CHANGELOG.md](CHANGELOG.md)
- **Claude Code統合**: [CLAUDE.md](CLAUDE.md)

## 貢献・サポート

- **Issues**: [GitHub Issues](https://github.com/y-hirakaw/effortlessly-mcp/issues)
- **ドキュメント**: [docs/](docs/)

## Third-Party Models

このプロジェクトには以下のサードパーティモデルが含まれています：

- **all-MiniLM-L6-v2**: sentence-transformers 埋め込みモデル
  - ライセンス: Apache License 2.0
  - 元モデル: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
  - 用途: セマンティック検索・類似度計算
  - ファイル: `models/all-MiniLM-L6-v2/`

## ライセンス

MIT License
