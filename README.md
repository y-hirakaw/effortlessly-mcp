# effortlessly-mcp

エンタープライズ環境対応のMCP（Model Context Protocol）サーバーです。安全なコード解析とセマンティック検索機能を提供し、Claude Codeとの統合により高度な開発支援を実現します。

**主要な特徴**：
- 🔥 **21のMCPツール** - ファイル操作からLSP統合まで包括的サポート
- ⚡ **高性能LSP統合** - TypeScript/Swift対応、**LSP自動起動機能**
　- 今後の対応予定: Java, Kotlin, Go, Python
- 🚀 **統合ワークスペース管理** - 統合設定システムと自動インデックス
- 🛡️ **エンタープライズセキュリティ(開発中)** - 包括的なアクセス制御とログ監査
- 🧪 **フォールバック機能** - LSP障害時のテキストベース検索

## 機能

### 🛠️ コア機能（21のMCPツール）

#### 📁 **ファイル編集関係** (7ツール)
> **✨ v1.0.3-1.0.4 強化**: FileSystemService Phase2A完全移行により統一ファイル操作プロキシ実現
- `read_file` - ファイル内容読み取り（エンコーディング対応・部分読み取り・行番号表示）
- `list_directory` - ディレクトリ一覧取得（再帰・パターンフィルタ対応）
- `get_file_metadata` - ファイル/ディレクトリのメタデータ取得
- `search_files` - 高度なファイル検索（名前・内容・正規表現）
- `smart_edit_file` - 安全なファイル編集（Issue #1修正済み・絶対位置ベース置換・v1.0.3でさらなる安全性向上）
- `smart_insert_text` - 柔軟な位置指定テキスト挿入（v1.0.4でdiff機能大幅強化）
- `echo` - 接続テスト用

> **🚀 v1.0.7 NEW**: **LSP自動起動とワークスペース統合システム**
> - **ConfigManager**: 統合config.yaml設定管理システム
> - **LSPServerManager**: LSPプロキシサーバー自動起動・管理
> - **IndexService**: SQLiteベースシンボル・ファイルインデックス
> - **LSP自動起動**: 主要コード解析ツールでLSP自動起動対応
> - **高速化**: workspace_activate実行時間を大幅短縮（バックグラウンド処理）

#### 🔍 **LSPを利用前提のもの** (10ツール) 
> **⚡ v1.0.7**: 全ツールでLSP自動起動対応 - LSPサーバーが起動していない場合は自動で起動

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
> **🚀 v1.0.7**: workspace_activate大幅高速化とLSP/インデックス自動起動対応

- `workspace_activate` - プロジェクトワークスペース活性化（**LSP自動起動・インデックス自動作成**）
- `workspace_get_info` - 現在のワークスペース情報取得
- `workspace_list_all` - 登録済みワークスペース一覧
- `project_memory_write` - プロジェクト固有知識の永続化（**固定ファイル名対応**）
- `project_memory_read` - 保存された知識の取得（**5つの特化インデックス**）
- `project_memory_list` - 利用可能メモリ一覧
- `project_update_workflow` - プロジェクト更新ワークフロー生成

> **✨ v1.0.2 新機能**: 特化プロジェクトインデックスシステム
> - 固定ファイル名構造で常に最新情報にアクセス
> - 5つの専用インデックス: 構造/Manager/アーキテクチャ/セキュリティ/LSP統合

## クイックスタート

### 前提条件

- **Node.js** 20.0.0以上
- **npm** または **yarn**
- **LSPサーバー**（使用する言語、v1.0.8で設定簡素化）:
  ```bash
  # TypeScript（推奨・自動インストール対応）
  npm install -g typescript-language-server typescript
  
  # Swift（macOS、Xcodeがインストール済みなら自動利用可能）
  
  # Python（オプション）
  pip install python-lsp-server
  ```
  
  > **💡 v1.0.8**: `.claude/workspace/effortlessly/config.yaml`の`enabled_languages`で簡単に言語選択可能

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
│   └── files.db           # ファイルインデックス
├── memory/                # プロジェクトメモリ
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
- **[ログ・Diff設定ガイド](docs/LOGGING-CONFIGURATION.md)** - 操作ログとdiff表示の設定（v1.0.6新機能）
- **[セキュリティガイド](docs/SECURITY.md)** - エンタープライズセキュリティ設定

### 🛠️ 運用・保守
- **[トラブルシューティング](docs/TROUBLESHOOTING.md)** - 問題解決ガイド

### 📋 開発資料
- **[TypeScript LSP統合RDD](RDD_ts_lsp.md)** - LSP統合機能の詳細要求・実装状況

## ステータス

- ✅ **開発完了**: 全5フェーズ完了（FileSystemService Phase2A統合）
- ✅ **テスト検証**: 282テスト、100%成功（v1.0.4で包括テスト追加）
- ✅ **Claude Code互換性**: ログ出力最適化により安定動作
- 🧪 **Claude Code自動起動**: 検証中

## 📋 変更履歴

最新の変更内容や機能追加については、[CHANGELOG.md](CHANGELOG.md)をご確認ください。

**最新リリース**: v1.0.8 (2025-08-09)
- 🎯 **LSP設定システム改善** - 直感的な言語サーバー選択（`enabled_languages`リスト形式）
- 💡 **設定の簡素化** - コメントアウトによる簡単な有効/無効切り替え
- 📖 **設定ドキュメント強化** - 利用可能言語とセットアップ要件の明記
- 🚀 **LSP自動起動検証** - Claude Code再起動後の動作確認完了

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
