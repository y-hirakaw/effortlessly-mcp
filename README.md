# effortlessly-mcp

エンタープライズ環境対応のMCP（Model Context Protocol）サーバーです。安全なコード解析とセマンティック検索機能を提供し、Claude Codeとの統合により高度な開発支援を実現します。

**主要な特徴**：
- 🔥 **21のMCPツール** - ファイル操作からLSP統合まで包括的サポート
- ⚡ **高性能LSP統合** - TypeScript/Swift対応
　- 今後の対応予定: Java, Kotlin, Go, Python
- 🛡️ **エンタープライズセキュリティ(開発中)** - 包括的なアクセス制御とログ監査
- 🧪 **フォールバック機能** - LSP障害時のテキストベース検索

## 機能

### 🛠️ コア機能（21のMCPツール）

#### 📁 **ファイル編集関係** (7ツール)
- `read_file` - ファイル内容読み取り（エンコーディング対応）
- `list_directory` - ディレクトリ一覧取得（再帰・パターンフィルタ対応）
- `get_file_metadata` - ファイル/ディレクトリのメタデータ取得
- `search_files` - 高度なファイル検索（名前・内容・正規表現）
- `smart_edit_file` - 安全なファイル編集（バックアップ・プレビュー付き）
- `smart_insert_text` - 柔軟な位置指定テキスト挿入
- `echo` - 接続テスト用

#### 🔍 **LSPを利用前提のもの** (10ツール)
- `code_find_symbol` - シンボル検索（関数、クラス、変数等）
- `code_find_references` - 参照検索とコード解析
- `code_get_symbol_hierarchy` - シンボル階層構造取得
- `code_analyze_dependencies` - 依存関係分析とグラフ生成
- `code_search_pattern` - 高度パターン検索（正規表現）
- `code_find_referencing_symbols` - シンボル参照元検索
- `code_get_symbols_overview` - シンボル構造概要取得
- `code_replace_symbol_body` - シンボル本体置換
- `code_insert_at_symbol` - シンボル位置コード挿入
- `code_replace_with_regex` - 正規表現によるコード置換

#### 🗃️ **プロジェクトメモリ化関連** (7ツール)
- `workspace_activate` - プロジェクトワークスペース活性化
- `workspace_get_info` - 現在のワークスペース情報取得
- `workspace_list_all` - 登録済みワークスペース一覧
- `project_memory_write` - プロジェクト固有知識の永続化
- `project_memory_read` - 保存された知識の取得
- `project_memory_list` - 利用可能メモリ一覧
- `project_update_workflow` - プロジェクト更新ワークフロー生成

## クイックスタート

### 前提条件

- **Node.js** 20.0.0以上
- **npm** または **yarn**
- **LSPサーバー**（使用する言語）:
  ```bash
  # TypeScript（推奨）
  npm install -g typescript-language-server typescript
  
  # Swift（macOS、オプション）
  # Xcodeがインストール済みの場合は自動で利用可能
  ```

### インストール

#### 方法1: 開発版（現在推奨）

```bash
# リポジトリをクローン
git clone https://github.com/y-hirakaw/effortlessly-mcp.git
cd effortlessly-mcp

# 依存関係のインストールとビルド
npm install
npm run build
```

#### 方法2: パッケージインストール（将来版）

- npxで提供予定

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

## アーキテクチャ

### 🏗️ システム構成

```
Claude Code Client
    ↓ (MCP over stdio)
MCP Server (effortlessly-mcp)
    ↓ (HTTP REST API)
LSP Proxy Server (localhost:3001)
    ↓ (LSP over stdio)
TypeScript/Go/Java/C++ LSP Servers
```

### 📁 ワークスペース構造

```
.claude/workspace/effortlessly/
├── config/
│   ├── workspace.yaml      # ワークスペース設定
│   ├── security.yaml       # セキュリティ設定
│   └── whitelist.yaml      # アクセス制御
├── logs/
│   ├── audit/             # 監査ログ
│   ├── error/             # エラーログ
│   └── debug/             # デバッグ情報
├── index/
│   ├── symbols.db         # シンボルインデックス
│   └── files.db           # ファイルインデックス
└── temp/                  # 一時ファイル
```

## 技術仕様

- **言語**: TypeScript (ES2022)
- **ランタイム**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk
- **テストフレームワーク**: Vitest（282テスト、100%成功）
- **リンター**: ESLint v9 + TypeScript strict mode
- **設定形式**: YAML
- **データベース**: SQLite（シンボル・ファイルインデックス）

## 📚 詳細ドキュメント

### 🚀 はじめに
- **[セットアップガイド](docs/SETUP.md)** - 完全なインストール・設定手順
- **[使い方ガイド](docs/USAGE.md)** - 実践的な使用方法と活用例

### 🏗️ 言語別開発ガイド
- **[TypeScript開発ガイド](docs/TYPESCRIPT-GUIDE.md)** - TypeScript Language Server統合による開発支援
- **[Swift開発ガイド](docs/SWIFT-GUIDE.md)** - SourceKit-LSP統合によるSwift開発支援

### 📖 技術資料
- **[ツールリファレンス](docs/TOOLS.md)** - 全21ツールの詳細仕様とAPI
- **[APIドキュメント](docs/API.md)** - MCP統合とプロトコル詳細
- **[セキュリティガイド](docs/SECURITY.md)** - エンタープライズセキュリティ設定

### 🛠️ 運用・保守
- **[トラブルシューティング](docs/TROUBLESHOOTING.md)** - 問題解決ガイド

### 📋 開発資料
- **[TypeScript LSP統合RDD](RDD_ts_lsp.md)** - LSP統合機能の詳細要求・実装状況

## ステータス

- ✅ **開発完了**: 全5フェーズ完了
- ✅ **テスト検証**: 282テスト、100%成功
- ✅ **本番対応**: エンタープライズ導入可能
- 🧪 **Claude Code自動起動**: 検証中

## 貢献・サポート

- **Issues**: [GitHub Issues](https://github.com/y-hirakaw/effortlessly-mcp/issues)
- **ドキュメント**: [完全ドキュメントスイート](docs/)
- **セキュリティ**: security@effortlessly-mcp.dev

## ライセンス

MIT License
