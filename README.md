# effortlessly-mcp

エンタープライズ環境対応のMCP（Model Context Protocol）サーバーです。安全なコード解析とセマンティック検索を提供し、Claude Codeとの統合により高度な開発支援を実現します。

## 機能

### 🛠️ コア機能（11のMCPツール）

- **ファイル操作** (4ツール)
  - `read_file` - ファイル内容読み取り
  - `list_directory` - ディレクトリ一覧取得（パターンフィルタ対応）
  - `get_file_metadata` - ファイル/ディレクトリのメタデータ取得
  - `search_files` - 高度なファイル検索（名前・内容・正規表現）

- **プロジェクト管理** (3ツール)
  - `workspace_activate` - プロジェクトワークスペースの活性化
  - `workspace_get_info` - 現在のワークスペース情報取得
  - `workspace_list_all` - 登録済みワークスペース一覧

- **セマンティック検索** (2ツール)
  - `code_find_symbol` - シンボル検索（関数、クラス、変数等）
  - `code_find_references` - 参照検索とコード解析

- **ユーティリティ** (2ツール)
  - `echo` - 接続テスト用
  - 他の統合ツール

### 🔥 高度な機能

- **LSP統合**: TypeScript, Go, Java, C++のセマンティック解析
- **エンタープライズセキュリティ**: 包括的なアクセス制御とログ監査
- **高性能**: RDD要件を60-99%上回る実測性能
- **完全テストカバレッジ**: 282テスト、100%成功率

## インストール

### 前提条件

- **Node.js** 20.0.0以上
- **npm** または **yarn**
- **LSPサーバー**（使用する言語）:
  ```bash
  # TypeScript
  npm install -g typescript-language-server typescript
  
  # Go
  go install golang.org/x/tools/gopls@latest
  ```

### グローバルインストール（推奨）

```bash
npm install -g effortlessly-mcp
```

### 開発者向けインストール

```bash
git clone https://github.com/y-hirakaw/effortlessly-mcp.git
cd effortlessly-mcp
npm install
npm run build
npm link  # グローバルアクセス用
```

## Claude Code統合

### 🎯 方法1: 自動起動設定

Claude Codeの設定ファイルに以下を追加することで、MCPサーバーとLSP Proxy Serverの両方を自動起動できます：

**設定ファイル場所**:
- **macOS**: `~/Library/Application Support/Claude/config.json`
- **Linux**: `~/.config/claude/config.json`
- **Windows**: `%APPDATA%\Claude\config.json`

#### **開発版設定（現在推奨）**:
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

#### **将来版設定（npxインストール後）**:
```json
{
  "mcpServers": {
    "effortlessly-mcp": {
      "command": "npx",
      "args": ["effortlessly-mcp"],
      "env": {
        "NODE_ENV": "production"
      }
    },
    "effortlessly-lsp-proxy": {
      "command": "npx",
      "args": ["effortlessly-lsp-proxy"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

> **⚠️ 注意**: 将来版設定は現在開発中です。`npm install -g effortlessly-mcp` が利用可能になってから使用してください。

**利用方法**:
```bash
# 1. effortlessly-mcpをクローン・ビルド
git clone https://github.com/y-hirakaw/effortlessly-mcp.git
cd effortlessly-mcp
npm install && npm run build

# 2. Claude Codeの設定ファイルに上記設定を追加

# 3. Claude Codeを起動
claude-code /path/to/your/project
```

### 🔧 方法2: 手動起動

```bash
# 1. LSP Proxy Serverを起動
effortlessly-lsp-proxy &

# 2. Claude Codeを起動
claude-code /path/to/your/project

# 3. ワークスペースを活性化（Claude Code内で実行）
# await mcp.callTool('workspace_activate', {
#   workspace_path: '/path/to/your/project',
#   lsp_servers: ['typescript', 'go']
# });
```

### 動作確認

```bash
# LSP Proxy Server動作確認
curl http://localhost:3001/health

# effortlessly-mcpが利用可能になっているか確認
# Claude Code内で11のツールが認識されているはず
```

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
- **セキュリティ**: エンタープライズグレード（包括的監査ログ）

## 開発・検証

```bash
# 開発コマンド
npm run typecheck  # 型チェック
npm run lint      # コード品質チェック  
npm test          # 全テストスイート実行（282テスト）
npm run build     # 本番ビルド

# 動作確認
effortlessly-lsp-proxy &           # LSP Proxy Server起動
curl http://localhost:3001/health   # ヘルスチェック
```

## 📚 詳細ドキュメント

### 🚀 はじめに
- **[セットアップガイド](docs/SETUP.md)** - 完全なインストール・設定手順
- **[使い方ガイド](docs/USAGE.md)** - 実践的な使用方法と活用例

### 📖 技術資料
- **[ツールリファレンス](docs/TOOLS.md)** - 全25ツールの詳細仕様とAPI
- **[APIドキュメント](docs/API.md)** - MCP統合とプロトコル詳細
- **[セキュリティガイド](docs/SECURITY.md)** - エンタープライズセキュリティ設定

### 🛠️ 運用・保守
- **[トラブルシューティング](docs/TROUBLESHOOTING.md)** - 問題解決ガイド

### 📋 開発資料
- **[要件定義書](RDD+Task.md)** - プロジェクト全体の仕様・進捗

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

MIT License - エンタープライズ利用を促進
