# effortlessly-mcp

Claude Code向けのMCP（Model Context Protocol）サーバーです。セキュアなファイル操作とコード解析機能を提供します。

## 主な機能

- **ファイル操作**: 読み取り、編集、検索、メタデータ取得
- **コード解析**: LSP統合による高精度な検索・参照・依存関係分析  
- **対応言語**: TypeScript、Swift、Java（基本機能）
- **プロジェクト管理**: ワークスペース管理、設定システム

## 利用可能なツール

### ファイル操作
- ファイル読み取り、編集、検索
- ディレクトリ一覧、メタデータ取得
- **ファイル完全上書き** (`override_text`): バックアップ機能付きの安全な上書き  

### コード解析（LSP統合）
- シンボル検索、参照解析
- 依存関係分析、階層構造取得
- Java診断機能（基本）

### プロジェクト管理
- ワークスペース管理（設定ファイル自動生成）
- プロジェクトメモリシステム

詳細は [docs/TOOLS.md](docs/TOOLS.md) を参照してください。

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

### 📁 ワークスペース構造 (v1.0.14階層型インデックス統合設計)

```
.claude/workspace/effortlessly/
├── config.yaml            # 統合設定ファイル（全設定を一元管理）
├── logs/
│   ├── audit/             # 監査ログ
│   ├── error/             # エラーログ
│   └── debug/             # デバッグ情報
├── index/                 # 🆕 階層型インデックス構造
│   ├── knowledge/         # 🆕 プロジェクト知識（汎用・再利用可能）
│   ├── project/           # 🆕 プロジェクト固有情報とテンプレート
│   ├── lsp_symbols/       # 🆕 LSPシンボルデータベース
│   │   └── symbols.db     # SQLiteシンボルインデックス
│   └── meta/              # 🆕 メタインデックス（目次・ナビゲーション）
├── backups/               # 自動バックアップ
└── temp/                  # 一時ファイル
```

> **v1.0.7 統合設計**: 個別設定ファイル（workspace.yaml, security.yaml等）を`config.yaml`に統合し、管理を簡素化

## 技術仕様

- **言語**: TypeScript (ES2022)
- **ランタイム**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk
- **テストフレームワーク**: Vitest（**551テスト、100%成功**）
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
- **[ツールリファレンス](docs/TOOLS.md)** - 全26ツールの詳細仕様とAPI
- **[APIドキュメント](docs/API.md)** - MCP統合とプロトコル詳細
- **[ログ・Diff設定ガイド](docs/LOGGING-CONFIGURATION.md)** - 操作ログとdiff表示の設定（v1.0.6新機能）
- **[セキュリティガイド](docs/SECURITY.md)** - エンタープライズセキュリティ設定

### 🛠️ 運用・保守
- **[トラブルシューティング](docs/TROUBLESHOOTING.md)** - 問題解決ガイド

### 📋 開発資料
- **[TypeScript LSP統合RDD](RDD_ts_lsp.md)** - LSP統合機能の詳細要求・実装状況

## ステータス

- ✅ **開発完了**: 全5フェーズ完了（FileSystemService Phase2A統合）
- ✅ **テスト検証**: **551テスト、100%成功**（v1.0.9でテスト品質大幅向上）
- ✅ **Claude Code互換性**: ログ出力最適化により安定動作
- 🧪 **Claude Code自動起動**: 検証中

## 📋 変更履歴

**v1.0.13** (2025-08-16) - Swift LSPフォールバック制御機能とMCPツールパラメータ修正

**v1.0.12** (2025-08-14) - Swift LSP統合パフォーマンス改善

**v1.0.11** (2025-08-14) - Swift LSP統合強化とoverride_text機能追加

**v1.0.10** (2025-08-11) - ワークスペース設定自動生成機能追加

**v1.0.9** (2025-08-10) - Java LSP統合とプロジェクトメモリ改善

詳細な変更履歴は [CHANGELOG.md](CHANGELOG.md) をご確認ください。

## 貢献・サポート

- **Issues**: [GitHub Issues](https://github.com/y-hirakaw/effortlessly-mcp/issues)
- **ドキュメント**: [完全ドキュメントスイート](docs/)

## ライセンス

MIT License
