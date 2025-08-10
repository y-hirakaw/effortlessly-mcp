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

### コード解析（LSP統合）
- シンボル検索、参照解析
- 依存関係分析、階層構造取得
- Java診断機能（基本）

### プロジェクト管理
- ワークスペース管理
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

### 📁 ワークスペース構造 (v1.0.7統合設計)

```
.claude/workspace/effortlessly/
├── config.yaml            # 🚀 NEW: 統合設定ファイル（全設定を一元管理）
├── logs/
│   ├── audit/             # 監査ログ
│   ├── error/             # エラーログ
│   └── debug/             # デバッグ情報
├── index/
│   ├── symbols.db         # 🚀 NEW: SQLiteシンボルインデックス
├── memory/                # プロジェクトメモリ（分類システム対応）
│   ├── generic/           # 🆕 汎用・再利用可能な知識
│   ├── project_specific/  # 🆕 effortlessly-mcp固有情報
│   ├── templates/         # 🆕 新規プロジェクト用テンプレート
│   ├── project_structure_index.md
│   ├── architecture_overview.md
│   └── [その他の固定インデックス...]
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
- **[ツールリファレンス](docs/TOOLS.md)** - 全23ツールの詳細仕様とAPI
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

最新の変更内容や機能追加については、[CHANGELOG.md](CHANGELOG.md)をご確認ください。

**最新リリース**: v1.0.9 (2025-08-10)
- 🧪 **Java LSP統合（検証中）** - Eclipse JDT Language Server統合による基本診断機能
- 🔧 **Java LSP診断ツール追加** - `java_lsp_basic_diagnostics`、`java_lsp_diagnostics`の2つの新ツール
- ⚡ **Phase 2A エラーハンドリング実装** - 基本的なエラー統計とヘルスチェック機能
- 🚀 **プロジェクトメモリ管理システム改善** - `project_update_workflow` → `project_memory_update_workflow` に改名
- 📂 **メモリ分類システム導入** - generic/project_specific/template の3カテゴリでナレッジ管理
- 🎯 **分類対応プロンプト生成** - 各カテゴリに特化した適切なプロンプト自動生成
- ⚡ **Swift LSP パフォーマンス向上** - タイムアウト時間最適化により安定性向上
- ✅ **テスト品質向上** - **551テスト全成功**、DiffLogger修正によりテスト信頼性向上

**v1.0.6 (2025-08-09)**
- 🎛️ **設定ファイル統合化** - 設定を `.claude/workspace/effortlessly/config.yaml` に統合
- ⚙️ **operationsログ制御** - `logging.operations.enabled` で操作ログの有効/無効を制御
- 🎨 **diffログ表示改善** - 常にカラーコード使用でログファイル視認性向上

**v1.0.4 (2025-08-08)**
- Insert diff機能の大幅強化とテスト拡充
- smart_edit_fileツールの安全性とパフォーマンス最適化 
- ログ出力量最適化によるClaude Code互換性改善
- FileSystemService Phase2A完全移行（LSP・プロジェクト管理・コード解析統合）

## 貢献・サポート

- **Issues**: [GitHub Issues](https://github.com/y-hirakaw/effortlessly-mcp/issues)
- **ドキュメント**: [完全ドキュメントスイート](docs/)

## ライセンス

MIT License
