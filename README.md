# effortlessly-mcp

Claude Code向けのMCP（Model Context Protocol）サーバーです。セキュアなファイル操作とプロジェクト管理機能を提供します。

## 主な機能

- **ファイル操作**: 高速で確実な読み取り、編集、検索、メタデータ取得 ✅ **本番対応**
- **プロジェクト管理**: AI駆動のメモリシステム、ワークスペース管理 ✅ **実用レベル**
- **コード解析**: LSP機能は廃止中（v2.0で実用性重視に方針転換）

## 利用可能なツール（15個）

### 基本ファイル操作（3個） ✅ **メイン機能**
- **read_file**: ファイル読み取り（UTF-8対応）
- **list_directory**: ディレクトリ一覧（再帰・パターン対応）
- **get_file_metadata**: ファイルメタデータ取得

### スマート編集（3個） ✅ **強化済み**
- **smart_edit_file**: 安全な置換・バックアップ機能
- **smart_insert_text**: 位置指定テキスト挿入
- **override_text**: バックアップ機能付きの安全な上書き

### AI検索システム（1個） 🚀 **NEW**
- **search_with_learning**: AI搭載の学習型高速検索
  - 検索パターン自動学習・最適化
  - ファイル変更検知による自動キャッシュ無効化

### スマート範囲最適化（1個） 🚀 **NEW**
- **smart_range_optimizer**: セマンティック検索統合の最適範囲検出
  - ONNXベースのセマンティック類似度スコアリング
  - Intent別のセマンティッククエリ生成
  - パターンマッチングとセマンティック検索のハイブリッド

### ワークスペース管理（3個） **再検討中**
- **workspace_activate**: ワークスペース有効化
- **workspace_get_info**: 現在のワークスペース情報取得
- **workspace_list_all**: 全ワークスペース一覧

### プロジェクトメモリ（5個）**再検討中**
- **project_memory_write/read**: プロジェクト知識の永続化・取得
- **project_memory_list**: 保存済みメモリ一覧
- **project_memory_smart_read**: AI駆動の最適メモリ自動検索・取得  
- **project_memory_update_workflow**: メモリ更新手順生成

### 🚫 廃止・非推奨機能
- ~~search_files~~ → search_with_learningに統合
- ~~echo~~ → デバッグ専用のため無効化
- ~~java_lsp_basic_diagnostics~~ → LSP機能廃止により無効化
- ~~optimize_search_query, get_search_statistics, update_search_patterns~~ → search_with_learningに統合
- ~~シンボル検索、参照解析、依存関係分析~~ → v2.0で無効化済み
- ~~階層構造取得、パターン検索~~ → 軽量化のため廃止
- ~~LSPベースのコード編集機能~~ → スマート編集機能に統合

**コンテキスト効率化**: 6個の検索ツールを1個に統合（83%削減）により、Claude Codeでの使用時のトークン消費量を大幅削減

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

## 技術仕様

- **言語**: TypeScript (ES2022)
- **ランタイム**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk
- **テストフレームワーク**: Vitest（**551テスト、100%成功**）
- **リンター**: ESLint v9 + TypeScript strict mode
- **設定形式**: YAML
- **データベース**: SQLite（シンボル・ファイルインデックス）

## 📚 ドキュメント

- **[Claude Code統合設定](docs/CLAUDE-CODE-INTEGRATION.md)** - CLAUDE.md推奨設定
- その他は整備中

## ステータス

- ✅ **本番対応**: ファイル操作・プロジェクト管理機能
- 🚀 **新機能**: SmartRangeOptimizer セマンティック検索統合
- 🚫 **廃止**: LSP機能（実用性重視の方針転換）

詳細な変更履歴は [CHANGELOG.md](CHANGELOG.md) をご確認ください。

## 貢献・サポート

- **Issues**: [GitHub Issues](https://github.com/y-hirakaw/effortlessly-mcp/issues)
- **ドキュメント**: [docs/](docs/)

## ライセンス

MIT License
