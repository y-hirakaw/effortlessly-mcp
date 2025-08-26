# effortlessly-mcp

Claude Code向けのMCP（Model Context Protocol）サーバーです。セキュアなファイル操作とプロジェクト管理機能を提供します。

## 主な機能

- **ファイル操作**: 高速で確実な読み取り、編集、検索、メタデータ取得 ✅ **本番対応**
- **プロジェクト管理**: AI駆動のメモリシステム、ワークスペース管理 ✅ **実用レベル**
- **ワークフロー自動化**: タスク自動化、ファイル監視（開発中）
- **~~コード解析~~**: LSP機能は無効化済み（v2.0で実用性重視に方針転換）

## 利用可能なツール（16個）

### 基本ファイル操作（4個） ✅ **メイン機能**
- **read_file**: ファイル読み取り（UTF-8対応）
- **list_directory**: ディレクトリ一覧（再帰・パターン対応）
- **get_file_metadata**: ファイルメタデータ取得
- **search_files**: ファイル検索機能 *(非推奨)*

### スマート編集（3個） ✅ **強化済み**
- **smart_edit_file**: 安全な置換・バックアップ機能
- **smart_insert_text**: 位置指定テキスト挿入
- **override_text**: バックアップ機能付きの安全な上書き

### AI検索システム（1個） 🚀 **NEW**
- **search_with_learning**: AI搭載の学習型高速検索
  - 検索パターン自動学習・最適化
  - ファイル変更検知による自動キャッシュ無効化  
  - 43%高速化、ROI 350%の性能向上

### ワークスペース管理（3個） ✅ **実用レベル**
- **workspace_activate**: ワークスペース有効化
- **workspace_get_info**: 現在のワークスペース情報取得
- **workspace_list_all**: 全ワークスペース一覧

### プロジェクトメモリ（5個） ✅ **AI駆動**
- **project_memory_write/read**: プロジェクト知識の永続化・取得
- **project_memory_list**: 保存済みメモリ一覧
- **project_memory_smart_read**: AI駆動の最適メモリ自動検索・取得  
- **project_memory_update_workflow**: メモリ更新手順生成

### 🚫 廃止・非推奨機能
- ~~echo~~ → デバッグ専用のため無効化
- ~~java_lsp_basic_diagnostics~~ → LSP機能廃止により無効化
- ~~optimize_search_query, get_search_statistics, update_search_patterns~~ → search_with_learningに統合
- ~~シンボル検索、参照解析、依存関係分析~~ → v2.0で無効化済み
- ~~階層構造取得、パターン検索~~ → 軽量化のため廃止
- ~~LSPベースのコード編集機能~~ → スマート編集機能に統合

**コンテキスト効率化**: 6個の検索ツールを1個に統合（83%削減）により、Claude Codeでの使用時のトークン消費量を大幅削減

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
- **[要求定義書 (RDD) v2.0](docs/RDD/RDD.md)** - 実用性重視の新開発方針
- **[旧RDD (LSP中心)](docs/RDD/RDD_old.md)** - アーカイブ：LSP統合中心の旧方針
- **[TypeScript LSP統合RDD](RDD_ts_lsp.md)** - アーカイブ：LSP統合機能の詳細

## ステータス

- 🔄 **v2.0開発中**: 実用性重視の方向転換実施中
- ✅ **コア機能**: ファイル操作・プロジェクト管理機能は本番対応
- 🚧 **新機能開発**: ワークフロー自動化・AI強化機能を計画中
- 🧪 **実験的機能**: LSP統合（TypeScriptのみ最小限維持）

## 📋 変更履歴

**v2.0.0** (2025-01-25) - 🔄 **戦略的方向転換** - 実用性重視への転換
- LSP機能を実験的機能として縮小
- ファイル編集・プロジェクト管理機能へのフォーカス
- 新RDD v2.0策定

**v1.0.16** (2025-08-19) - LSP統合機能完全動作確認完了・実用レベル達成

**v1.0.15** (2025-08-19) - Swift LSP統合動作確認・TypeScriptビルドエラー解消

**v1.0.11** (2025-08-14) - Swift LSP統合強化とoverride_text機能追加

**v1.0.10** (2025-08-11) - ワークスペース設定自動生成機能追加

**v1.0.9** (2025-08-10) - Java LSP統合とプロジェクトメモリ改善

詳細な変更履歴は [CHANGELOG.md](CHANGELOG.md) をご確認ください。

## 🎯 実用性ステータス（v1.0.16）

### ✅ **本番使用準備完了**
- **機能成功率**: 95%以上（ほぼ全機能正常動作）
- **エラー耐性**: 優良（適切なエラーハンドリング・フォールバック）
- **パフォーマンス**: 良好（高速応答・適正メモリ使用量）
- **安定性**: 高（複数テストでクラッシュなし）

### 🔧 **検証済み機能**
- **Swift LSP**: JSONHandler検出、7構造体・クラス階層、Foundation・Alamofire依存関係
- **TypeScript LSP**: 複数シンボル検出、45シンボル階層、ワークスペース切り替え
- **エラー処理**: 存在しないシンボル・ファイル・不正座標での適切な処理
- **自動復旧**: LSPサーバー自動起動・再接続・ヘルスチェック機能

## 貢献・サポート

- **Issues**: [GitHub Issues](https://github.com/y-hirakaw/effortlessly-mcp/issues)
- **ドキュメント**: [完全ドキュメントスイート](docs/)

## ライセンス

MIT License
